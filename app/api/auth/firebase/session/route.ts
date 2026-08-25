import { NextResponse } from "next/server";
import { z } from "zod";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import {
  FIREBASE_SESSION_COOKIE,
  FIREBASE_SESSION_MAX_AGE_SECONDS,
  hasRecentFirebaseSignIn,
  identityFromFirebaseToken,
} from "@/lib/auth/firebase-session";
import { getAuthMode } from "@/lib/auth/config";
import { getFirebaseAuth } from "@/lib/firebase/admin";

const loginSchema = z.object({
  idToken: z.string().min(100),
});

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const requestUrl = new URL(request.url);
  const expectedHost = forwardedHost ?? request.headers.get("host") ?? requestUrl.host;
  const expectedProtocol = forwardedProto ?? requestUrl.protocol.replace(":", "");

  try {
    const originUrl = new URL(origin);
    return (
      originUrl.host === expectedHost &&
      originUrl.protocol === `${expectedProtocol}:`
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (getAuthMode() !== "firebase") {
    return NextResponse.json(
      { error: "Firebase Authentication is not enabled" },
      { status: 404 },
    );
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  }

  try {
    const { idToken } = loginSchema.parse(await request.json());
    const firebaseAuth = getFirebaseAuth();
    const decoded = await firebaseAuth.verifyIdToken(idToken, true);
    const identity = identityFromFirebaseToken(decoded);

    if (!identity || !isEmailAllowed(identity.email)) {
      return NextResponse.json(
        { error: "อีเมลนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน" },
        { status: 403 },
      );
    }
    if (!hasRecentFirebaseSignIn(decoded)) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง" },
        { status: 401 },
      );
    }

    const sessionCookie = await firebaseAuth.createSessionCookie(idToken, {
      expiresIn: FIREBASE_SESSION_MAX_AGE_SECONDS * 1000,
    });
    const response = NextResponse.json({ success: true });
    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: FIREBASE_SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error("Firebase session login failed", error);
    return NextResponse.json(
      { error: "เข้าสู่ระบบด้วย Firebase ไม่สำเร็จ" },
      { status: 401 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(FIREBASE_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
