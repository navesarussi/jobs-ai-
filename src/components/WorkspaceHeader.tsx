"use client";

import Image from "next/image";
import Link from "next/link";

export function WorkspaceHeader(props: {
  name: string;
  subtitle?: string;
  tabs: React.ReactNode;
  settings?: React.ReactNode;
  homeHref?: string;
}) {
  const homeHref = props.homeHref ?? "/";
  return (
    <header className="glass-bar enter">
      <div className="workspace-header__bar mx-auto max-w-[var(--content-max)] px-4 py-3.5 sm:px-6">
        <div className="workspace-header__brand flex min-w-0 items-center gap-2.5 sm:gap-3">
          {props.settings ? (
            <div className="settings-menu-anchor shrink-0">{props.settings}</div>
          ) : null}
          <Link
            href={homeHref}
            className="shrink-0 rounded-xl border border-[var(--stroke)] bg-white/70 p-1.5 shadow-[var(--shadow-soft)] transition duration-200 hover:border-[var(--accent)]/30"
          >
            <Image src="/logo.png" alt="CITOV" width={38} height={38} className="object-contain" />
          </Link>
          <div className="min-w-0">
            <p className="eyebrow">CITOV</p>
            <h1 className="truncate text-base font-bold tracking-tight text-[var(--hero)] sm:text-lg">
              {props.name}
            </h1>
            {props.subtitle ? (
              <p className="truncate text-xs leading-5 text-[var(--muted)] sm:text-sm">
                {props.subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="workspace-header__tabs flex items-center justify-center">{props.tabs}</div>

        <div className="workspace-header__balance" aria-hidden />
      </div>
    </header>
  );
}
