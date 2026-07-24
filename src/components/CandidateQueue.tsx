"use client";

import { useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/Button";

type Item = {
  matchId: string;
  score: number;
  reason: string;
  name: string;
  candidateId?: string;
  cvDocumentId?: string | null;
  card?: {
    summary: string;
    desiredRole: string;
    field: string;
    location: string;
    personality: string;
    flexibility: number;
    skills: string[];
  };
};

export function CandidateQueue(props: {
  employerId: string;
  items: Item[];
  onChanged: () => void;
}) {
  const { t, fmt } = useTranslation();
  const [questionById, setQuestionById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(matchId: string, action: "approve" | "reject" | "ask") {
    setBusyId(matchId);
    try {
      await fetch("/api/employer/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employerId: props.employerId,
          matchId,
          action,
          question: questionById[matchId],
        }),
      });
      props.onChanged();
    } finally {
      setBusyId(null);
    }
  }

  function openCv(item: Item) {
    if (!item.candidateId || !item.cvDocumentId) return;
    const qs = new URLSearchParams({
      viewerId: props.employerId,
      candidateId: item.candidateId,
      documentId: item.cvDocumentId,
    });
    window.open(`/api/cv/document?${qs.toString()}`, "_blank", "noopener,noreferrer");
  }

  if (props.items.length === 0) {
    return (
      <div className="empty-state panel-elevated border-dashed p-12 text-center text-sm text-[var(--muted)]">
        {t.candidates.empty}
      </div>
    );
  }

  return (
    <div className="tab-fade space-y-4">
      {props.items.map((item) => (
        <article
          key={item.matchId}
          className="panel-elevated p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-md)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[var(--hero)]">{item.name}</h3>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                {item.card?.desiredRole || t.candidates.roleNotSpecified}
                {item.card?.field ? ` · ${item.card.field}` : ""}
                {item.card?.location ? ` · ${item.card.location}` : ""}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--accent-strong)]">
              {Math.round(item.score * 100)}%
            </span>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--ink)]">{item.reason}</p>
          {item.card?.personality ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {fmt(t.candidates.personality, { value: item.card.personality })}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-[var(--muted)]">
            {fmt(t.candidates.flexibility, { value: item.card?.flexibility ?? "—" })}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {item.cvDocumentId ? (
              <Button
                variant="secondary"
                onClick={() => openCv(item)}
                className="min-h-0 px-3 py-2"
              >
                {t.candidates.viewCv}
              </Button>
            ) : null}
            <Button
              disabled={busyId === item.matchId}
              onClick={() => void act(item.matchId, "approve")}
              className="min-h-0 bg-[var(--accent)] px-3 py-2 hover:bg-[var(--accent-strong)]"
            >
              {t.candidates.fit}
            </Button>
            <Button
              variant="secondary"
              disabled={busyId === item.matchId}
              onClick={() => void act(item.matchId, "reject")}
              className="min-h-0 px-3 py-2"
            >
              {t.candidates.notFit}
            </Button>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={questionById[item.matchId] ?? ""}
              onChange={(e) =>
                setQuestionById((s) => ({ ...s, [item.matchId]: e.target.value }))
              }
              placeholder={t.candidates.askPlaceholder}
              className="min-h-11 flex-1 rounded-[var(--control-radius)] border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition duration-200 focus:border-[var(--accent)]"
            />
            <Button
              disabled={busyId === item.matchId}
              onClick={() => void act(item.matchId, "ask")}
              className="min-h-11 px-3"
            >
              {t.candidates.ask}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
