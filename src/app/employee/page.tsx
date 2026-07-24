"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChatPanel, type ChatTurnPayload } from "@/components/ChatPanel";
import { FileImport } from "@/components/FileImport";
import { SettingsMenu } from "@/components/SettingsMenu";
import { useTranslation } from "@/components/LocaleProvider";
import { OpportunityList } from "@/components/OpportunityList";
import { ProfileAside } from "@/components/ProfileAside";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
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
  const [showFullCard, setShowFullCard] = useState(false);

  useEffect(() => {
    void fetch("/api/session")
      .then((r) => r.json())
      .then((d: { isAdmin?: boolean }) => setShowFullCard(Boolean(d.isAdmin)))
      .catch(() => setShowFullCard(false));
  }, []);

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
        <div className="enter-delay grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="min-h-[520px]">
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
          <div className="space-y-4">
            <ProfileAside
              kind="employee"
              userId={userId}
              card={(me?.card as never) ?? null}
              pendingQuestions={me?.pendingQuestions ?? []}
              showFullCard={showFullCard}
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
              minimalSummary
              onDone={() => void refresh(userId)}
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
