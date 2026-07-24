import { analyzeCandidateCv } from "@/application/cv-import";
import {
  appendEmployeeChat,
  buildCvUploadChatMessage,
} from "@/application/cv-upload-chat";
import { runCvWelcomeAfterUpload } from "@/application/cv-welcome-chat";
import { assertActor } from "@/infrastructure/auth-guard";
import {
  insertEmployeeChatMessages,
  persistEmployeeProfile,
  persistEmployeeTurn,
} from "@/infrastructure/db/scoped-store";
import { ok, fail } from "@/infrastructure/http";
import { parseLocale } from "@/infrastructure/locale";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      documentId?: string;
      locale?: string;
      announceInChat?: boolean;
      isCvUpdate?: boolean;
    };
    const userId = String(body.userId ?? "").trim();
    if (!userId) return ok({ error: "חסר userId" }, { status: 400 });
    const locale = parseLocale(body.locale ?? null);

    const gate = await assertActor(userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    const analyzed = await analyzeCandidateCv(gate.store, userId, body.documentId, locale);
    let store = analyzed.store;
    if (analyzed.usageRecord) {
      store = {
        ...store,
        aiUsage: [...(store.aiUsage ?? []), analyzed.usageRecord].slice(-200),
      };
    }
    const emp = store.employees.find((e) => e.userId === userId)!;
    const document = emp.cv?.documents.find((d) => d.id === analyzed.documentId);

    let chatMessage = null;
    let assistantMessage = null;
    if (body.announceInChat && document?.fileName) {
      const msg = buildCvUploadChatMessage(document.fileName, locale);
      store = appendEmployeeChat(store, userId, [msg]);
      chatMessage = { id: msg.id, role: msg.role, content: msg.content };
      await insertEmployeeChatMessages(userId, [msg]);

      const welcome = await runCvWelcomeAfterUpload({
        store,
        userId,
        locale,
        userCvMessage: msg.content,
        isCvUpdate: Boolean(body.isCvUpdate),
      });
      store = welcome.store;
      const assistant = welcome.newMessages[0];
      assistantMessage = assistant
        ? { id: assistant.id, role: assistant.role, content: assistant.content }
        : null;

      await persistEmployeeTurn({
        store,
        userId,
        card: welcome.card as typeof emp.card,
        pendingFieldQuestionIds:
          store.employees.find((e) => e.userId === userId)?.pendingFieldQuestionIds ?? [],
        cv: welcome.cv,
        newMessages: welcome.newMessages,
        newFieldAnswers: welcome.newFieldAnswers,
        usageRecord: welcome.usageRecord,
      });
    } else {
      await persistEmployeeProfile({
        store,
        userId,
        card: emp.card,
        pendingFieldQuestionIds: emp.pendingFieldQuestionIds,
        cv: emp.cv,
      });
    }

    const nextEmp = store.employees.find((e) => e.userId === userId)!;
    return ok({
      ok: true,
      phase: "analyzed",
      provider: analyzed.provider,
      summary: analyzed.summary,
      documentId: analyzed.documentId,
      chatMessage,
      assistantMessage,
      chat: nextEmp.chat,
    });
  } catch (e) {
    return fail(e);
  }
}
