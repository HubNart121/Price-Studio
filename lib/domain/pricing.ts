export const FORMULA_VERSION = 1;

export type PricingMode = "SIMPLE" | "ADVANCED";

export interface PricingInput {
  mode: PricingMode;
  unitForeignPrice: number;
  exchangeRate: number;
  quantity: number;
  overseasShippingPct: number;
  domesticPackingPct: number;
  internationalFreight: number;
  insurance: number;
  dutyRatePct: number;
  otherTaxFees: number;
  brokerFee: number;
  domesticLogistics: number;
  otherExpenses: number;
  vatRatePct: number;
  includeVatInCost: boolean;
  gpMarginPct: number;
}

export interface PricingResult {
  goodsValue: number;
  internationalFreightCost: number;
  internationalFreightPerUnit: number;
  domesticPackingCost: number;
  domesticPackingPerUnit: number;
  cifValue: number;
  importDuty: number;
  importVat: number;
  totalCost: number;
  costPerUnit: number;
  sellingPricePerUnit: number;
  profitPerUnit: number;
  totalProfit: number;
  formulaVersion: number;
}

export class PricingValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(", "));
    this.name = "PricingValidationError";
  }
}

const round = (value: number, places = 4) => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function validatePricingInput(input: PricingInput): string[] {
  const issues: string[] = [];
  const numericKeys: Array<keyof PricingInput> = [
    "unitForeignPrice",
    "exchangeRate",
    "quantity",
    "overseasShippingPct",
    "domesticPackingPct",
    "internationalFreight",
    "insurance",
    "dutyRatePct",
    "otherTaxFees",
    "brokerFee",
    "domesticLogistics",
    "otherExpenses",
    "vatRatePct",
    "gpMarginPct",
  ];

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    issues.push("จำนวนสินค้าต้องมากกว่า 0");
  }
  if (!Number.isFinite(input.exchangeRate) || input.exchangeRate <= 0) {
    issues.push("อัตราแลกเปลี่ยนต้องมากกว่า 0");
  }
  if (input.gpMarginPct < 0 || input.gpMarginPct >= 100) {
    issues.push("GP Margin ต้องอยู่ระหว่าง 0 ถึงน้อยกว่า 100%");
  }
  for (const key of numericKeys) {
    const value = input[key] as number;
    if (!Number.isFinite(value) || value < 0) {
      issues.push(`${key} ต้องเป็นตัวเลขที่ไม่ติดลบ`);
    }
  }
  return [...new Set(issues)];
}

export function calculatePricing(input: PricingInput): PricingResult {
  const issues = validatePricingInput(input);
  if (issues.length) {
    throw new PricingValidationError(issues);
  }

  const goodsValue = input.unitForeignPrice * input.exchangeRate * input.quantity;
  let internationalFreightCost = 0;
  let domesticPackingCost = 0;
  let cifValue = goodsValue;
  let importDuty = 0;
  let importVat = 0;
  let totalCost = 0;

  if (input.mode === "SIMPLE") {
    internationalFreightCost = goodsValue * (input.overseasShippingPct / 100);
    domesticPackingCost =
      (goodsValue + internationalFreightCost) *
      (input.domesticPackingPct / 100);
    cifValue = goodsValue + internationalFreightCost;
    totalCost = goodsValue + internationalFreightCost + domesticPackingCost;
  } else {
    internationalFreightCost = input.internationalFreight;
    cifValue = goodsValue + internationalFreightCost + input.insurance;
    importDuty = cifValue * (input.dutyRatePct / 100);
    importVat =
      (cifValue + importDuty + input.otherTaxFees) *
      (input.vatRatePct / 100);
    totalCost =
      cifValue +
      importDuty +
      input.otherTaxFees +
      input.brokerFee +
      input.domesticLogistics +
      input.otherExpenses +
      (input.includeVatInCost ? importVat : 0);
  }

  const costPerUnit = totalCost / input.quantity;
  const internationalFreightPerUnit =
    internationalFreightCost / input.quantity;
  const domesticPackingPerUnit = domesticPackingCost / input.quantity;
  const sellingPricePerUnit =
    costPerUnit / (1 - input.gpMarginPct / 100);
  const profitPerUnit = sellingPricePerUnit - costPerUnit;
  const totalProfit = profitPerUnit * input.quantity;

  return {
    goodsValue: round(goodsValue, 2),
    internationalFreightCost: round(internationalFreightCost, 2),
    internationalFreightPerUnit: round(internationalFreightPerUnit),
    domesticPackingCost: round(domesticPackingCost, 2),
    domesticPackingPerUnit: round(domesticPackingPerUnit),
    cifValue: round(cifValue, 2),
    importDuty: round(importDuty, 2),
    importVat: round(importVat, 2),
    totalCost: round(totalCost, 2),
    costPerUnit: round(costPerUnit),
    sellingPricePerUnit: round(sellingPricePerUnit),
    profitPerUnit: round(profitPerUnit),
    totalProfit: round(totalProfit, 2),
    formulaVersion: FORMULA_VERSION,
  };
}

export const emptyPricingInput: PricingInput = {
  mode: "SIMPLE",
  unitForeignPrice: 0,
  exchangeRate: 5,
  quantity: 1,
  overseasShippingPct: 0,
  domesticPackingPct: 0,
  internationalFreight: 0,
  insurance: 0,
  dutyRatePct: 0,
  otherTaxFees: 0,
  brokerFee: 0,
  domesticLogistics: 0,
  otherExpenses: 0,
  vatRatePct: 7,
  includeVatInCost: true,
  gpMarginPct: 30,
};
