import { getDataBackend } from "../config/data-backend";
import { prisma } from "../db/prisma";
import { categoryCollection, projectCollection } from "./firestore/paths";

async function deleteCollection(
  collection: ReturnType<typeof categoryCollection>,
) {
  const snapshot = await collection.get();
  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = collection.firestore.batch();
    snapshot.docs.slice(index, index + 450).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

export async function clearOwnerData(ownerId: string) {
  if (getDataBackend() === "firestore") {
    await deleteCollection(projectCollection(ownerId));
    await deleteCollection(categoryCollection(ownerId));
    return;
  }

  await prisma.$transaction([
    prisma.project.deleteMany({ where: { ownerId } }),
    prisma.category.deleteMany({ where: { ownerId } }),
  ]);
}
