import { z } from "zod";

const optStr = z.string().optional();
const optArr = z.array(z.string()).optional();

export const candidatePatchSchema = z.object({
  summary: optStr,
  desiredRole: optStr,
  field: optStr,
  subField: optStr,
  location: optStr,
  preferredCities: optStr,
  remotePreference: optStr,
  relocationWillingness: optStr,
  experienceYears: z.number().nullable().optional(),
  experienceLevel: optStr,
  skills: optArr,
  softSkills: optArr,
  languages: optArr,
  hebrewLevel: optStr,
  englishLevel: optStr,
  education: optStr,
  certifications: optStr,
  licenses: optStr,
  computerSkills: optStr,
  salaryExpectation: optStr,
  salaryMin: optStr,
  salaryMax: optStr,
  employmentType: optStr,
  hoursPerWeek: optStr,
  shiftPreference: optStr,
  nightShiftsOk: optStr,
  weekendsOk: optStr,
  transportation: optStr,
  hasVehicle: optStr,
  drivingLicense: optStr,
  personality: optStr,
  workStyle: optStr,
  strengths: optStr,
  weaknesses: optStr,
  careerGoals: optStr,
  motivation: optStr,
  dealBreakers: optStr,
  noticePeriod: optStr,
  startDate: optStr,
  availability: optStr,
  interviewAvailability: optStr,
  customerFacingOk: optStr,
  physicalRequirementsOk: optStr,
  managementExperience: optStr,
  teamSizeManaged: optStr,
  industryExperience: optStr,
  portfolioUrl: optStr,
  linkedinUrl: optStr,
  referencesAvailable: optStr,
  narrative: optStr,
  flexibility: z.number().min(1).max(10).optional(),
  extras: z.record(z.string(), z.string()).optional(),
});

export const jobPatchSchema = z.object({
  summary: optStr,
  title: optStr,
  field: optStr,
  subField: optStr,
  location: optStr,
  workModel: optStr,
  scope: optStr,
  employmentType: optStr,
  hoursPerWeek: optStr,
  shiftPattern: optStr,
  nightShiftsRequired: optStr,
  weekendsRequired: optStr,
  salaryRange: optStr,
  salaryMin: optStr,
  salaryMax: optStr,
  benefits: optStr,
  mustHaves: optArr,
  niceToHaves: optArr,
  requiredLanguages: optArr,
  requiredLicenses: optStr,
  requiredEducation: optStr,
  minExperienceYears: optStr,
  seniorityLevel: optStr,
  toolsRequired: optStr,
  personalityFit: optStr,
  teamCulture: optStr,
  managementStyle: optStr,
  teamSize: optStr,
  reportsTo: optStr,
  customerFacing: optStr,
  physicalDemands: optStr,
  dressCode: optStr,
  transportNeeded: optStr,
  startDate: optStr,
  urgency: optStr,
  interviewSlots: optArr,
  interviewProcess: optStr,
  probationPeriod: optStr,
  growthPath: optStr,
  companyDescription: optStr,
  companySize: optStr,
  industry: optStr,
  dealBreakers: optStr,
  successMetrics: optStr,
  onboardingNotes: optStr,
  contactName: optStr,
  contactPhone: optStr,
  narrative: optStr,
  flexibility: z.number().min(1).max(10).optional(),
  extras: z.record(z.string(), z.string()).optional(),
});

export type CandidatePatch = z.infer<typeof candidatePatchSchema>;
export type JobPatch = z.infer<typeof jobPatchSchema>;

export type AiTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type IntakeResult = {
  reply: string;
  candidatePatch?: CandidatePatch;
  jobPatch?: JobPatch;
  fieldAnswers?: { questionId: string; answer: string }[];
  provider: "gemini" | "heuristic";
  usage?: AiTokenUsage;
};

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
}

export {
  allowDemoMode,
  allowOpenAuth,
  hasGoogleAuth,
  isGoogleAuthEnabled,
} from "@/infrastructure/auth-flags";
