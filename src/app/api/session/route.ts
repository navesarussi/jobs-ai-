import { randomUUID } from "crypto";
import { auth } from "@/auth";
import type { Role, User } from "@/domain/types";
import { ok, fail } from "@/infrastructure/http";
import { allowOpenAuth } from "@/infrastructure/auth-flags";
import { allowDemo } from "@/infrastructure/auth-guard";
import { createSeedStore } from "@/infrastructure/db/memory-store";
import {
  findUserByEmailOrGoogle,
  upsertSessionRole,
} from "@/infrastructure/db/normalized-store";
import { getSessionFlags } from "@/lib/session-flags-server";

export async function GET() {
  return ok(await getSessionFlags());
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      role?: Role;
      demo?: boolean;
      name?: string;
      deviceId?: string;
    };
    const role: Role = body.role === "employer" ? "employer" : "employee";

    if (body.demo) {
      if (!allowDemo()) {
        return ok({ error: "מצב דמו כבוי. התחברו עם Google." }, { status: 403 });
      }
      // Avoid a full-store read just to return a known seed user.
      const demoId = role === "employee" ? "demo-employee" : "demo-employer";
      const seedUser = createSeedStore().users.find((u) => u.id === demoId);
      if (!seedUser) {
        return ok({ error: "משתמש דמו לא נמצא" }, { status: 404 });
      }
      const user = await upsertSessionRole(seedUser, role);
      return ok({ user });
    }

    if (allowOpenAuth()) {
      const deviceId = body.deviceId?.trim() || randomUUID();
      const existing = await findUserByEmailOrGoogle(`open:${deviceId}`, deviceId);
      const base: User = existing ?? {
        id: randomUUID(),
        name: body.name?.trim() || (role === "employee" ? "מועמד/ת" : "מעסיק/ה"),
        role,
        email: `open:${deviceId}@local.dev`,
        googleId: deviceId,
        createdAt: new Date().toISOString(),
      };
      const user = await upsertSessionRole({ ...base, role }, role);
      return ok({ user });
    }

    const session = await auth();
    if (!session?.user?.email) {
      return ok({ error: "נדרשת התחברות עם Google" }, { status: 401 });
    }

    const email = session.user.email;
    const googleId = session.user.googleId ?? session.user.id;
    const existing = await findUserByEmailOrGoogle(email, googleId);

    const base: User = existing ?? {
      id: randomUUID(),
      name: session.user.name ?? body.name?.trim() ?? "משתמש/ת",
      role,
      email,
      image: session.user.image ?? undefined,
      googleId,
      createdAt: new Date().toISOString(),
    };

    const user = await upsertSessionRole(
      {
        ...base,
        name: session.user.name ?? base.name,
        email,
        image: session.user.image ?? base.image,
        googleId,
      },
      role,
    );

    return ok({ user });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("session POST failed", e);
    if (msg.includes("DATABASE_URL") || msg.includes("Could not connect")) {
      return ok(
        { error: "חיבור למסד הנתונים נכשל. נסו שוב בעוד רגע." },
        { status: 503 },
      );
    }
    return fail(e);
  }
}
