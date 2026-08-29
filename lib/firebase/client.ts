"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import type { FirebaseWebConfig } from "./web-config";

function getFirebaseClientApp(config: FirebaseWebConfig) {
  return getApps().length > 0 ? getApp() : initializeApp(config);
}

export function getFirebaseClientAuth(config: FirebaseWebConfig) {
  return getAuth(getFirebaseClientApp(config));
}

export function getFirebaseClientStorage(config: FirebaseWebConfig) {
  return getStorage(getFirebaseClientApp(config));
}
