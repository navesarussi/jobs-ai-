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
  roleLandingPath,
  startRoleSession,
} from "@/lib/client-session";

type DevUser = { id: string; name: string; role: Role; email?: string };

type SessionFlags = {
  googleAuth: boolean;
  openAuth: boolean;
  devAuth: boolean;
  isAdmin: boolean;
  devUsers: DevUser[];
};

export function RoleLandingPage(props: { role: Role }) {
  const { role } = props;
  const landingPath = roleLandingPath(role);
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t, fmt } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const [flags, setFlags] = useState<SessionFlags>({
    googleAuth: false,
    openAuth: false,
    devAuth: true,
    isAdmin: false,
    devUsers: [],
  });
  const [flagsReady, setFlagsReady] = useState(false);
  const autoStarted = useRef(false);

  const copy =
    role === "employee"
      ? {
          description: t.home.description,
          enterLabel: t.home.iAmEmployee,
          openHint: t.home.openAuthHint,
          googleHint: t.home.candidateGoogleHint,
        }
      : {
          description: t.home.employerDescription,
          enterLabel: t.home.iAmEmployer,
          openHint: t.home.employerOpenAuthHint,
          googleHint: t.home.employerGoogleHint,
        };

  async function loadFlags() {
    const r = await fetch("/api/session");
    const d = (await r.json()) as Partial<SessionFlags & { devUsers?: DevUser[] }>;
    setFlags({
      googleAuth: Boolean(d.googleAuth),
      openAuth: Boolean(d.openAuth),
      devAuth: Boolean(d.devAuth),
      isAdmin: Boolean(d.isAdmin),
      devUsers: Array.isArray(d.devUsers) ? d.devUsers : [],
    });
  }

  useEffect(() => {
    void loadFlags()
      .catch(() => {
        setFlags({
          googleAuth: false,
          openAuth: false,
          devAuth: true,
          isAdmin: false,
          devUsers: [],
        });
      })
      .finally(() => setFlagsReady(true));
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadFlags().catch(() => undefined);
  }, [status]);

  useEffect(() => {
    if (!flagsReady || autoStarted.current) return;
    if (consumeSkipAutoLogin()) return;

    const isAuthed = status === "authenticated" && Boolean(session?.user);

    if (isAuthed && flags.googleAuth && flags.isAdmin) {
      autoStarted.current = true;
      router.replace(adminHomePath());
      return;
    }

    if (isAuthed && flags.googleAuth && !flags.isAdmin) {
      autoStarted.current = true;
      setEntering(true);
      void startRoleSession(role)
        .then(() => router.replace(roleHomePath(role)))
        .catch((e) => {
          autoStarted.current = false;
          setError(e instanceof Error ? e.message : t.api.internalError);
        })
        .finally(() => setEntering(false));
      return;
    }

    const stored = readStoredUser();
    if (stored?.role === role) {
      autoStarted.current = true;
      router.replace(roleHomePath(role));
    }
  }, [
    flagsReady,
    flags.googleAuth,
    flags.isAdmin,
    role,
    session?.user,
    status,
    router,
    t.api.internalError,
  ]);

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

  async function enterAsRole() {
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
  const showGoogle = flags.googleAuth && !isAuthed;
  const showTestLogin = flags.devAuth;
  const showOpenEnter = flags.openAuth && !flags.googleAuth && !flags.devAuth;
  const bootstrapping = entering || (isAuthed && flags.googleAuth && !flags.isAdmin);

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
          {copy.description}
        </p>

        <section className="enter-delay-2 relative z-10 mt-12 w-full max-w-md space-y-4">
          {error ? (
            <p className="rounded-2xl bg-[var(--warn-bg)] px-4 py-3 text-sm text-[var(--warn)]">
              {error}
            </p>
          ) : null}

          {bootstrapping ? (
            <p className="text-center text-sm text-[var(--muted)]">{t.home.openingRole}</p>
          ) : (
            <div className="space-y-3">
              {showGoogle ? (
                <>
                  <Button
                    disabled={status === "loading"}
                    onClick={() =>
                      void signIn("google", {
                        callbackUrl: landingPath,
                        prompt: "select_account",
                      })
                    }
                    className="cta-glow brand-gradient-bg w-full border-0 py-4 text-base hover:bg-transparent hover:brightness-105"
                  >
                    {t.home.googleSignIn}
                  </Button>
                  <p className="text-center text-xs leading-5 text-[var(--muted)]">
                    {copy.googleHint}
                  </p>
                </>
              ) : null}

              {showTestLogin ? (
                <>
                  <Button
                    onClick={() => setLoginOpen(true)}
                    variant={showGoogle ? "secondary" : undefined}
                    className={
                      showGoogle
                        ? "w-full py-4 text-base"
                        : "cta-glow brand-gradient-bg w-full border-0 py-4 text-base hover:bg-transparent hover:brightness-105"
                    }
                  >
                    {t.home.devSignIn}
                  </Button>
                  <p className="text-center text-xs leading-5 text-[var(--muted)]">
                    {t.devLogin.hint}
                  </p>
                </>
              ) : null}

              {showOpenEnter ? (
                <>
                  <p className="text-center text-xs leading-5 text-[var(--muted)]">
                    {copy.openHint}
                  </p>
                  <Button
                    disabled={entering}
                    onClick={() => void enterAsRole()}
                    className="cta-glow brand-gradient-bg w-full border-0 py-4 text-base hover:bg-transparent hover:brightness-105"
                  >
                    {entering ? t.home.openingRole : copy.enterLabel}
                  </Button>
                </>
              ) : null}

              {!showTestLogin && !showGoogle && !showOpenEnter ? (
                <p className="text-center text-xs leading-5 text-[var(--muted)]">
                  {t.home.googleNotConfigured}
                </p>
              ) : null}

              {isAuthed && flags.googleAuth ? (
                <Button variant="ghost" onClick={() => void handleSignOut()} className="w-full text-xs">
                  {fmt(t.home.connectedAs, {
                    name: session?.user?.name ?? session?.user?.email ?? "",
                  })}{" "}
                  · {t.home.signOut}
                </Button>
              ) : null}
            </div>
          )}
        </section>
      </main>

      <DevLoginDialog
        open={loginOpen}
        users={flags.devUsers}
        defaultRole={role}
        onClose={() => setLoginOpen(false)}
        onDone={onDevLoginDone}
        onError={setError}
      />
    </div>
  );
}
