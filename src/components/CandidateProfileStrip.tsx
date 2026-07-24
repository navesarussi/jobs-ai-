"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import { Slider } from "@/components/ui/Slider";
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

  return (
    <div
      className="relative min-w-0 flex-1 rounded-lg border border-[var(--stroke)] bg-[color-mix(in_srgb,var(--chip)_55%,transparent)] px-2.5 py-2 transition duration-150 hover:border-[color-mix(in_srgb,var(--sky)_45%,var(--stroke))]"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
        <span className="truncate">{props.label}</span>
        <span className="shrink-0 font-semibold text-[var(--ink)]">{props.valueLabel}</span>
      </div>
      <Slider
        value={local}
        min={1}
        max={10}
        step={1}
        aria-label={t.flexibility.title}
        className="py-1.5"
        onValueChange={(next) => {
          const clamped = clampFlex(next);
          setLocal(clamped);
          props.onChange(clamped);
          scheduleSave(clamped);
        }}
      />
    </div>
  );
}

export function CandidateProfileStrip(props: {
  userId: string;
  card: CandidateCard | null | undefined;
  onFlexibilityChange?: (value: number) => void;
  variant?: "default" | "toolbar" | "sidebar";
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

  if ((props.variant ?? "default") === "sidebar") {
    return (
      <div className="employee-profile-card">
        <div className="employee-profile-card__metrics">
          <div
            className="knowledge-ring shrink-0"
            style={{
              background: `conic-gradient(from -90deg, var(--accent) 0%, var(--accent) ${knowledge}%, rgba(59,130,246,0.15) ${knowledge}%)`,
            }}
            role="progressbar"
            aria-valuenow={knowledge}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.profile.knowledge}
          >
            <span>{knowledge}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--hero)]">{t.profile.knowledge}</p>
            <p className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">{t.profile.knowledgeHint}</p>
          </div>
        </div>

        <FlexibilityBar
          userId={props.userId}
          label={t.profile.flexibility}
          valueLabel={fmtFlex(t.profile.flexibilityValue, flex)}
          value={flex}
          onChange={onFlex}
        />

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

        <p className="employee-profile-card__live">
          <span className="live-pulse inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          {t.profile.autoFillHint}
        </p>
      </div>
    );
  }

  if ((props.variant ?? "default") === "toolbar") {
    return (
      <div className="employee-toolbar-profile">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
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
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 cursor-pointer rounded-lg border border-[var(--stroke)] bg-white px-2.5 py-1.5 text-[10px] font-medium text-[var(--accent-strong)] transition hover:border-[var(--accent)]"
          aria-expanded={open}
        >
          {open ? t.profile.hideCard : t.profile.yourCard}
        </button>
        {open ? (
          <div className="employee-toolbar-profile__details">
            {miniLines.length > 0 ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                {miniLines.map((line) => (
                  <div key={line.key} className="rounded-lg bg-[var(--chip)] px-3 py-2">
                    <dt className="text-[10px] font-medium text-[var(--muted)]">{line.label}</dt>
                    <dd className="mt-0.5 text-xs leading-5 text-[var(--ink)]">{line.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-[var(--muted)]">{t.profile.miniCardEmpty}</p>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="panel-elevated px-4 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 cursor-pointer items-center gap-2 text-start"
          aria-expanded={open}
        >
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-sm text-[var(--accent-strong)]"
            aria-hidden
          >
            {open ? "−" : "+"}
          </span>
          <span>
            <span className="block text-xs font-semibold text-[var(--hero)]">{t.profile.yourCard}</span>
            <span className="block text-[10px] text-[var(--muted)]">
              {fmtPercent(t.profile.knowledgePercent, knowledge)}
            </span>
          </span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
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
        <div className="mt-4 border-t border-[var(--stroke)] pt-4">
          <p className="mb-2.5 text-[11px] leading-5 text-[var(--muted)]">{t.profile.miniCardHint}</p>
          {miniLines.length > 0 ? (
            <dl className="grid gap-2.5 sm:grid-cols-2">
              {miniLines.map((line) => (
                <div key={line.key} className="rounded-lg bg-[var(--chip)] px-3 py-2">
                  <dt className="text-[10px] font-medium text-[var(--muted)]">{line.label}</dt>
                  <dd className="mt-0.5 text-xs leading-5 text-[var(--ink)]">{line.value}</dd>
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
