export type DataBackend = "postgres" | "firestore";

export function getDataBackend(): DataBackend {
  const explicit = process.env.DATA_BACKEND?.trim().toLowerCase();
  if (explicit === "firestore") {
    return "firestore";
  }
  if (explicit === "postgres") {
    return "postgres";
  }

  const firestoreConfigured =
    Boolean(process.env.FIREBASE_WEBAPP_CONFIG) ||
    Boolean(process.env.FIREBASE_PROJECT_ID) ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  return firestoreConfigured ? "firestore" : "postgres";
}

export function isFirestoreBackend() {
  return getDataBackend() === "firestore";
}
