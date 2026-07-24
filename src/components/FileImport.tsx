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
  compact?: boolean;
  variant?: "default" | "toolbar" | "footer" | "sidebar" | "attach" | "message-button";
  inputRef?: Ref<HTMLInputElement>;
}) {
  const { t, fmt, locale } = useTranslation();
  const localRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [phase, setPhase] = useState<"saved" | "analyzed" | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [expanded, setExpanded] = useState(false);
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

  async function runAnalysis(documentId?: string, announceInChat = false, isCvUpdate = false) {
    setStatus("analyzing");
    setPhase(null);
    try {
      const res = await fetch("/api/cv/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: props.userId,
          documentId,
          locale,
          announceInChat,
          isCvUpdate,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus("done");
        setPhase("analyzed");
        setExpanded(false);
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
        const isCvUpdate = Boolean(props.hasExisting);
        await runAnalysis(data.documentId as string | undefined, true, isCvUpdate);
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

  const summaryLine = summary ? (
    <p className="employee-cv-card__summary">
      {fmt(t.fileImport.cvSummary, {
        fields: String(summary.fieldsUpdated ?? 0),
        roles: String(summary.rolesFound ?? 0),
      })}
    </p>
  ) : null;

  if (variant === "sidebar") {
    if (hasCv && !expanded && !busy) {
      return (
        <div className="employee-cv-card employee-cv-card--collapsed">
          <input
            ref={bindInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => void onFile(e)}
            className="hidden"
          />
          <div className="employee-cv-card__compact">
            <span className="employee-cv-card__compact-check" aria-hidden>
              ✓
            </span>
            <span className="employee-cv-card__compact-name">
              {props.existingFileName || t.fileImport.cvCaptured}
            </span>
            <button
              type="button"
              className="employee-cv-card__compact-btn"
              onClick={() => setExpanded(true)}
            >
              {t.fileImport.expandCv}
            </button>
          </div>
          {summaryLine}
        </div>
      );
    }

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
          {hasCv ? (
            <button
              type="button"
              className="employee-cv-card__compact-btn"
              onClick={() => setExpanded(false)}
              disabled={busy}
            >
              {t.fileImport.collapseCv}
            </button>
          ) : null}
          {statusLine}
        </div>
        {summaryLine}
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

  if (variant === "message-button") {
    return (
      <>
        <input
          ref={bindInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => void onFile(e)}
          className="hidden"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => localRef.current?.click()}
          className="mt-2.5 inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-white/35 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition duration-200 hover:bg-white/25 disabled:cursor-wait disabled:opacity-70"
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
            t.chat.attachCv
          )}
        </button>
      </>
    );
  }

  if (variant === "attach") {
    return (
      <>
        <input
          ref={bindInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => void onFile(e)}
          className="hidden"
        />
        <button
          type="button"
          disabled={busy}
          title={t.chat.attachCv}
          aria-label={t.chat.attachCv}
          onClick={() => localRef.current?.click()}
          className="chat-attach-btn inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--chip)] text-[var(--hero)] transition duration-200 hover:border-[var(--accent)] hover:bg-white hover:text-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? (
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden
            />
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12.5 18.5 7.2 13.2a4.2 4.2 0 0 1 6-5.9l5.6 5.6a3 3 0 0 1-4.2 4.2l-5.1-5.1" />
              <path d="m16 6 2-2" />
            </svg>
          )}
        </button>
      </>
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
        {!props.compact ? (
          <p className="mb-3 text-center text-sm leading-6 text-[var(--warn)]">{t.chat.cvRequired}</p>
        ) : null}
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          {uploadButton}
          {statusLine}
        </div>
        {!props.compact ? (
          <p className="mt-2 text-center text-[11px] text-[var(--muted)]">{props.hint}</p>
        ) : null}
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
