"use client";

import { useState } from "react";
import { FlexibilitySlider } from "@/components/FlexibilitySlider";
import { useTranslation } from "@/components/LocaleProvider";
import { candidateMiniCardLines } from "@/domain/candidate-mini-card";
import { candidateRows, knowledgePercent } from "@/domain/card-progress";
import { emptyCandidateCard, type CandidateCard } from "@/domain/types";

export function CandidateProfileStrip(props: {
  card: CandidateCard | null | undefined;
  userId: string;
  onFlexibilityChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const card = props.card ?? emptyCandidateCard();
  const labels = t.cardFields.candidate as Record<string, string>;
  const miniLines = candidateMiniCardLines(card, labels);
  const percent = knowledgePercent(candidateRows(card, labels));

  return (
    <div className={`employee-profile-card ${open ? "employee-profile-card--open" : ""}`}>
      <button
        type="button"
        className="employee-profile-card__toggle"
        aria-expanded={open}
        aria-label={open ? t.profile.hideDetails : t.profile.showDetails}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="employee-profile-card__toggle-copy">
          <span className="employee-profile-card__toggle-title">
            <span className="employee-profile-card__toggle-label">{t.profile.yourCard}</span>
            <span className="employee-profile-card__toggle-percent">{percent}%</span>
          </span>
          <span className="employee-profile-card__toggle-meta">{t.employee.profileStepHint}</span>
        </span>
        <span className="employee-profile-card__expand">
          <svg
            className="employee-profile-card__expand-icon"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M4 6.5L8 10.5L12 6.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="employee-profile-card__expand-label">
            {open ? t.profile.hideDetails : t.profile.showDetails}
          </span>
        </span>
      </button>

      <div
        className="knowledge-bar"
        style={{ ["--knowledge-pct" as string]: `${percent}%` }}
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t.employee.applicationProgress}
      >
        <div className="knowledge-bar__fill" />
      </div>

      {open ? (
        <>
          <div className="employee-profile-card__fields">
            {miniLines.length > 0 ? (
              <dl className="space-y-2">
                {miniLines.map((line) => (
                  <div key={line.key} className="employee-profile-card__field">
                    <dt>{line.label}</dt>
                    <dd>{line.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs leading-6 text-[var(--muted)]">{t.profile.miniCardEmpty}</p>
            )}
          </div>

          <FlexibilitySlider
            userId={props.userId}
            value={card.flexibility}
            onChange={props.onFlexibilityChange}
          />
        </>
      ) : null}
    </div>
  );
}
