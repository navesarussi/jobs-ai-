import { after } from "next/server";
import {
  applyEmployeeTurn,
  applyEmployerTurn,
  prepareEmployeeTurn,
  prepareEmployerTurn,
  type ChatTurnResult,
} from "@/application/chat";
import { employeeHasCv } from "@/domain/candidate-mini-card";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";
import type { CandidateCard, StoreData } from "@/domain/types";
import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import {
  persistEmployeeTurn,
  persistEmployerTurn,
} from "@/infrastructure/db/scoped-store";
import { scheduleMatchRebuild } from "@/infrastructure/db/match-scheduler";
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

export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Controller = ReadableStreamDefaultController<Uint8Array>;

function frame(controller: Controller, obj: unknown): void {
  controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
}

async function emitTyping(controller: Controller, text: string): Promise<void> {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (const part of parts) {
    frame(controller, { type: "delta", text: part });
    await sleep(12);
  }
}

async function persistTurn(
  role: "employee" | "employer",
  userId: string,
  result: ChatTurnResult,
): Promise<void> {
  if (role === "employee") {
    const emp = result.store.employees.find((e) => e.userId === userId);
    await persistEmployeeTurn({
      store: result.store,
      userId,
      card: result.card as CandidateCard,
      pendingFieldQuestionIds: emp?.pendingFieldQuestionIds ?? [],
      cv: result.cv,
      newMessages: result.newMessages,
      newFieldAnswers: result.newFieldAnswers,
      usageRecord: result.usageRecord,
    });
  } else {
    const raw = result.store.employers.find((e) => e.userId === userId);
    if (!raw) return;
    const employer = normalizeEmployerRecord(raw);
    await persistEmployerTurn({
      store: result.store,
      userId,
      card: employer.card,
      jobs: employer.jobs,
      activeJobId: employer.activeJobId,
      jobId: result.jobId ?? employer.activeJobId,
      newMessages: result.newMessages,
      usageRecord: result.usageRecord,
    });
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

    if (role === "employee") {
      const emp = store.employees.find((e) => e.userId === userId);
      if (!employeeHasCv(emp?.cv)) {
        return ok(
          { error: "יש להעלות קורות חיים לפני תחילת השיחה." },
          { status: 422 },
        );
      }
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

          await persistTurn(role, userId, result);
          after(() => {
            scheduleMatchRebuild();
          });

          frame(controller, {
            type: "final",
            reply: result.reply,
            provider: result.provider,
            aiMode,
            aiDegraded: result.aiDegraded ?? false,
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

  const patchPromise = extractEmployeePatch({
    message,
    card: prep.card,
    chat: prep.chat,
    pendingQuestions: prep.pendingQuestions,
    systemPrompt: prep.systemPrompt,
    pendingConflicts: prep.pendingConflicts,
  });

  let replyText = "";
  let provider: "gemini" | "heuristic" = "gemini";
  let degraded = false;
  try {
    const { textStream } = streamEmployeeReply({
      message,
      card: prep.card,
      chat: prep.chat,
      pendingQuestions: prep.pendingQuestions,
      systemPrompt: prep.systemPrompt,
      pendingConflicts: prep.pendingConflicts,
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
    provider = "heuristic";
    degraded = true;
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
    aiDegraded: degraded,
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
  let degraded = false;
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
    degraded = true;
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
    aiDegraded: degraded,
    jobId: prep.jobId,
  });
}
