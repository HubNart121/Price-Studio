import type { DocumentData, DocumentSnapshot } from "firebase-admin/firestore";
import {
  createDefaultVolumeTiers,
  type CategoryRecord,
  type ProjectRecord,
  type VolumeTier,
} from "../../domain/project";
import { calculatePricing, type PricingResult } from "../../domain/pricing";

const round = (value: number, places = 4) => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function boolValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

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

export function mapCategory(
  doc: DocumentSnapshot<DocumentData>,
  projectCount: number,
): CategoryRecord {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    name: stringValue(data.name),
    isActive: boolValue(data.isActive, true),
    projectCount,
    createdAt: stringValue(data.createdAt),
    updatedAt: stringValue(data.updatedAt),
  };
}

function pricingResult(data: DocumentData): PricingResult {
  const computed = calculatePricing({
    mode:
      data.mode === "ADVANCED"
        ? "ADVANCED"
        : data.mode === "VOLUME"
          ? "VOLUME"
          : "SIMPLE",
    unitForeignPrice: numberValue(data.unitForeignPrice),
    exchangeRate: numberValue(data.exchangeRate, 1),
    quantity: numberValue(data.quantity, 1),
    overseasShippingPct: numberValue(data.overseasShippingPct),
    domesticPackingPct: numberValue(data.domesticPackingPct),
    internationalFreight: numberValue(data.internationalFreight),
    insurance: numberValue(data.insurance),
    dutyRatePct: numberValue(data.dutyRatePct),
    otherTaxFees: numberValue(data.otherTaxFees),
    brokerFee: numberValue(data.brokerFee),
    domesticLogistics: numberValue(data.domesticLogistics),
    otherExpenses: numberValue(data.otherExpenses),
    vatRatePct: numberValue(data.vatRatePct, 7),
    includeVatInCost: boolValue(data.includeVatInCost, true),
    gpMarginPct: numberValue(data.gpMarginPct),
  });

  return {
    ...computed,
    goodsValue: numberValue(data.goodsValue, computed.goodsValue),
    internationalFreightCost: numberValue(
      data.internationalFreightCost,
      computed.internationalFreightCost,
    ),
    internationalFreightPerUnit: numberValue(
      data.internationalFreightPerUnit,
      computed.internationalFreightPerUnit,
    ),
    domesticPackingCost: numberValue(
      data.domesticPackingCost,
      computed.domesticPackingCost,
    ),
    domesticPackingPerUnit: numberValue(
      data.domesticPackingPerUnit,
      computed.domesticPackingPerUnit,
    ),
    cifValue: numberValue(data.cifValue, computed.cifValue),
    importDuty: numberValue(data.importDuty, computed.importDuty),
    importVat: numberValue(data.importVat, computed.importVat),
    totalCost: numberValue(data.totalCost, computed.totalCost),
    costPerUnit: round(numberValue(data.costPerUnit, computed.costPerUnit)),
    sellingPricePerUnit: round(
      numberValue(data.sellingPricePerUnit, computed.sellingPricePerUnit),
    ),
    profitPerUnit: round(numberValue(data.profitPerUnit, computed.profitPerUnit)),
    totalProfit: numberValue(data.totalProfit, computed.totalProfit),
    formulaVersion: numberValue(data.formulaVersion, computed.formulaVersion),
  };
}

export function mapProject(
  doc: DocumentSnapshot<DocumentData>,
  category: { id: string; name: string } | null,
): ProjectRecord {
  const data = doc.data() ?? {};
  const result = pricingResult(data);
  return {
    id: doc.id,
    categoryId:
      typeof data.categoryId === "string" && data.categoryId.length > 0
        ? data.categoryId
        : null,
    category,
    projectDate: stringValue(data.projectDate),
    productName: stringValue(data.productName),
    productImageUrl: stringValue(data.productImageUrl),
    detail: stringValue(data.detail),
    currencyCode: stringValue(data.currencyCode, "CNY"),
    mode:
      data.mode === "ADVANCED"
        ? "ADVANCED"
        : data.mode === "VOLUME"
          ? "VOLUME"
          : "SIMPLE",
    unitForeignPrice: numberValue(data.unitForeignPrice),
    exchangeRate: numberValue(data.exchangeRate, 1),
    quantity: numberValue(data.quantity, 1),
    overseasShippingPct: numberValue(data.overseasShippingPct),
    domesticPackingPct: numberValue(data.domesticPackingPct),
    internationalFreight: numberValue(data.internationalFreight),
    insurance: numberValue(data.insurance),
    dutyRatePct: numberValue(data.dutyRatePct),
    otherTaxFees: numberValue(data.otherTaxFees),
    brokerFee: numberValue(data.brokerFee),
    domesticLogistics: numberValue(data.domesticLogistics),
    otherExpenses: numberValue(data.otherExpenses),
    vatRatePct: numberValue(data.vatRatePct, 7),
    includeVatInCost: boolValue(data.includeVatInCost, true),
    gpMarginPct: numberValue(data.gpMarginPct),
    volumeTiers: volumeTierValue(data.volumeTiers),
    ...result,
    createdAt: stringValue(data.createdAt),
    updatedAt: stringValue(data.updatedAt),
  };
}
