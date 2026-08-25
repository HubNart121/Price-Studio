export function getAllowedEmails(raw = process.env.ALLOWED_EMAILS): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(
  email?: string | null,
  raw = process.env.ALLOWED_EMAILS,
): boolean {
  if (!email) return false;
  const allowed = getAllowedEmails(raw);
  return allowed.includes(email.trim().toLowerCase());
}
