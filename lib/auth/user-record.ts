import type { CurrentUser, UserIdentity } from "./types";
import { ownerIdFromEmail } from "./owner-id";
import { getDataBackend } from "../config/data-backend";
import { prisma } from "../db/prisma";
import { categoryCollection, nowIso, userRef } from "../repositories/firestore/paths";

async function ensurePostgresUser(identity: UserIdentity): Promise<CurrentUser> {
  const user = await prisma.user.upsert({
    where: { email: identity.email },
    create: identity,
    update: {
      name: identity.name,
      image: identity.image,
    },
  });

  const categoryCount = await prisma.category.count({
    where: { ownerId: user.id },
  });
  if (categoryCount === 0) {
    await prisma.category.createMany({
      data: [
        { ownerId: user.id, name: "ทั่วไป" },
        { ownerId: user.id, name: "อื่น ๆ" },
      ],
      skipDuplicates: true,
    });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}

async function ensureFirestoreUser(identity: UserIdentity): Promise<CurrentUser> {
  const ownerId = ownerIdFromEmail(identity.email);
  const timestamp = nowIso();
  const ref = userRef(ownerId);
  const doc = await ref.get();

  if (!doc.exists) {
    await ref.set({
      email: identity.email,
      name: identity.name,
      image: identity.image,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } else {
    const current = doc.data();
    const changed =
      current?.email !== identity.email ||
      current?.name !== identity.name ||
      current?.image !== identity.image;
    if (changed) {
      await ref.update({
        email: identity.email,
        name: identity.name,
        image: identity.image,
        updatedAt: timestamp,
      });
    }
  }

  const categories = await categoryCollection(ownerId).limit(1).get();
  if (categories.empty) {
    const batch = ref.firestore.batch();
    batch.set(categoryCollection(ownerId).doc("general"), {
        name: "ทั่วไป",
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
    });
    batch.set(categoryCollection(ownerId).doc("other"), {
        name: "อื่น ๆ",
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
    });
    await batch.commit();
  }

  return {
    id: ownerId,
    email: identity.email,
    name: identity.name,
    image: identity.image,
  };
}

export async function ensureUserRecord(
  identity: UserIdentity,
): Promise<CurrentUser> {
  return getDataBackend() === "firestore"
    ? ensureFirestoreUser(identity)
    : ensurePostgresUser(identity);
}
