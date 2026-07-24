"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";

type Status = "idle" | "saving" | "analyzing" | "done" | "error";

type ImportSummary = {
  fieldsUpdated?: number;
  rolesFound?: number;
  conflictsPending?: number;
  fileName?: string;
};

export function FileImport(props: {
  userId: string;
  endpoint: string;
  jobId?: string;
  title: string;
  hint: string;
  onDone?: () => void;
  minimalSummary?: boolean;
  cvMode?: boolean;
  hasExisting?: boolean;
  existingFileName?: string | null;
  pendingAnalysis?: boolean;
}) {
  const { t, fmt } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [phase, setPhase] = useState<"saved" | "analyzed" | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const analyzingRef = useRef(false);

  useEffect(() => {
    if (!props.cvMode || !props.pendingAnalysis || analyzingRef.current) return;
    analyzingRef.current = true;
    void runAnalysis();
  }, [props.cvMode, props.pendingAnalysis]);

  async function runAnalysis(documentId?: string) {
    setStatus("analyzing");
    setPhase(null);
    try {
      const res = await fetch("/api/cv/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: props.userId, documentId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus("done");
        setPhase("analyzed");
        if (props.minimalSummary && data.summary) {
          setSummary(data.summary as ImportSummary);
        }
        props.onDone?.();
      } else {
        setStatus("error");
        setError(data.error ?? t.fileImport.error);
      }
    } catch {
      setStatus("error");
      setError(t.fileImport.error);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("saving");
    setError("");
    setSummary(null);
    setPhase(null);
    try {
      const form = new FormData();
      form.append("userId", props.userId);
      form.append("file", file);
      if (props.jobId) form.append("jobId", props.jobId);

      const res = await fetch(props.endpoint, { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus("error");
        setError(data.error ?? t.fileImport.error);
        return;
      }

      if (props.cvMode) {
        setPhase("saved");
        props.onDone?.();
        await runAnalysis(data.documentId as string | undefined);
      } else {
        setStatus("done");
        if (props.minimalSummary && data.summary) {
          setSummary(data.summary as ImportSummary);
        }
        props.onDone?.();
      }
    } catch {
      setStatus("error");
      setError(t.fileImport.error);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const busy = status === "saving" || status === "analyzing";
  const hasCv = props.cvMode && (props.hasExisting || phase === "saved" || phase === "analyzed");

  function buttonLabel() {
    if (status === "saving") return t.fileImport.saving;
    if (status === "analyzing") return t.fileImport.analyzing;
    if (hasCv) return t.fileImport.changeCv;
    return props.cvMode ? t.fileImport.uploadCv : t.fileImport.choose;
  }

  return (
    <div className="panel rounded-[1.25rem] p-3.5">
      <p className="text-sm font-semibold text-[var(--hero)]">{props.title}</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{props.hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        onChange={(e) => void onFile(e)}
        className="hidden"
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={
            hasCv
              ? "cursor-pointer whitespace-nowrap rounded-md border border-[var(--stroke)] bg-transparent px-2 py-1 text-[11px] font-medium text-[var(--muted)] transition duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
              : "cursor-pointer whitespace-nowrap rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white transition duration-200 hover:bg-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-70"
          }
        >
          {busy ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
              {buttonLabel()}
            </span>
          ) : (
            buttonLabel()
          )}
        </button>
        {phase === "saved" && status === "analyzing" ? (
          <span className="text-xs text-[var(--accent)]">{t.fileImport.saved}</span>
        ) : null}
        {phase === "analyzed" && status === "done" ? (
          <span className="text-xs text-[var(--accent)]">{t.fileImport.analyzed}</span>
        ) : null}
        {!props.cvMode && status === "done" && !summary ? (
          <span className="text-xs text-[var(--accent)]">{t.fileImport.done}</span>
        ) : null}
        {status === "error" ? <span className="text-xs text-[var(--warn)]">{error}</span> : null}
      </div>
      {props.existingFileName && hasCv && status === "idle" ? (
        <p className="mt-1.5 truncate text-[10px] text-[var(--muted)]">{props.existingFileName}</p>
      ) : null}
      {summary ? (
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
          {fmt(t.fileImport.cvSummary, {
            fields: String(summary.fieldsUpdated ?? 0),
            roles: String(summary.rolesFound ?? 0),
          })}
          {(summary.conflictsPending ?? 0) > 0 ? ` ${t.fileImport.cvConflictsHint}` : ""}
        </p>
      ) : null}
    </div>
  );
}
