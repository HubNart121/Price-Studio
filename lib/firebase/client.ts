"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { FirebaseWebConfig } from "./web-config";

export function getFirebaseClientAuth(config: FirebaseWebConfig) {
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  return getAuth(app);
}
