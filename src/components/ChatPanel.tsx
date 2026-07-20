"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import type { Locale } from "@/i18n/types";

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string };

export type ChatTurnPayload = {
  reply?: string;
  error?: string;
  provider?: string;
  aiMode?: string;
  card?: unknown;
  chat?: Msg[];
  pendingQuestions?: { id: string; question: string }[];
  jobId?: string;
};

export function ChatPanel(props: {
  userId: string;
  role: "employee" | "employer";
  locale: Locale;
  initialMessages: Msg[];
  placeholder: string;
  jobId?: string;
  onTurn?: (payload: ChatTurnPayload) => void;
  onReset?: () => void;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Msg[]>(props.initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(props.initialMessages);
  }, [props.initialMessages, props.jobId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: text }]);

    const assistantId = `a-${Date.now()}`;
    let acc = "";
    let started = false;
    const upsertAssistant = (content: string) => {
      setMessages((m) => {
        if (m.some((x) => x.id === assistantId)) {
          return m.map((x) => (x.id === assistantId ? { ...x, content } : x));
        }
        return [...m, { id: assistantId, role: "assistant", content }];
      });
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: props.userId,
          role: props.role,
          message: text,
          locale: props.locale,
          jobId: props.jobId,
        }),
      });

      if (!res.body) {
        // Non-streaming fallback (e.g. a buffered error response).
        const data = (await res.json().catch(() => null)) as ChatTurnPayload | null;
        upsertAssistant(data?.reply ?? data?.error ?? t.chat.replyFailed);
        if (data && !data.error) props.onTurn?.(data);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalPayload: ChatTurnPayload | null = null;
      let errorText: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let evt: { type?: string; text?: string; error?: string } & ChatTurnPayload;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === "delta") {
            acc += evt.text ?? "";
            if (!started) {
              started = true;
              setStreamingId(assistantId);
            }
            upsertAssistant(acc);
          } else if (evt.type === "final") {
            finalPayload = evt;
          } else if (evt.type === "error") {
            errorText = evt.error ?? t.chat.replyFailed;
          }
        }
      }

      if (errorText) {
        upsertAssistant(errorText);
      } else if (finalPayload) {
        setProvider(finalPayload.provider ?? finalPayload.aiMode ?? "");
        upsertAssistant(finalPayload.reply ?? acc ?? t.chat.replyFailed);
        props.onTurn?.(finalPayload);
      } else if (!started) {
        upsertAssistant(t.chat.replyFailed);
      }
    } catch {
      upsertAssistant(acc || t.chat.replyFailed);
    } finally {
      setStreamingId(null);
      setBusy(false);
    }
  }

  async function resetChat() {
    if (busy) return;
    if (!window.confirm(t.chat.resetConfirm)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/chat/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: props.userId,
          role: props.role,
          jobId: props.jobId,
        }),
      });
      const data = await res.json();
      if (!data.error) {
        setMessages([]);
        props.onReset?.();
        props.onTurn?.({ chat: [], card: data.card, jobId: data.jobId });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="premium-panel flex h-full min-h-[440px] flex-col overflow-hidden rounded-[1.35rem]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--stroke)] bg-[linear-gradient(180deg,#ffffff,rgba(230,242,240,0.55))] px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="live-pulse inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
            <p className="text-sm font-semibold tracking-tight text-[var(--ink)]">
              {t.chat.title}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{t.chat.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {provider ? (
            <span className="rounded-full bg-[var(--chip)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
              {provider === "gemini" ? "Gemini" : t.chat.localMode}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void resetChat()}
            disabled={busy}
            className="press focus-ring rounded-lg border border-[var(--stroke)] bg-white px-2.5 py-1 text-[11px] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          >
            {t.chat.reset}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="chat-msg rounded-2xl bg-[var(--bubble)]/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
            {props.role === "employee" ? t.chat.employeeEmptyHint : t.chat.employerEmptyHint}
          </div>
        ) : null}
        {messages.map((m) => {
          const streaming = m.id === streamingId && m.role === "assistant";
          return (
            <div
              key={m.id}
              className={
                (m.role === "user"
                  ? "chat-msg ms-8 rounded-2xl rounded-se-md bg-[var(--accent)] px-3.5 py-2.5 text-sm leading-6 text-white shadow-[0_8px_20px_rgba(12,107,102,0.22)]"
                  : "chat-msg me-8 rounded-2xl rounded-ss-md border border-[var(--stroke)] bg-white px-3.5 py-2.5 text-sm leading-6 text-[var(--ink)] shadow-[0_6px_16px_rgba(16,36,42,0.04)]") +
                " whitespace-pre-wrap break-words" +
                (streaming ? " stream-caret" : "")
              }
            >
              {m.content}
            </div>
          );
        })}
        {busy && !streamingId ? (
          <div className="chat-msg me-8 inline-flex items-center gap-2 rounded-2xl border border-[var(--stroke)] bg-white px-3.5 py-2.5 text-xs text-[var(--muted)]">
            <span>{t.chat.typing}</span>
            <span className="typing-dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[var(--stroke)] bg-white/80 p-3 backdrop-blur">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            placeholder={props.placeholder}
            className="focus-ring flex-1 rounded-xl border border-[var(--stroke)] bg-[var(--bg)]/40 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] focus:bg-white"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy}
            className="press focus-ring rounded-xl bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {t.chat.send}
          </button>
        </div>
      </div>
    </div>
  );
}
