"use client";

import { useEffect, useRef, useState } from "react";
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

function FlexibilityBar(props: {
  userId: string;
  label: string;
  valueLabel: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(clampFlex(props.value));
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(clampFlex(props.value));
  }, [props.value]);

  function scheduleSave(next: number) {
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, 280);
  }

  async function flush() {
    const value = pending.current;
    pending.current = null;
    if (value == null) return;
    try {
      const res = await fetch("/api/flexibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: props.userId, value }),
      });
      const data = (await res.json()) as { flexibility?: number; error?: string };
      if (data.flexibility != null) {
        props.onChange(data.flexibility);
        setLocal(data.flexibility);
      }
    } catch {
      /* keep local value */
    }
  }

  const percent = Math.round((local / 10) * 100);

  return (
    <div
      className="relative min-w-0 flex-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
        <span className="truncate">{props.label}</span>
        <span className="shrink-0 font-medium text-[var(--ink)]">{props.valueLabel}</span>
      </div>
      <div className="relative h-1.5 cursor-pointer rounded-full bg-[var(--chip)]">
        <div
          className="pointer-events-none absolute inset-y-0 start-0 rounded-full bg-[var(--sky)] transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={local}
          aria-label={t.flexibility.title}
          onChange={(e) => {
            const next = clampFlex(Number(e.target.value));
            setLocal(next);
            props.onChange(next);
            scheduleSave(next);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
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
  const miniLines = candidateMiniCardLines(card, labels);

  function onFlex(value: number) {
    setFlex(value);
    props.onFlexibilityChange?.(value);
  }

  return (
    <section className="panel rounded-[1rem] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 text-start"
          aria-expanded={open}
        >
          <span className="text-xs font-semibold text-[var(--hero)]">{t.profile.yourCard}</span>
          <span className="text-[10px] text-[var(--muted)]">{open ? "▲" : "▼"}</span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <MetricBar
            label={t.profile.knowledge}
            valueLabel={fmtPercent(t.profile.knowledgePercent, knowledge)}
            percent={knowledge}
          />
          <FlexibilityBar
            userId={props.userId}
            label={t.profile.flexibility}
            valueLabel={fmtFlex(t.profile.flexibilityValue, flex)}
            value={flex}
            onChange={onFlex}
          />
        </div>
      </div>

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
