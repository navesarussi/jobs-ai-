"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CandidateQueue } from "@/components/CandidateQueue";
import { type ChatTurnPayload } from "@/components/ChatPanel";
import { EmployerChatLayout } from "@/components/EmployerChatLayout";
import { JobFilterBar } from "@/components/JobFilterBar";
import { SettingsMenu } from "@/components/SettingsMenu";
import { useTranslation } from "@/components/LocaleProvider";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { readStoredUser } from "@/lib/client-session";

type Tab = "chat" | "candidates";
type JobMeta = { id: string; title?: string; field?: string };

export default function EmployerPage() {
  const { t, fmt, locale } = useTranslation();
  const [tab, setTab] = useState<Tab>("chat");
  const [sessionUser] = useState(() => {
    const u = readStoredUser();
    return u?.role === "employer" ? u : null;
  });
  const userId = sessionUser?.id ?? null;
  const name = sessionUser?.name ?? "";
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobMeta[]>([]);
  const [me, setMe] = useState<{
    card: unknown;
    chat: { id: string; role: "user" | "assistant" | "system"; content: string }[];
    error?: string;
  } | null>(null);
  const [candidates, setCandidates] = useState([]);
  const [hydrating, setHydrating] = useState(Boolean(userId));
  const [jobBusy, setJobBusy] = useState(false);

  const refreshLists = useCallback(
    async (id: string, jobId?: string | null) => {
      const q = jobId ? `&jobId=${encodeURIComponent(jobId)}` : "";
      const candRes = await fetch(`/api/candidates?userId=${id}${q}&locale=${locale}`).then((r) =>
        r.json(),
      );
      setCandidates(candRes.candidates ?? []);
    },
    [locale],
  );

  const refresh = useCallback(
    async (id: string, jobId?: string | null) => {
      const q = jobId ? `&jobId=${encodeURIComponent(jobId)}` : "";
      const meRes = await fetch(`/api/me?userId=${id}${q}&locale=${locale}`).then((r) => r.json());
      setMe(meRes);
      if (Array.isArray(meRes.jobs)) setJobs(meRes.jobs);
      const nextJobId = meRes.activeJobId ?? jobId ?? null;
      setActiveJobId(nextJobId);
      await refreshLists(id, nextJobId);
    },
    [locale, refreshLists],
  );

  useEffect(() => {
    if (!userId) return;
    void refresh(userId).finally(() => setHydrating(false));
  }, [refresh, userId]);

  function onTurn(payload: ChatTurnPayload) {
    setMe((prev) =>
      prev
        ? {
            ...prev,
            card: payload.card ?? prev.card,
            chat: (payload.chat as typeof prev.chat) ?? prev.chat,
          }
        : { card: payload.card, chat: (payload.chat as never) ?? [] },
    );
    if (userId) void refreshLists(userId, payload.jobId ?? activeJobId);
  }

  async function jobAction(action: "select" | "create", jobId?: string) {
    if (!userId || jobBusy) return;
    if (action === "select" && (!jobId || jobId === activeJobId)) return;
    setJobBusy(true);
    try {
      const res = await fetch("/api/employer/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, jobId }),
      });
      const data = await res.json();
      if (data.error) return;
      setJobs(data.jobs ?? (action === "create" ? [] : jobs));
      setActiveJobId(data.activeJobId);
      setMe({ card: data.card, chat: data.chat ?? [] });
      if (action === "create") {
        setCandidates([]);
        setTab("chat");
      } else {
        await refreshLists(userId, data.activeJobId);
      }
    } finally {
      setJobBusy(false);
    }
  }

  function jobLabel(job: JobMeta, index: number) {
    return job.title?.trim() || job.field?.trim() || fmt(t.employer.jobFallback, { n: String(index + 1) });
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <SettingsMenu />
        <p className="text-[var(--muted)]">{t.session.noActiveSession}</p>
        <Link href="/for-employers" className="mt-4 inline-block text-[var(--accent)]">
          {t.session.backToStart}
        </Link>
      </main>
    );
  }

  return (
    <div className="workspace-shell atmosphere">
      <WorkspaceHeader
        name={name}
        subtitle={t.employer.subtitle}
        homeHref="/for-employers"
        tabs={
          <>
            <SettingsMenu variant="inline" />
            <SegmentedTabs
              value={tab}
              onChange={(id) => setTab(id as Tab)}
              tabs={[
                { id: "chat", label: t.employer.chatTab },
                {
                  id: "candidates",
                  label: fmt(t.employer.candidatesTab, { count: candidates.length }),
                },
              ]}
            />
          </>
        }
      />
      <main className="workspace-main">
      <JobFilterBar
        label={t.employer.jobsFilter}
        jobs={jobs}
        activeJobId={activeJobId}
        busy={jobBusy}
        newJobLabel={t.employer.newJob}
        jobLabel={jobLabel}
        onSelect={(id) => void jobAction("select", id)}
        onCreate={() => void jobAction("create")}
      />
      {me?.error ? (
        <p className="mb-4 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn)]">
          {me.error}
        </p>
      ) : null}
      {tab === "chat" ? (
        <EmployerChatLayout
          userId={userId}
          locale={locale}
          activeJobId={activeJobId}
          chat={me?.chat ?? []}
          card={me?.card}
          placeholder={t.employer.chatPlaceholder}
          hydrating={hydrating && !me}
          importTitle={t.fileImport.jobTitle}
          importHint={t.fileImport.jobHint}
          onTurn={onTurn}
          onFlexibilityChange={(value) => {
            setMe((prev) =>
              prev ? { ...prev, card: { ...(prev.card as object), flexibility: value } } : prev,
            );
          }}
          onImportDone={() => void refresh(userId, activeJobId)}
        />
      ) : (
        <CandidateQueue
          employerId={userId}
          items={candidates}
          onChanged={() => void refresh(userId, activeJobId)}
        />
      )}
      </main>
    </div>
  );
}
