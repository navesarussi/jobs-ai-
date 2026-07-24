"use client";

import Image from "next/image";
import Link from "next/link";
import { SettingsMenu } from "@/components/SettingsMenu";
import { Button } from "@/components/ui/Button";

export function AdminShell(props: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="workspace-shell atmosphere">
      <header className="glass-bar enter">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="shrink-0 rounded-xl bg-white/60 p-1.5 shadow-sm">
              <Image src="/logo.png" alt="CITOV" width={36} height={36} className="object-contain" />
            </Link>
            <div>
              <p className="eyebrow">CITOV Admin</p>
              <h1 className="text-lg font-bold text-[var(--hero)]">{props.title}</h1>
              <p className="text-xs text-[var(--muted)] sm:text-sm">{props.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {props.actions}
            <Link
              href="/employee"
              className="inline-flex min-h-9 items-center rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)] transition duration-200 hover:border-[var(--accent)]"
            >
              תצוגת מועמד
            </Link>
            <SettingsMenu variant="inline" />
          </div>
        </div>
      </header>
      <main className="workspace-main max-w-5xl">{props.children}</main>
    </div>
  );
}
