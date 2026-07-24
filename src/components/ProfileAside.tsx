"use client";

import { useEffect, useState } from "react";
import { FlexibilitySlider } from "@/components/FlexibilitySlider";
import { useTranslation } from "@/components/LocaleProvider";
import { Panel } from "@/components/ui/Panel";
import { candidateRows, jobRows, knowledgePercent } from "@/domain/card-progress";
import {
  emptyCandidateCard,
  emptyJobCard,
  type CandidateCard,
  type JobCard,
} from "@/domain/types";

export function ProfileAside(props: {
  kind: "employee" | "employer";
  userId: string;
  card: CandidateCard | JobCard | null | undefined;
  pendingQuestions?: { id: string; question: string }[];
  onFlexibilityChange?: (value: number) => void;
  showFullCard?: boolean;
}) {
  const { t, fmt } = useTranslation();
  const showFullCard = props.showFullCard ?? false;
  const [flex, setFlex] = useState(5);

  const c =
    props.card ??
    (props.kind === "employee" ? emptyCandidateCard() : emptyJobCard());

  useEffect(() => {
    setFlex(clampFlex((c as CandidateCard | JobCard).flexibility));
  }, [c]);

  const labels = (props.kind === "employee"
    ? t.cardFields.candidate
    : t.cardFields.job) as Record<string, string>;
  const rows =
    props.kind === "employee"
      ? candidateRows(c as CandidateCard, labels)
      : jobRows(c as JobCard, labels);
  const percent = knowledgePercent(rows);

  function onFlex(value: number) {
    setFlex(value);
    props.onFlexibilityChange?.(value);
  }

  return (
    <Panel as="aside" className={`flex flex-col p-5 ${showFullCard ? "max-h-[70vh]" : ""}`}>
      <h2 className="text-sm font-bold text-[var(--hero)]">
        {props.kind === "employee" ? t.profile.yourCard : t.profile.jobCard}
      </h2>

      <div className="mt-4 flex items-center gap-4">
        <div
          className="knowledge-ring shrink-0"
          style={{
            background: `conic-gradient(from -90deg, var(--accent) 0%, var(--accent) ${percent}%, rgba(59,130,246,0.15) ${percent}%)`,
          }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t.profile.knowledge}
        >
          <span>{percent}%</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-[var(--hero)]">{t.profile.knowledge}</p>
          <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
            {t.profile.knowledgeHint}
          </p>
        </div>
      </div>

      <FlexibilitySlider userId={props.userId} value={flex} onChange={onFlex} />

      {showFullCard && props.pendingQuestions && props.pendingQuestions.length > 0 ? (
        <div className="mt-3 rounded-xl bg-[var(--warn-bg)] p-3 text-xs text-[var(--warn)]">
          {fmt(t.profile.pendingQuestions, { count: props.pendingQuestions.length })}
        </div>
      ) : null}

      {showFullCard ? (
        <>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{t.profile.autoFillHint}</p>
          <dl className="mt-3 space-y-2 overflow-y-auto pe-1 text-sm">
            {rows.map((row) => (
              <div key={row.key} className={row.filled ? "" : "opacity-55"}>
                <dt className="text-xs text-[var(--muted)]">{row.label}</dt>
                <dd className="text-[var(--ink)]">{row.value || t.profile.emptyValue}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </Panel>
  );
}

function clampFlex(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(10, Math.round(value)));
}
