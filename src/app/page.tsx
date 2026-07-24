"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { DevLoginDialog } from "@/components/DevLoginDialog";
import { SettingsMenu } from "@/components/SettingsMenu";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/components/LocaleProvider";
import type { Role } from "@/domain/types";
import {
  adminHomePath,
  clearSessionOnLogout,
  consumeSkipAutoLogin,
  readStoredUser,
  roleHomePath,
  startRoleSession,
} from "@/lib/client-session";

type DevUser = { id: string; name: string; role: Role; email?: string };

type SessionFlags = {
  googleAuth: boolean;
  allowDemo: boolean;
  openAuth: boolean;
  devAuth: boolean;
  isAdmin: boolean;
  devUsers: DevUser[];
};

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t, fmt } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const [flags, setFlags] = useState<SessionFlags>({
    googleAuth: false,
    allowDemo: false,
    openAuth: true,
    devAuth: false,
    isAdmin: false,
    devUsers: [],
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
          devAuth: Boolean(d.devAuth),
          isAdmin: Boolean(d.isAdmin),
          devUsers: Array.isArray(d.devUsers) ? d.devUsers : [],
        });
      })
      .catch(() => {
        setFlags({
          googleAuth: false,
          allowDemo: false,
          openAuth: true,
          devAuth: false,
          isAdmin: false,
          devUsers: [],
        });
      })
      .finally(() => setFlagsReady(true));
  }, []);

  useEffect(() => {
    if (!flagsReady || autoStarted.current) return;
    if (consumeSkipAutoLogin()) return;

    if (flags.isAdmin && !flags.devAuth && status === "authenticated") {
      autoStarted.current = true;
      router.replace(adminHomePath());
      return;
    }

    const stored = readStoredUser();
    if (stored) {
      autoStarted.current = true;
      router.replace(roleHomePath(stored.role));
    }
  }, [flagsReady, flags.devAuth, flags.isAdmin, status, router]);

  async function handleSignOut() {
    clearSessionOnLogout();
    if (flags.devAuth) {
      await fetch("/api/dev/login", { method: "DELETE" }).catch(() => undefined);
    }
    try {
      await signOut({ redirect: false });
    } catch {
      // Open-auth — local clear is enough.
    }
    router.refresh();
  }

  async function enterAsRole(role: Role) {
    setError(null);
    setEntering(true);
    try {
      await startRoleSession(role);
      router.replace(roleHomePath(role));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.api.internalError);
    } finally {
      setEntering(false);
    }
  }

  function onDevLoginDone(redirect: string) {
    setLoginOpen(false);
    setError(null);
    router.replace(redirect);
  }

  const isAuthed = status === "authenticated" && Boolean(session?.user);
  const isAdminUser = flags.isAdmin && !flags.devAuth && isAuthed;
  const showTestLogin = flags.devAuth;
  const showGoogle = flags.googleAuth && !isAuthed;
  const showRoleEntry = flags.openAuth || isAuthed;

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

          {isAdminUser ? (
            <div className="space-y-3">
              <p className="text-center text-sm text-[var(--muted)]">
                {fmt(t.home.connectedAs, {
                  name: session?.user?.name ?? session?.user?.email ?? "",
                })}
              </p>
              <Button
                onClick={() => router.replace(adminHomePath())}
                className="cta-glow brand-gradient-bg w-full border-0 py-4 text-base hover:bg-transparent hover:brightness-105"
              >
                {t.home.adminPortal}
              </Button>
              <Button variant="ghost" onClick={() => void handleSignOut()} className="w-full text-xs">
                {t.home.signOut}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {showTestLogin ? (
                <>
                  <p className="text-center text-xs leading-5 text-[var(--muted)]">
                    {t.devLogin.hint}
                  </p>
                  <Button
                    onClick={() => setLoginOpen(true)}
                    className="cta-glow brand-gradient-bg w-full border-0 py-4 text-base hover:bg-transparent hover:brightness-105"
                  >
                    {t.home.devSignIn}
                  </Button>
                </>
              ) : null}

              {showGoogle ? (
                <>
                  <Button
                    disabled={status === "loading"}
                    onClick={() =>
                      void signIn("google", { callbackUrl: "/", prompt: "select_account" })
                    }
                    className="cta-glow w-full py-4 text-base"
                  >
                    {t.home.googleSignIn}
                  </Button>
                  <p className="text-center text-xs leading-5 text-[var(--muted)]">
                    {t.home.afterSignInHint}
                  </p>
                </>
              ) : null}

              {showRoleEntry ? (
                <>
                  <p className="text-center text-xs leading-5 text-[var(--muted)]">
                    {isAuthed
                      ? t.home.realUsersTitleOpen
                      : flags.openAuth
                        ? t.home.openAuthHint
                        : t.home.afterSignInHint}
                  </p>
                  <Button
                    disabled={entering}
                    onClick={() => void enterAsRole("employee")}
                    className="cta-glow brand-gradient-bg w-full border-0 py-4 text-base hover:bg-transparent hover:brightness-105"
                  >
                    {entering ? t.home.openingRole : t.home.iAmEmployee}
                  </Button>
                  <Button
                    disabled={entering}
                    variant="secondary"
                    onClick={() => void enterAsRole("employer")}
                    className="w-full py-4 text-base"
                  >
                    {entering ? t.home.openingRole : t.home.iAmEmployer}
                  </Button>
                </>
              ) : null}

              {!showTestLogin && !showGoogle && !showRoleEntry ? (
                <p className="text-center text-xs leading-5 text-[var(--muted)]">
                  {t.home.googleNotConfigured}
                </p>
              ) : null}
            </div>
          )}
        </section>
      </main>

      <DevLoginDialog
        open={loginOpen}
        users={flags.devUsers}
        onClose={() => setLoginOpen(false)}
        onDone={onDevLoginDone}
        onError={setError}
      />
    </div>
  );
}
