export type Role = "employee" | "employer";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type CandidateCard = {
  summary: string;
  desiredRole: string;
  field: string;
  subField: string;
  location: string;
  preferredCities: string;
  remotePreference: string;
  relocationWillingness: string;
  experienceYears: number | null;
  experienceLevel: string;
  skills: string[];
  softSkills: string[];
  languages: string[];
  hebrewLevel: string;
  englishLevel: string;
  education: string;
  certifications: string;
  licenses: string;
  computerSkills: string;
  salaryExpectation: string;
  salaryMin: string;
  salaryMax: string;
  employmentType: string;
  hoursPerWeek: string;
  shiftPreference: string;
  nightShiftsOk: string;
  weekendsOk: string;
  transportation: string;
  hasVehicle: string;
  drivingLicense: string;
  personality: string;
  workStyle: string;
  strengths: string;
  weaknesses: string;
  careerGoals: string;
  motivation: string;
  dealBreakers: string;
  noticePeriod: string;
  startDate: string;
  availability: string;
  interviewAvailability: string;
  customerFacingOk: string;
  physicalRequirementsOk: string;
  managementExperience: string;
  teamSizeManaged: string;
  industryExperience: string;
  portfolioUrl: string;
  linkedinUrl: string;
  referencesAvailable: string;
  /** Free-form narrative / stories from conversation */
  narrative: string;
  /** Structured employment history (also mirrored on cv profile). */
  workHistory: WorkHistoryEntry[];
  /** Structured education history (also mirrored on cv profile). */
  educationHistory: EducationHistoryEntry[];
  /** 1 = גמיש מאוד, 10 = חייב התאמה מדויקת */
  flexibility: number;
  extras: Record<string, string>;
};

export type JobCard = {
  summary: string;
  title: string;
  field: string;
  subField: string;
  location: string;
  workModel: string;
  scope: string;
  employmentType: string;
  hoursPerWeek: string;
  shiftPattern: string;
  nightShiftsRequired: string;
  weekendsRequired: string;
  salaryRange: string;
  salaryMin: string;
  salaryMax: string;
  benefits: string;
  mustHaves: string[];
  niceToHaves: string[];
  requiredLanguages: string[];
  requiredLicenses: string;
  requiredEducation: string;
  minExperienceYears: string;
  seniorityLevel: string;
  toolsRequired: string;
  personalityFit: string;
  teamCulture: string;
  managementStyle: string;
  teamSize: string;
  reportsTo: string;
  customerFacing: string;
  physicalDemands: string;
  dressCode: string;
  transportNeeded: string;
  startDate: string;
  urgency: string;
  interviewSlots: string[];
  interviewProcess: string;
  probationPeriod: string;
  growthPath: string;
  companyDescription: string;
  companySize: string;
  industry: string;
  dealBreakers: string;
  successMetrics: string;
  onboardingNotes: string;
  contactName: string;
  contactPhone: string;
  /** Free-form narrative about the role / culture */
  narrative: string;
  /** 1 = גמיש מאוד בדרישות, 10 = רק התאמה מדויקת */
  flexibility: number;
  extras: Record<string, string>;
};

export type User = {
  id: string;
  name: string;
  role: Role;
  email?: string;
  image?: string;
  googleId?: string;
  createdAt: string;
};

export type EvidenceSource = "cv" | "chat" | "user";
export type EvidenceConfidence = "high" | "medium" | "low";

export type WorkHistoryEntry = {
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
  achievements?: string[];
};

export type EducationHistoryEntry = {
  institution: string;
  degreeOrProgram: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  details?: string;
};

export type UnmappedFact = {
  label: string;
  value: string;
  confidence?: EvidenceConfidence;
};

export type FieldEvidence = {
  fieldKey: string;
  value: string;
  source: EvidenceSource;
  confidence?: EvidenceConfidence;
  at: string;
  documentId?: string;
};

export type FieldConflict = {
  id: string;
  fieldKey: string;
  values: { value: string; source: EvidenceSource; at: string }[];
  status: "pending" | "resolved";
  resolvedValue?: string;
};

export type CandidateDocument = {
  id: string;
  kind: "cv";
  fileName: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
  uploadedAt: string;
  textCharCount: number;
  extractedText: string;
  extractionStatus?: "pending" | "ok" | "partial" | "failed";
};

export type PendingInference = {
  id: string;
  fieldKey: string;
  value: string;
  evidence: string;
  confidence: "low";
  status: "pending" | "accepted" | "rejected";
  at: string;
};

export type ReliabilityNote = {
  id: string;
  kind: "cv_vs_chat" | "chat_internal" | "cv_internal" | "unresolved_inference";
  fieldKey?: string;
  summary: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
};

export type CandidateReliability = {
  score: number;
  notes: ReliabilityNote[];
  updatedAt: string;
};

export type CandidateCvProfile = {
  workHistory: WorkHistoryEntry[];
  educationHistory: EducationHistoryEntry[];
  unmappedFacts: UnmappedFact[];
  fieldEvidence: FieldEvidence[];
  conflicts: FieldConflict[];
  documents: CandidateDocument[];
  pendingInferences: PendingInference[];
  reliability: CandidateReliability;
};

export function emptyReliability(now = ""): CandidateReliability {
  return { score: 100, notes: [], updatedAt: now };
}

export type EmployeeRecord = {
  userId: string;
  card: CandidateCard;
  chat: ChatMessage[];
  pendingFieldQuestionIds: string[];
  /** CV extraction artifacts (histories, provenance, documents). */
  cv?: CandidateCvProfile;
};

