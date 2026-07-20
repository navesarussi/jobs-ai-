"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CandidateQueue } from "@/components/CandidateQueue";
import { ChatPanel, type ChatTurnPayload } from "@/components/ChatPanel";
import { FileImport } from "@/components/FileImport";
import { SettingsMenu } from "@/components/SettingsMenu";
import { useTranslation } from "@/components/LocaleProvider";
import { ProfileAside } from "@/components/ProfileAside";
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
        : {
            card: payload.card,
            chat: (payload.chat as never) ?? [],
          },
    );
    if (userId) void refreshLists(userId, payload.jobId ?? activeJobId);
  }

  async function selectJob(jobId: string) {
    if (!userId || jobBusy || jobId === activeJobId) return;
    setJobBusy(true);
    try {
      const res = await fetch("/api/employer/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "select", jobId }),
      });
      const data = await res.json();
      if (data.error) return;
      setJobs(data.jobs ?? jobs);
      setActiveJobId(data.activeJobId);
      setMe({ card: data.card, chat: data.chat ?? [] });
      await refreshLists(userId, data.activeJobId);
    } finally {
      setJobBusy(false);
    }
  }

  async function createJob() {
    if (!userId || jobBusy) return;
    setJobBusy(true);
    try {
      const res = await fetch("/api/employer/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "create" }),
      });
      const data = await res.json();
      if (data.error) return;
      setJobs(data.jobs ?? []);
      setActiveJobId(data.activeJobId);
      setMe({ card: data.card, chat: data.chat ?? [] });
      setCandidates([]);
      setTab("chat");
    } finally {
      setJobBusy(false);
    }
  }

  function jobLabel(job: JobMeta, index: number) {
    if (job.title?.trim()) return job.title;
    if (job.field?.trim()) return job.field;
    return fmt(t.employer.jobFallback, { n: String(index + 1) });
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
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm font-medium tracking-wide text-[var(--accent)]">
            {t.app.name}
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--hero)]">
            {name}
          </h1>
          <p className="text-sm text-[var(--muted)]">{t.employer.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pe-14">
          <SettingsMenu />
          <div className="flex rounded-xl bg-[var(--chip)] p-1 text-sm">
            <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
              {t.employer.chatTab}
            </TabButton>
            <TabButton active={tab === "candidates"} onClick={() => setTab("candidates")}>
              {fmt(t.employer.candidatesTab, { count: candidates.length })}
            </TabButton>
          </div>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--muted)]">{t.employer.jobsFilter}</span>
        {jobs.map((job, i) => (
          <button
            key={job.id}
            type="button"
            disabled={jobBusy}
            onClick={() => void selectJob(job.id)}
            className={
              job.id === activeJobId
                ? "rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-full border border-[var(--stroke)] bg-white px-3 py-1.5 text-xs text-[var(--ink)]"
            }
          >
            {jobLabel(job, i)}
          </button>
        ))}
        <button
          type="button"
          disabled={jobBusy}
          onClick={() => void createJob()}
          className="rounded-full border border-dashed border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]"
        >
          + {t.employer.newJob}
        </button>
      </div>

      {me?.error ? (
        <p className="mb-4 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn)]">
          {me.error}
        </p>
      ) : null}

      {tab === "chat" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="order-2 lg:order-1">
            <ChatPanel
              key={`${userId}-${activeJobId ?? "job"}-employer`}
              userId={userId}
              role="employer"
              locale={locale}
              jobId={activeJobId ?? undefined}
              initialMessages={me?.chat ?? []}
              placeholder={t.employer.chatPlaceholder}
              onTurn={onTurn}
            />
          </div>
          <div className="relative order-1 space-y-4 lg:order-2">
            {hydrating && !me ? (
              <p className="mb-2 text-xs text-[var(--muted)] opacity-70">…</p>
            ) : null}
            <ProfileAside
              kind="employer"
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
            <FileImport
              userId={userId}
              endpoint="/api/job-import"
              jobId={activeJobId ?? undefined}
              title={t.fileImport.jobTitle}
              hint={t.fileImport.jobHint}
              onDone={() => void refresh(userId, activeJobId)}
            />
          </div>
        </div>
      ) : (
        <CandidateQueue
          employerId={userId}
          items={candidates}
          onChanged={() => void refresh(userId, activeJobId)}
        />
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
