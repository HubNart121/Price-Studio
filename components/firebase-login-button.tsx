"use client";

import { useState } from "react";
import {
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase/client";
import type { FirebaseWebConfig } from "@/lib/firebase/web-config";

export default function FirebaseLoginButton({
  config,
  returnTo,
}: {
  config: FirebaseWebConfig;
  returnTo: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login() {
    setLoading(true);
    setError("");
    const firebaseAuth = getFirebaseClientAuth(config);

    try {
      await setPersistence(firebaseAuth, inMemoryPersistence);
      const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      const idToken = await result.user.getIdToken();
      const response = await fetch("/api/auth/firebase/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "เข้าสู่ระบบไม่สำเร็จ");
      }

      await signOut(firebaseAuth);
      window.location.assign(returnTo || "/");
    } catch (loginError) {
      await signOut(firebaseAuth).catch(() => undefined);
      setError(
        loginError instanceof Error
          ? loginError.message
          : "เข้าสู่ระบบด้วย Google ไม่สำเร็จ",
      );
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="button primary login-button"
        disabled={loading}
        onClick={login}
        type="button"
      >
        <span aria-hidden="true">G</span>
        {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย Google"}
      </button>
      {error ? (
        <div className="notice error" role="alert">
          {error}
        </div>
      ) : null}
    </>
  );
}
