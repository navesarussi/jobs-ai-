"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { DevLoginDialog } from "@/components/DevLoginDialog";
import { SettingsMenu } from "@/components/SettingsMenu";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/components/LocaleProvider";
import type { Role } from "@/domain/types";
import type { SessionFlagsPayload } from "@/lib/session-flags-server";
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
type SessionFlags = SessionFlagsPayload;

const PILLAR_ICONS = ["💬", "✦", "✓"] as const;

export function RoleLandingPage(props: { role: Role; initialFlags?: SessionFlags }) {
  const { role } = props;
  const landingPath = roleLandingPath(role);
  const otherRolePath = role === "employee" ? "/for-employers" : "/";
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t, fmt } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const [flags, setFlags] = useState<SessionFlags>(
    props.initialFlags ?? {
      googleAuth: false,
      openAuth: false,
      devAuth: true,
      allowDemo: false,
      memoryStore: false,
      isAdmin: false,
      devUsers: [],
      email: null,
    },
  );
  const [flagsReady, setFlagsReady] = useState(Boolean(props.initialFlags));
  const autoStarted = useRef(false);

  const copy =
    role === "employee"
      ? {
          heroTitle: t.home.heroTitleCandidate,
          description: t.home.description,
          enterLabel: t.home.iAmEmployee,
          openHint: t.home.openAuthHint,
          googleHint: t.home.candidateGoogleHint,
          googleButton: t.home.candidateGoogleButton,
          switchLabel: t.home.switchToEmployer,
        }
      : {
          heroTitle: t.home.heroTitleEmployer,
          description: t.home.employerDescription,
          enterLabel: t.home.iAmEmployer,
          openHint: t.home.employerOpenAuthHint,
          googleHint: t.home.employerGoogleHint,
          googleButton: t.home.employerGoogleButton,
          switchLabel: t.home.switchToCandidate,
        };

  const pillars = [
    { title: t.home.pillarChatTitle, body: t.home.pillarChatBody },
    { title: t.home.pillarMatchTitle, body: t.home.pillarMatchBody },
    { title: t.home.pillarApprovedTitle, body: t.home.pillarApprovedBody },
  ];

  async function loadFlags() {
    const r = await fetch("/api/session");
    const d = (await r.json()) as Partial<SessionFlags & { devUsers?: DevUser[] }>;
    setFlags({
      googleAuth: Boolean(d.googleAuth),
      allowDemo: Boolean(d.allowDemo),
      openAuth: Boolean(d.openAuth),
      devAuth: Boolean(d.devAuth),
      memoryStore: Boolean(d.memoryStore),
      isAdmin: Boolean(d.isAdmin),
      email: typeof d.email === "string" ? d.email : null,
      devUsers: Array.isArray(d.devUsers) ? d.devUsers : [],
    });
  }

  useEffect(() => {
    if (props.initialFlags) return;
    void loadFlags()
      .catch(() => {
        setFlags({
          googleAuth: false,
          allowDemo: false,
          openAuth: false,
          devAuth: true,
          memoryStore: false,
          isAdmin: false,
          email: null,
          devUsers: [],
        });
      })
      .finally(() => setFlagsReady(true));
  }, [props.initialFlags]);

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
        <SettingsMenu />

        <div className="landing-hero enter">
          <div className="landing-hero__copy">
            <BrandMark size={72} showWordmark align="start" />
            <h1 className="landing-hero__title enter-delay">{copy.heroTitle}</h1>
            <p className="landing-hero__lead enter-delay">{copy.description}</p>

            <div className="landing-pillars enter-delay-2">
              {pillars.map((pillar, i) => (
                <article key={pillar.title} className="landing-pillar">
                  <span className="landing-pillar__icon" aria-hidden>
                    {PILLAR_ICONS[i]}
                  </span>
                  <h2 className="landing-pillar__title">{pillar.title}</h2>
                  <p className="landing-pillar__body">{pillar.body}</p>
                </article>
              ))}
            </div>

            <Link href={otherRolePath} className="landing-role-switch enter-delay-2">
              {copy.switchLabel} →
            </Link>
          </div>

          <section className="landing-cta-card enter-delay-2" aria-label={t.home.ctaCardTitle}>
            <h2 className="landing-cta-card__title">{t.home.ctaCardTitle}</h2>
            <p className="landing-cta-card__hint">{t.home.ctaCardHint}</p>

            {error ? (
              <p className="mb-4 rounded-xl bg-[var(--warn-bg)] px-4 py-3 text-sm text-[var(--warn)]">
                {error}
              </p>
            ) : null}

            {bootstrapping ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">{t.home.openingRole}</p>
            ) : (
              <div className="flex flex-col gap-3">
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
                      className="cta-glow brand-gradient-bg min-h-12 w-full border-0 py-3.5 text-base font-semibold hover:bg-transparent hover:brightness-105"
                    >
                      {copy.googleButton}
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
                          ? "min-h-12 w-full py-3.5 text-base"
                          : "cta-glow brand-gradient-bg min-h-12 w-full border-0 py-3.5 text-base font-semibold hover:bg-transparent hover:brightness-105"
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
                      className="cta-glow brand-gradient-bg min-h-12 w-full border-0 py-3.5 text-base font-semibold hover:bg-transparent hover:brightness-105"
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
                  <Button
                    variant="ghost"
                    onClick={() => void handleSignOut()}
                    className="w-full text-xs"
                  >
                    {fmt(t.home.connectedAs, {
                      name: session?.user?.name ?? session?.user?.email ?? "",
                    })}{" "}
                    · {t.home.signOut}
                  </Button>
                ) : null}
              </div>
            )}
          </section>
        </div>
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
