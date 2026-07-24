import { generateObject, generateText } from "ai";
import {
  callGeminiWithRetry,
  getGeminiModel,
  hasGeminiKey,
} from "./gemini-client";
import { z } from "zod";
import type { CandidateCard, ChatMessage, FieldQuestion, JobCard } from "@/domain/types";
import { heuristicEmployeeIntake, heuristicEmployerIntake } from "./heuristic";
import { buildEmployeeConversation, buildEmployerConversation } from "./prompts";
import {
  candidatePatchSchema,
  jobPatchSchema,
  type AiTokenUsage,
  type CandidatePatch,
  type IntakeResult,
  type JobPatch,
} from "./schemas";

export { runCvExtraction } from "./cv-extraction";

function extractUsage(usage?: {
  promptTokens?: number;
  completionTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): AiTokenUsage | undefined {
  if (!usage) return undefined;
  const promptTokens = usage.promptTokens ?? usage.inputTokens ?? 0;
  const completionTokens = usage.completionTokens ?? usage.outputTokens ?? 0;
  if (promptTokens === 0 && completionTokens === 0) return undefined;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage.totalTokens ?? promptTokens + completionTokens,
  };
}

export async function runEmployeeIntake(params: {
  message: string;
  card: CandidateCard;
  chat: ChatMessage[];
  pendingQuestions: FieldQuestion[];
  systemPrompt: string;
  pendingConflicts?: string;
  pendingInferences?: string;
  openReliabilityNotes?: string;
}): Promise<IntakeResult> {
  if (!hasGeminiKey()) {
    return heuristicEmployeeIntake(
      params.message,
      params.card,
      params.pendingQuestions,
      params.chat,
    );
  }

  try {
    const { system, messages } = buildEmployeeConversation({
      template: params.systemPrompt,
      message: params.message,
      card: params.card,
      chat: params.chat,
      pendingQuestions: params.pendingQuestions,
      pendingConflicts: params.pendingConflicts,
      pendingInferences: params.pendingInferences,
      openReliabilityNotes: params.openReliabilityNotes,
    });

    const { object, usage } = await callGeminiWithRetry(() =>
      generateObject({
        model: getGeminiModel(),
        temperature: 0.65,
        schema: z.object({
          reply: z.string(),
          patch: candidatePatchSchema,
          fieldAnswers: z
            .array(z.object({ questionId: z.string(), answer: z.string() }))
            .default([]),
        }),
        system,
        messages,
      }),
    );

    return {
      reply: object.reply,
      candidatePatch: object.patch,
      fieldAnswers: object.fieldAnswers,
      provider: "gemini",
      usage: extractUsage(usage),
      degraded: false,
    };
  } catch (err) {
    console.error("employee intake Gemini failed, using heuristic", err);
    const fallback = heuristicEmployeeIntake(
      params.message,
      params.card,
      params.pendingQuestions,
      params.chat,
    );
    return { ...fallback, provider: "heuristic", degraded: true };
  }
}

export async function runEmployerIntake(params: {
  message: string;
  card: JobCard;
  chat: ChatMessage[];
  systemPrompt: string;
}): Promise<IntakeResult> {
  if (!hasGeminiKey()) {
    return heuristicEmployerIntake(params.message, params.card, params.chat);
  }

  try {
    const { system, messages } = buildEmployerConversation({
      template: params.systemPrompt,
      message: params.message,
      card: params.card,
      chat: params.chat,
    });

    const { object, usage } = await callGeminiWithRetry(() =>
      generateObject({
        model: getGeminiModel(),
        temperature: 0.65,
        schema: z.object({
          reply: z.string(),
          patch: jobPatchSchema,
        }),
        system,
        messages,
      }),
    );

    return {
      reply: object.reply,
      jobPatch: object.patch,
      provider: "gemini",
      usage: extractUsage(usage),
      degraded: false,
    };
  } catch (err) {
    console.error("employer intake Gemini failed, using heuristic", err);
    const fallback = heuristicEmployerIntake(params.message, params.card, params.chat);
    return { ...fallback, provider: "heuristic", degraded: true };
  }
}

export type CardExtraction<P> = {
  patch: P;
  provider: "gemini" | "heuristic";
  usage?: AiTokenUsage;
};

const JOB_EXTRACTION_SYSTEM = `את/ה עוזר/ת השמה שמחלץ/ת מידע מתיאור משרה אל כרטיס משרה.
- חלץ/י אך ורק מה שמופיע במפורש בטקסט. אל תמציא/י ואל תנחש/י.
- ערכים תמציתיים. שדה שלא מופיע בטקסט — אל תכלול/י אותו ב-patch.
- העדף/י למלא: title, field, location, mustHaves, niceToHaves, requiredLanguages, salaryRange, workModel, seniorityLevel, personalityFit, teamCulture.
- סכם/י את המשרה והתרבות בשדה narrative.
החזר/י JSON עם השדה patch בלבד.`;

/** Extract job card fields from a raw job-description document. */
export async function runJobDescriptionExtraction(params: {
  text: string;
  card: JobCard;
}): Promise<CardExtraction<JobPatch>> {
  if (!hasGeminiKey()) {
    const h = heuristicEmployerIntake(params.text, params.card, []);
    return { patch: h.jobPatch ?? {}, provider: "heuristic" };
  }
  try {
    const { object, usage } = await callGeminiWithRetry(() =>
      generateObject({
        model: getGeminiModel(),
        temperature: 0.2,
        schema: z.object({ patch: jobPatchSchema }),
        system: JOB_EXTRACTION_SYSTEM,
        messages: [
          {
            role: "user",
            content: `תיאור משרה:\n\n${params.text}\n\nכרטיס נוכחי (למניעת דריסה מיותרת):\n${JSON.stringify(params.card)}`,
          },
        ],
      }),
    );
    return { patch: object.patch, provider: "gemini", usage: extractUsage(usage) };
  } catch (err) {
    console.error("job extraction Gemini failed, using heuristic", err);
    const h = heuristicEmployerIntake(params.text, params.card, []);
    return { patch: h.jobPatch ?? {}, provider: "heuristic" };
  }
}

export async function enrichReasonWithAi(
  reason: string,
  candidateSummary: string,
  jobSummary: string,
): Promise<{ text: string; usage?: AiTokenUsage }> {
  if (!hasGeminiKey()) return { text: reason };
  try {
    const { text, usage } = await callGeminiWithRetry(() =>
      generateText({
        model: getGeminiModel(),
        prompt: `נסח במשפט אחד בעברית, אנושי ובלי כותרות, למה המועמד והמשרה מתאימים.
מועמד: ${candidateSummary}
משרה: ${jobSummary}
בסיס: ${reason}`,
      }),
    );
    return { text: text.trim() || reason, usage: extractUsage(usage) };
  } catch {
    return { text: reason };
  }
}
