"use server";

import { signIn, signOut } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthMode } from "@/lib/auth/config";
import { FIREBASE_SESSION_COOKIE } from "@/lib/auth/firebase-session";

function sanitizeReturnTo(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/")) return "/";
  return value;
}

export async function loginWithGoogle(formData: FormData) {
  const returnTo = sanitizeReturnTo(formData.get("returnTo"));
  await signIn("google", { redirectTo: returnTo });
}

export async function logout() {
  if (getAuthMode() === "firebase") {
    (await cookies()).delete(FIREBASE_SESSION_COOKIE);
    redirect("/");
  }
  await signOut({ redirectTo: "/" });
}
