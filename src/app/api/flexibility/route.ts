import { updateFlexibility } from "@/application/update-flexibility";
import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { readStore, writeStore } from "@/infrastructure/store";

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { userId?: string; value?: number };
    if (!body.userId || body.value == null) {
      return ok({ error: "חסרים פרטים" }, { status: 400 });
    }
    if (!Number.isFinite(body.value) || body.value < 1 || body.value > 10) {
      return ok({ error: "גמישות חייבת להיות בין 1 ל-10" }, { status: 400 });
    }

    const gate = await assertActor(body.userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    const store = await readStore();
    const next = updateFlexibility(store, body.userId, body.value);
    await writeStore(next);
    return ok({ ok: true, flexibility: Math.round(body.value) });
  } catch (e) {
    return fail(e);
  }
}
