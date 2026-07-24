import { NextResponse } from "next/server";
import { resolveDevLogin } from "@/application/dev-login";
import {
  clearDevSessionCookieHeader,
  devSessionCookieHeader,
  isDevAuthEnabled,
} from "@/infrastructure/dev-auth";
import { upsertSessionRole } from "@/infrastructure/db/normalized-store";
import { ok } from "@/infrastructure/http";

export async function POST(req: Request) {
  if (!isDevAuthEnabled()) {
    return ok({ error: "Dev login is disabled" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      mode?: string;
      role?: string;
      userId?: string;
      name?: string;
      deviceId?: string;
    };

    const result = resolveDevLogin({
      mode: body.mode === "admin" || body.mode === "existing" || body.mode === "new"
        ? body.mode
        : "new",
      role: body.role === "employer" ? "employer" : "employee",
      userId: body.userId,
      name: body.name,
      deviceId: body.deviceId,
    });

    if (result.kind === "admin") {
      const res = NextResponse.json({
        isAdmin: true,
        redirect: result.redirect,
        email: result.email,
      });
      res.headers.append(
        "Set-Cookie",
        devSessionCookieHeader({ kind: "admin", email: result.email }),
      );
      return res;
    }

    const user = await upsertSessionRole(result.user, result.user.role);
    const res = NextResponse.json({
      isAdmin: false,
      redirect: result.redirect,
      user,
    });
    res.headers.append(
      "Set-Cookie",
      devSessionCookieHeader({
        kind: "user",
        email: user.email ?? `open:${user.id}@local.dev`,
        userId: user.id,
      }),
    );
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return ok({ error: msg }, { status: 400 });
  }
}

export async function DELETE() {
  if (!isDevAuthEnabled()) {
    return ok({ error: "Dev login is disabled" }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", clearDevSessionCookieHeader());
  return res;
}
