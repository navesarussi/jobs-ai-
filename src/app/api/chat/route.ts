import { after } from "next/server";
import { handleEmployeeChat, handleEmployerChat } from "@/application/chat";
import { employeeHasCv } from "@/domain/candidate-mini-card";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";
import type { CandidateCard } from "@/domain/types";
import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { rebuildAndWriteMatches } from "@/infrastructure/store";
import {
  persistEmployeeTurn,
  persistEmployerTurn,
} from "@/infrastructure/db/scoped-store";
import { hasGeminiKey } from "@/infrastructure/ai/schemas";

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
    const user = store.users.find((u) => u.id === body.userId);
    if (!user) return ok({ error: "משתמש לא נמצא" }, { status: 404 });

    const role = user.role;
    if (body.role && body.role !== role) {
      return ok(
        { error: "התפקיד לא תואם לסשן הפעיל. חזרו למסך הכניסה והתחילו מחדש." },
        { status: 409 },
      );
    }

    if (role === "employee") {
      const emp = store.employees.find((e) => e.userId === body.userId);
      if (!employeeHasCv(emp?.cv)) {
        return ok(
          { error: "יש להעלות קורות חיים לפני תחילת השיחה." },
          { status: 422 },
        );
      }
    }

    const result =
      role === "employee"
        ? await handleEmployeeChat(store, body.userId, body.message.trim())
        : await handleEmployerChat(store, body.userId, body.message.trim(), body.jobId);

    if (role === "employee") {
      const emp = result.store.employees.find((e) => e.userId === body.userId);
      await persistEmployeeTurn({
        store: result.store,
        userId: body.userId,
        card: result.card as CandidateCard,
        pendingFieldQuestionIds: emp?.pendingFieldQuestionIds ?? [],
        cv: result.cv,
        newMessages: result.newMessages,
        newFieldAnswers: result.newFieldAnswers,
        usageRecord: result.usageRecord,
      });
    } else {
      const raw = result.store.employers.find((e) => e.userId === body.userId);
      if (raw) {
        const employer = normalizeEmployerRecord(raw);
        await persistEmployerTurn({
          store: result.store,
          userId: body.userId,
          card: employer.card,
          jobs: employer.jobs,
          activeJobId: employer.activeJobId,
          jobId: result.jobId ?? employer.activeJobId,
          newMessages: result.newMessages,
          usageRecord: result.usageRecord,
        });
      }
    }

    // Rebuild from a fresh matching snapshot — actor slice must not drive global matches.
    after(async () => {
      try {
        await rebuildAndWriteMatches();
      } catch (err) {
        console.error("deferred match refresh failed", err);
      }
    });

    return ok({
      reply: result.reply,
      provider: result.provider,
      aiMode: hasGeminiKey() ? "gemini" : "heuristic",
      aiDegraded: result.aiDegraded ?? false,
      role,
      card: result.card,
      chat: result.chat,
      pendingQuestions: result.pendingQuestions,
      jobId: result.jobId,
    });
  } catch (e) {
    return fail(e);
  }
}
