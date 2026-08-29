import type { Prisma } from "@prisma/client";
import {
  createDefaultVolumeTiers,
  type ProjectRecord,
  type VolumeTier,
} from "../../domain/project";

export type ProjectWithCategory = Prisma.ProjectGetPayload<{
  include: { category: { select: { id: true; name: true } } };
}>;

const round = (value: number, places = 4) => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

function volumeTierValue(value: unknown): VolumeTier[] {
  if (!Array.isArray(value)) return createDefaultVolumeTiers();
  const tiers = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const tier = item as Record<string, unknown>;
    if (
      typeof tier.qty !== "string" ||
      typeof tier.quantity !== "number" ||
      !Number.isFinite(tier.quantity) ||
      typeof tier.discount !== "number" ||
      !Number.isFinite(tier.discount)
    ) {
      return [];
    }
    return [{ qty: tier.qty, quantity: tier.quantity, discount: tier.discount }];
  });
  return tiers.length > 0 ? tiers : createDefaultVolumeTiers();
}

export function mapProject(project: ProjectWithCategory): ProjectRecord {
  const quantity = Number(project.quantity);
  const goodsValue = Number(project.goodsValue);
  const overseasShippingPct = Number(project.overseasShippingPct);
  const domesticPackingPct = Number(project.domesticPackingPct);
  const internationalFreightCost =
    project.mode === "SIMPLE"
      ? goodsValue * (overseasShippingPct / 100)
      : Number(project.internationalFreight);
  const domesticPackingCost =
    project.mode === "SIMPLE"
      ? (goodsValue + internationalFreightCost) * (domesticPackingPct / 100)
      : 0;

  return {
    id: project.id,
    categoryId: project.categoryId,
    category: project.category,
    projectDate: project.projectDate.toISOString().slice(0, 10),
    productName: project.productName,
    productImageUrl: project.productImageUrl,
    detail: project.detail,
    currencyCode: project.currencyCode,
    mode: project.mode,
    unitForeignPrice: Number(project.unitForeignPrice),
    exchangeRate: Number(project.exchangeRate),
    quantity: Number(project.quantity),
    overseasShippingPct: Number(project.overseasShippingPct),
    domesticPackingPct: Number(project.domesticPackingPct),
    internationalFreight: Number(project.internationalFreight),
    insurance: Number(project.insurance),
    dutyRatePct: Number(project.dutyRatePct),
    otherTaxFees: Number(project.otherTaxFees),
    brokerFee: Number(project.brokerFee),
    domesticLogistics: Number(project.domesticLogistics),
    otherExpenses: Number(project.otherExpenses),
    vatRatePct: Number(project.vatRatePct),
    includeVatInCost: project.includeVatInCost,
    gpMarginPct: Number(project.gpMarginPct),
    volumeTiers: volumeTierValue(project.volumeTiers),
    goodsValue,
    internationalFreightCost: round(internationalFreightCost, 2),
    internationalFreightPerUnit: round(internationalFreightCost / quantity),
    domesticPackingCost: round(domesticPackingCost, 2),
    domesticPackingPerUnit: round(domesticPackingCost / quantity),
    cifValue: Number(project.cifValue),
    importDuty: Number(project.importDuty),
    importVat: Number(project.importVat),
    totalCost: Number(project.totalCost),
    costPerUnit: Number(project.costPerUnit),
    sellingPricePerUnit: Number(project.sellingPricePerUnit),
    profitPerUnit: Number(project.profitPerUnit),
    totalProfit: Number(project.totalProfit),
    formulaVersion: project.formulaVersion,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
