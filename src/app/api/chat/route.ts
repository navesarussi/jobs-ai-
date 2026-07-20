import { after } from "next/server";
import {
  applyEmployeeTurn,
  applyEmployerTurn,
  prepareEmployeeTurn,
  prepareEmployerTurn,
  type ChatTurnResult,
} from "@/application/chat";
import { refreshStoreMatches } from "@/application/employer-actions";
import type { StoreData } from "@/domain/types";
import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { writeStore, writeMatches } from "@/infrastructure/store";
import { hasGeminiKey } from "@/infrastructure/ai/schemas";
import {
  extractEmployeePatch,
  extractEmployerPatch,
  streamEmployeeReply,
  streamEmployerReply,
} from "@/infrastructure/ai/intake";
import {
  heuristicEmployeeIntake,
  heuristicEmployerIntake,
} from "@/infrastructure/ai/heuristic";

const encoder = new TextEncoder();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Controller = ReadableStreamDefaultController<Uint8Array>;

/** One NDJSON frame per line. */
function frame(controller: Controller, obj: unknown): void {
  controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
}

/** Reveal a precomputed (heuristic) reply word-by-word so it still feels live. */
async function emitTyping(controller: Controller, text: string): Promise<void> {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (const part of parts) {
    frame(controller, { type: "delta", text: part });
    await sleep(16);
  }
}

/** Persist the turn and refresh matches off the user's critical path. */
async function persistTurn(result: ChatTurnResult): Promise<void> {
  await writeStore(result.store);
  const refreshMatches = async () => {
    try {
      await writeMatches(refreshStoreMatches(result.store).matches);
    } catch (err) {
      console.error("deferred match refresh failed", err);
    }
  };
  // Prefer running after the response finishes; fall back to inline if the
  // request scope is unavailable inside the stream.
  try {
    after(refreshMatches);
  } catch {
    await refreshMatches();
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      role?: "employee" | "employer";
      message?: string;
      jobId?: string;
    };
    if (!body.userId || !body.message?.trim()) {
      return ok({ error: "חסרים פרטים" }, { status: 400 });
    }
    const gate = await assertActor(body.userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    const store = gate.store;
    const userId = body.userId;
    const user = store.users.find((u) => u.id === userId);
    if (!user) return ok({ error: "משתמש לא נמצא" }, { status: 404 });

    const role = user.role;
    if (body.role && body.role !== role) {
      return ok(
        { error: "התפקיד לא תואם לסשן הפעיל. חזרו למסך הכניסה והתחילו מחדש." },
        { status: 409 },
      );
    }

    const message = body.message.trim();
    const aiMode = hasGeminiKey() ? "gemini" : "heuristic";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const result =
            role === "employee"
              ? await runEmployeeStream(controller, store, userId, message)
              : await runEmployerStream(controller, store, userId, message, body.jobId);

          await persistTurn(result);
          frame(controller, {
            type: "final",
            reply: result.reply,
            provider: result.provider,
            aiMode,
            role,
            card: result.card,
            chat: result.chat,
            pendingQuestions: result.pendingQuestions,
            jobId: result.jobId,
          });
        } catch (err) {
          console.error("chat stream failed", err);
          frame(controller, { type: "error", error: "אירעה שגיאה בשיחה. נסו שוב." });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Content-Type-Options": "nosniff",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return fail(e);
  }
}

async function runEmployeeStream(
  controller: Controller,
  store: StoreData,
  userId: string,
  message: string,
): Promise<ChatTurnResult> {
  const prep = prepareEmployeeTurn(store, userId);

  if (!hasGeminiKey()) {
    const h = heuristicEmployeeIntake(message, prep.card, prep.pendingQuestions, prep.chat);
    await emitTyping(controller, h.reply);
    return applyEmployeeTurn({
      store,
      userId,
      message,
      reply: h.reply,
      candidatePatch: h.candidatePatch,
      fieldAnswers: h.fieldAnswers,
      provider: "heuristic",
    });
  }

  // Extract the card in parallel so its latency hides behind the reply stream.
  const patchPromise = extractEmployeePatch({
    message,
    card: prep.card,
    chat: prep.chat,
    pendingQuestions: prep.pendingQuestions,
    systemPrompt: prep.systemPrompt,
  });

  let replyText = "";
  let provider: "gemini" | "heuristic" = "gemini";
  try {
    const { textStream } = streamEmployeeReply({
      message,
      card: prep.card,
      chat: prep.chat,
      pendingQuestions: prep.pendingQuestions,
      systemPrompt: prep.systemPrompt,
    });
    for await (const delta of textStream) {
      if (!delta) continue;
      replyText += delta;
      frame(controller, { type: "delta", text: delta });
    }
  } catch (err) {
    console.error("gemini employee reply stream failed", err);
  }

  const patch = await patchPromise;

  if (!replyText.trim()) {
    // Reply stream produced nothing → fall back to a heuristic reply.
    provider = "heuristic";
    const h = heuristicEmployeeIntake(message, prep.card, prep.pendingQuestions, prep.chat);
    replyText = h.reply;
    await emitTyping(controller, h.reply);
  }

  return applyEmployeeTurn({
    store,
    userId,
    message,
    reply: replyText,
    candidatePatch: patch.candidatePatch,
    fieldAnswers: patch.fieldAnswers,
    usage: patch.usage,
    provider,
  });
}

async function runEmployerStream(
  controller: Controller,
  store: StoreData,
  userId: string,
  message: string,
  jobId?: string,
): Promise<ChatTurnResult> {
  const prep = prepareEmployerTurn(store, userId, jobId);

  if (!hasGeminiKey()) {
    const h = heuristicEmployerIntake(message, prep.card, prep.chat);
    await emitTyping(controller, h.reply);
    return applyEmployerTurn({
      store,
      userId,
      message,
      reply: h.reply,
      jobPatch: h.jobPatch,
      provider: "heuristic",
      jobId: prep.jobId,
    });
  }

  const patchPromise = extractEmployerPatch({
    message,
    card: prep.card,
    chat: prep.chat,
    systemPrompt: prep.systemPrompt,
  });

  let replyText = "";
  let provider: "gemini" | "heuristic" = "gemini";
  try {
    const { textStream } = streamEmployerReply({
      message,
      card: prep.card,
      chat: prep.chat,
      systemPrompt: prep.systemPrompt,
    });
    for await (const delta of textStream) {
      if (!delta) continue;
      replyText += delta;
      frame(controller, { type: "delta", text: delta });
    }
  } catch (err) {
    console.error("gemini employer reply stream failed", err);
  }

  const patch = await patchPromise;

  if (!replyText.trim()) {
    provider = "heuristic";
    const h = heuristicEmployerIntake(message, prep.card, prep.chat);
    replyText = h.reply;
    await emitTyping(controller, h.reply);
  }

  return applyEmployerTurn({
    store,
    userId,
    message,
    reply: replyText,
    jobPatch: patch.jobPatch,
    usage: patch.usage,
    provider,
    jobId: prep.jobId,
  });
}
