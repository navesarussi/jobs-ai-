import { handleEmployeeChat, handleEmployerChat } from "@/application/chat";
import { ok, fail } from "@/infrastructure/http";
import { assertActor } from "@/infrastructure/auth-guard";
import { readStore, writeStore } from "@/infrastructure/store";
import { hasGeminiKey } from "@/infrastructure/ai/schemas";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      role?: "employee" | "employer";
      message?: string;
    };
    if (!body.userId || !body.message?.trim() || !body.role) {
      return ok({ error: "חסרים פרטים" }, { status: 400 });
    }
    const gate = await assertActor(body.userId);
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    const store = await readStore();
    const result =
      body.role === "employee"
        ? await handleEmployeeChat(store, body.userId, body.message.trim())
        : await handleEmployerChat(store, body.userId, body.message.trim());

    await writeStore(result.store);
    return ok({
      reply: result.reply,
      provider: result.provider,
      aiMode: hasGeminiKey() ? "gemini" : "heuristic",
    });
  } catch (e) {
    return fail(e);
  }
}
