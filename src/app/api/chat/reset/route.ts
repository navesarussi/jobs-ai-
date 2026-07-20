import { resetChat } from "@/application/chat";
import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { writeStore } from "@/infrastructure/store";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      role?: "employee" | "employer";
      jobId?: string;
    };
    if (!body.userId || !body.role) {
      return ok({ error: "חסרים פרטים" }, { status: 400 });
    }
    const gate = await assertActor(body.userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    const next = resetChat(gate.store, body.userId, body.role, body.jobId);
    await writeStore(next);

    const user = next.users.find((u) => u.id === body.userId);
    if (body.role === "employee") {
      const emp = next.employees.find((e) => e.userId === body.userId);
      return ok({ chat: emp?.chat ?? [], card: emp?.card });
    }
    const er = next.employers.find((e) => e.userId === body.userId);
    return ok({
      chat: er?.chat ?? [],
      card: er?.card,
      jobId: body.jobId ?? er?.activeJobId,
      role: user?.role,
    });
  } catch (e) {
    return fail(e);
  }
}
