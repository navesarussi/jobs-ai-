import { randomUUID } from "crypto";
import type { ChatMessage, StoreData } from "@/domain/types";
import { formatMessage, getMessages } from "@/i18n";
import type { Locale } from "@/i18n/types";

export function buildCvUploadChatMessage(fileName: string, locale: Locale): ChatMessage {
  const t = getMessages(locale);
  return {
    id: randomUUID(),
    role: "user",
    content: formatMessage(t.employee.cvUploadedMessage, { fileName }),
    createdAt: new Date().toISOString(),
  };
}

export function appendEmployeeChat(
  store: StoreData,
  userId: string,
  messages: ChatMessage[],
): StoreData {
  return {
    ...store,
    employees: store.employees.map((e) =>
      e.userId === userId ? { ...e, chat: [...e.chat, ...messages] } : e,
    ),
  };
}

/** True when a chat line was auto-posted after a CV upload. */
export function isCvUploadChatContent(content: string): boolean {
  for (const locale of ["he", "en"] as const) {
    const template = getMessages(locale).employee.cvUploadedMessage;
    const prefix = template.split("{fileName}")[0];
    if (content.startsWith(prefix) && content.length > prefix.length) return true;
  }
  return false;
}
