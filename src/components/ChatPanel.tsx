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

type StreamEvent =
  | { type: "delta"; text: string }
  | ({ type: "final" } & ChatTurnPayload)
  | { type: "error"; error: string };

export function ChatPanel(props: {
  userId: string;
  role: "employee" | "employer";
  locale: Locale;
  initialMessages: Msg[];
  placeholder: string;
  jobId?: string;
  blockedReason?: string;
  topSlot?: React.ReactNode;
  blockedFooter?: React.ReactNode;
  lockedOverlay?: React.ReactNode;
  onTurn?: (payload: ChatTurnPayload) => void;
  onReset?: () => void;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Msg[]>(props.initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [degraded, setDegraded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(props.initialMessages);
  }, [props.initialMessages, props.jobId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, streamingId]);

  async function send() {
    const text = input.trim();
    if (!text || busy || props.blockedReason) return;
    setInput("");
    setBusy(true);
    const assistantId = `a-${Date.now()}`;
    setStreamingId(assistantId);
    setMessages((m) => [
      ...m,
      { id: `local-${Date.now()}`, role: "user", content: text },
      { id: assistantId, role: "assistant", content: "" },
    ]);

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

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("ndjson") && !contentType.includes("json")) {
        throw new Error("bad content type");
      }

      // Legacy JSON fallback (non-stream errors from auth/validation).
      if (contentType.includes("application/json") && !contentType.includes("ndjson")) {
        const data = (await res.json()) as ChatTurnPayload;
        if (data.error) {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId ? { ...msg, content: data.error! } : msg,
            ),
          );
          return;
        }
        setProvider(data.provider ?? data.aiMode ?? "");
        setDegraded(Boolean(data.aiDegraded));
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: data.reply ?? t.chat.replyFailed }
              : msg,
          ),
        );
        props.onTurn?.(data);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("no body");
      const decoder = new TextDecoder();
      let buffer = "";
      let gotFinal = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }
          if (event.type === "delta" && event.text) {
            setMessages((m) =>
              m.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content + event.text }
                  : msg,
              ),
            );
          } else if (event.type === "error") {
            setMessages((m) =>
              m.map((msg) =>
                msg.id === assistantId ? { ...msg, content: event.error } : msg,
              ),
            );
          } else if (event.type === "final") {
            gotFinal = true;
            setProvider(event.provider ?? event.aiMode ?? "");
            setDegraded(Boolean(event.aiDegraded));
            if (event.reply) {
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: event.reply! } : msg,
                ),
              );
            }
            props.onTurn?.(event);
          }
        }
      }

      if (!gotFinal) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId && !msg.content
              ? { ...msg, content: t.chat.replyFailed }
              : msg,
          ),
        );
      }
    } catch {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: msg.content || t.chat.replyFailed }
            : msg,
        ),
      );
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

  const blocked = Boolean(props.blockedReason);
  const showTyping = busy && !streamingId;

  return (
    <div className="chat-surface flex h-full min-h-0 flex-col">
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

      {props.topSlot ? <div className="border-b border-[var(--stroke)] bg-white/90">{props.topSlot}</div> : null}

      <div className="chat-surface__body relative flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 && !blocked ? (
          <div className="empty-state chat-msg mx-auto max-w-md rounded-2xl border border-dashed border-[var(--stroke)] px-6 py-5 text-center text-sm leading-7 text-[var(--muted)]">
            {props.role === "employee" ? t.chat.employeeEmptyHint : t.chat.employerEmptyHint}
          </div>
        ) : null}
        {messages.map((m) =>
          m.role === "assistant" && m.id === streamingId && !m.content ? null : (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "chat-msg ms-6 max-w-[85%] rounded-2xl rounded-se-sm bg-[var(--accent)] px-4 py-3 text-sm leading-6 text-white shadow-lg"
                  : "chat-msg me-6 max-w-[90%] rounded-2xl rounded-ss-sm border border-[var(--stroke)] bg-white px-4 py-3 text-sm leading-6 text-[var(--ink)] shadow-sm"
              }
            >
              {m.content}
              {m.id === streamingId && m.content ? (
                <span className="ms-0.5 inline-block h-3 w-0.5 animate-pulse bg-[var(--accent)] align-middle" />
              ) : null}
            </div>
          ),
        )}
        {showTyping || (streamingId && messages.find((m) => m.id === streamingId)?.content === "") ? (
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
        {blocked && props.lockedOverlay ? (
          <div className="employee-chat-locked-layer">{props.lockedOverlay}</div>
        ) : null}
      </div>

      <div className="border-t border-[var(--stroke)] bg-white/80 p-4 backdrop-blur">
        {blocked && props.lockedOverlay ? (
          <p className="text-center text-xs leading-5 text-[var(--muted)]">{t.chat.cvRequired}</p>
        ) : blocked && props.blockedFooter ? (
          props.blockedFooter
        ) : (
          <>
            {props.blockedReason && !props.lockedOverlay ? (
              <p className="mb-3 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-center text-xs leading-5 text-[var(--warn)]">
                {t.chat.cvRequired}
              </p>
            ) : null}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
                placeholder={blocked ? t.chat.cvRequiredPlaceholder : props.placeholder}
                disabled={blocked}
                className="min-h-12 flex-1 rounded-full border border-[var(--stroke)] bg-[var(--chip)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <Button
                onClick={() => void send()}
                disabled={busy || blocked}
                className="brand-gradient-bg min-h-12 rounded-full px-6 hover:bg-transparent hover:brightness-105"
              >
                {t.chat.send}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
