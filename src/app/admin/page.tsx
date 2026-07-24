"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { SettingsMenu } from "@/components/SettingsMenu";
import { Button } from "@/components/ui/Button";

type AdminStats = {
  employers: number;
  candidates: number;
  matches: {
    total: number;
    queued: number;
    approved: number;
    rejected: number;
  };
  aiUsage: {
    totalCalls: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  users: number;
  reliability?: {
    averageScore: number;
    openNotes: number;
    lowScoreCandidates: { userId: string; name: string; score: number; openNotes: number }[];
  };
};

type Dashboard = {
  stats: AdminStats;
  prompts: {
    candidatePrompt: string;
    employerPrompt: string;
    updatedAt?: string;
    updatedBy?: string;
    isCustom?: boolean;
  };
};

const PLACEHOLDER_HELP =
  "{{known_facts}}, {{current_card}}, {{missing_field_key}}, {{pending_field_questions}}, {{recent_agent_questions}} — היסטוריית השיחה נשלחת אוטומטית כ-messages";

function formatUsd(value: number): string {
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function formatTokens(value: number): string {
  return value.toLocaleString("he-IL");
}

export default function AdminPage() {
  const { status } = useSession();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidatePrompt, setCandidatePrompt] = useState("");
  const [employerPrompt, setEmployerPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [aiMode, setAiMode] = useState<string | null>(null);
  const [bootTimedOut, setBootTimedOut] = useState(false);

  const load = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const [res, aiRes] = await Promise.all([
        fetch("/api/admin/stats", { signal: controller.signal }),
        fetch("/api/health/ai", { signal: controller.signal }),
      ]);
      clearTimeout(timer);
      const json = await res.json();
      const ai = await aiRes.json().catch(() => null);
      if (!res.ok) {
        setError(json.error ?? "שגיאה בטעינה");
        return;
      }
      setData(json);
      setCandidatePrompt(json.prompts.candidatePrompt);
      setEmployerPrompt(json.prompts.employerPrompt);
      setIsCustom(Boolean(json.prompts.isCustom));
      setAiMode(ai?.mode ?? null);
      setError(null);
    } catch {
      setError("הטעינה ארכה מדי או נכשלה. רעננו את העמוד.");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setBootTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (status === "loading" && !bootTimedOut) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dashboard fetch on auth ready
    void load();
  }, [status, load, bootTimedOut]);

  async function savePrompts() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidatePrompt, employerPrompt }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "שגיאה בשמירה");
        return;
      }
      if (json.prompts) {
        setCandidatePrompt(json.prompts.candidatePrompt);
        setEmployerPrompt(json.prompts.employerPrompt);
        setIsCustom(Boolean(json.prompts.isCustom));
        setData((prev) => (prev ? { ...prev, prompts: json.prompts } : prev));
      }
      setSaved(true);
      setError(null);
    } finally {
      setSaving(false);
    }
  }

  async function resetPrompts() {
    if (!confirm("לאפס לפרומפטים ברירת המחדל מהקבצים?")) return;
    setResetting(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/prompts", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "שגיאה באיפוס");
        return;
      }
      setCandidatePrompt(json.prompts.candidatePrompt);
      setEmployerPrompt(json.prompts.employerPrompt);
      setIsCustom(false);
      await load();
    } finally {
      setResetting(false);
    }
  }

  if ((!data && !error) && (status === "loading" || !bootTimedOut)) {
    return (
      <div className="atmosphere flex min-h-dvh items-center justify-center px-5">
        <main className="text-center">
          <SettingsMenu />
          <p className="text-[var(--muted)]">טוען פורטל מנהלים…</p>
          <Link href="/" className="mt-4 inline-block text-sm text-[var(--accent)]">
            חזרה להתחלה
          </Link>
        </main>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="atmosphere flex min-h-dvh items-center justify-center px-5">
        <main className="panel max-w-lg rounded-[var(--panel-radius)] p-8 text-center">
          <SettingsMenu />
          <p className="text-[var(--muted)]">{error}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={() => void load()}>
              נסו שוב
            </Button>
            <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
              חזרה להתחלה
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!data) return null;

  const { stats, prompts } = data;

  return (
    <AdminShell
      title="פורטל מנהלים"
      subtitle="סטטיסטיקות ועריכת פרומפטים בלייב לסוכני הצ׳אט"
      actions={
        <Button variant="secondary" onClick={() => void load()} className="min-h-9 px-3 py-1.5 text-sm">
          רענון
        </Button>
      }
    >
      <section className="enter-delay grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="מעסיקים" value={stats.employers} />
        <StatCard label="מועמדים" value={stats.candidates} />
        <StatCard
          label="מאצ׳ים"
          value={stats.matches.total}
          sub={`${stats.matches.approved} אושרו · ${stats.matches.queued} בתור`}
        />
        <StatCard
          label="עלות AI (הערכה)"
          value={formatUsd(stats.aiUsage.estimatedCostUsd)}
          sub={`${formatTokens(stats.aiUsage.totalTokens)} טוקנים · ${stats.aiUsage.totalCalls} קריאות`}
        />
      </section>

      <section className="panel enter-delay-2 mt-4 rounded-[var(--panel-radius)] p-5">
        <h2 className="text-sm font-semibold text-[var(--muted)]">פירוט מאצ׳ים</h2>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <span>בתור: {stats.matches.queued}</span>
          <span>אושרו: {stats.matches.approved}</span>
          <span>נדחו: {stats.matches.rejected}</span>
          <span>משתמשים רשומים: {stats.users}</span>
        </div>
      </section>

      <section className="panel enter-delay-2 mt-4 rounded-[var(--panel-radius)] p-5">
        <h2 className="text-sm font-semibold text-[var(--muted)]">אמינות מועמדים (פנימי)</h2>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <span>ממוצע: {stats.reliability?.averageScore ?? 100}</span>
          <span>סתירות פתוחות: {stats.reliability?.openNotes ?? 0}</span>
        </div>
        {(stats.reliability?.lowScoreCandidates?.length ?? 0) > 0 ? (
          <ul className="mt-3 space-y-1.5 text-xs text-[var(--ink)]">
            {stats.reliability!.lowScoreCandidates.map((c) => (
              <li key={c.userId} className="flex flex-wrap gap-2">
                <span className="font-medium">{c.name}</span>
                <span className="text-[var(--muted)]">ציון {c.score}</span>
                {c.openNotes > 0 ? (
                  <span className="text-[var(--warn)]">{c.openNotes} פתוחות</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-[var(--muted)]">אין סתירות פתוחות כרגע.</p>
        )}
      </section>

      <section className="enter-delay-2 mt-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--muted)]">
            הפרומפטים נשלחים בכל הודעת צ׳אט מ־
            <code className="mx-1 rounded bg-[var(--chip)] px-1.5 py-0.5 text-[11px]">
              /api/chat
            </code>
            (מפתח Gemini רק בשרת).{" "}
            <span className="font-medium text-[var(--ink)]">
              {isCustom ? "מקור: עריכה מותאמת (DB)" : "מקור: קבצי ברירת מחדל"}
            </span>
            {aiMode ? (
              <span className="ms-2 font-medium text-[var(--accent)]">
                · מצב AI: {aiMode === "gemini" ? "Gemini פעיל" : "מקומי (חסר מפתח)"}
              </span>
            ) : null}
          </p>
        </div>

        {error ? (
          <p className="rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn)]">
            {error}
          </p>
        ) : null}

        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-semibold">פרומפט סוכן מועמדים</h2>
            <span className="max-w-xl text-xs leading-5 text-[var(--muted)]">
              {PLACEHOLDER_HELP}
            </span>
          </div>
          <textarea
            value={candidatePrompt}
            onChange={(e) => setCandidatePrompt(e.target.value)}
            dir="rtl"
            rows={14}
            className="w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-4 font-mono text-xs leading-6 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
          />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-semibold">פרומפט סוכן מעסיקים</h2>
            <span className="max-w-xl text-xs leading-5 text-[var(--muted)]">
              {PLACEHOLDER_HELP}
            </span>
          </div>
          <textarea
            value={employerPrompt}
            onChange={(e) => setEmployerPrompt(e.target.value)}
            dir="rtl"
            rows={14}
            className="w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-4 font-mono text-xs leading-6 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={saving} onClick={() => void savePrompts()}>
            {saving ? "שומר…" : "שמירת פרומפטים (לייב)"}
          </Button>
          <Button variant="secondary" disabled={resetting} onClick={() => void resetPrompts()}>
            {resetting ? "מאפס…" : "איפוס לברירת מחדל"}
          </Button>
          {saved ? <span className="text-sm text-[var(--accent)]">נשמר — פעיל מההודעה הבאה</span> : null}
          {prompts.updatedAt ? (
            <span className="text-xs text-[var(--muted)]">
              עודכן לאחרונה: {new Date(prompts.updatedAt).toLocaleString("he-IL")}
              {prompts.updatedBy ? ` · ${prompts.updatedBy}` : ""}
            </span>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="panel rounded-[var(--panel-radius)] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[var(--hero)]">{value}</p>
      {sub ? <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p> : null}
    </div>
  );
}
