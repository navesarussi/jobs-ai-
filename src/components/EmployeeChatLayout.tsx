"use client";

import { CandidateProfileStrip } from "@/components/CandidateProfileStrip";
import { InlineInfoHint } from "@/components/InlineInfoHint";
import { ChatPanel, type ChatTurnPayload } from "@/components/ChatPanel";
import { FileImport } from "@/components/FileImport";
import { useTranslation } from "@/components/LocaleProvider";
import type { Locale } from "@/i18n/types";
import type { CandidateCard } from "@/domain/types";
import { candidateRows, knowledgePercent } from "@/domain/card-progress";
import { emptyCandidateCard } from "@/domain/types";

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string };

function ApplicationProgress(props: { percent: number }) {
  const { t } = useTranslation();

  return (
    <div className="employee-application-progress" aria-live="polite">
      <div className="employee-application-progress__content">
        <span className="employee-application-progress__value">{props.percent}%</span>
        <span className="employee-application-progress__label">{t.employee.applicationProgress}</span>
        <InlineInfoHint label={t.employee.applicationProgressHint}>
          {t.employee.applicationProgressHint}
        </InlineInfoHint>
      </div>
    </div>
  );
}

export function EmployeeChatLayout(props: {
  userId: string;
  locale: Locale;
  chat: Msg[];
  card: CandidateCard | null | undefined;
  hasCv: boolean;
  cvPending: boolean;
  placeholder: string;
  onTurn: (payload: ChatTurnPayload) => void;
  onCvDone: () => void;
  onFlexibilityChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const blockedReason = props.hasCv ? undefined : "blocked";
  const labels = t.cardFields.candidate as Record<string, string>;
  const knowledge = knowledgePercent(
    candidateRows(props.card ?? emptyCandidateCard(), labels),
  );

  const cvUpload = (
    <FileImport
      userId={props.userId}
      endpoint="/api/cv"
      title={t.fileImport.cvTitle}
      hint={t.fileImport.cvHint}
      variant="footer"
      compact
      minimalSummary
      cvMode
      hasExisting={props.hasCv}
      pendingAnalysis={props.cvPending}
      onDone={props.onCvDone}
    />
  );

  const cvAttach = (
    <FileImport
      userId={props.userId}
      endpoint="/api/cv"
      title={t.fileImport.cvTitle}
      hint={t.fileImport.cvHint}
      variant="attach"
      minimalSummary
      cvMode
      hasExisting={props.hasCv}
      onDone={props.onCvDone}
    />
  );

  return (
    <div className="employee-workspace enter-delay">
      <ApplicationProgress percent={knowledge} />

      <div className="employee-workspace__grid">
        <aside className="employee-sidebar">
          <section className="employee-sidebar__section">
            <CandidateProfileStrip
              card={props.card}
              userId={props.userId}
              onFlexibilityChange={props.onFlexibilityChange}
            />
          </section>
        </aside>

        <section className="employee-chat-main" aria-label={t.chat.title}>
          {props.cvPending && props.hasCv ? (
            <div className="hidden" aria-hidden>
              {cvUpload}
            </div>
          ) : null}
          <div className="employee-chat-main__panel">
            <ChatPanel
              key={`${props.userId}-employee`}
              userId={props.userId}
              role="employee"
              locale={props.locale}
              initialMessages={props.chat}
              placeholder={props.placeholder}
              blockedReason={blockedReason}
              onTurn={props.onTurn}
              onCvUpdated={props.onCvDone}
              composerAddon={props.hasCv && !props.cvPending ? cvAttach : undefined}
              lockedOverlay={
                props.hasCv ? undefined : (
                  <div className="employee-chat-locked">
                    <div className="employee-chat-locked__icon" aria-hidden>
                      💬
                    </div>
                    <h3 className="employee-chat-locked__title">{t.employee.chatLockedTitle}</h3>
                    <p className="employee-chat-locked__body">{t.employee.chatLockedBody}</p>
                    {cvUpload}
                  </div>
                )
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
