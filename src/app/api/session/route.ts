import { randomUUID } from "crypto";
import { auth } from "@/auth";
import type { Role, User } from "@/domain/types";
import { ok, fail } from "@/infrastructure/http";
import {
  allowDemoMode,
  allowOpenAuth,
  hasGoogleAuth,
} from "@/infrastructure/auth-flags";
import { listDevUsers } from "@/application/dev-login";
import { isAdminEmail } from "@/infrastructure/admin-config";
import {
  devSessionIsAdmin,
  getDevSession,
  isDevAuthEnabled,
} from "@/infrastructure/dev-auth";
import { shouldUseMemoryStore } from "@/infrastructure/db/memory-store";
import { allowDemo } from "@/infrastructure/auth-guard";
import {
  findUserByEmailOrGoogle,
  upsertSessionRole,
} from "@/infrastructure/db/normalized-store";
import { readStore } from "@/infrastructure/store";

export async function GET() {
  const devSession = await getDevSession();
  const session = await auth();
  const email = devSession?.email ?? session?.user?.email ?? null;
  const isAdmin = devSessionIsAdmin(devSession) || isAdminEmail(session?.user?.email);
  const devAuth = isDevAuthEnabled();
  return ok({
    googleAuth: hasGoogleAuth(),
    allowDemo: allowDemoMode(),
    openAuth: allowOpenAuth(),
    devAuth,
    memoryStore: shouldUseMemoryStore(),
    devUsers: devAuth ? listDevUsers() : [],
    isAdmin,
    email,
  });
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
      const store = await readStore();
      const demoId = role === "employee" ? "demo-employee" : "demo-employer";
      return ok({ user: store.users.find((u) => u.id === demoId) });
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
