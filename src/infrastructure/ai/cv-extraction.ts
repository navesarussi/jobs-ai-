import { generateObject } from "ai";
import {
  callGeminiWithRetry,
  getGeminiModel,
  hasGeminiKey,
} from "./gemini-client";
import type { CandidateCard } from "@/domain/types";
import { isExtractTextUsable, sanitizeCvPatch } from "@/domain/cv-sanitize";
import { heuristicEmployeeIntake } from "./heuristic";
import {
  cvExtractionSchema,
  cvInferencePassSchema,
  type AiTokenUsage,
  type CandidatePatch,
} from "./schemas";

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

const PASS_A_SYSTEM = `את/ה מגייס/ת מקצועית שמחלצת מקורות חיים עובדות מפורשות בלבד אל כרטיס מועמד/ת.
כללים מחייבים:
1. חלץ/י אך ורק מידע שמופיע במפורש בטקסט. אל תמציא/י, אל תנחש/י, אל תשלימ/י פערי ניסיון.
2. מלא/י כמה שיותר שדות רלוונטיים ב-patch (תפקיד, תחום, מיקום, כישורים, שפות, השכלה, הסמכות, רישיונות, ניסיון, קישורים וכו').
3. בנה/י workHistory מלאה לכל תפקיד (חברה, תפקיד, תאריכים אם יש, תיאור/הישגים).
4. בנה/י educationHistory לכל מוסד/תואר/קורס משמעותי.
5. כל פרט מפורש שלא נכנס לשדה קבוע — העבר/י ל-unmappedFacts (label+value). אסור לאבד מידע.
6. narrative = סיכום מקצועי קצר של הרקע בלבד (לא העתקת כל הקורות חיים, עד ~3 משפטים).
7. fieldConfidence: סמן/י high/medium/low לשדות עמומים.
8. שדה שלא מופיע — אל תכלול/י אותו ב-patch.
החזר/י JSON לפי הסכמה בלבד. אל תכלול inferences בשלב זה.`;

const PASS_B_SYSTEM = `את/ה אנליסט/ית השמה. בהינתן טקסט קורות חיים + חילוץ מובנה קיים, הפק/י הסקות סאבטקסט מבוקרות בלבד.
כללים:
1. כל פריט חייב evidence (ציטוט/פרפרזה קצרה מהטקסט) + confidence high|medium|low.
2. מותר: ניסיון ניהולי מ"ניהלתי צוות", בכירות משנים+תארים, תחום מתפקידים, סגנון עבודה מניסוח.
3. אסור: להמציא מעסיקים, תאריכים, שכר, מיקום, או עובדות שלא נתמכות.
4. fieldKey חייב להיות שם שדה כרטיס מוכר (למשל managementExperience, experienceLevel, personality, industryExperience).
5. אם אין הסקה מבוססת — החזר/י מערך inferences ריק.
החזר/י JSON עם inferences בלבד.`;

export type CvExtractionResult = {
  patch: CandidatePatch;
  workHistory?: import("@/domain/types").WorkHistoryEntry[];
  educationHistory?: import("@/domain/types").EducationHistoryEntry[];
  unmappedFacts?: import("@/domain/types").UnmappedFact[];
  fieldConfidence?: Record<string, "high" | "medium" | "low">;
  inferences?: {
    fieldKey: string;
    value: string;
    evidence: string;
    confidence: "high" | "medium" | "low";
  }[];
  provider: "gemini" | "heuristic";
  usage?: AiTokenUsage;
  failed?: boolean;
  strippedCount?: number;
};

/** Two-pass CV extraction: structured facts then controlled subtext. */
export async function runCvExtraction(params: {
  text: string;
  card: CandidateCard;
}): Promise<CvExtractionResult> {
  if (!isExtractTextUsable(params.text)) {
    return { patch: {}, provider: "heuristic", failed: true };
  }

  if (!hasGeminiKey()) {
    const h = heuristicEmployeeIntake(params.text, params.card, [], []);
    const sanitized = sanitizeCvPatch({ patch: h.candidatePatch ?? {} });
    return {
      patch: sanitized.patch as CandidatePatch,
      provider: "heuristic",
      strippedCount: sanitized.strippedCount,
    };
  }

  try {
    const passA = await callGeminiWithRetry(() =>
      generateObject({
        model: getGeminiModel(),
        temperature: 0.1,
        schema: cvExtractionSchema,
        system: PASS_A_SYSTEM,
        messages: [
          {
            role: "user",
            content: `קורות חיים לניתוח מעמיק (עובדות מפורשות):\n\n${params.text}\n\nכרטיס נוכחי (למודעות בלבד):\n${JSON.stringify(params.card)}`,
          },
        ],
      }),
    );

    let inferences: CvExtractionResult["inferences"] = [];
    let usageB: AiTokenUsage | undefined;
    try {
      const passB = await callGeminiWithRetry(() =>
        generateObject({
          model: getGeminiModel(),
          temperature: 0.2,
          schema: cvInferencePassSchema,
          system: PASS_B_SYSTEM,
          messages: [
            {
              role: "user",
              content: `טקסט קורות חיים:\n\n${params.text}\n\nחילוץ מובנה קיים:\n${JSON.stringify({
                patch: passA.object.patch,
                workHistory: passA.object.workHistory,
                educationHistory: passA.object.educationHistory,
              })}`,
            },
          ],
        }),
      );
      inferences = passB.object.inferences ?? [];
      usageB = extractUsage(passB.usage);
    } catch (err) {
      console.error("cv subtext pass B failed; keeping pass A only", err);
    }

    const usageA = extractUsage(passA.usage);
    const usage =
      usageA || usageB
        ? {
            promptTokens: (usageA?.promptTokens ?? 0) + (usageB?.promptTokens ?? 0),
            completionTokens:
              (usageA?.completionTokens ?? 0) + (usageB?.completionTokens ?? 0),
            totalTokens: (usageA?.totalTokens ?? 0) + (usageB?.totalTokens ?? 0),
          }
        : undefined;

    const sanitized = sanitizeCvPatch({
      patch: passA.object.patch ?? {},
      workHistory: passA.object.workHistory,
      educationHistory: passA.object.educationHistory,
      unmappedFacts: passA.object.unmappedFacts,
      fieldConfidence: passA.object.fieldConfidence,
      inferences,
    });

    return {
      patch: sanitized.patch as CandidatePatch,
      workHistory: sanitized.workHistory as CvExtractionResult["workHistory"],
      educationHistory: sanitized.educationHistory as CvExtractionResult["educationHistory"],
      unmappedFacts: sanitized.unmappedFacts,
      fieldConfidence: sanitized.fieldConfidence,
      inferences: sanitized.inferences,
      provider: "gemini",
      usage,
      strippedCount: sanitized.strippedCount,
    };
  } catch (err) {
    console.error("cv extraction Gemini failed, using heuristic", err);
    const h = heuristicEmployeeIntake(params.text, params.card, [], []);
    const sanitized = sanitizeCvPatch({ patch: h.candidatePatch ?? {} });
    return {
      patch: sanitized.patch as CandidatePatch,
      provider: "heuristic",
      strippedCount: sanitized.strippedCount,
    };
  }
}
