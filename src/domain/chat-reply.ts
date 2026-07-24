/** Strip structured JSON wrappers and return user-visible chat text only. */
export function normalizeAssistantReplyText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const candidate = (fenced ? fenced[1] : trimmed).trim();

  if (candidate.startsWith("{") && candidate.includes('"reply"')) {
    try {
      const parsed = JSON.parse(candidate) as { reply?: unknown };
      if (typeof parsed.reply === "string" && parsed.reply.trim()) {
        return parsed.reply.trim();
      }
    } catch {
      // not JSON — fall through
    }
  }

  return candidate;
}
