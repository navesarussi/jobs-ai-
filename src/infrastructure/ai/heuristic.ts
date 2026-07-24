import { wasQuestionJustAsked } from "@/domain/chat-context";
import { nextMissingCandidateField, nextMissingJobField } from "@/domain/card-progress";
import type { CandidateCard, ChatMessage, FieldQuestion, JobCard } from "@/domain/types";
import type { CandidatePatch, IntakeResult, JobPatch } from "./schemas";

function extractList(text: string, label: RegExp): string[] {
  const m = text.match(label);
  if (!m?.[1]) return [];
  return m[1]
    .split(/,|ו|·|\|/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

const ROLE_RE =
  /מלצר(?:ית)?|ברמן|מארח(?:ת)?|שף|טבח(?:ית)?|קופאי(?:ת)?|מחסנאי|שליח|מנהל(?:ת)?|נציג(?:ת)?(?:\s*מכירות)?|מכירות/;

function extractCandidatePatch(message: string, card: CandidateCard): CandidatePatch {
  const patch: CandidatePatch = {};
  const lower = message;

  const role = lower.match(ROLE_RE)?.[0];
  if (role) {
    patch.desiredRole = role === "מכירות" ? "מכירות" : role;
    if (/מכירות|שירות לקוחות/.test(role) || /מכירות|שירות לקוחות/.test(lower)) {
      patch.field = patch.field || "מכירות";
    }
  }
  if (/מסעד|בית קפה|בר\b|מזון/.test(lower)) patch.field = "מסעדנות";
  if (/מחסן|לוגיסט|הפצה|שילוח/.test(lower)) patch.field = "לוגיסטיקה";
  if (/מכירות|שירות לקוחות/.test(lower)) {
    patch.field = patch.field || "מכירות";
    if (!card.desiredRole && !patch.desiredRole) patch.desiredRole = "מכירות";
  }
  if (/תל אביב|חיפה|ירושלים|באר שבע|רמת גן|פתח תקווה|נתניה|הרצליה/.test(lower)) {
    patch.location = lower.match(
      /תל אביב|חיפה|ירושלים|באר שבע|רמת גן|פתח תקווה|נתניה|הרצליה/,
    )?.[0];
  }
  if (/היברידי|מהבית|ריחוק|משרד/.test(lower)) patch.remotePreference = message.slice(0, 80);
  const years = lower.match(/(\d+)\s*שנ(?:ות|ה)/);
  if (years) patch.experienceYears = Number(years[1]);
  if (/ג׳וניור|junior|בכיר|סיניור|senior|ביניים/i.test(lower)) {
    patch.experienceLevel = lower.match(/ג׳וניור|junior|בכיר|סיניור|senior|ביניים/i)?.[0];
  }
  const skills = extractList(lower, /כישור(?:ים)?[:\s]+(.+)/i);
  if (skills.length) patch.skills = skills;
  if (/שכר|משכורת|₪|שקל/.test(lower)) {
    patch.salaryExpectation = message.slice(0, 80);
    const nums = lower.match(/(\d{4,6})/g);
    if (nums?.[0]) patch.salaryMin = nums[0];
    if (nums?.[1]) patch.salaryMax = nums[1];
  }
  if (/מלאה|חלקית|100%|50%|פרילנס/.test(lower)) patch.employmentType = message.slice(0, 60);
  if (/משמרות|בוקר|ערב|לילה/.test(lower)) patch.shiftPreference = message.slice(0, 80);
  if (/לילה/.test(lower)) patch.nightShiftsOk = /לא.*לילה|בלי לילה/.test(lower) ? "לא" : "כן";
  if (/סופ.?שבוע|שישי|שבת/.test(lower)) {
    patch.weekendsOk = /לא.*סופ|בלי סופ/.test(lower) ? "לא" : "כן";
  }
  if (/רכב|אוטובוס|רכבת|נהיגה/.test(lower)) patch.transportation = message.slice(0, 80);
  if (/רישיון/.test(lower)) patch.drivingLicense = message.slice(0, 60);
  if (/אופי|רגוע|אנרגטי|אחראי|יסודי|חברותי|דייקן/.test(lower)) {
    patch.personality = message.slice(0, 160);
  }
  if (/סגנון|עצמאי|צוות|לבד/.test(lower)) patch.workStyle = message.slice(0, 120);
  if (/חוזק|טוב ב/.test(lower)) patch.strengths = message.slice(0, 120);
  if (/זמין|אחה״צ|בוקר|ראיון/.test(lower)) {
    patch.availability = message.slice(0, 120);
    patch.interviewAvailability = message.slice(0, 120);
  }
  if (/להתחיל|מיידי|שבוע|חודש/.test(lower)) patch.startDate = message.slice(0, 80);
  if (/עברית/.test(lower)) patch.hebrewLevel = message.slice(0, 60);
  if (/אנגלית|english/.test(lower)) patch.englishLevel = message.slice(0, 60);
  if (/תואר|תיכון|קורס|השכלה/.test(lower)) patch.education = message.slice(0, 100);
  if (/קהל|לקוחות/.test(lower)) patch.customerFacingOk = "כן";
  if (/ניהול|צוות/.test(lower)) patch.managementExperience = message.slice(0, 100);
  if (/לא מוכן|בלי|קו אדום|לא אסכים/.test(lower)) patch.dealBreakers = message.slice(0, 120);
  if (message.trim().length > 40) patch.narrative = message.trim().slice(0, 400);
  return patch;
}

function extractJobPatch(message: string, card: JobCard): JobPatch {
  const patch: JobPatch = {};
  const lower = message;
  const role = lower.match(ROLE_RE)?.[0];
  if (role) {
    patch.title = role === "מכירות" ? "מכירות" : role;
    if (/מכירות|שירות/.test(lower)) patch.field = patch.field || "מכירות";
  }
  if (/מסעד|בית קפה|בר\b/.test(lower)) patch.field = "מסעדנות";
  if (/מחסן|לוגיסט|הפצה/.test(lower)) patch.field = "לוגיסטיקה";
  if (/מכירות|שירות/.test(lower)) {
    patch.field = patch.field || "מכירות";
    if (!card.title && !patch.title) patch.title = "מכירות";
  }
  if (/תל אביב|חיפה|ירושלים|באר שבע|רמת גן|פתח תקווה|נתניה|הרצליה/.test(lower)) {
    patch.location = lower.match(
      /תל אביב|חיפה|ירושלים|באר שבע|רמת גן|פתח תקווה|נתניה|הרצליה/,
    )?.[0];
  }
  if (/היברידי|מהבית|ריחוק|משרד/.test(lower)) patch.workModel = message.slice(0, 80);
  if (/מלאה|חלקית|100%|50%/.test(lower)) patch.scope = message.slice(0, 80);
  if (/שכר|₪|שקל/.test(lower)) {
    patch.salaryRange = message.slice(0, 80);
    const nums = lower.match(/(\d{4,6})/g);
    if (nums?.[0]) patch.salaryMin = nums[0];
    if (nums?.[1]) patch.salaryMax = nums[1];
  }
  const must = extractList(lower, /חובה[:\s]+(.+)/i);
  if (must.length) patch.mustHaves = must;
  const nice = extractList(lower, /יתרון[:\s]+(.+)/i);
  if (nice.length) patch.niceToHaves = nice;
  if (/אופי|צוות|אנרגטי|רגוע|שירותי/.test(lower)) patch.personalityFit = message.slice(0, 160);
  if (/תרבות|אווירה/.test(lower)) patch.teamCulture = message.slice(0, 120);
  if (/ראיון|זמין|יום|שעה|אחה״צ/.test(lower)) patch.interviewSlots = [message.slice(0, 120)];
  if (/דחוף|מיידי|השבוע/.test(lower)) patch.urgency = message.slice(0, 60);
  if (/הטבות|אוכל|נסיעות|ביטוח/.test(lower)) patch.benefits = message.slice(0, 120);
  if (/לילה/.test(lower)) patch.nightShiftsRequired = /לא.*לילה/.test(lower) ? "לא" : "כן";
  if (/סופ.?שבוע|שישי|שבת/.test(lower)) {
    patch.weekendsRequired = /לא.*סופ/.test(lower) ? "לא" : "כן";
  }
  if (/רכב|רישיון/.test(lower)) patch.transportNeeded = message.slice(0, 80);
  if (/פיזי|הרמה|עמידה/.test(lower)) patch.physicalDemands = message.slice(0, 100);
  if (/קהל|לקוחות/.test(lower)) patch.customerFacing = "כן";
  if (/חברה|עסק|רשת/.test(lower)) patch.companyDescription = message.slice(0, 160);
  if (/קו אדום|לא לקבל|חובה שיהיה/.test(lower)) patch.dealBreakers = message.slice(0, 120);
  if (message.trim().length > 40) patch.narrative = message.trim().slice(0, 400);
  return patch;
}

const CANDIDATE_FOLLOWUPS: Record<string, string> = {
  desiredRole: "ספר/י לי קצת — איזה תפקיד מדבר אליך עכשיו?",
  field: "באיזה תחום זה בעיקר?",
  location: "באיזה אזור נוח לך לעבוד?",
  experienceYears: "כמה זמן כבר בעניין הזה, בערך?",
  skills: "מה לדעתך הכי חזק אצלך בעבודה?",
  personality: "איך היית מתאר/ת את עצמך עם צוות או מול לקוחות?",
  salaryExpectation: "מה בערך ציפיית השכר שלך?",
  interviewAvailability: "מתי בדרך כלל נוח לך לראיון?",
  dealBreakers: "יש משהו שהוא קו אדום מבחינתך?",
  shiftPreference: "יש העדפה למשמרות — בוקר, ערב, לילה?",
  transportation: "איך את/ה בדרך כלל מגיע/ה לעבודה?",
  motivation: "מה גורם לך לרצות את התפקיד הבא?",
};

const JOB_FOLLOWUPS: Record<string, string> = {
  title: "איזה תפקיד את/ה מגייס/ת עכשיו?",
  field: "מה התחום של המשרה?",
  location: "איפה המיקום?",
  mustHaves: "מה באמת חובה שיהיה למועמד/ת?",
  personalityFit: "איזה אופי ישתלב טוב אצלכם בצוות?",
  interviewSlots: "מתי את/ה פנוי/ה לראיונות השבוע?",
  salaryRange: "מה טווח השכר או התנאים?",
  urgency: "כמה דחוף הגיוס?",
  teamCulture: "איך היית מתאר/ת את האווירה אצלכם?",
  dealBreakers: "מה יהיה דיל-ברייקר אצל מועמד/ת?",
  benefits: "יש הטבות שחשוב לציין?",
  workModel: "העבודה מהמשרד, היברידית או מרחוק?",
};

function warmAck(patch: Record<string, unknown>, kind: "candidate" | "job"): string {
  if (patch.desiredRole || patch.title) {
    const role = String(patch.desiredRole ?? patch.title);
    return kind === "candidate" ? `מעולה, ${role} — קיבלתי.` : `מעולה, מגייסים ל${role}.`;
  }
  if (patch.field) return `יופי, תחום ${String(patch.field)}.`;
  if (patch.location) return `הבנתי, ${String(patch.location)}.`;
  if (Object.keys(patch).length) return "תודה, קלטתי.";
  return "היי, אני כאן איתך.";
}

function pickFollowUp(
  chat: ChatMessage[],
  missingKey: string | undefined,
  prompts: Record<string, string>,
  fallback: string,
): string {
  const ordered = missingKey
    ? [missingKey, ...Object.keys(prompts).filter((k) => k !== missingKey)]
    : Object.keys(prompts);
  for (const key of ordered) {
    const q = prompts[key];
    if (q && !wasQuestionJustAsked(chat, q)) return q;
  }
  return fallback;
}

export function heuristicEmployeeIntake(
  message: string,
  card: CandidateCard,
  pending: FieldQuestion[],
  chat: ChatMessage[] = [],
): IntakeResult {
  const patch = extractCandidatePatch(message, card);
  const fieldAnswers: { questionId: string; answer: string }[] = [];
  if (pending.length && message.trim().length > 5) {
    fieldAnswers.push({ questionId: pending[0].id, answer: message.trim() });
  }

  const nextCard = { ...card, ...patch } as CandidateCard;
  if (patch.skills) nextCard.skills = patch.skills;

  if (pending.length && fieldAnswers.length === 0) {
    return {
      reply: `לפני שנמשיך — מעסיקים בתחום שאלו משהו חשוב: ${pending[0].question}`,
      candidatePatch: patch,
      fieldAnswers,
      provider: "heuristic",
    };
  }

  const missing = nextMissingCandidateField(nextCard);
  const followUp = pickFollowUp(
    chat,
    missing?.key,
    CANDIDATE_FOLLOWUPS,
    "ספר/י לי עוד משהו שחשוב לך בתפקיד הבא.",
  );
  if (Object.keys(patch).length) {
    patch.summary = [nextCard.desiredRole, nextCard.field, nextCard.location]
      .filter(Boolean)
      .join(" · ");
  }

  return {
    reply: `${warmAck(patch as Record<string, unknown>, "candidate")} ${followUp}`,
    candidatePatch: patch,
    fieldAnswers,
    provider: "heuristic",
  };
}

export function heuristicEmployerIntake(
  message: string,
  card: JobCard,
  chat: ChatMessage[] = [],
): IntakeResult {
  const patch = extractJobPatch(message, card);
  const nextCard = { ...card, ...patch } as JobCard;
  if (patch.mustHaves) nextCard.mustHaves = patch.mustHaves;
  if (patch.interviewSlots) nextCard.interviewSlots = patch.interviewSlots;

  const missing = nextMissingJobField(nextCard);
  const followUp = pickFollowUp(
    chat,
    missing?.key,
    JOB_FOLLOWUPS,
    "ספר/י לי עוד ניואנס על מי שבאמת ישתלב אצלכם.",
  );
  if (Object.keys(patch).length) {
    patch.summary = [nextCard.title, nextCard.field, nextCard.location]
      .filter(Boolean)
      .join(" · ");
  }

  return {
    reply: `${warmAck(patch as Record<string, unknown>, "job")} ${followUp}`,
    jobPatch: patch,
    provider: "heuristic",
  };
}
