import { createHash } from "node:crypto";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function ownerIdFromEmail(email: string) {
  return `email_${createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex")
    .slice(0, 32)}`;
}
