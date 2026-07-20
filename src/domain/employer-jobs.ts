import type { ChatMessage, EmployerRecord, JobCard, JobSlot } from "./types";
import { emptyJobCard, normalizeJobCard } from "./types";

function newJobId(): string {
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createJobSlot(partial?: {
  id?: string;
  card?: Partial<JobCard>;
  chat?: ChatMessage[];
}): JobSlot {
  return {
    id: partial?.id ?? newJobId(),
    card: normalizeJobCard(partial?.card),
    chat: partial?.chat ?? [],
  };
}

/** Ensure employer has jobs[] + activeJobId; sync card/chat to the active slot. */
export function normalizeEmployerRecord(
  raw: EmployerRecord | (Omit<EmployerRecord, "jobs" | "activeJobId"> & {
    jobs?: JobSlot[];
    activeJobId?: string;
  }),
): EmployerRecord {
  const legacyCard = normalizeJobCard(raw.card);
  const legacyChat = raw.chat ?? [];
  let jobs = (raw.jobs ?? []).map((j) => ({
    id: j.id,
    card: normalizeJobCard(j.card),
    chat: j.chat ?? [],
  }));

  if (jobs.length === 0) {
    jobs = [
      createJobSlot({
        id: raw.userId,
        card: legacyCard,
        chat: legacyChat,
      }),
    ];
  }

  const activeJobId =
    (raw.activeJobId && jobs.some((j) => j.id === raw.activeJobId)
      ? raw.activeJobId
      : jobs[0]!.id) ?? jobs[0]!.id;
  const active = jobs.find((j) => j.id === activeJobId)!;

  return {
    userId: raw.userId,
    jobs,
    activeJobId,
    card: active.card,
    chat: active.chat,
  };
}

export function getActiveJob(employer: EmployerRecord): JobSlot {
  const normalized = normalizeEmployerRecord(employer);
  return normalized.jobs.find((j) => j.id === normalized.activeJobId) ?? normalized.jobs[0]!;
}

export function withActiveJob(employer: EmployerRecord, jobId: string): EmployerRecord {
  const normalized = normalizeEmployerRecord(employer);
  if (!normalized.jobs.some((j) => j.id === jobId)) return normalized;
  const active = normalized.jobs.find((j) => j.id === jobId)!;
  return {
    ...normalized,
    activeJobId: jobId,
    card: active.card,
    chat: active.chat,
  };
}

export function updateJobSlot(
  employer: EmployerRecord,
  jobId: string,
  patch: { card?: JobCard; chat?: ChatMessage[] },
): EmployerRecord {
  const normalized = normalizeEmployerRecord(employer);
  const jobs = normalized.jobs.map((j) =>
    j.id === jobId
      ? {
          ...j,
          card: patch.card ?? j.card,
          chat: patch.chat ?? j.chat,
        }
      : j,
  );
  const next = { ...normalized, jobs };
  return withActiveJob(next, normalized.activeJobId);
}

export function addEmployerJob(employer: EmployerRecord): EmployerRecord {
  const normalized = normalizeEmployerRecord(employer);
  const job = createJobSlot({ card: emptyJobCard(), chat: [] });
  const jobs = [...normalized.jobs, job];
  return withActiveJob({ ...normalized, jobs }, job.id);
}

export function jobLabel(job: JobSlot, fallbackIndex: number): string {
  const title = job.card.title?.trim();
  if (title) return title;
  const field = job.card.field?.trim();
  if (field) return field;
  return `משרה ${fallbackIndex + 1}`;
}
