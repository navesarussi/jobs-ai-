"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/i18n/types";

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string };

export type ChatTurnPayload = {
  reply?: string;
  error?: string;
  provider?: string;
  aiMode?: string;
  aiDegraded?: boolean;
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
  blockedReason?: string;
  onTurn?: (payload: ChatTurnPayload) => void;
  onReset?: () => void;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Msg[]>(props.initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState("");
  const [degraded, setDegraded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(props.initialMessages);
  }, [props.initialMessages, props.jobId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy || props.blockedReason) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: text }]);
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
      const data = (await res.json()) as ChatTurnPayload;
      if (data.error) {
        setMessages((m) => [
          ...m,
          { id: `err-${Date.now()}`, role: "assistant", content: data.error! },
        ]);
        return;
      }
      setProvider(data.provider ?? data.aiMode ?? "");
      setDegraded(Boolean(data.aiDegraded));
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply ?? t.chat.replyFailed,
        },
      ]);
      props.onTurn?.(data);
    } catch {
      setMessages((m) => [
        ...m,
        { id: `err-${Date.now()}`, role: "assistant", content: t.chat.replyFailed },
      ]);
    } finally {
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
    <div className="chat-surface flex h-full min-h-[480px] flex-col">
      <div className="chat-surface__header flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="live-pulse inline-block h-2.5 w-2.5 rounded-full bg-[var(--sky)]" />
            <p className="text-sm font-semibold">{t.chat.title}</p>
          </div>
          <p className="mt-0.5 text-xs text-white/70">{t.chat.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {provider ? (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white/90">
              {degraded
                ? t.chat.degradedMode
                : provider === "gemini"
                  ? "Gemini"
                  : t.chat.localMode}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void resetChat()}
            disabled={busy || Boolean(props.blockedReason)}
            className="cursor-pointer rounded-lg bg-white/10 px-2.5 py-1 text-[11px] text-white/90 transition hover:bg-white/20 disabled:opacity-50"
          >
            {t.chat.reset}
          </button>
        </div>
      </div>

      <div className="chat-surface__body flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="chat-msg mx-auto max-w-md rounded-2xl border border-dashed border-[var(--stroke)] bg-white/60 px-5 py-4 text-center text-sm leading-7 text-[var(--muted)]">
            {props.blockedReason ?? (props.role === "employee" ? t.chat.employeeEmptyHint : t.chat.employerEmptyHint)}
          </div>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "chat-msg ms-6 max-w-[85%] rounded-2xl rounded-se-sm bg-[var(--accent)] px-4 py-3 text-sm leading-6 text-white shadow-lg"
                : "chat-msg me-6 max-w-[90%] rounded-2xl rounded-ss-sm border border-[var(--stroke)] bg-white px-4 py-3 text-sm leading-6 text-[var(--ink)] shadow-sm"
            }
          >
            {m.content}
          </div>
        ))}
        {busy ? (
          <div className="chat-msg me-6 inline-flex items-center gap-2 rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-xs text-[var(--muted)]">
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

      <div className="border-t border-[var(--stroke)] bg-white/80 p-4 backdrop-blur">
        {props.blockedReason ? (
          <p className="mb-3 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-center text-xs leading-5 text-[var(--warn)]">
            {props.blockedReason}
          </p>
        ) : null}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            placeholder={props.blockedReason ? t.chat.cvRequiredPlaceholder : props.placeholder}
            disabled={Boolean(props.blockedReason)}
            className="min-h-12 flex-1 rounded-full border border-[var(--stroke)] bg-[var(--chip)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <Button
            onClick={() => void send()}
            disabled={busy || Boolean(props.blockedReason)}
            className="brand-gradient-bg min-h-12 rounded-full px-6 hover:bg-transparent hover:brightness-105"
          >
            {t.chat.send}
          </Button>
        </div>
      </div>
    </div>
  );
}
