"use client";

import { useEffect, useState } from "react";
import { FlexibilitySlider } from "@/components/FlexibilitySlider";
import { useTranslation } from "@/components/LocaleProvider";
import { candidateMiniCardLines } from "@/domain/candidate-mini-card";
import { candidateRows, knowledgePercent } from "@/domain/card-progress";
import { emptyCandidateCard, type CandidateCard } from "@/domain/types";

function clampFlex(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(10, Math.round(value)));
}

function MetricBar(props: {
  label: string;
  valueLabel: string;
  percent: number;
  tone?: "accent" | "sky";
}) {
  const toneClass = props.tone === "sky" ? "bg-[var(--sky)]" : "bg-[var(--accent)]";
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
        <span className="truncate">{props.label}</span>
        <span className="shrink-0 font-medium text-[var(--ink)]">{props.valueLabel}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--chip)]"
        role="progressbar"
        aria-valuenow={props.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={props.label}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${toneClass}`}
          style={{ width: `${props.percent}%` }}
        />
      </div>
    </div>
  );
}

export function CandidateProfileStrip(props: {
  userId: string;
  card: CandidateCard | null | undefined;
  onFlexibilityChange?: (value: number) => void;
}) {
  const { t } = useTranslation();
  const card = props.card ?? emptyCandidateCard();
  const [open, setOpen] = useState(false);
  const [flex, setFlex] = useState(clampFlex(card.flexibility));

  useEffect(() => {
    setFlex(clampFlex(card.flexibility));
  }, [card.flexibility]);

  const labels = t.cardFields.candidate as Record<string, string>;
  const rows = candidateRows(card, labels);
  const knowledge = knowledgePercent(rows);
  const flexPercent = Math.round((flex / 10) * 100);
  const miniLines = candidateMiniCardLines(card, labels);

  function onFlex(value: number) {
    setFlex(value);
    props.onFlexibilityChange?.(value);
  }

  return (
    <section className="panel rounded-[1rem] px-3 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 text-start"
        aria-expanded={open}
      >
        <span className="shrink-0 text-xs font-semibold text-[var(--hero)]">{t.profile.yourCard}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <MetricBar
            label={t.profile.knowledge}
            valueLabel={fmtPercent(t.profile.knowledgePercent, knowledge)}
            percent={knowledge}
          />
          <MetricBar
            label={t.profile.flexibility}
            valueLabel={fmtFlex(t.profile.flexibilityValue, flex)}
            percent={flexPercent}
            tone="sky"
          />
        </div>
        <span className="shrink-0 text-[10px] text-[var(--muted)]">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="mt-3 border-t border-[var(--stroke)] pt-3">
          <p className="mb-2 text-[10px] leading-4 text-[var(--muted)]">{t.profile.miniCardHint}</p>
          {miniLines.length > 0 ? (
            <dl className="space-y-1.5 text-xs">
              {miniLines.map((line) => (
                <div key={line.key}>
                  <dt className="text-[10px] text-[var(--muted)]">{line.label}</dt>
                  <dd className="leading-5 text-[var(--ink)]">{line.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-[var(--muted)]">{t.profile.miniCardEmpty}</p>
          )}
          <div className="mt-3 border-t border-[var(--stroke)] pt-2">
            <FlexibilitySlider userId={props.userId} value={flex} onChange={onFlex} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function fmtPercent(template: string, percent: number): string {
  return template.replace("{percent}", String(percent));
}

function fmtFlex(template: string, value: number): string {
  return template.replace("{value}", String(value));
}
