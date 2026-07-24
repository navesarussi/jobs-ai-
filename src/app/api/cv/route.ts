import { randomUUID } from "crypto";
import { saveCandidateCv } from "@/application/cv-import";
import { assertActor } from "@/infrastructure/auth-guard";
import { persistEmployeeProfile } from "@/infrastructure/db/scoped-store";
import { saveCandidateDocumentBlob } from "@/infrastructure/files/cv-storage";
import { extractTextFromUpload, MAX_UPLOAD_BYTES } from "@/infrastructure/files/extract-text";
import { ok, fail } from "@/infrastructure/http";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const userId = String(form.get("userId") ?? "").trim();
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

    const emp = gate.store.employees.find((e) => e.userId === userId);
    if (!emp) return ok({ error: "משתמש לא נמצא" }, { status: 404 });

    const docId = randomUUID();
    const storageKey = await saveCandidateDocumentBlob({
      id: docId,
      userId,
      content: buffer,
    });

    const saved = saveCandidateCv(gate.store, {
      userId,
      id: docId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      byteSize: buffer.length,
      storageKey,
      extractedText: text,
    });

    const nextEmp = saved.store.employees.find((e) => e.userId === userId)!;
    await persistEmployeeProfile({
      store: saved.store,
      userId,
      card: nextEmp.card,
      pendingFieldQuestionIds: nextEmp.pendingFieldQuestionIds,
      cv: nextEmp.cv,
    });

    return ok({
      ok: true,
      phase: "saved",
      documentId: saved.document.id,
      fileName: saved.document.fileName,
    });
  } catch (e) {
    return fail(e);
  }
}
