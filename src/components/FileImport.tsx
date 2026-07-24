"use client";

import { useEffect, useRef, useState, type Ref } from "react";
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
  variant?: "default" | "toolbar" | "footer" | "sidebar";
  inputRef?: Ref<HTMLInputElement>;
}) {
  const { t, fmt } = useTranslation();
  const localRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [phase, setPhase] = useState<"saved" | "analyzed" | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const analyzingRef = useRef(false);

  function bindInputRef(node: HTMLInputElement | null) {
    localRef.current = node;
    const external = props.inputRef;
    if (!external) return;
    if (typeof external === "function") external(node);
    else external.current = node;
  }

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
      if (localRef.current) localRef.current.value = "";
    }
  }

  const busy = status === "saving" || status === "analyzing";
  const hasCv = props.cvMode && (props.hasExisting || phase === "saved" || phase === "analyzed");
  const variant = props.variant ?? "default";

  function buttonLabel() {
    if (status === "saving") return t.fileImport.saving;
    if (status === "analyzing") return t.fileImport.analyzing;
    if (hasCv) return t.fileImport.changeCv;
    return props.cvMode ? t.fileImport.uploadCv : t.fileImport.choose;
  }

  const uploadButton = (
    <button
      type="button"
      disabled={busy}
      onClick={() => localRef.current?.click()}
      className={
        hasCv && variant !== "footer"
          ? "cursor-pointer whitespace-nowrap rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink)] transition duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          : "cta-glow brand-gradient-bg cursor-pointer whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition duration-200 hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
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
  );

  const statusLine = (
    <>
      {phase === "saved" && status === "analyzing" ? (
        <span className="text-xs font-medium text-[var(--accent)]">{t.fileImport.saved}</span>
      ) : null}
      {phase === "analyzed" && status === "done" ? (
        <span className="text-xs font-medium text-[var(--accent)]">{t.fileImport.analyzed}</span>
      ) : null}
      {!props.cvMode && status === "done" && !summary ? (
        <span className="text-xs font-medium text-[var(--accent)]">{t.fileImport.done}</span>
      ) : null}
      {status === "error" ? <span className="text-xs text-[var(--warn)]">{error}</span> : null}
    </>
  );

  if (variant === "sidebar") {
    return (
      <div className={`employee-cv-card ${hasCv ? "employee-cv-card--done" : "employee-cv-card--pending"}`}>
        <input
          ref={bindInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => void onFile(e)}
          className="hidden"
        />
        <div className="employee-cv-card__body">
          <div
            className={`employee-cv-card__icon ${hasCv ? "employee-cv-card__icon--done" : ""}`}
            aria-hidden
          >
            {hasCv ? "✓" : "📄"}
          </div>
          <div className="min-w-0 flex-1">
            {hasCv && props.existingFileName && status === "idle" ? (
              <p className="truncate text-sm font-medium text-[var(--hero)]">{props.existingFileName}</p>
            ) : (
              <p className="text-sm font-medium text-[var(--hero)]">{props.title}</p>
            )}
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{props.hint}</p>
          </div>
        </div>
        <div className="employee-cv-card__actions">
          {uploadButton}
          {statusLine}
        </div>
        {summary ? (
          <p className="employee-cv-card__summary">
            {fmt(t.fileImport.cvSummary, {
              fields: String(summary.fieldsUpdated ?? 0),
              roles: String(summary.rolesFound ?? 0),
            })}
          </p>
        ) : null}
      </div>
    );
  }

  if (variant === "toolbar") {
    return (
      <div className="employee-toolbar-cv">
        <input
          ref={bindInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => void onFile(e)}
          className="hidden"
        />
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${
              hasCv
                ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                : "bg-[var(--warn-bg)] text-[var(--warn)]"
            }`}
            aria-hidden
          >
            {hasCv ? "✓" : "↑"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[var(--hero)]">{props.title}</p>
            <p className="truncate text-[10px] text-[var(--muted)]">
              {props.existingFileName && hasCv && status === "idle"
                ? props.existingFileName
                : props.hint}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {uploadButton}
          {statusLine}
        </div>
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <div className="employee-cv-footer">
        <input
          ref={bindInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => void onFile(e)}
          className="hidden"
        />
        <p className="mb-3 text-center text-sm leading-6 text-[var(--warn)]">{t.chat.cvRequired}</p>
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          {uploadButton}
          {statusLine}
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--muted)]">{props.hint}</p>
      </div>
    );
  }

  return (
    <div className="panel-elevated p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--hero)]">{props.title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{props.hint}</p>
        </div>
        {hasCv ? (
          <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent-strong)]">
            ✓
          </span>
        ) : null}
      </div>
      <input
        ref={bindInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        onChange={(e) => void onFile(e)}
        className="hidden"
      />
      <div
        className={`mt-3 rounded-xl border border-dashed px-4 py-3 transition duration-200 ${
          hasCv
            ? "border-[var(--stroke)] bg-[var(--surface)]"
            : "border-[var(--accent)]/35 bg-[var(--brand-gradient-soft)] hover:border-[var(--accent)]"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {uploadButton}
          {statusLine}
        </div>
        {props.existingFileName && hasCv && status === "idle" ? (
          <p className="mt-2 truncate text-[11px] text-[var(--muted)]">{props.existingFileName}</p>
        ) : null}
      </div>
      {summary ? (
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
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
