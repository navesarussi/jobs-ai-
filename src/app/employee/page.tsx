"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmployeeChatLayout } from "@/components/EmployeeChatLayout";
import { type ChatTurnPayload } from "@/components/ChatPanel";
import { SettingsMenu } from "@/components/SettingsMenu";
import { useTranslation } from "@/components/LocaleProvider";
import { OpportunityList } from "@/components/OpportunityList";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { useStoredUser } from "@/lib/use-stored-user";
import type { CandidateCard } from "@/domain/types";

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
    cvExtractionStatus?: "pending" | "ok" | "partial" | "failed" | null;
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
      <main className="workspace-loading atmosphere">
        <p>{t.session.loading}</p>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="workspace-loading atmosphere">
        <SettingsMenu />
        <div>
          <p>{t.session.noActiveSession}</p>
          <Link href="/" className="mt-4 inline-block text-[var(--accent)]">
            {t.session.backToStart}
          </Link>
        </div>
      </main>
    );
  }

  const hasCv = Boolean(me?.hasCv);

  return (
    <div className="workspace-shell workspace-shell--employee atmosphere">
      <WorkspaceHeader
        name={name}
        settings={<SettingsMenu variant="header" />}
        tabs={
          <SegmentedTabs
            value={tab}
            onChange={(id) => setTab(id as Tab)}
            tabs={[
              { id: "chat", label: t.employee.chatTab },
              { id: "jobs", label: fmt(t.employee.jobsTab, { count: jobs.length }) },
            ]}
          />
        }
      />

      <main className={`workspace-main ${tab === "chat" ? "workspace-main--fit" : ""}`}>
      {me?.error ? (
        <p className="mb-4 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn)]">
          {me.error}
        </p>
      ) : null}

      {tab === "chat" ? (
        <EmployeeChatLayout
          userId={userId}
          locale={locale}
          chat={me?.chat ?? []}
          card={(me?.card as CandidateCard | null) ?? null}
          hasCv={hasCv}
          cvFileName={me?.cvFileName}
          cvPending={me?.cvExtractionStatus === "pending"}
          scheduledInterviews={jobs.length}
          placeholder={t.employee.chatPlaceholder}
          onTurn={onTurn}
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
          onCvDone={() => void refresh(userId)}
        />
      ) : (
        <div className="workspace-stack enter-delay tab-fade">
          <OpportunityList jobs={jobs} />
        </div>
      )}
      </main>
    </div>
  );
}
