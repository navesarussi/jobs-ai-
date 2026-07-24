import { after } from "next/server";
import { applyFlexibility } from "@/application/update-flexibility";
import type { CandidateCard, JobCard } from "@/domain/types";
import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { rebuildAndWriteMatches } from "@/infrastructure/store";
import {
  persistEmployeeProfile,
  persistEmployerProfile,
} from "@/infrastructure/db/scoped-store";

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

    const applied = applyFlexibility(gate.store, body.userId, body.value);
    if (applied.role === "employee") {
      const emp = applied.store.employees.find((e) => e.userId === body.userId);
      await persistEmployeeProfile({
        store: applied.store,
        userId: body.userId,
        card: applied.card as CandidateCard,
        pendingFieldQuestionIds: emp?.pendingFieldQuestionIds ?? [],
        cv: emp?.cv,
      });
    } else {
      await persistEmployerProfile({
        store: applied.store,
        userId: body.userId,
        card: applied.card as JobCard,
        jobs: applied.jobs ?? [],
        activeJobId: applied.activeJobId ?? "",
      });
    }

    after(async () => {
      try {
        await rebuildAndWriteMatches();
      } catch (err) {
        console.error("deferred flexibility match refresh failed", err);
      }
    });

    return ok({ ok: true, flexibility: Math.round(body.value) });
  } catch (e) {
    return fail(e);
  }
}