export function emptyCvProfile(): CandidateCvProfile {
  return {
    workHistory: [],
    educationHistory: [],
    unmappedFacts: [],
    fieldEvidence: [],
    conflicts: [],
    documents: [],
    pendingInferences: [],
    reliability: emptyReliability(),
  };
}

export type JobSlot = {
  id: string;
  card: JobCard;
  chat: ChatMessage[];
};

export type EmployerRecord = {
  userId: string;
  /** Mirrors the active job card (compat + matching helpers). */
  card: JobCard;
  /** Mirrors the active job chat. */
  chat: ChatMessage[];
  jobs: JobSlot[];
  activeJobId: string;
};

export type FieldQuestion = {
  id: string;
  field: string;
  question: string;
  sourceJobId: string;
  sourceEmployerId: string;
  createdAt: string;
};

export type FieldAnswer = {
  questionId: string;
  candidateId: string;
  answer: string;
  answeredAt: string;
};

export type MatchStatus = "queued" | "approved" | "rejected";

export type Match = {
  id: string;
  jobOwnerId: string;
  /** Job slot id; falls back to jobOwnerId for legacy rows. */
  jobId: string;
  candidateId: string;
  score: number;
  reason: string;
  status: MatchStatus;
  createdAt: string;
  updatedAt: string;
};

/** Bump when shipping new default prompt files so stale admin overrides refresh. */
export const PROMPT_BUNDLE_VERSION = "2026-07-24-cv-reliability-v1";

export type AdminSettings = {
  candidatePrompt: string;
  employerPrompt: string;
  updatedAt?: string;
  updatedBy?: string;
  /** Matches PROMPT_BUNDLE_VERSION when saved from admin; otherwise files win. */
  promptBundleVersion?: string;
};

export type AiUsageType =
  | "employee_intake"
  | "employer_intake"
  | "enrich_reason"
  | "cv_import"
  | "job_import";

export type AiUsageRecord = {
  id: string;
  type: AiUsageType;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  createdAt: string;
};

export type StoreData = {
  users: User[];
  employees: EmployeeRecord[];
  employers: EmployerRecord[];
  fieldQuestions: FieldQuestion[];
  fieldAnswers: FieldAnswer[];
  matches: Match[];
  adminSettings?: AdminSettings;
  aiUsage?: AiUsageRecord[];
};

export function emptyCandidateCard(): CandidateCard {
  return {
    summary: "",
    desiredRole: "",
    field: "",
    subField: "",
    location: "",
    preferredCities: "",
    remotePreference: "",
    relocationWillingness: "",
    experienceYears: null,
    experienceLevel: "",
    skills: [],
    softSkills: [],
    languages: [],
    hebrewLevel: "",
    englishLevel: "",
    education: "",
    certifications: "",
    licenses: "",
    computerSkills: "",
    salaryExpectation: "",
    salaryMin: "",
    salaryMax: "",
    employmentType: "",
    hoursPerWeek: "",
    shiftPreference: "",
    nightShiftsOk: "",
    weekendsOk: "",
    transportation: "",
    hasVehicle: "",
    drivingLicense: "",
    personality: "",
    workStyle: "",
    strengths: "",
    weaknesses: "",
    careerGoals: "",
    motivation: "",
    dealBreakers: "",
    noticePeriod: "",
    startDate: "",
    availability: "",
    interviewAvailability: "",
    customerFacingOk: "",
    physicalRequirementsOk: "",
    managementExperience: "",
    teamSizeManaged: "",
    industryExperience: "",
    portfolioUrl: "",
    linkedinUrl: "",
    referencesAvailable: "",
    narrative: "",
    workHistory: [],
    educationHistory: [],
    flexibility: 5,
    extras: {},
  };
}

export function emptyJobCard(): JobCard {
  return {
    summary: "",
    title: "",
    field: "",
    subField: "",
    location: "",
    workModel: "",
    scope: "",
    employmentType: "",
    hoursPerWeek: "",
    shiftPattern: "",
    nightShiftsRequired: "",
    weekendsRequired: "",
    salaryRange: "",
    salaryMin: "",
    salaryMax: "",
    benefits: "",
    mustHaves: [],
    niceToHaves: [],
    requiredLanguages: [],
    requiredLicenses: "",
    requiredEducation: "",
    minExperienceYears: "",
    seniorityLevel: "",
    toolsRequired: "",
    personalityFit: "",
    teamCulture: "",
    managementStyle: "",
    teamSize: "",
    reportsTo: "",
    customerFacing: "",
    physicalDemands: "",
    dressCode: "",
    transportNeeded: "",
    startDate: "",
    urgency: "",
    interviewSlots: [],
    interviewProcess: "",
    probationPeriod: "",
    growthPath: "",
    companyDescription: "",
    companySize: "",
    industry: "",
    dealBreakers: "",
    successMetrics: "",
    onboardingNotes: "",
    contactName: "",
    contactPhone: "",
    narrative: "",
    flexibility: 5,
    extras: {},
  };
}

export function normalizeCandidateCard(raw: Partial<CandidateCard> | undefined): CandidateCard {
  return { ...emptyCandidateCard(), ...(raw ?? {}) };
}

export function normalizeJobCard(raw: Partial<JobCard> | undefined): JobCard {
  return { ...emptyJobCard(), ...(raw ?? {}) };
}
