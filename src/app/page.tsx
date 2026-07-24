"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { SettingsMenu } from "@/components/SettingsMenu";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/components/LocaleProvider";
import {
  adminHomePath,
  clearSessionOnLogout,
  consumeSkipAutoLogin,
  getOrCreateDeviceId,
  readRoleDefault,
  readStoredUser,
  roleHomePath,
  writeRoleDefault,
  writeStoredUser,
} from "@/lib/client-session";

type SessionFlags = {
  googleAuth: boolean;
  allowDemo: boolean;
  openAuth: boolean;
  isAdmin: boolean;
};

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t, fmt, locale } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState<SessionFlags>({
    googleAuth: false,
    allowDemo: false,
    openAuth: true,
    isAdmin: false,
  });
  const [flagsReady, setFlagsReady] = useState(false);
  const autoStarted = useRef(false);

  useEffect(() => {
    void fetch("/api/session")
      .then((r) => r.json())
      .then((d) => {
        setFlags({
          googleAuth: Boolean(d.googleAuth),
          allowDemo: Boolean(d.allowDemo),
          openAuth: Boolean(d.openAuth),
          isAdmin: Boolean(d.isAdmin),
        });
      })
      .catch(() => {
        setFlags({
          googleAuth: false,
          allowDemo: false,
          openAuth: true,
          isAdmin: false,
        });
      })
      .finally(() => setFlagsReady(true));
  }, []);

  async function startCandidate(demo: boolean) {
    setBusy(demo ? "employee-demo" : "employee");
    setError(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "employee",
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
      writeRoleDefault("employee");
      router.replace(roleHomePath("employee"));
    } catch {
      setError(t.api.internalError);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!flagsReady || autoStarted.current) return;
    if (consumeSkipAutoLogin()) return;

    if (flags.isAdmin && status === "authenticated") {
      autoStarted.current = true;
      router.replace(adminHomePath());
      return;
    }

    const stored = readStoredUser();
    if (stored?.role === "employee") {
      autoStarted.current = true;
      router.replace(roleHomePath("employee"));
      return;
    }

    const roleDefault = readRoleDefault();
    if (roleDefault === "employee" && (flags.openAuth || flags.allowDemo)) {
      autoStarted.current = true;
      void startCandidate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot entry
  }, [flagsReady, flags.openAuth, flags.allowDemo, flags.isAdmin, status, router]);

  const canEnter = flags.openAuth || (status === "authenticated" && session?.user);
  const isAdminUser = flags.isAdmin && status === "authenticated";

  async function handleSignOut() {
    clearSessionOnLogout();
    try {
      await signOut({ redirect: false });
    } catch {
      // Open-auth — local clear is enough.
    }
    router.refresh();
  }

  return (
    <div className="atmosphere">
      <main className="landing-scene">
        <div className="landing-orb landing-orb--1" aria-hidden />
        <div className="landing-orb landing-orb--2" aria-hidden />
        <div className="landing-orb landing-orb--3" aria-hidden />
        <SettingsMenu />

        <div className="enter relative z-10">
          <BrandMark size={128} showWordmark />
        </div>

        <p className="enter-delay relative z-10 mt-8 max-w-lg text-center text-lg leading-8 text-[var(--muted)]">
          {t.home.description}
        </p>

        <section className="enter-delay-2 relative z-10 mt-12 w-full max-w-md space-y-4">
          {error ? (
            <p className="rounded-2xl bg-[var(--warn-bg)] px-4 py-3 text-sm text-[var(--warn)]">
              {error}
            </p>
          ) : null}
          {busy ? (
            <p className="text-center text-sm text-[var(--muted)]">{t.home.openingRole}</p>
          ) : null}

          {isAdminUser ? (
            <div className="space-y-3">
              <p className="text-center text-sm text-[var(--muted)]">
                {fmt(t.home.connectedAs, {
                  name: session?.user?.name ?? session?.user?.email ?? "",
                })}
              </p>
              <Button
                disabled={!!busy}
                onClick={() => router.replace(adminHomePath())}
                className="cta-glow brand-gradient-bg w-full border-0 py-4 text-base hover:bg-transparent hover:brightness-105"
              >
                {t.home.adminPortal}
              </Button>
              <Button
                variant="secondary"
                disabled={!!busy}
                onClick={() => void startCandidate(false)}
                className="w-full py-3"
              >
                {t.home.continueAsEmployee}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void handleSignOut()}
                className="w-full text-xs"
              >
                {t.home.signOut}
              </Button>
            </div>
          ) : canEnter ? (
            <div className="space-y-3">
              {status === "authenticated" && session?.user ? (
                <p className="text-center text-sm text-[var(--muted)]">
                  {fmt(t.home.connectedAs, {
                    name: session.user.name ?? session.user.email ?? "",
                  })}
                </p>
              ) : (
                <p className="text-center text-xs leading-5 text-[var(--muted)]">
                  {t.home.openAuthHint}
                </p>
              )}
              <Button
                disabled={!!busy}
                onClick={() => void startCandidate(false)}
                className="cta-glow brand-gradient-bg w-full border-0 py-4 text-base hover:bg-transparent hover:brightness-105"
              >
                {t.home.iAmEmployee}
              </Button>
              {status === "authenticated" ? (
                <Button
                  variant="ghost"
                  onClick={() => void handleSignOut()}
                  className="w-full text-xs"
                >
                  {t.home.signOut}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                disabled={!flags.googleAuth || status === "loading"}
                onClick={() =>
                  void signIn("google", { callbackUrl: "/", prompt: "select_account" })
                }
                className="cta-glow w-full py-4 text-base"
              >
                {t.home.googleSignIn}
              </Button>
              <p className="text-center text-xs leading-5 text-[var(--muted)]">
                {flags.googleAuth ? t.home.afterSignInHint : t.home.googleNotConfigured}
              </p>
            </div>
          )}

          {flags.allowDemo ? (
            <Button
              variant="secondary"
              onClick={() => void startCandidate(true)}
              disabled={!!busy}
              className="w-full border-dashed bg-white/50 py-3"
            >
              {t.home.demoEmployeeDev}
            </Button>
          ) : null}
        </section>
      </main>
    </div>
  );
}
