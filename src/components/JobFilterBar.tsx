"use client";

type JobMeta = { id: string; title?: string; field?: string };

export function JobFilterBar(props: {
  label: string;
  jobs: JobMeta[];
  activeJobId: string | null;
  busy: boolean;
  newJobLabel: string;
  jobLabel: (job: JobMeta, index: number) => string;
  onSelect: (jobId: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="enter-delay mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--stroke)] bg-[color-mix(in_srgb,var(--surface)_80%,white)] p-3 shadow-[var(--shadow-soft)]">
      <span className="w-full text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase sm:w-auto sm:pe-2">
        {props.label}
      </span>
      {props.jobs.map((job, i) => (
        <button
          key={job.id}
          type="button"
          disabled={props.busy}
          onClick={() => props.onSelect(job.id)}
          className={
            job.id === props.activeJobId
              ? "cursor-pointer rounded-full bg-[var(--hero)] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(16,42,80,0.18)] transition duration-200"
              : "cursor-pointer rounded-full border border-[var(--stroke)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--ink)] transition duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          }
        >
          {props.jobLabel(job, i)}
        </button>
      ))}
      <button
        type="button"
        disabled={props.busy}
        onClick={props.onCreate}
        className="cursor-pointer rounded-full border border-dashed border-[var(--accent)] bg-[var(--accent-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-strong)] transition duration-200 hover:bg-[var(--bubble)]"
      >
        + {props.newJobLabel}
      </button>
    </div>
  );
}
