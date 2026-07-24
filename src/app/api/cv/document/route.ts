import { auth } from "@/auth";
import { canViewCandidateCv, findCandidateDocument } from "@/domain/cv-access";
import { isAdminEmail } from "@/infrastructure/admin-config";
import { authorizeActor } from "@/infrastructure/auth-guard";
import { readCvAccessStore } from "@/infrastructure/db/slice-store";
import { readCandidateDocumentBlob } from "@/infrastructure/files/cv-storage";
import { ok, fail } from "@/infrastructure/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const viewerId = String(url.searchParams.get("viewerId") ?? "").trim();
    const candidateId = String(url.searchParams.get("candidateId") ?? "").trim();
    const documentId = String(url.searchParams.get("documentId") ?? "").trim();
    if (!viewerId || !candidateId || !documentId) {
      return ok({ error: "חסרים פרמטרים" }, { status: 400 });
    }

    const gate = await authorizeActor(viewerId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    const store = await readCvAccessStore(viewerId, candidateId);
    const session = await auth();
    const isAdmin = isAdminEmail(session?.user?.email);
    if (!canViewCandidateCv(store, { userId: viewerId, isAdmin }, candidateId)) {
      return ok({ error: "אין הרשאה" }, { status: 403 });
    }

    const meta = findCandidateDocument(store, candidateId, documentId);
    if (!meta) return ok({ error: "מסמך לא נמצא" }, { status: 404 });

    const bytes = await readCandidateDocumentBlob(meta.storageKey);
    if (!bytes) return ok({ error: "קובץ לא נמצא באחסון" }, { status: 404 });

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": meta.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
