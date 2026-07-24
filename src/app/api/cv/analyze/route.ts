import { analyzeCandidateCv } from "@/application/cv-import";
import { assertActor } from "@/infrastructure/auth-guard";
import { persistEmployeeProfile } from "@/infrastructure/db/scoped-store";
import { ok, fail } from "@/infrastructure/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { userId?: string; documentId?: string };
    const userId = String(body.userId ?? "").trim();
    if (!userId) return ok({ error: "חסר userId" }, { status: 400 });

    const gate = await assertActor(userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    const analyzed = await analyzeCandidateCv(gate.store, userId, body.documentId);
    const emp = analyzed.store.employees.find((e) => e.userId === userId)!;
    await persistEmployeeProfile({
      store: analyzed.store,
      userId,
      card: emp.card,
      pendingFieldQuestionIds: emp.pendingFieldQuestionIds,
      cv: emp.cv,
      usageRecord: analyzed.usageRecord,
    });

    return ok({
      ok: true,
      phase: "analyzed",
      provider: analyzed.provider,
      summary: analyzed.summary,
      documentId: analyzed.documentId,
    });
  } catch (e) {
    return fail(e);
  }
}
