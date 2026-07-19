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
    const approved = store.matches.filter(
      (m) => m.candidateId === userId && m.status === "approved",
    );

    const jobs = approved.map((m) => {
      const er = store.employers.find((e) => e.userId === m.jobOwnerId);
      const user = store.users.find((u) => u.id === m.jobOwnerId);
      return {
        matchId: m.id,
        score: m.score,
        reason: m.reason,
        employerName: user?.name ?? "מעסיק/ה",
        card: er?.card,
      };
    });

    return ok({ jobs });
  } catch (e) {
    return fail(e);
  }
}
