import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { persistEmployerProfile } from "@/infrastructure/db/scoped-store";
import {
  addEmployerJob,
  normalizeEmployerRecord,
  withActiveJob,
} from "@/domain/employer-jobs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      action?: "create" | "select";
      jobId?: string;
    };
    if (!body.userId) return ok({ error: "חסר userId" }, { status: 400 });
    const gate = await assertActor(body.userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    const store = gate.store;
    const raw = store.employers.find((e) => e.userId === body.userId);
    if (!raw) return ok({ error: "מעסיק לא נמצא" }, { status: 404 });

    let employer = normalizeEmployerRecord(raw);
    if (body.action === "select") {
      if (!body.jobId) return ok({ error: "חסר jobId" }, { status: 400 });
      employer = withActiveJob(employer, body.jobId);
    } else {
      employer = addEmployerJob(employer);
    }

    const next = {
      ...store,
      employers: store.employers.map((e) =>
        e.userId === body.userId ? employer : e,
      ),
    };
    await persistEmployerProfile({
      store: next,
      userId: body.userId,
      card: employer.card,
      jobs: employer.jobs,
      activeJobId: employer.activeJobId,
    });

    return ok({
      jobs: employer.jobs.map((j) => ({
        id: j.id,
        title: j.card.title,
        field: j.card.field,
      })),
      activeJobId: employer.activeJobId,
      card: employer.card,
      chat: employer.chat,
    });
  } catch (e) {
    return fail(e);
  }
}
