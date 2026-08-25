import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import type { ProjectInput } from "../../domain/project";
import { calculatePricing } from "../../domain/pricing";
import type { ProjectRepository } from "../interfaces";
import { mapProject } from "./mappers";

function decimal(value: number, places = 4) {
  return new Prisma.Decimal(value.toFixed(places));
}

async function assertOwnedCategory(ownerId: string, categoryId: string | null) {
  if (!categoryId) return;
  const category = await prisma.category.findFirst({
    where: { id: categoryId, ownerId },
  });
  if (!category) throw new Error("CATEGORY_NOT_FOUND");
}

function toData(ownerId: string, input: ProjectInput) {
  const result = calculatePricing(input);
  return {
    ownerId,
    categoryId: input.categoryId,
    mode: input.mode,
    projectDate: new Date(`${input.projectDate}T00:00:00.000Z`),
    productName: input.productName,
    detail: input.detail,
    currencyCode: input.currencyCode.toUpperCase(),
    unitForeignPrice: decimal(input.unitForeignPrice),
    exchangeRate: decimal(input.exchangeRate, 6),
    quantity: decimal(input.quantity),
    overseasShippingPct: decimal(input.overseasShippingPct),
    domesticPackingPct: decimal(input.domesticPackingPct),
    internationalFreight: decimal(input.internationalFreight, 2),
    insurance: decimal(input.insurance, 2),
    dutyRatePct: decimal(input.dutyRatePct),
    otherTaxFees: decimal(input.otherTaxFees, 2),
    brokerFee: decimal(input.brokerFee, 2),
    domesticLogistics: decimal(input.domesticLogistics, 2),
    otherExpenses: decimal(input.otherExpenses, 2),
    vatRatePct: decimal(input.vatRatePct),
    includeVatInCost: input.includeVatInCost,
    gpMarginPct: decimal(input.gpMarginPct),
    goodsValue: decimal(result.goodsValue, 2),
    cifValue: decimal(result.cifValue, 2),
    importDuty: decimal(result.importDuty, 2),
    importVat: decimal(result.importVat, 2),
    totalCost: decimal(result.totalCost, 2),
    costPerUnit: decimal(result.costPerUnit),
    sellingPricePerUnit: decimal(result.sellingPricePerUnit),
    profitPerUnit: decimal(result.profitPerUnit),
    totalProfit: decimal(result.totalProfit, 2),
    formulaVersion: result.formulaVersion,
  };
}

export const postgresProjectRepository: ProjectRepository = {
  async list(ownerId, filters = {}) {
    const rows = await prisma.project.findMany({
      where: {
        ownerId,
        categoryId: filters.categoryId || undefined,
        mode: filters.mode,
        ...(filters.query
          ? {
              OR: [
                { productName: { contains: filters.query, mode: "insensitive" } },
                { detail: { contains: filters.query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapProject);
  },

  async get(ownerId, id) {
    const row = await prisma.project.findFirst({
      where: { id, ownerId },
      include: { category: { select: { id: true, name: true } } },
    });
    return row ? mapProject(row) : null;
  },

  async create(ownerId, input) {
    await assertOwnedCategory(ownerId, input.categoryId);
    const row = await prisma.project.create({
      data: toData(ownerId, input),
      include: { category: { select: { id: true, name: true } } },
    });
    return mapProject(row);
  },

  async update(ownerId, id, input) {
    const exists = await prisma.project.findFirst({ where: { id, ownerId } });
    if (!exists) return null;
    await assertOwnedCategory(ownerId, input.categoryId);
    const { ownerId: _ownerId, ...data } = toData(ownerId, input);
    const row = await prisma.project.update({
      where: { id },
      data,
      include: { category: { select: { id: true, name: true } } },
    });
    return mapProject(row);
  },

  async duplicate(ownerId, id) {
    const original = await this.get(ownerId, id);
    if (!original) return null;
    const { id: _id, category: _category, createdAt: _createdAt, updatedAt: _updatedAt, ...data } =
      original;
    return this.create(ownerId, {
      ...data,
      productName: `${data.productName} (สำเนา)`,
    });
  },

  async delete(ownerId, id) {
    const result = await prisma.project.deleteMany({ where: { id, ownerId } });
    return result.count > 0;
  },
};
