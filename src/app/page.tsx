"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SettingsMenu } from "@/components/SettingsMenu";
import { useTranslation } from "@/components/LocaleProvider";
import type { Role } from "@/domain/types";
import {
  getOrCreateDeviceId,
  readRoleDefault,
  readStoredUser,
  roleHomePath,
  writeRoleDefault,
  writeStoredUser,
} from "@/lib/client-session";

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t, fmt, locale } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [googleAuth, setGoogleAuth] = useState(false);
  const [allowDemo, setAllowDemo] = useState(false);
  const [openAuth, setOpenAuth] = useState(true);
  const [flagsReady, setFlagsReady] = useState(false);
  const autoStarted = useRef(false);

  useEffect(() => {
    void fetch("/api/session")
      .then((r) => r.json())
      .then((d) => {
        setGoogleAuth(Boolean(d.googleAuth));
        setAllowDemo(Boolean(d.allowDemo));
        setOpenAuth(Boolean(d.openAuth));
      })
      .catch(() => {
        setGoogleAuth(false);
        setAllowDemo(false);
        setOpenAuth(true);
      })
      .finally(() => setFlagsReady(true));
  }, []);

  async function start(role: Role, demo: boolean) {
    setBusy(role + (demo ? "-demo" : ""));
    setError(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          demo,
          locale,
          deviceId: getOrCreateDeviceId(),
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      const user = data.user;
      if (!user?.id) {
        setError(t.api.internalError);
        return;
      }
      writeStoredUser(user);
      writeRoleDefault(role);
      router.replace(roleHomePath(role));
    } catch {
      setError(t.api.internalError);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!flagsReady || autoStarted.current) return;
    const roleDefault = readRoleDefault();
    const stored = readStoredUser();
    if (stored && (!roleDefault || stored.role === roleDefault)) {
      autoStarted.current = true;
      router.replace(roleHomePath(stored.role));
      return;
    }
    if (roleDefault && (openAuth || allowDemo)) {
      autoStarted.current = true;
      void start(roleDefault, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot entry
  }, [flagsReady, openAuth, allowDemo, router]);

  const showRolePicker = openAuth || (status === "authenticated" && session?.user);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-10 pt-16">
      <SettingsMenu />

      <p className="text-sm font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
        {t.app.name}
      </p>
      <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-[1.15] tracking-tight text-[var(--hero)] sm:text-5xl">
        {t.home.tagline}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
        {t.home.description}
      </p>

      <section className="premium-panel mt-9 rounded-[1.4rem] p-6">
        <h2 className="text-base font-semibold text-[var(--ink)]">
          {openAuth ? t.home.realUsersTitleOpen : t.home.realUsersTitle}
        </h2>
        {error ? (
          <p className="mt-3 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn)]">
            {error}
          </p>
        ) : null}
        {busy ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{t.home.openingRole}</p>
        ) : null}

        {showRolePicker ? (
          <div className="mt-4 space-y-3">
            {status === "authenticated" && session?.user ? (
              <p className="text-sm text-[var(--muted)]">
                {fmt(t.home.connectedAs, {
                  name: session.user.name ?? session.user.email ?? "",
                })}
              </p>
            ) : (
              <p className="text-xs leading-5 text-[var(--muted)]">{t.home.openAuthHint}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void start("employee", false)}
                className="rounded-xl bg-[var(--hero)] px-4 py-3.5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(6,47,45,0.22)] transition hover:bg-[var(--accent-strong)]"
              >
                {t.home.iAmEmployee}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void start("employer", false)}
                className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-3.5 text-sm font-medium transition hover:border-[var(--accent)]"
              >
                {t.home.iAmEmployer}
              </button>
            </div>
            {status === "authenticated" ? (
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="text-xs text-[var(--muted)] underline-offset-2 hover:underline"
              >
                {t.home.signOut}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <button
              type="button"
              disabled={!googleAuth || status === "loading"}
              onClick={() => void signIn("google", { callbackUrl: "/" })}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {t.home.googleSignIn}
            </button>
            <p className="text-xs leading-5 text-[var(--muted)]">
              {googleAuth ? t.home.afterSignInHint : t.home.googleNotConfigured}
            </p>
          </div>
        )}
      </section>

      {allowDemo ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void start("employee", true)}
            disabled={!!busy}
            className="rounded-2xl border border-dashed border-[var(--stroke)] bg-white/50 p-4 text-start text-sm text-[var(--muted)] transition hover:border-[var(--accent)]"
          >
            {t.home.demoEmployeeDev}
          </button>
          <button
            type="button"
            onClick={() => void start("employer", true)}
            disabled={!!busy}
            className="rounded-2xl border border-dashed border-[var(--stroke)] bg-white/50 p-4 text-start text-sm text-[var(--muted)] transition hover:border-[var(--accent)]"
          >
            {t.home.demoEmployerDev}
          </button>
        </div>
      ) : null}
    </main>
  );
}
