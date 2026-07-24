import { ok, fail } from "@/infrastructure/http";
import { authorizeActor } from "@/infrastructure/auth-guard";
import { readCandidateQueueStore } from "@/infrastructure/store";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const jobId = url.searchParams.get("jobId");
    if (!userId) return ok({ error: "חסר userId" }, { status: 400 });
    const gate = await authorizeActor(userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });
    const store = await readCandidateQueueStore(userId, jobId);
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
      const latestCv = emp?.cv?.documents
        ?.filter((d) => d.kind === "cv")
        .slice()
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0];
      return {
        matchId: m.id,
        jobId: m.jobId || m.jobOwnerId,
        score: m.score,
        reason: m.reason,
        name: user?.name ?? "מועמד/ת",
        candidateId: m.candidateId,
        cvDocumentId: latestCv?.id ?? null,
        card: emp?.card,
      };
    });
    return ok({ candidates });
  } catch (e) {
    return fail(e);
  }
}
