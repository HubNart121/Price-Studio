export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
}

function normalizeConfig(value: unknown): FirebaseWebConfig | null {
  if (!value || typeof value !== "object") return null;
  const config = value as Record<string, unknown>;
  const apiKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
  const authDomain =
    typeof config.authDomain === "string" ? config.authDomain.trim() : "";
  const projectId =
    typeof config.projectId === "string" ? config.projectId.trim() : "";
  const appId = typeof config.appId === "string" ? config.appId.trim() : "";

  if (!apiKey || !authDomain || !projectId || !appId) return null;

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId:
      typeof config.messagingSenderId === "string"
        ? config.messagingSenderId.trim()
        : undefined,
    storageBucket:
      typeof config.storageBucket === "string"
        ? config.storageBucket.trim()
        : undefined,
  };
}

export function getFirebaseWebConfig(
  raw = process.env.FIREBASE_WEBAPP_CONFIG,
): FirebaseWebConfig | null {
  if (raw) {
    try {
      const config = normalizeConfig(JSON.parse(raw));
      if (config) return config;
    } catch {
      // Fall through to the explicit environment variables below.
    }
  }

  return normalizeConfig({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}
