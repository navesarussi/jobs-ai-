import { randomUUID } from "crypto";
import { applyJobDescriptionExtraction } from "@/application/chat";
import { createAiUsageRecord } from "@/domain/admin";
import { getActiveJob, normalizeEmployerRecord, withActiveJob } from "@/domain/employer-jobs";
import type { StoreData } from "@/domain/types";
import { runJobDescriptionExtraction } from "@/infrastructure/ai/intake";
import { assertActor } from "@/infrastructure/auth-guard";
import { extractTextFromUpload, MAX_UPLOAD_BYTES } from "@/infrastructure/files/extract-text";
import { ok, fail } from "@/infrastructure/http";
import { writeStore } from "@/infrastructure/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const userId = String(form.get("userId") ?? "").trim();
    const jobId = form.get("jobId") ? String(form.get("jobId")) : undefined;
    const file = form.get("file");
    if (!userId || !(file instanceof File)) {
      return ok({ error: "חסר קובץ או משתמש" }, { status: 400 });
    }

    const gate = await assertActor(userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return ok({ error: "הקובץ גדול מדי (עד 5MB)" }, { status: 400 });
    }

    const text = await extractTextFromUpload(buffer, file.name, file.type);
    if (text.length < 10) {
      return ok({ error: "לא נמצא טקסט קריא בקובץ" }, { status: 400 });
    }

    const store = gate.store;
    const raw = store.employers.find((e) => e.userId === userId);
    if (!raw) return ok({ error: "משתמש לא נמצא" }, { status: 404 });

    let employer = normalizeEmployerRecord(raw);
    if (jobId) employer = withActiveJob(employer, jobId);
    const activeCard = getActiveJob(employer).card;

    const { patch, provider, usage } = await runJobDescriptionExtraction({ text, card: activeCard });
    const applied = applyJobDescriptionExtraction(store, userId, patch, text, jobId);

    let next: StoreData = applied.store;
    if (usage) {
      next = {
        ...next,
        aiUsage: [
          ...(next.aiUsage ?? []),
          createAiUsageRecord({
            id: randomUUID(),
            type: "job_import",
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            createdAt: new Date().toISOString(),
          }),
        ].slice(-200),
      };
    }

    await writeStore(next);
    return ok({ ok: true, provider, card: applied.card, jobId: applied.jobId });
  } catch (e) {
    return fail(e);
  }
}
