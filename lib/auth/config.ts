const GOOGLE_AUTH_PLACEHOLDERS = new Set([
  "",
  "not-configured",
  "replace-with-google-oauth-client-id",
  "replace-with-google-oauth-client-secret",
]);

export type AuthMode = "nextauth" | "firebase";

export function getAuthMode(
  raw = process.env.AUTH_MODE,
): AuthMode {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "firebase") {
    return "firebase";
  }
  if (normalized === "nextauth") {
    return "nextauth";
  }

  const firebaseConfigured =
    Boolean(process.env.FIREBASE_WEBAPP_CONFIG) ||
    Boolean(process.env.FIREBASE_PROJECT_ID) ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  return firebaseConfigured ? "firebase" : "nextauth";
}

export function isGoogleAuthConfigured(
  clientId = process.env.AUTH_GOOGLE_ID,
  clientSecret = process.env.AUTH_GOOGLE_SECRET,
): boolean {
  const id = clientId?.trim() ?? "";
  const secret = clientSecret?.trim() ?? "";

  return (
    !GOOGLE_AUTH_PLACEHOLDERS.has(id) &&
    !GOOGLE_AUTH_PLACEHOLDERS.has(secret)
  );
}

export function isLocalAuthEnabled(): boolean {
  return process.env.LOCAL_AUTH_BYPASS?.trim().toLowerCase() === "true";
}
