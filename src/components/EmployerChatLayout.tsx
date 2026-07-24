"use client";

import { ChatPanel, type ChatTurnPayload } from "@/components/ChatPanel";
import { FileImport } from "@/components/FileImport";
import { ProfileAside } from "@/components/ProfileAside";
import type { Locale } from "@/i18n/types";

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string };

export function EmployerChatLayout(props: {
  userId: string;
  locale: Locale;
  activeJobId: string | null;
  chat: Msg[];
  card: unknown;
  placeholder: string;
  hydrating: boolean;
  importTitle: string;
  importHint: string;
  onTurn: (payload: ChatTurnPayload) => void;
  onFlexibilityChange: (value: number) => void;
  onImportDone: () => void;
}) {
  return (
    <div className="enter-delay-2 grid gap-4 lg:grid-cols-[1fr_280px]">
      <div>
        <ChatPanel
          key={`${props.userId}-${props.activeJobId ?? "job"}-employer`}
          userId={props.userId}
          role="employer"
          locale={props.locale}
          jobId={props.activeJobId ?? undefined}
          initialMessages={props.chat}
          placeholder={props.placeholder}
          onTurn={props.onTurn}
        />
      </div>
      <div className="relative space-y-4">
        {props.hydrating ? (
          <p className="mb-2 text-xs text-[var(--muted)] opacity-70">…</p>
        ) : null}
        <ProfileAside
          kind="employer"
          userId={props.userId}
          card={(props.card as never) ?? null}
          onFlexibilityChange={props.onFlexibilityChange}
        />
        <FileImport
          userId={props.userId}
          endpoint="/api/job-import"
          jobId={props.activeJobId ?? undefined}
          title={props.importTitle}
          hint={props.importHint}
          onDone={props.onImportDone}
        />
      </div>
    </div>
  );
}
