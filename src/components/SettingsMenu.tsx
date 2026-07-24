"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import type { Locale } from "@/i18n/types";
import { formatAppVersion } from "@/lib/version";
import { clearSessionOnLogout, roleLandingPath } from "@/lib/client-session";
import { signOut } from "next-auth/react";

export function SettingsMenu(props: { variant?: "fixed" | "inline" | "header" }) {
  const variant = props.variant ?? "fixed";
  const wrapClass =
    variant === "fixed"
      ? "fixed top-3 end-3 z-50 sm:top-4 sm:end-4"
      : "relative z-50";
  const { t, locale, setLocale, fmt } = useTranslation();
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

  const menuAlignClass = variant === "fixed" ? "end-0" : "start-0";
  const triggerClass =
    variant === "header"
      ? "settings-trigger settings-trigger--header"
      : variant === "inline"
        ? "settings-trigger settings-trigger--inline"
        : "settings-trigger settings-trigger--fixed";

  return (
    <div ref={rootRef} className={wrapClass}>
      <button
        type="button"
        aria-label={t.settings.title}
        title={t.settings.title}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        <MenuIcon open={open} />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`settings-menu-dropdown absolute top-[calc(100%+0.5rem)] ${menuAlignClass} z-[60]`}
        >
          <div className="settings-menu-dropdown__header">
            <p className="settings-menu-dropdown__title">{t.settings.title}</p>
            <p className="settings-menu-dropdown__subtitle">CITOV</p>
          </div>

          <div className="settings-menu-dropdown__body">
            <section className="settings-menu-section">
              <p className="settings-menu-section__label">{t.settings.language}</p>
              <div className="settings-lang-switch" role="group" aria-label={t.settings.language}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={locale === "he"}
                  className={`settings-lang-switch__btn ${locale === "he" ? "settings-lang-switch__btn--active" : ""}`}
                  onClick={() => switchLocale("he")}
                >
                  {t.language.hebrew}
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={locale === "en"}
                  className={`settings-lang-switch__btn ${locale === "en" ? "settings-lang-switch__btn--active" : ""}`}
                  onClick={() => switchLocale("en")}
                >
                  {t.language.english}
                </button>
              </div>
            </section>

            <section className="settings-menu-section">
              <MenuLink href="/legal/privacy" icon="shield" onClick={() => setOpen(false)}>
                {t.settings.privacy}
              </MenuLink>
              <MenuLink href="/legal/terms" icon="doc" onClick={() => setOpen(false)}>
                {t.settings.terms}
              </MenuLink>
              <MenuLink href="/legal/about" icon="info" onClick={() => setOpen(false)}>
                {t.settings.about}
              </MenuLink>
              {isAdmin ? (
                <MenuLink href="/admin" icon="admin" onClick={() => setOpen(false)}>
                  {t.settings.adminPortal}
                </MenuLink>
              ) : null}
            </section>

            <section className="settings-menu-section">
              <MenuButton icon="report" onClick={reportIssue}>
                {t.settings.report}
              </MenuButton>
              <MenuButton
                icon="star"
                onClick={() => {
                  setRateOpen(true);
                  setOpen(false);
                }}
              >
                {t.settings.rate}
              </MenuButton>
            </section>

            <button
              type="button"
              role="menuitem"
              className="settings-menu-signout"
              onClick={() => void handleSignOut()}
            >
              <MenuGlyph name="logout" />
              <span>{t.settings.signOut}</span>
            </button>
          </div>

          <footer className="settings-menu-dropdown__footer">
            {fmt(t.app.versionLabel, { version: formatAppVersion() })}
          </footer>
        </div>
      ) : null}

      {rateOpen ? (
        <div className="settings-rate-backdrop">
          <div className="settings-rate-card" role="dialog" aria-modal="true">
            <h2 className="settings-rate-card__title">{t.settings.rateTitle}</h2>
            <p className="settings-rate-card__hint">{t.settings.rateHint}</p>
            <div className="settings-rate-card__stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`settings-rate-star ${rating >= n ? "settings-rate-star--on" : ""}`}
                  aria-label={`${n}`}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="settings-rate-card__actions">
              <button type="button" onClick={() => setRateOpen(false)} className="settings-rate-btn">
                {t.settings.cancel}
              </button>
              <button
                type="button"
                disabled={rating < 1}
                onClick={submitRating}
                className="settings-rate-btn settings-rate-btn--primary"
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

function MenuLink(props: {
  href: string;
  icon: GlyphName;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link href={props.href} role="menuitem" className="settings-menu-item" onClick={props.onClick}>
      <MenuGlyph name={props.icon} />
      <span>{props.children}</span>
    </Link>
  );
}

function MenuButton(props: {
  icon: GlyphName;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" role="menuitem" className="settings-menu-item" onClick={props.onClick}>
      <MenuGlyph name={props.icon} />
      <span>{props.children}</span>
    </button>
  );
}

type GlyphName = "shield" | "doc" | "info" | "admin" | "report" | "star" | "logout";

function MenuGlyph(props: { name: GlyphName }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (props.name) {
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
        </svg>
      );
    case "doc":
      return (
        <svg {...common}>
          <path d="M8 4h6l4 4v12H8V4Z" />
          <path d="M14 4v4h4" />
        </svg>
      );
    case "info":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6M12 7h.01" />
        </svg>
      );
    case "admin":
      return (
        <svg {...common}>
          <path d="M12 3 4 7v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V7l-8-4Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "report":
      return (
        <svg {...common}>
          <path d="M12 8v5M12 16h.01" />
          <path d="M10.3 4.2 2.6 18a1 1 0 0 0 .9 1.5h16.9a1 1 0 0 0 .9-1.5L13.7 4.2a1 1 0 0 0-1.8 0Z" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="m12 3 2.2 5.5L20 9.3l-4.5 3.9 1.4 6-5.9-3.4-5.9 3.4 1.4-6L4 9.3l5.8-.8L12 3Z" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M10 7V5a2 2 0 0 1 2-2h6v16h-6a2 2 0 0 1-2-2v-2" />
          <path d="M14 12H4M7 9l-3 3 3 3" />
        </svg>
      );
  }
}

function MenuIcon(props: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`settings-trigger__icon ${props.open ? "settings-trigger__icon--open" : ""}`}
    >
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
