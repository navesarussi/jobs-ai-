"use client";

import { SessionProvider } from "next-auth/react";
import { LocaleProvider } from "@/components/LocaleProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <SessionProvider>{children}</SessionProvider>
    </LocaleProvider>
  );
}
