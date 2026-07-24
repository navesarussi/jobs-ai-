import { askFieldQuestion } from "@/application/employer-actions";
import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { updateMatchStatus } from "@/infrastructure/db/scoped-store";
import { readStore, writeStore } from "@/infrastructure/store";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      employerId?: string;
      matchId?: string;
      action?: "approve" | "reject" | "ask";
      question?: string;
    };
    if (!body.employerId || !body.matchId || !body.action) {
      return ok({ error: "חסרים פרטים" }, { status: 400 });
    }
    const gate = await assertActor(body.employerId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    if (body.action === "approve" || body.action === "reject") {
      const updated = await updateMatchStatus({
        matchId: body.matchId,
        employerId: body.employerId,
        status: body.action === "approve" ? "approved" : "rejected",
      });
      if (!updated) return ok({ error: "התאמה לא נמצאה" }, { status: 404 });
      return ok({ ok: true });
    }

    // Field questions touch many candidates in the same field — rare path, full read OK.
    const store = await readStore();
    const next = askFieldQuestion(store, {
      employerId: body.employerId,
      matchId: body.matchId,
      question: body.question ?? "",
    });
    await writeStore(next);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
