import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { readStore } from "@/infrastructure/store";

export async function GET(req: Request) {
  try {
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) return ok({ error: "חסר userId" }, { status: 400 });
    const gate = await assertActor(userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });
    const store = await readStore();
    const matches = store.matches.filter((m) => m.jobOwnerId === userId && m.status === "queued").sort((a, b) => b.score - a.score);
    const candidates = matches.map((m) => {
      const emp = store.employees.find((e) => e.userId === m.candidateId);
      const user = store.users.find((u) => u.id === m.candidateId);
      return { matchId: m.id, score: m.score, reason: m.reason, name: user?.name ?? "מועמד/ת", card: emp?.card };
    });
    return ok({ candidates });
  } catch (e) {
    return fail(e);
  }
}
