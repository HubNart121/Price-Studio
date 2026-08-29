import { describe, expect, it } from "vitest";
import { emptyPricingInput } from "./pricing";
import { createDefaultVolumeTiers } from "./project";
import { projectInputSchema } from "./schemas";

const projectInput = {
  ...emptyPricingInput,
  categoryId: null,
  projectDate: "2026-08-28",
  productName: "Volume product",
  productImageUrl: "",
  detail: "",
  currencyCode: "CNY",
};

describe("projectInputSchema volume tiers", () => {
  it("ใช้ค่าเริ่มต้นกับข้อมูลสินค้าเดิมที่ยังไม่มี volume tiers", () => {
    const parsed = projectInputSchema.parse(projectInput);

    expect(parsed.volumeTiers).toEqual(createDefaultVolumeTiers());
  });

  it("เก็บ volume tiers ของสินค้าแต่ละรายการ", () => {
    const volumeTiers = [
      { qty: "12-24", quantity: 24, discount: 7.5 },
      { qty: "25+", quantity: 25, discount: 12 },
    ];
    const parsed = projectInputSchema.parse({ ...projectInput, volumeTiers });

    expect(parsed.volumeTiers).toEqual(volumeTiers);
  });
});
