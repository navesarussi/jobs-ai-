"use client";

import { useEffect, useRef, useState } from "react";
import { InlineInfoHint } from "@/components/InlineInfoHint";
import { useTranslation } from "@/components/LocaleProvider";

export function FlexibilitySlider(props: {
  userId: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(clamp(props.value));
  const [saving, setSaving] = useState(false);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(clamp(props.value));
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
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flexibility-control">
      <div className="flexibility-control__header">
        <span className="flexibility-control__title-wrap">
          <span className="flexibility-control__title">{t.flexibility.title}</span>
          <InlineInfoHint label={t.flexibility.title} tooltipPlacement="top">
            <span className="inline-info-hint__lines">
              <span>{t.flexibility.tooltipExact}</span>
              <span>{t.flexibility.tooltipFlexible}</span>
            </span>
          </InlineInfoHint>
        </span>
        <span className={`flexibility-control__value${saving ? " is-saving" : ""}`}>
          {local}/10
        </span>
      </div>

      <div className="flexibility-slider">
        <div className="flexibility-slider__track" aria-hidden>
          <div
            className="flexibility-slider__fill"
            style={{ ["--flex-pct" as string]: `${(local / 10) * 100}%` }}
          >
            <span className="flexibility-slider__marker" />
          </div>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={local}
          aria-label={t.flexibility.title}
          aria-valuemin={1}
          aria-valuemax={10}
          aria-valuenow={local}
          onChange={(e) => {
            const next = clamp(Number(e.target.value));
            setLocal(next);
            props.onChange(next);
            scheduleSave(next);
          }}
          className="flexibility-slider__input"
        />
      </div>
    </div>
  );
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(10, Math.round(value)));
}
