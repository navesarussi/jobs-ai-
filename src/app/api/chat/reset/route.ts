import { resetChat } from "@/application/chat";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";
import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { clearConversationChat } from "@/infrastructure/db/scoped-store";
import { deleteCandidateDocumentBlobs } from "@/infrastructure/files/cv-storage";

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

    if (body.role === "employee") {
      const before = gate.store.employees.find((e) => e.userId === body.userId);
      const storageKeys = (before?.cv?.documents ?? []).map((d) => d.storageKey);
      const next = resetChat(gate.store, body.userId, body.role, body.jobId);
      await deleteCandidateDocumentBlobs(storageKeys);
      await clearConversationChat({
        store: next,
        userId: body.userId,
        role: "employee",
      });
      const emp = next.employees.find((e) => e.userId === body.userId);
      return ok({ chat: emp?.chat ?? [], card: emp?.card, hasCv: false });
    }

    const next = resetChat(gate.store, body.userId, body.role, body.jobId);
    const er = next.employers.find((e) => e.userId === body.userId);
    const employer = er ? normalizeEmployerRecord(er) : null;
    await clearConversationChat({
      store: next,
      userId: body.userId,
      role: "employer",
      jobId: body.jobId ?? employer?.activeJobId,
      employerCard: employer?.card,
      employerJobs: employer?.jobs,
      activeJobId: employer?.activeJobId,
    });
    const user = next.users.find((u) => u.id === body.userId);
    return ok({
      chat: employer?.chat ?? [],
      card: employer?.card,
      jobId: body.jobId ?? employer?.activeJobId,
      role: user?.role,
    });
  } catch (e) {
    return fail(e);
  }
}
