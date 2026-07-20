"use client";

import { useRef, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";

type Status = "idle" | "busy" | "done" | "error";

export function FileImport(props: {
  userId: string;
  endpoint: string;
  jobId?: string;
  title: string;
  hint: string;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("busy");
    setError("");
    try {
      const form = new FormData();
      form.append("userId", props.userId);
      form.append("file", file);
      if (props.jobId) form.append("jobId", props.jobId);
      const res = await fetch(props.endpoint, { method: "POST", body: form });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus("done");
        props.onDone?.();
      } else {
        setStatus("error");
        setError(data.error ?? t.fileImport.error);
      }
    } catch {
      setStatus("error");
      setError(t.fileImport.error);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3">
      <p className="text-sm font-semibold text-[var(--ink)]">{props.title}</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{props.hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        onChange={(e) => void onFile(e)}
        className="hidden"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={status === "busy"}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {status === "busy" ? t.fileImport.processing : t.fileImport.choose}
        </button>
        {status === "done" ? (
          <span className="text-xs text-[var(--accent)]">{t.fileImport.done}</span>
        ) : null}
        {status === "error" ? <span className="text-xs text-[var(--warn)]">{error}</span> : null}
      </div>
    </div>
  );
}
