"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import type { Locale } from "@/i18n/types";
import { AppVersionBadge } from "@/components/AppVersion";
import { clearSessionOnLogout, roleLandingPath } from "@/lib/client-session";
import { signOut } from "next-auth/react";

export function SettingsMenu(props: { variant?: "fixed" | "inline" }) {
  const variant = props.variant ?? "fixed";
  const wrapClass =
    variant === "inline" ? "relative z-50" : "fixed top-3 end-3 z-50 sm:top-4 sm:end-4";
  const { t, locale, setLocale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    void fetch("/api/session")
      .then((r) => r.json())
      .then((d: { isAdmin?: boolean }) => setIsAdmin(Boolean(d.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function switchLocale(next: Locale) {
    setLocale(next);
    setOpen(false);
  }

  function reportIssue() {
    const subject = encodeURIComponent(t.settings.reportSubject);
    const body = encodeURIComponent(
      `${t.settings.reportBody}\n\nURL: ${typeof window !== "undefined" ? window.location.href : ""}`,
    );
    window.location.href = `mailto:navesarussi@gmail.com?subject=${subject}&body=${body}`;
    setOpen(false);
  }

  function submitRating() {
    if (rating < 1) return;
    const subject = encodeURIComponent(t.settings.rateSubject);
    const body = encodeURIComponent(`${t.settings.rateBody}: ${rating}/5`);
    window.location.href = `mailto:navesarussi@gmail.com?subject=${subject}&body=${body}`;
    setRateOpen(false);
    setOpen(false);
  }

  async function handleSignOut() {
    setOpen(false);
    clearSessionOnLogout();
    await fetch("/api/dev/login", { method: "DELETE" }).catch(() => undefined);
    try {
      await signOut({ redirect: false });
    } catch {
      // Open-auth / no Google session — local clear is enough.
    }
    router.push(
      pathname.startsWith("/employer") || pathname.startsWith("/for-employers")
        ? roleLandingPath("employer")
        : roleLandingPath("employee"),
    );
    router.refresh();
  }

  const menuAlignClass = variant === "inline" ? "start-0" : "end-0";

  return (
    <div ref={rootRef} className={wrapClass}>
      <button
        type="button"
        aria-label={t.settings.title}
        title={t.settings.title}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface)] text-[var(--accent)] shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--bubble)]"
      >
        <SettingsIcon />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`panel absolute top-12 ${menuAlignClass} z-[60] max-h-[80vh] w-72 max-w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl py-1 text-sm shadow-[var(--shadow-soft)]`}
        >
          <p className="px-3 py-2 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
            {t.settings.title}
          </p>
          <MenuSection label={t.settings.language}>
            <button
              type="button"
              role="menuitem"
              className={itemClass(locale === "he")}
              onClick={() => switchLocale("he")}
            >
              {t.language.hebrew}
            </button>
            <button
              type="button"
              role="menuitem"
              className={itemClass(locale === "en")}
              onClick={() => switchLocale("en")}
            >
              {t.language.english}
            </button>
          </MenuSection>
          <div className="my-1 h-px bg-[var(--stroke)]" />
          <Link href="/legal/privacy" role="menuitem" className={itemClass(false)} onClick={() => setOpen(false)}>
            {t.settings.privacy}
          </Link>
          <Link href="/legal/terms" role="menuitem" className={itemClass(false)} onClick={() => setOpen(false)}>
            {t.settings.terms}
          </Link>
          <Link href="/legal/about" role="menuitem" className={itemClass(false)} onClick={() => setOpen(false)}>
            {t.settings.about}
          </Link>
          {isAdmin ? (
            <Link href="/admin" role="menuitem" className={itemClass(false)} onClick={() => setOpen(false)}>
              {t.settings.adminPortal}
            </Link>
          ) : null}
          <div className="my-1 h-px bg-[var(--stroke)]" />
          <button type="button" role="menuitem" className={itemClass(false)} onClick={reportIssue}>
            {t.settings.report}
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass(false)}
            onClick={() => {
              setRateOpen(true);
              setOpen(false);
            }}
          >
            {t.settings.rate}
          </button>
          <div className="my-1 h-px bg-[var(--stroke)]" />
          <button
            type="button"
            role="menuitem"
            className={`${itemClass(false)} text-[var(--warn)]`}
            onClick={() => void handleSignOut()}
          >
            {t.settings.signOut}
          </button>
          <div className="my-1 h-px bg-[var(--stroke)]" />
          <AppVersionBadge />
        </div>
      ) : null}

      {rateOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="panel w-full max-w-sm rounded-2xl p-5">
            <h2 className="text-base font-semibold text-[var(--hero)]">{t.settings.rateTitle}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t.settings.rateHint}</p>
            <div className="mt-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`h-10 w-10 cursor-pointer rounded-full text-lg transition duration-200 ${
                    rating >= n ? "text-[var(--gold)]" : "text-[var(--stroke)]"
                  }`}
                  aria-label={`${n}`}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setRateOpen(false)}
                className="flex-1 cursor-pointer rounded-xl border border-[var(--stroke)] px-3 py-2.5 text-sm"
              >
                {t.settings.cancel}
              </button>
              <button
                type="button"
                disabled={rating < 1}
                onClick={submitRating}
                className="flex-1 cursor-pointer rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-white transition duration-200 hover:bg-[var(--accent-strong)] disabled:opacity-50"
              >
                {t.settings.sendRating}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuSection(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-1 py-1">
      <p className="px-2 pb-1 text-[11px] text-[var(--muted)]">{props.label}</p>
      {props.children}
    </div>
  );
}

function itemClass(active: boolean) {
  return `block w-full cursor-pointer px-3 py-2.5 text-start transition duration-200 ${
    active
      ? "bg-[var(--bubble)] font-medium text-[var(--accent)]"
      : "text-[var(--ink)] hover:bg-[var(--chip)]"
  }`;
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 13a7.7 7.7 0 0 0 .05-2l2.05-1.6-2-3.46-2.45.98a7.6 7.6 0 0 0-1.73-1L15 2h-6l-.32 3.92a7.6 7.6 0 0 0-1.73 1L4.5 5.94l-2 3.46L4.55 11a7.7 7.7 0 0 0 0 2l-2.05 1.6 2 3.46 2.45-.98a7.6 7.6 0 0 0 1.73 1L9 22h6l.32-3.92a7.6 7.6 0 0 0 1.73-1l2.45.98 2-3.46L19.4 13Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
