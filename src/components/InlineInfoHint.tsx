"use client";

import { useId, useState, type ReactNode } from "react";

export function InlineInfoHint(props: {
  label: string;
  children: ReactNode;
  tooltipPlacement?: "bottom" | "top" | "left";
}) {
  const [open, setOpen] = useState(false);
  const hintId = useId();
  const placement = props.tooltipPlacement ?? "bottom";
  const placementClass =
    placement === "left"
      ? " inline-info-hint--tooltip-left"
      : placement === "top"
        ? " inline-info-hint--tooltip-top"
        : "";

  return (
    <span className={`inline-info-hint${placementClass}`}>
      <button
        type="button"
        className="inline-info-hint__btn"
        aria-label={props.label}
        aria-describedby={open ? hintId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
      >
        !
      </button>
      <span
        id={hintId}
        role="tooltip"
        className={`inline-info-hint__tooltip${open ? " is-visible" : ""}`}
      >
        {props.children}
      </span>
    </span>
  );
}
