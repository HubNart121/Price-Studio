import type { CollectionReference, DocumentData } from "firebase-admin/firestore";
import { getFirestoreDb } from "../../firebase/admin";

export function userRef(ownerId: string) {
  return getFirestoreDb().collection("users").doc(ownerId);
}

export function categoryCollection(ownerId: string) {
  return userRef(ownerId).collection("categories") as CollectionReference<DocumentData>;
}

export function projectCollection(ownerId: string) {
  return userRef(ownerId).collection("projects") as CollectionReference<DocumentData>;
}

export function nowIso() {
  return new Date().toISOString();
}
