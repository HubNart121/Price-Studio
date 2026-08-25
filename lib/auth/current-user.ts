import { auth } from "@/auth";
import { cookies } from "next/headers";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { getAuthMode, isLocalAuthEnabled } from "@/lib/auth/config";
import {
  FIREBASE_SESSION_COOKIE,
  identityFromFirebaseToken,
} from "@/lib/auth/firebase-session";
import type { CurrentUser, UserIdentity } from "@/lib/auth/types";
import { ensureUserRecord } from "@/lib/auth/user-record";
import { getFirebaseAuth } from "@/lib/firebase/admin";

export class UnauthorizedError extends Error {
  constructor(message = "กรุณาเข้าสู่ระบบ") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

async function readIdentity(): Promise<UserIdentity | null> {
  const localAuthEnabled = isLocalAuthEnabled();
  const devEmail =
    process.env.NODE_ENV !== "production" || localAuthEnabled
      ? process.env.DEV_AUTH_EMAIL?.trim().toLowerCase()
      : undefined;

  if (devEmail && isEmailAllowed(devEmail)) {
    return {
      email: devEmail,
      name: localAuthEnabled ? "Nart (Local)" : "Nart (Development)",
      image: null,
    };
  }

  if (getAuthMode() === "firebase") {
    const sessionCookie = (await cookies()).get(FIREBASE_SESSION_COOKIE)?.value;
    if (!sessionCookie) return null;

    try {
      const decoded = await getFirebaseAuth().verifySessionCookie(
        sessionCookie,
        true,
      );
      const identity = identityFromFirebaseToken(decoded);
      return identity && isEmailAllowed(identity.email) ? identity : null;
    } catch {
      return null;
    }
  }

  const session = await auth();
  const sessionUser = session?.user;
  const email = sessionUser?.email?.trim().toLowerCase();
  if (!sessionUser || !email || !isEmailAllowed(email)) return null;
  return {
    email,
    name: sessionUser.name ?? null,
    image: sessionUser.image ?? null,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const identity = await readIdentity();
  if (!identity) return null;
  return ensureUserRecord(identity);
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
