import {
  defaultPromptSnapshot,
  getAdminDashboard,
  resetAdminPrompts,
  updateAdminPrompts,
} from "@/application/admin";
import { assertAdmin } from "@/infrastructure/admin-guard";
import {
  deleteAdminSettings,
  upsertAdminSettings,
} from "@/infrastructure/db/normalized-store";
import { ok, fail } from "@/infrastructure/http";
import { readStore } from "@/infrastructure/store";

export async function GET() {
  try {
    const gate = await assertAdmin();
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    const store = await readStore();
    const { prompts } = getAdminDashboard(store);
    return ok({ prompts });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request) {
  try {
    const gate = await assertAdmin();
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    const body = (await req.json()) as {
      candidatePrompt?: string;
      employerPrompt?: string;
    };
    if (!body.candidatePrompt?.trim() || !body.employerPrompt?.trim()) {
      return ok({ error: "שני הפרומפטים נדרשים" }, { status: 400 });
    }

    const store = await readStore();
    const adminSettings = updateAdminPrompts(store, {
      candidatePrompt: body.candidatePrompt!,
      employerPrompt: body.employerPrompt!,
      updatedBy: gate.email,
    }).adminSettings!;

    await upsertAdminSettings(adminSettings);

    const prompts = getAdminDashboard({ ...store, adminSettings }).prompts;
    return ok({ ok: true, prompts, isCustom: true });
  } catch (e) {
    return fail(e);
  }
}

/** Reset to file defaults — live from prompts/*.md again. */
export async function DELETE() {
  try {
    const gate = await assertAdmin();
    if (!gate.ok) return ok({ error: gate.error }, { status: gate.status });

    await deleteAdminSettings();
    const defaults = defaultPromptSnapshot();
    const store = await readStore();
    const prompts = getAdminDashboard({ ...store, adminSettings: undefined }).prompts;
    return ok({ ok: true, prompts, isCustom: false });
  } catch (e) {
    return fail(e);
  }
}
