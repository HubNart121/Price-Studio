import { describe, expect, it } from "vitest";
import {
  calculatePricing,
  emptyPricingInput,
  PricingValidationError,
} from "./pricing";

describe("calculatePricing", () => {
  it("คำนวณโหมดง่ายตามสูตรเว็บตัวอย่าง", () => {
    const result = calculatePricing({
      ...emptyPricingInput,
      mode: "SIMPLE",
      unitForeignPrice: 100,
      exchangeRate: 5,
      quantity: 10,
      overseasShippingPct: 10,
      domesticPackingPct: 5,
      gpMarginPct: 20,
    });

    expect(result.goodsValue).toBe(5000);
    expect(result.internationalFreightCost).toBe(500);
    expect(result.internationalFreightPerUnit).toBe(50);
    expect(result.domesticPackingCost).toBe(275);
    expect(result.domesticPackingPerUnit).toBe(27.5);
    expect(result.totalCost).toBe(5775);
    expect(result.costPerUnit).toBe(577.5);
    expect(result.sellingPricePerUnit).toBe(721.875);
    expect(result.totalProfit).toBe(1443.75);
  });

  it("คำนวณโหมดละเอียดและรวม VAT เป็นต้นทุน", () => {
    const result = calculatePricing({
      ...emptyPricingInput,
      mode: "ADVANCED",
      unitForeignPrice: 100,
      exchangeRate: 5,
      quantity: 10,
      internationalFreight: 500,
      insurance: 100,
      dutyRatePct: 10,
      otherTaxFees: 50,
      brokerFee: 300,
      domesticLogistics: 200,
      otherExpenses: 100,
      vatRatePct: 7,
      includeVatInCost: true,
      gpMarginPct: 20,
    });

    expect(result.cifValue).toBe(5600);
    expect(result.importDuty).toBe(560);
    expect(result.importVat).toBe(434.7);
    expect(result.totalCost).toBe(7244.7);
    expect(result.sellingPricePerUnit).toBe(905.5875);
  });

  it("ไม่นำ VAT มารวมต้นทุนเมื่อปิดสวิตช์", () => {
    const included = calculatePricing({
      ...emptyPricingInput,
      mode: "ADVANCED",
      unitForeignPrice: 100,
      exchangeRate: 5,
      quantity: 10,
      vatRatePct: 7,
      includeVatInCost: true,
    });
    const excluded = calculatePricing({
      ...emptyPricingInput,
      mode: "ADVANCED",
      unitForeignPrice: 100,
      exchangeRate: 5,
      quantity: 10,
      vatRatePct: 7,
      includeVatInCost: false,
    });

    expect(included.totalCost - excluded.totalCost).toBe(350);
  });

  it.each([
    [{ quantity: 0 }, "จำนวนสินค้าต้องมากกว่า 0"],
    [{ exchangeRate: 0 }, "อัตราแลกเปลี่ยนต้องมากกว่า 0"],
    [{ gpMarginPct: 100 }, "GP Margin"],
    [{ unitForeignPrice: -1 }, "unitForeignPrice"],
  ])("ปฏิเสธค่าที่ไม่ถูกต้อง", (patch, message) => {
    expect(() =>
      calculatePricing({ ...emptyPricingInput, ...patch }),
    ).toThrowError(PricingValidationError);
    expect(() =>
      calculatePricing({ ...emptyPricingInput, ...patch }),
    ).toThrowError(message);
  });
});
