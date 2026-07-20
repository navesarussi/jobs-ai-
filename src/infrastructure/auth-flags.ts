/** Soft-disable Google until GOOGLE_AUTH_ENABLED=true (keeps OAuth code intact). */
export function isGoogleAuthEnabled(): boolean {
  return process.env.GOOGLE_AUTH_ENABLED === "true";
}

export function hasGoogleCredentials(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim(),
  );
}

/** UI + session: Google button only when explicitly enabled and credentials exist. */
export function hasGoogleAuth(): boolean {
  return isGoogleAuthEnabled() && hasGoogleCredentials();
}

export function allowDemoMode(): boolean {
  return process.env.ALLOW_DEMO === "true";
}

/** Open local sessions for chat development while Google is soft-disabled. */
export function allowOpenAuth(): boolean {
  return !isGoogleAuthEnabled();
}
