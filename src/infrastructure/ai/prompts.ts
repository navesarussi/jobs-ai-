import { readFileSync } from "fs";
import { join } from "path";
import { renderPromptTemplate } from "@/domain/admin";
import {
  compactCard,
  knownFactsText,
  recentAssistantReplies,
  toModelMessages,
  type ModelChatMessage,
} from "@/domain/chat-context";
import {
  nextMissingCandidateField,
  nextMissingJobField,
} from "@/domain/card-progress";
import {
  PROMPT_BUNDLE_VERSION,
  type AdminSettings,
  type CandidateCard,
  type ChatMessage,
  type FieldQuestion,
  type JobCard,
} from "@/domain/types";

let cachedCandidatePrompt: string | null = null;
let cachedEmployerPrompt: string | null = null;

function readPromptFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

export function clearDefaultPromptCache(): void {
  cachedCandidatePrompt = null;
  cachedEmployerPrompt = null;
}

export function getDefaultCandidatePrompt(): string {
  if (!cachedCandidatePrompt) {
    cachedCandidatePrompt = readPromptFile("prompts/candidate/system-prompt.md");
  }
  return cachedCandidatePrompt;
}

export function getDefaultEmployerPrompt(): string {
  if (!cachedEmployerPrompt) {
    cachedEmployerPrompt = readPromptFile("prompts/employer/system-prompt.md");
  }
  return cachedEmployerPrompt;
}

export function resolveAdminSettings(
  raw?: Partial<AdminSettings>,
): AdminSettings {
  const hasStoredPrompts =
    Boolean(raw?.candidatePrompt?.trim()) && Boolean(raw?.employerPrompt?.trim());
  const version = raw?.promptBundleVersion;
  const customFresh =
    hasStoredPrompts &&
    (version === PROMPT_BUNDLE_VERSION || version == null);

  if (customFresh) {
    return {
      candidatePrompt: raw!.candidatePrompt!.trim(),
      employerPrompt: raw!.employerPrompt!.trim(),
      updatedAt: raw?.updatedAt,
      updatedBy: raw?.updatedBy,
      promptBundleVersion: raw?.promptBundleVersion,
    };
  }

  // Stale / missing admin override → ship the latest file prompts.
  return {
    candidatePrompt: getDefaultCandidatePrompt(),
    employerPrompt: getDefaultEmployerPrompt(),
    updatedAt: raw?.updatedAt,
    updatedBy: raw?.updatedBy,
    promptBundleVersion: PROMPT_BUNDLE_VERSION,
  };
}

export function hasCustomAdminPrompts(raw?: Partial<AdminSettings>): boolean {
  const hasStoredPrompts =
    Boolean(raw?.candidatePrompt?.trim()) && Boolean(raw?.employerPrompt?.trim());
  const version = raw?.promptBundleVersion;
  return (
    hasStoredPrompts &&
    (version === PROMPT_BUNDLE_VERSION || version == null)
  );
}

export type BuiltConversation = {
  system: string;
  messages: ModelChatMessage[];
};

function renderSystem(template: string, vars: Record<string, string>): string {
  return renderPromptTemplate(template, {
    chat_history: "(ההיסטוריה מגיעה כהודעות נפרדות — ראה/י messages)",
    new_message: "(ההודעה האחרונה היא ההודעה האחרונה ב-messages)",
    current_card: vars.current_card,
    known_facts: vars.known_facts,
    missing_field_key: vars.missing_field_key,
    pending_field_questions: vars.pending_field_questions,
    recent_agent_questions: vars.recent_agent_questions,
  });
}

export function buildEmployeeConversation(params: {
  template: string;
  message: string;
  card: CandidateCard;
  chat: ChatMessage[];
  pendingQuestions: FieldQuestion[];
  pendingConflicts?: string;
  pendingInferences?: string;
  openReliabilityNotes?: string;
}): BuiltConversation {
  const pending = params.pendingQuestions
    .map((q) => `- [${q.id}] ${q.question}`)
    .join("\n");
  const missing = nextMissingCandidateField(params.card);
  const recent = recentAssistantReplies(params.chat)
    .map((q) => `- ${q}`)
    .join("\n");
  const conflicts = params.pendingConflicts?.trim();
  const inferences = params.pendingInferences?.trim();
  const notes = params.openReliabilityNotes?.trim();
  const conflictBlock = conflicts
    ? `\n\nקונפליקטים ממקורות שונים (CV מול שיחה) — ברר/י בעדינות מה מעודכן, בלי למחוק מקורות:\n${conflicts}`
    : "";
  const inferenceBlock = inferences
    ? `\n\nהסקות חלשות מהקו״ח לאישור (אל תציין שמדובר ב״הסקה״ או ציון):\n${inferences}`
    : "";
  const notesBlock = notes
    ? `\n\nסתירות פתוחות לבירור (בלי להזכיר אמינות/ציונים):\n${notes}`
    : "";

  return {
    system:
      renderSystem(params.template, {
        current_card: JSON.stringify(compactCard(params.card), null, 2),
        known_facts: knownFactsText(params.card),
        missing_field_key: missing ? `${missing.label} (${missing.key})` : "",
        pending_field_questions: pending || "אין",
        recent_agent_questions: recent || "אין עדיין",
      }) +
      conflictBlock +
      inferenceBlock +
      notesBlock,
    messages: toModelMessages(params.chat, params.message),
  };
}

export function buildEmployerConversation(params: {
  template: string;
  message: string;
  card: JobCard;
  chat: ChatMessage[];
}): BuiltConversation {
  const missing = nextMissingJobField(params.card);
  const recent = recentAssistantReplies(params.chat)
    .map((q) => `- ${q}`)
    .join("\n");

  return {
    system: renderSystem(params.template, {
      current_card: JSON.stringify(compactCard(params.card), null, 2),
      known_facts: knownFactsText(params.card),
      missing_field_key: missing ? `${missing.label} (${missing.key})` : "",
      pending_field_questions: "אין",
      recent_agent_questions: recent || "אין עדיין",
    }),
    messages: toModelMessages(params.chat, params.message),
  };
}

export function buildEmployeePrompt(params: {
  template: string;
  message: string;
  card: CandidateCard;
  chat: ChatMessage[];
  pendingQuestions: FieldQuestion[];
}): string {
  const built = buildEmployeeConversation(params);
  return `${built.system}\n\n---\n${built.messages.map((m) => `${m.role}: ${m.content}`).join("\n")}`;
}

export function buildEmployerPrompt(params: {
  template: string;
  message: string;
  card: JobCard;
  chat: ChatMessage[];
}): string {
  const built = buildEmployerConversation(params);
  return `${built.system}\n\n---\n${built.messages.map((m) => `${m.role}: ${m.content}`).join("\n")}`;
}
