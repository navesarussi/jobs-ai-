import { ValidationError } from "@/domain/errors";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_UPLOAD = ".pdf,.docx,.txt,.md,application/pdf,text/plain";

function isPdf(name: string, type: string): boolean {
  return name.endsWith(".pdf") || type === "application/pdf";
}

function isDocx(name: string, type: string): boolean {
  return (
    name.endsWith(".docx") ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isPlainText(name: string, type: string): boolean {
  return name.endsWith(".txt") || name.endsWith(".md") || type.startsWith("text/");
}

/**
 * Extract plain text from an uploaded CV / job-description file.
 * Supports PDF (unpdf), DOCX (mammoth), and plain text / markdown.
 */
export async function extractTextFromUpload(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const name = filename.toLowerCase();
  const type = (mimeType || "").toLowerCase();

  if (isPdf(name, type)) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text).trim();
  }

  if (isDocx(name, type)) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim();
  }

  if (isPlainText(name, type)) {
    return buffer.toString("utf-8").trim();
  }

  throw new ValidationError("סוג קובץ לא נתמך — יש להעלות PDF, DOCX או TXT");
}
