"use client";

import { useTranslation } from "@/components/LocaleProvider";

type Job = {
  matchId: string;
  score: number;
  reason: string;
  employerName: string;
  card?: {
    title: string;
    field: string;
    location: string;
    salaryRange: string;
    personalityFit: string;
    interviewSlots: string[];
    summary: string;
  };
};

export function OpportunityList(props: { jobs: Job[] }) {
  const { t, fmt } = useTranslation();

  if (props.jobs.length === 0) {
    return (
      <div className="empty-state panel-elevated border-dashed p-12 text-center">
        <p className="text-sm leading-6 text-[var(--muted)]">{t.jobs.empty}</p>
      </div>
    );
  }

  return (
    <div className="tab-fade space-y-4">
      {props.jobs.map((job) => (
        <article
          key={job.matchId}
          className="panel-elevated group p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-md)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[var(--hero)]">
                {job.card?.title || t.jobs.defaultTitle}
              </h3>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                {job.employerName}
                {job.card?.field ? ` · ${job.card.field}` : ""}
                {job.card?.location ? ` · ${job.card.location}` : ""}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--accent-strong)]">
              {t.jobs.approved}
            </span>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--ink)]">{job.reason}</p>
          {job.card?.salaryRange ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {fmt(t.jobs.salary, { value: job.card.salaryRange })}
            </p>
          ) : null}
          {job.card?.interviewSlots?.length ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              {fmt(t.jobs.interviewSlots, { value: job.card.interviewSlots.join(" · ") })}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
