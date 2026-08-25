"use server";

import { signIn, signOut } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthMode } from "@/lib/auth/config";
import { FIREBASE_SESSION_COOKIE } from "@/lib/auth/firebase-session";

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function logout() {
  if (getAuthMode() === "firebase") {
    (await cookies()).delete(FIREBASE_SESSION_COOKIE);
    redirect("/");
  }
  await signOut({ redirectTo: "/" });
}
