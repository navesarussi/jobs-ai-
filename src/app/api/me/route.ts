import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { hasGeminiKey } from "@/infrastructure/ai/schemas";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const jobId = url.searchParams.get("jobId") ?? undefined;
    if (!userId) return ok({ error: "חסר userId" }, { status: 400 });
    const gate = await assertActor(userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });
    const store = gate.store;
    const user = store.users.find((u) => u.id === userId);
    if (!user) return ok({ error: "משתמש לא נמצא" }, { status: 404 });
    if (user.role === "employee") {
      const emp = store.employees.find((e) => e.userId === userId);
      const pending = store.fieldQuestions.filter((q) =>
        emp?.pendingFieldQuestionIds.includes(q.id),
      );
      return ok({
        user,
        card: emp?.card,
        chat: emp?.chat ?? [],
        pendingQuestions: pending,
        aiMode: hasGeminiKey() ? "gemini" : "heuristic",
      });
    }
    const raw = store.employers.find((e) => e.userId === userId);
    if (!raw) return ok({ error: "מעסיק לא נמצא" }, { status: 404 });
    let er = normalizeEmployerRecord(raw);
    if (jobId) {
      const hit = er.jobs.find((j) => j.id === jobId);
      if (hit) {
        er = { ...er, activeJobId: hit.id, card: hit.card, chat: hit.chat };
      }
    }
    return ok({
      user,
      card: er.card,
      chat: er.chat,
      jobs: er.jobs.map((j) => ({
        id: j.id,
        title: j.card.title,
        field: j.card.field,
      })),
      activeJobId: er.activeJobId,
      aiMode: hasGeminiKey() ? "gemini" : "heuristic",
    });
  } catch (e) {
    return fail(e);
  }
}
