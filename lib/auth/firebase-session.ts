import type { DecodedIdToken } from "firebase-admin/auth";
import type { UserIdentity } from "./types";

export const FIREBASE_SESSION_COOKIE = "__session";
export const FIREBASE_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;
export const FIREBASE_RECENT_SIGN_IN_SECONDS = 60 * 5;

export function identityFromFirebaseToken(
  token: DecodedIdToken,
): UserIdentity | null {
  const email = token.email?.trim().toLowerCase();
  if (!email || token.email_verified !== true) return null;

  return {
    email,
    name: typeof token.name === "string" ? token.name : null,
    image: typeof token.picture === "string" ? token.picture : null,
  };
}

export function hasRecentFirebaseSignIn(
  token: DecodedIdToken,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  return (
    typeof token.auth_time === "number" &&
    nowSeconds - token.auth_time >= 0 &&
    nowSeconds - token.auth_time <= FIREBASE_RECENT_SIGN_IN_SECONDS
  );
}
