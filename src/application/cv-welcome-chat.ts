import {
  appendAssistantReply,
  prepareEmployeeTurn,
  type ChatTurnResult,
} from "@/application/chat-turn";
import type { StoreData } from "@/domain/types";
import type { Locale } from "@/i18n/types";
import { runCvWelcomeReply } from "@/infrastructure/ai/intake";

function candidateFirstName(store: StoreData, userId: string): string | undefined {
  const name = store.users.find((u) => u.id === userId)?.name?.trim();
  return name?.split(/[\s(]/)[0]?.trim() || undefined;
}

export async function runCvWelcomeAfterUpload(params: {
  store: StoreData;
  userId: string;
  locale: Locale;
  userCvMessage: string;
  isCvUpdate: boolean;
}): Promise<ChatTurnResult> {
  const prep = prepareEmployeeTurn(params.store, params.userId);
  const welcome = await runCvWelcomeReply({
    userCvMessage: params.userCvMessage,
    card: prep.card,
    chat: prep.chat,
    pendingQuestions: prep.pendingQuestions,
    systemPrompt: prep.systemPrompt,
    pendingConflicts: prep.pendingConflicts,
    isCvUpdate: params.isCvUpdate,
    locale: params.locale,
    candidateName: candidateFirstName(params.store, params.userId),
  });

  return appendAssistantReply({
    store: params.store,
    userId: params.userId,
    reply: welcome.reply,
    usage: welcome.usage,
    provider: welcome.provider,
    aiDegraded: welcome.degraded,
  });
}
