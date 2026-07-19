"use client";

import { candidateRows, jobRows } from "@/domain/card-progress";
import { CANDIDATE_FIELD_META, JOB_FIELD_META } from "@/domain/card-fields";
import type { CandidateCard, JobCard } from "@/domain/types";

export function ProfileAside(props: {
  kind: "employee" | "employer";
  card: CandidateCard | JobCard | null | undefined;
  pendingQuestions?: { id: string; question: string }[];
}) {
  const c = props.card;
  if (!c) return null;

  const labels = Object.fromEntries(
    (props.kind === "employee" ? CANDIDATE_FIELD_META : JOB_FIELD_META).map((m) => [
      m.key,
      m.label,
    ]),
  );

  const rows =
    props.kind === "employee"
      ? candidateRows(c as CandidateCard, labels)
      : jobRows(c as JobCard, labels);
  const card = c as CandidateCard;

  return (
    <aside className="flex max-h-[70vh] flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--ink)]">
        {props.kind === "employee" ? "הכרטיס שלך" : "כרטיס המשרה"}
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">מתמלא אוטומטית מהשיחה · כולל טקסט חופשי</p>

      {props.kind === "employee" ? (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--muted)]">
            <span>גמישות</span>
            <span>{card.flexibility}/10</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--chip)]">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(card.flexibility / 10) * 100}%` }} />
          </div>
        </div>
      ) : null}

      {props.pendingQuestions && props.pendingQuestions.length > 0 ? (
        <div className="mt-3 rounded-xl bg-[var(--warn-bg)] p-3 text-xs text-[var(--warn)]">
          יש {props.pendingQuestions.length} שאלות תחום שמחכות בשיחה
        </div>
      ) : null}

      <dl className="mt-4 space-y-2 overflow-y-auto pe-1 text-sm">
        {rows.map((row) => (
          <div key={row.key} className={row.filled ? "" : "opacity-55"}>
            <dt className="text-xs text-[var(--muted)]">{row.label}</dt>
            <dd className="text-[var(--ink)]">{row.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
