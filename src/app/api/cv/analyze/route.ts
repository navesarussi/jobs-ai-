import { analyzeCandidateCv } from "@/application/cv-import";
import { assertActor } from "@/infrastructure/auth-guard";
import { ok, fail } from "@/infrastructure/http";
import { writeStore } from "@/infrastructure/store";

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
    await writeStore(analyzed.store);

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
