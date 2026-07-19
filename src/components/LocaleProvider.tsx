"use client";
import { createContext, useContext, useMemo } from "react";

type Ctx = {
  locale: "he";
  setLocale: (l: string) => void;
  t: Record<string, unknown>;
  fmt: (s: string, _vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<Ctx | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<Ctx>(
    () => ({
      locale: "he",
      setLocale: () => undefined,
      t: {},
      fmt: (s) => s,
    }),
    [],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: "he" as const,
      setLocale: () => undefined,
      t: {} as Record<string, unknown>,
      fmt: (s: string) => s,
    };
  }
  return ctx;
}

export function useLocale() {
  return useTranslation();
}
