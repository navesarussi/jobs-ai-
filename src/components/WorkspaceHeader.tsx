"use client";

import Image from "next/image";
import Link from "next/link";

export function WorkspaceHeader(props: {
  name: string;
  subtitle: string;
  tabs: React.ReactNode;
  homeHref?: string;
}) {
  const homeHref = props.homeHref ?? "/";
  return (
    <header className="glass-bar enter">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={homeHref} className="shrink-0 rounded-xl bg-white/60 p-1.5 shadow-sm">
            <Image src="/logo.png" alt="CITOV" width={36} height={36} className="object-contain" />
          </Link>
          <div className="min-w-0">
            <p className="eyebrow">CITOV</p>
            <h1 className="truncate text-lg font-bold text-[var(--hero)] sm:text-xl">
              {props.name}
            </h1>
            <p className="truncate text-xs text-[var(--muted)] sm:text-sm">{props.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">{props.tabs}</div>
      </div>
    </header>
  );
}
