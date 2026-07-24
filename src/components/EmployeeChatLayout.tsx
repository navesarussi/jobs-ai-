"use client";

import { useRef } from "react";
import { CandidateProfileStrip } from "@/components/CandidateProfileStrip";
import { ChatPanel, type ChatTurnPayload } from "@/components/ChatPanel";
import { FileImport } from "@/components/FileImport";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/components/LocaleProvider";
import type { Locale } from "@/i18n/types";
import type { CandidateCard } from "@/domain/types";
import { candidateRows, knowledgePercent } from "@/domain/card-progress";
import { emptyCandidateCard } from "@/domain/types";

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string };

function FlowSteps(props: { hasCv: boolean; knowledge: number; scheduledInterviews: number }) {
  const { t } = useTranslation();
  const chatActive = props.hasCv;

  const steps = [
    { id: "cv", label: t.employee.stepCv, done: props.hasCv, active: !props.hasCv },
    { id: "chat", label: t.employee.stepChat, done: props.knowledge > 20, active: chatActive },
    {
      id: "interviews",
      label: t.employee.stepProfile,
      done: props.scheduledInterviews > 0,
      active: props.hasCv && props.knowledge > 20,
    },
  ];

  return (
    <nav className="employee-flow" aria-label={t.employee.flowTitle}>
      {steps.map((step, i) => (
        <div key={step.id} className="employee-flow__item">
          <span
            className={`employee-flow__dot ${
              step.done ? "employee-flow__dot--done" : step.active ? "employee-flow__dot--active" : ""
            }`}
            aria-hidden
          >
            {step.done ? "✓" : i + 1}
          </span>
          <span
            className={`employee-flow__label ${
              step.active || step.done ? "employee-flow__label--emphasis" : ""
            }`}
          >
            {step.label}
          </span>
          {i < steps.length - 1 ? <span className="employee-flow__line" aria-hidden /> : null}
        </div>
      ))}
    </nav>
  );
}

export function EmployeeChatLayout(props: {
  userId: string;
  locale: Locale;
  chat: Msg[];
  card: CandidateCard | null | undefined;
  hasCv: boolean;
  cvFileName?: string | null;
  cvPending: boolean;
  scheduledInterviews: number;
  placeholder: string;
  onTurn: (payload: ChatTurnPayload) => void;
  onFlexibilityChange: (value: number) => void;
  onCvDone: () => void;
}) {
  const { t } = useTranslation();
  const uploadRef = useRef<HTMLInputElement>(null);
  const blockedReason = props.hasCv ? undefined : "blocked";
  const labels = t.cardFields.candidate as Record<string, string>;
  const knowledge = knowledgePercent(
    candidateRows(props.card ?? emptyCandidateCard(), labels),
  );

  return (
    <div className="employee-workspace enter-delay">
      <FlowSteps
        hasCv={props.hasCv}
        knowledge={knowledge}
        scheduledInterviews={props.scheduledInterviews}
      />

      <div className="employee-workspace__grid">
        <aside className="employee-sidebar">
          <section className="employee-sidebar__section">
            <header className="employee-sidebar__header">
              <span className="employee-sidebar__step">1</span>
              <div>
                <h2 className="employee-sidebar__title">{t.fileImport.cvTitle}</h2>
                <p className="employee-sidebar__hint">{t.employee.cvStepHint}</p>
              </div>
            </header>
            <FileImport
              userId={props.userId}
              endpoint="/api/cv"
              title={t.fileImport.cvTitle}
              hint={t.fileImport.cvHint}
              variant="sidebar"
              inputRef={uploadRef}
              minimalSummary
              cvMode
              hasExisting={props.hasCv}
              existingFileName={props.cvFileName}
              pendingAnalysis={props.cvPending}
              onDone={props.onCvDone}
            />
          </section>

          <section className="employee-sidebar__section">
            <header className="employee-sidebar__header">
              <span className="employee-sidebar__step">2</span>
              <div>
                <h2 className="employee-sidebar__title">{t.profile.yourCard}</h2>
                <p className="employee-sidebar__hint">{t.employee.profileStepHint}</p>
              </div>
            </header>
            <CandidateProfileStrip
              userId={props.userId}
              card={props.card}
              variant="sidebar"
              onFlexibilityChange={props.onFlexibilityChange}
            />
          </section>
        </aside>

        <section className="employee-chat-main" aria-label={t.chat.title}>
          <header className="employee-chat-main__header">
            <div>
              <h2 className="employee-chat-main__title">{t.employee.chatHeroTitle}</h2>
              <p className="employee-chat-main__lead">{t.employee.chatHeroLead}</p>
            </div>
          </header>

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
              lockedOverlay={
                props.hasCv ? undefined : (
                  <div className="employee-chat-locked">
                    <div className="employee-chat-locked__icon" aria-hidden>
                      💬
                    </div>
                    <h3 className="employee-chat-locked__title">{t.employee.chatLockedTitle}</h3>
                    <p className="employee-chat-locked__body">{t.employee.chatLockedBody}</p>
                    <Button
                      onClick={() => uploadRef.current?.click()}
                      className="cta-glow brand-gradient-bg mt-4 min-h-12 px-8 hover:bg-transparent hover:brightness-105"
                    >
                      {t.fileImport.uploadCv}
                    </Button>
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
