import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { readStore } from "@/infrastructure/store";
import { hasGeminiKey } from "@/infrastructure/ai/schemas";

export async function GET(req: Request) {
  try {
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) return ok({ error: "חסר userId" }, { status: 400 });
    const gate = await assertActor(userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });
    const store = await readStore();
    const user = store.users.find((u) => u.id === userId);
    if (!user) return ok({ error: "משתמש לא נמצא" }, { status: 404 });
    if (user.role === "employee") {
      const emp = store.employees.find((e) => e.userId === userId);
      const pending = store.fieldQuestions.filter((q) => emp?.pendingFieldQuestionIds.includes(q.id));
      return ok({ user, card: emp?.card, chat: emp?.chat ?? [], pendingQuestions: pending, aiMode: hasGeminiKey() ? "gemini" : "heuristic" });
    }
    const er = store.employers.find((e) => e.userId === userId);
    return ok({ user, card: er?.card, chat: er?.chat ?? [], aiMode: hasGeminiKey() ? "gemini" : "heuristic" });
  } catch (e) {
    return fail(e);
  }
}
