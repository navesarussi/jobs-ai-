"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CandidateProfileStrip } from "@/components/CandidateProfileStrip";
import { ChatPanel, type ChatTurnPayload } from "@/components/ChatPanel";
import { FileImport } from "@/components/FileImport";
import { SettingsMenu } from "@/components/SettingsMenu";
import { useTranslation } from "@/components/LocaleProvider";
import { OpportunityList } from "@/components/OpportunityList";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { useStoredUser } from "@/lib/use-stored-user";

type Tab = "chat" | "jobs";

export default function EmployeePage() {
  const { t, fmt, locale } = useTranslation();
  const [tab, setTab] = useState<Tab>("chat");
  const { user: sessionUser, ready: sessionReady } = useStoredUser("employee");
  const userId = sessionUser?.id ?? null;
  const name = sessionUser?.name ?? "";
  const [me, setMe] = useState<{
    card: unknown;
    chat: { id: string; role: "user" | "assistant" | "system"; content: string }[];
    pendingQuestions: { id: string; question: string }[];
    hasCv?: boolean;
    cvFileName?: string | null;
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

  if (!sessionReady) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-[var(--muted)]">{t.session.loading}</p>
      </main>
    );
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

  const hasCv = Boolean(me?.hasCv);

  return (
    <div className="workspace-shell atmosphere">
      <WorkspaceHeader
        name={name}
        subtitle={t.employee.subtitle}
        tabs={
          <>
            <SettingsMenu variant="inline" />
            <SegmentedTabs
              value={tab}
              onChange={(id) => setTab(id as Tab)}
              tabs={[
                { id: "chat", label: t.employee.chatTab },
                { id: "jobs", label: fmt(t.employee.jobsTab, { count: jobs.length }) },
              ]}
            />
          </>
        }
      />

      <main className="workspace-main">
      {me?.error ? (
        <p className="mb-4 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn)]">
          {me.error}
        </p>
      ) : null}

      {tab === "chat" ? (
        <div className="enter-delay mx-auto flex max-w-3xl flex-col gap-3">
          <FileImport
            userId={userId}
            endpoint="/api/cv"
            title={t.fileImport.cvTitle}
            hint={t.fileImport.cvHint}
            minimalSummary
            onDone={() => void refresh(userId)}
          />
          <CandidateProfileStrip
            userId={userId}
            card={(me?.card as never) ?? null}
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
          <div className="min-h-[480px]">
            <ChatPanel
              key={`${userId}-employee`}
              userId={userId}
              role="employee"
              locale={locale}
              initialMessages={me?.chat ?? []}
              placeholder={t.employee.chatPlaceholder}
              blockedReason={hasCv ? undefined : t.chat.cvRequired}
              onTurn={onTurn}
            />
          </div>
        </div>
      ) : (
        <div className="enter-delay">
          <OpportunityList jobs={jobs} />
        </div>
      )}
      </main>
    </div>
  );
}
