import { randomUUID } from "crypto";
import { applyCvExtraction } from "@/application/chat";
import { createAiUsageRecord } from "@/domain/admin";
import { NotFoundError } from "@/domain/errors";
import { emptyCvProfile, type CandidateDocument, type StoreData } from "@/domain/types";
import { runCvExtraction } from "@/infrastructure/ai/intake";

export type SaveCvInput = {
  userId: string;
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
  extractedText: string;
};

export function saveCandidateCv(
  store: StoreData,
  input: SaveCvInput,
): { store: StoreData; document: CandidateDocument } {
  const emp = store.employees.find((e) => e.userId === input.userId);
  if (!emp) throw new NotFoundError("Employee");

  const document: CandidateDocument = {
    id: input.id,
    kind: "cv",
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    storageKey: input.storageKey,
    uploadedAt: new Date().toISOString(),
    textCharCount: input.extractedText.length,
    extractedText: input.extractedText,
    extractionStatus: "pending",
  };

  const cv = emp.cv ?? emptyCvProfile();
  const nextCv = {
    ...cv,
    documents: [...cv.documents.filter((d) => d.id !== document.id), document],
  };

  return {
    store: {
      ...store,
      employees: store.employees.map((e) =>
        e.userId === input.userId ? { ...e, cv: nextCv } : e,
      ),
    },
    document,
  };
}

export async function analyzeCandidateCv(
  store: StoreData,
  userId: string,
  documentId?: string,
): Promise<{
  store: StoreData;
  provider: string;
  summary: ReturnType<typeof applyCvExtraction>["summary"];
  documentId: string;
}> {
  const emp = store.employees.find((e) => e.userId === userId);
  if (!emp) throw new NotFoundError("Employee");

  const docs = emp.cv?.documents ?? [];
  const document = documentId
    ? docs.find((d) => d.id === documentId)
    : docs[docs.length - 1];
  if (!document) throw new NotFoundError("CV document");

  const extracted = await runCvExtraction({ text: document.extractedText, card: emp.card });
  const analyzedDoc: CandidateDocument = {
    ...document,
    extractionStatus: extracted.provider === "heuristic" ? "partial" : "ok",
  };

  const applied = applyCvExtraction(
    store,
    userId,
    {
      patch: extracted.patch,
      workHistory: extracted.workHistory,
      educationHistory: extracted.educationHistory,
      unmappedFacts: extracted.unmappedFacts,
      fieldConfidence: extracted.fieldConfidence,
    },
    analyzedDoc,
  );

  let next: StoreData = applied.store;
  if (extracted.usage) {
    next = {
      ...next,
      aiUsage: [
        ...(next.aiUsage ?? []),
        createAiUsageRecord({
          id: randomUUID(),
          type: "cv_import",
          promptTokens: extracted.usage.promptTokens,
          completionTokens: extracted.usage.completionTokens,
          createdAt: new Date().toISOString(),
        }),
      ].slice(-200),
    };
  }

  return {
    store: next,
    provider: extracted.provider,
    summary: applied.summary,
    documentId: document.id,
  };
}
