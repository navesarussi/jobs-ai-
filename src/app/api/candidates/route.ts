import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const jobId = url.searchParams.get("jobId");
    if (!userId) return ok({ error: "חסר userId" }, { status: 400 });
    const gate = await assertActor(userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });
    const store = gate.store;
    const matches = store.matches
      .filter((m) => {
        if (m.jobOwnerId !== userId || m.status !== "queued") return false;
        if (!jobId) return true;
        return (m.jobId || m.jobOwnerId) === jobId;
      })
      .sort((a, b) => b.score - a.score);
    const candidates = matches.map((m) => {
      const emp = store.employees.find((e) => e.userId === m.candidateId);
      const user = store.users.find((u) => u.id === m.candidateId);
      return {
        matchId: m.id,
        jobId: m.jobId || m.jobOwnerId,
        score: m.score,
        reason: m.reason,
        name: user?.name ?? "מועמד/ת",
        card: emp?.card,
      };
    });
    return ok({ candidates });
  } catch (e) {
    return fail(e);
  }
}
