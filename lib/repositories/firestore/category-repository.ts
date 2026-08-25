import type { CategoryRepository } from "../interfaces";
import { categoryCollection, nowIso, projectCollection } from "./paths";
import { mapCategory } from "./mappers";

export const firestoreCategoryRepository: CategoryRepository = {
  async list(ownerId) {
    const [categorySnapshot, projectSnapshot] = await Promise.all([
      categoryCollection(ownerId).get(),
      projectCollection(ownerId).get(),
    ]);
    const projectCounts = new Map<string, number>();
    projectSnapshot.docs.forEach((doc) => {
      const categoryId = doc.data().categoryId;
      if (typeof categoryId === "string") {
        projectCounts.set(categoryId, (projectCounts.get(categoryId) ?? 0) + 1);
      }
    });

    return categorySnapshot.docs
      .map((doc) => mapCategory(doc, projectCounts.get(doc.id) ?? 0))
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name, "th");
      });
  },

  async create(ownerId, name) {
    const timestamp = nowIso();
    const ref = categoryCollection(ownerId).doc();
    await ref.set({
      name,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const doc = await ref.get();
    return mapCategory(doc, 0);
  },

  async update(ownerId, id, patch) {
    const ref = categoryCollection(ownerId).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({ ...patch, updatedAt: nowIso() });
    const [updated, projects] = await Promise.all([
      ref.get(),
      projectCollection(ownerId).where("categoryId", "==", id).get(),
    ]);
    return mapCategory(updated, projects.size);
  },

  async delete(ownerId, id) {
    const ref = categoryCollection(ownerId).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return "missing";
    const projects = await projectCollection(ownerId)
      .where("categoryId", "==", id)
      .limit(1)
      .get();
    if (!projects.empty) return "in-use";
    await ref.delete();
    return "deleted";
  },
};
