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

export function cvWelcomeSystemNote(params: {
  isCvUpdate: boolean;
  locale: "he" | "en";
  candidateName?: string;
}): string {
  const name = params.candidateName?.trim();
  if (params.locale === "en") {
    return params.isCvUpdate
      ? `\n\n[System: The candidate uploaded an updated CV. Open with "I received your updated CV", greet by name if known${name ? ` (${name})` : ""}, mention one strength from the card (role/experience), note you have a few questions to improve job matches, and end with one natural first question per your strategy. Warm, short, positive.]`
      : `\n\n[System: The candidate uploaded a CV for the first time. Greet by name if known${name ? ` (${name})` : ""}, say you received their CV, mention one strength from the profile, note you have a few questions to improve matches, and end with one natural first question. Warm, short, positive.]`;
  }
  return params.isCvUpdate
    ? `\n\n[אירוע מערכת: המועמד/ת העלה/תה קורות חיים מעודכנים. פתח/י במשפט שמתחיל ב"קיבלתי את קורות החיים המעודכנים שלך", פנה/י בשם${name ? ` (${name})` : ""} אם ידוע, אזכור/י נקודת חוזק אחת מהכרטיס (תפקיד/ניסיון), ציין/י שיש כמה שאלות להעלאת סיכויי ההתאמה, וסיים/י בשאלה ראשונה טבעית לפי האסטרטגיה. טון חיובי, קצר, "קיבלתי — בוא/י נצא לדרך".]`
    : `\n\n[אירוע מערכת: המועמד/ת העלה/תה קורות חיים לראשונה. פתח/י בברכה אישית${name ? ` (${name})` : ""}, אמור/י "קיבלתי את קורות החיים שלך", אזכור/י נקודת חוזק מהפרופיל, ציין/י שיש כמה שאלות להעלאת סיכויי ההתאמה, וסיים/י בשאלה ראשונה טבעית. טון חיובי וקצר.]`;
}

export function buildEmployeeConversation(params: {
  template: string;
  message: string;
  card: CandidateCard;
  chat: ChatMessage[];
  pendingQuestions: FieldQuestion[];
  pendingConflicts?: string;
}): BuiltConversation {
  const pending = params.pendingQuestions
    .map((q) => `- [${q.id}] ${q.question}`)
    .join("\n");
  const missing = nextMissingCandidateField(params.card);
  const recent = recentAssistantReplies(params.chat)
    .map((q) => `- ${q}`)
    .join("\n");
  const conflicts = params.pendingConflicts?.trim();
  const conflictBlock = conflicts
    ? `\n\nקונפליקטים ממקורות שונים (CV מול שיחה) — ברר/י בעדינות מה מעודכן, בלי למחוק מקורות:\n${conflicts}`
    : "";

  return {
    system:
      renderSystem(params.template, {
        current_card: JSON.stringify(compactCard(params.card), null, 2),
        known_facts: knownFactsText(params.card),
        missing_field_key: missing ? `${missing.label} (${missing.key})` : "",
        pending_field_questions: pending || "אין",
        recent_agent_questions: recent || "אין עדיין",
      }) + conflictBlock,
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
