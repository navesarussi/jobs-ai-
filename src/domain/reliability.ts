import type {
  CandidateReliability,
  FieldConflict,
  PendingInference,
  ReliabilityNote,
} from "./types";
import { emptyReliability } from "./types";

export type RecomputeReliabilityInput = {
  conflicts: FieldConflict[];
  pendingInferences: PendingInference[];
  prior?: CandidateReliability;
  notes?: ReliabilityNote[];
  now?: string;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * score = clamp(100 - 15*open(cv_vs_chat|chat_internal) - 10*open(cv_internal)
 *                - 5*pendingLowInferences - 5*open(unresolved_inference), 0, 100)
 */
export function recomputeReliability(input: RecomputeReliabilityInput): CandidateReliability {
  const now = input.now ?? new Date().toISOString();
  const notes = input.notes ?? input.prior?.notes ?? [];

  const openNotes = notes.filter((n) => n.status === "open");
  const openConflictNotes = openNotes.filter(
    (n) => n.kind === "cv_vs_chat" || n.kind === "chat_internal",
  ).length;
  const openCvInternal = openNotes.filter((n) => n.kind === "cv_internal").length;
  const openUnresolvedInf = openNotes.filter((n) => n.kind === "unresolved_inference").length;
  const pendingLow = input.pendingInferences.filter((p) => p.status === "pending").length;

  // Pending field conflicts without a note still count as cv_vs_chat-class penalties
  const pendingConflicts = input.conflicts.filter((c) => c.status === "pending");
  const notedFields = new Set(
    openNotes.filter((n) => n.fieldKey).map((n) => n.fieldKey as string),
  );
  const unnotedPending = pendingConflicts.filter((c) => !notedFields.has(c.fieldKey)).length;

  const score = clamp(
    100 -
      15 * (openConflictNotes + unnotedPending) -
      10 * openCvInternal -
      5 * (pendingLow + openUnresolvedInf),
  );

  return {
    score,
    notes,
    updatedAt: now,
  };
}

export function openReliabilityNote(
  prior: CandidateReliability | undefined,
  note: Omit<ReliabilityNote, "id" | "status" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
  now = new Date().toISOString(),
): CandidateReliability {
  const base = prior ?? emptyReliability(now);
  const fieldKey = note.fieldKey;
  if (fieldKey) {
    const existing = base.notes.find(
      (n) => n.fieldKey === fieldKey && n.status === "open" && n.kind === note.kind,
    );
    if (existing) {
      return recomputeReliability({
        conflicts: [],
        pendingInferences: [],
        notes: base.notes.map((n) =>
          n.id === existing.id ? { ...n, summary: note.summary } : n,
        ),
        now,
      });
    }
  }
  const next: ReliabilityNote = {
    id: note.id ?? `rel-${note.kind}-${fieldKey ?? "x"}-${now}`,
    kind: note.kind,
    fieldKey: note.fieldKey,
    summary: note.summary,
    status: "open",
    createdAt: note.createdAt ?? now,
  };
  return recomputeReliability({
    conflicts: [],
    pendingInferences: [],
    notes: [...base.notes, next],
    now,
  });
}

export function resolveReliabilityNotesForField(
  prior: CandidateReliability | undefined,
  fieldKey: string,
  now = new Date().toISOString(),
): CandidateReliability {
  const base = prior ?? emptyReliability(now);
  const notes = base.notes.map((n) =>
    n.fieldKey === fieldKey && n.status === "open"
      ? { ...n, status: "resolved" as const, resolvedAt: now }
      : n,
  );
  return recomputeReliability({
    conflicts: [],
    pendingInferences: [],
    notes,
    now,
  });
}
