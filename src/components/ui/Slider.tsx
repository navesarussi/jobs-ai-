"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";

export function Slider(props: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  "aria-label"?: string;
  className?: string;
}) {
  const {
    value,
    onValueChange,
    min = 1,
    max = 10,
    step = 1,
    "aria-label": ariaLabel,
    className = "",
  } = props;

  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={(next) => onValueChange(next[0] ?? value)}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      className={`relative flex w-full touch-none items-center select-none ${className}`}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--chip)]">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-[var(--sky)]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border-2 border-[var(--sky)] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.16)] transition-[box-shadow,transform] duration-150 hover:shadow-[0_2px_8px_rgba(15,23,42,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--sky)_45%,transparent)] active:scale-110" />
    </SliderPrimitive.Root>
  );
}
