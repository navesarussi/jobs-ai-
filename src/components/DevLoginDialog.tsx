"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/components/LocaleProvider";
import type { Role } from "@/domain/types";
import { getOrCreateDeviceId, writeRoleDefault, writeStoredUser } from "@/lib/client-session";

type DevUser = { id: string; name: string; role: Role; email?: string };

export function DevLoginDialog(props: {
  open: boolean;
  users: DevUser[];
  onClose: () => void;
  onDone: (redirect: string) => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const [mode, setMode] = useState<"admin" | "existing" | "new">("new");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setMode("new");
    setUserId(props.users[0]?.id ?? "");
    setName("");
  }, [props.open, props.users]);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/dev/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          userId: mode === "existing" ? userId : undefined,
          name: mode === "new" ? name : undefined,
          deviceId: getOrCreateDeviceId(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        redirect?: string;
        user?: { id: string; name: string; role: Role };
        isAdmin?: boolean;
      };
      if (!res.ok || data.error) {
        props.onError(data.error ?? t.api.internalError);
        return;
      }
      if (data.user) {
        writeStoredUser(data.user);
        writeRoleDefault(data.user.role);
      }
      props.onDone(data.redirect ?? "/employee");
    } catch {
      props.onError(t.api.internalError);
    } finally {
      setBusy(false);
    }
  }

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="panel w-full max-w-md rounded-2xl p-5"
      >
        <h2 id={titleId} className="text-lg font-semibold text-[var(--hero)]">
          {t.devLogin.title}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.devLogin.hint}</p>

        <div className="mt-4 space-y-2">
          {(
            [
              ["admin", t.devLogin.admin],
              ["existing", t.devLogin.existing],
              ["new", t.devLogin.newUser],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                mode === value
                  ? "border-[var(--accent)] bg-[var(--bubble)]"
                  : "border-[var(--stroke)]"
              }`}
            >
              <input
                type="radio"
                name="dev-login-mode"
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              {label}
            </label>
          ))}
        </div>

        {mode === "existing" ? (
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-[var(--muted)]">{t.devLogin.pickUser}</span>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2.5"
            >
              {props.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role === "employee" ? t.devLogin.roleEmployee : t.devLogin.roleEmployer})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode === "new" ? (
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-[var(--muted)]">{t.devLogin.nameOptional}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.devLogin.namePlaceholder}
              className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2.5"
            />
          </label>
        ) : null}

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={props.onClose} disabled={busy}>
            {t.settings.cancel}
          </Button>
          <Button className="flex-1" onClick={() => void submit()} disabled={busy}>
            {busy ? t.session.loading : t.devLogin.enter}
          </Button>
        </div>
      </div>
    </div>
  );
}
