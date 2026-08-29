import type { ProjectInput } from "../../domain/project";
import { calculatePricing } from "../../domain/pricing";
import type { ProjectRepository } from "../interfaces";
import { categoryCollection, nowIso, projectCollection } from "./paths";
import { mapProject } from "./mappers";

async function categoryMap(ownerId: string) {
  const snapshot = await categoryCollection(ownerId).get();
  return new Map(
    snapshot.docs.map((doc) => [
      doc.id,
      { id: doc.id, name: String(doc.data().name ?? "") },
    ]),
  );
}

async function assertOwnedCategory(ownerId: string, categoryId: string | null) {
  if (!categoryId) return;
  const doc = await categoryCollection(ownerId).doc(categoryId).get();
  if (!doc.exists) throw new Error("CATEGORY_NOT_FOUND");
}

function projectData(input: ProjectInput, createdAt?: string) {
  const timestamp = nowIso();
  const result = calculatePricing(input);
  return {
    categoryId: input.categoryId,
    mode: input.mode,
    projectDate: input.projectDate,
    productName: input.productName,
    productImageUrl: input.productImageUrl,
    detail: input.detail,
    currencyCode: input.currencyCode.toUpperCase(),
    unitForeignPrice: input.unitForeignPrice,
    exchangeRate: input.exchangeRate,
    quantity: input.quantity,
    overseasShippingPct: input.overseasShippingPct,
    domesticPackingPct: input.domesticPackingPct,
    internationalFreight: input.internationalFreight,
    insurance: input.insurance,
    dutyRatePct: input.dutyRatePct,
    otherTaxFees: input.otherTaxFees,
    brokerFee: input.brokerFee,
    domesticLogistics: input.domesticLogistics,
    otherExpenses: input.otherExpenses,
    vatRatePct: input.vatRatePct,
    includeVatInCost: input.includeVatInCost,
    gpMarginPct: input.gpMarginPct,
    volumeTiers: input.volumeTiers,
    ...result,
    createdAt: createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export const firestoreProjectRepository: ProjectRepository = {
  async list(ownerId, filters = {}) {
    const [projectSnapshot, categories] = await Promise.all([
      projectCollection(ownerId).get(),
      categoryMap(ownerId),
    ]);
    const query = filters.query?.trim().toLowerCase();
    return projectSnapshot.docs
      .map((doc) => mapProject(doc, categories.get(doc.data().categoryId) ?? null))
      .filter((project) => {
        const matchesText =
          !query ||
          project.productName.toLowerCase().includes(query) ||
          project.detail.toLowerCase().includes(query);
        const matchesCategory =
          !filters.categoryId || project.categoryId === filters.categoryId;
        const matchesMode = !filters.mode || project.mode === filters.mode;
        return matchesText && matchesCategory && matchesMode;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(ownerId, id) {
    const [doc, categories] = await Promise.all([
      projectCollection(ownerId).doc(id).get(),
      categoryMap(ownerId),
    ]);
    if (!doc.exists) return null;
    return mapProject(doc, categories.get(doc.data()?.categoryId) ?? null);
  },

  async create(ownerId, input) {
    await assertOwnedCategory(ownerId, input.categoryId);
    const ref = projectCollection(ownerId).doc();
    await ref.set(projectData(input));
    const doc = await ref.get();
    const categories = await categoryMap(ownerId);
    return mapProject(doc, categories.get(input.categoryId ?? "") ?? null);
  },

  async update(ownerId, id, input) {
    await assertOwnedCategory(ownerId, input.categoryId);
    const ref = projectCollection(ownerId).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.set(projectData(input, String(doc.data()?.createdAt ?? nowIso())));
    const updated = await ref.get();
    const categories = await categoryMap(ownerId);
    return mapProject(updated, categories.get(input.categoryId ?? "") ?? null);
  },

  async duplicate(ownerId, id) {
    const original = await this.get(ownerId, id);
    if (!original) return null;
    const {
      id: _id,
      category: _category,
      goodsValue: _goodsValue,
      internationalFreightCost: _internationalFreightCost,
      internationalFreightPerUnit: _internationalFreightPerUnit,
      domesticPackingCost: _domesticPackingCost,
      domesticPackingPerUnit: _domesticPackingPerUnit,
      cifValue: _cifValue,
      importDuty: _importDuty,
      importVat: _importVat,
      totalCost: _totalCost,
      costPerUnit: _costPerUnit,
      sellingPricePerUnit: _sellingPricePerUnit,
      profitPerUnit: _profitPerUnit,
      totalProfit: _totalProfit,
      formulaVersion: _formulaVersion,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...input
    } = original;
    return this.create(ownerId, {
      ...input,
      productName: `${input.productName} (สำเนา)`,
    });
  },

  async delete(ownerId, id) {
    const ref = projectCollection(ownerId).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  },
};
