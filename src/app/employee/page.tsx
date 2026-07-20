"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChatPanel, type ChatTurnPayload } from "@/components/ChatPanel";
import { FileImport } from "@/components/FileImport";
import { SettingsMenu } from "@/components/SettingsMenu";
import { useTranslation } from "@/components/LocaleProvider";
import { OpportunityList } from "@/components/OpportunityList";
import { ProfileAside } from "@/components/ProfileAside";
import { readStoredUser } from "@/lib/client-session";

type Tab = "chat" | "jobs";

export default function EmployeePage() {
  const { t, fmt, locale } = useTranslation();
  const [tab, setTab] = useState<Tab>("chat");
  const [sessionUser] = useState(() => {
    const u = readStoredUser();
    return u?.role === "employee" ? u : null;
  });
  const userId = sessionUser?.id ?? null;
  const name = sessionUser?.name ?? "";
  const [me, setMe] = useState<{
    card: unknown;
    chat: { id: string; role: "user" | "assistant" | "system"; content: string }[];
    pendingQuestions: { id: string; question: string }[];
    error?: string;
  } | null>(null);
  const [jobs, setJobs] = useState([]);

  const refreshLists = useCallback(
    async (id: string) => {
      const jobsRes = await fetch(`/api/opportunities?userId=${id}&locale=${locale}`).then((r) =>
        r.json(),
      );
      setJobs(jobsRes.jobs ?? []);
    },
    [locale],
  );

  const refresh = useCallback(
    async (id: string) => {
      const [meRes] = await Promise.all([
        fetch(`/api/me?userId=${id}&locale=${locale}`).then((r) => r.json()),
        refreshLists(id),
      ]);
      setMe(meRes);
    },
    [locale, refreshLists],
  );

  useEffect(() => {
    if (!userId) return;
    void refresh(userId);
  }, [refresh, userId]);

  function onTurn(payload: ChatTurnPayload) {
    setMe((prev) =>
      prev
        ? {
            ...prev,
            card: payload.card ?? prev.card,
            chat: (payload.chat as typeof prev.chat) ?? prev.chat,
            pendingQuestions: payload.pendingQuestions ?? prev.pendingQuestions,
          }
        : {
            card: payload.card,
            chat: (payload.chat as never) ?? [],
            pendingQuestions: payload.pendingQuestions ?? [],
          },
    );
    if (userId) void refreshLists(userId);
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <SettingsMenu />
        <p className="text-[var(--muted)]">{t.session.noActiveSession}</p>
        <Link href="/" className="mt-4 inline-block text-[var(--accent)]">
          {t.session.backToStart}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-full w-full max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm font-medium tracking-wide text-[var(--accent)]">
            {t.app.name}
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--hero)]">
            {name}
          </h1>
          <p className="text-sm text-[var(--muted)]">{t.employee.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pe-14">
          <SettingsMenu />
          <div className="flex rounded-xl bg-[var(--chip)] p-1 text-sm">
            <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
              {t.employee.chatTab}
            </TabButton>
            <TabButton active={tab === "jobs"} onClick={() => setTab("jobs")}>
              {fmt(t.employee.jobsTab, { count: jobs.length })}
            </TabButton>
          </div>
        </div>
      </header>

      {me?.error ? (
        <p className="mb-4 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn)]">
          {me.error}
        </p>
      ) : null}

      {tab === "chat" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="order-2 lg:order-1">
            <ChatPanel
              key={`${userId}-employee`}
              userId={userId}
              role="employee"
              locale={locale}
              initialMessages={me?.chat ?? []}
              placeholder={t.employee.chatPlaceholder}
              onTurn={onTurn}
            />
          </div>
          <div className="order-1 space-y-4 lg:order-2">
            <ProfileAside
              kind="employee"
              userId={userId}
              card={(me?.card as never) ?? null}
              pendingQuestions={me?.pendingQuestions ?? []}
              onFlexibilityChange={(value) => {
                setMe((prev) =>
                  prev
                    ? {
                        ...prev,
                        card: { ...(prev.card as object), flexibility: value },
                      }
                    : prev,
                );
              }}
            />
            <FileImport
              userId={userId}
              endpoint="/api/cv"
              title={t.fileImport.cvTitle}
              hint={t.fileImport.cvHint}
              onDone={() => void refresh(userId)}
            />
          </div>
        </div>
      ) : (
        <OpportunityList jobs={jobs} />
      )}
    </main>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        props.active
          ? "rounded-lg bg-white px-3 py-1.5 font-medium shadow-sm"
          : "rounded-lg px-3 py-1.5 text-[var(--muted)]"
      }
    >
      {props.children}
    </button>
  );
}
