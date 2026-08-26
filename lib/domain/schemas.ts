import { z } from "zod";

const nonNegative = z.coerce.number().finite().min(0);

export const projectInputSchema = z
  .object({
    categoryId: z.string().min(1).nullable().optional().default(null),
    projectDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ไม่ถูกต้อง"),
    productName: z.string().trim().min(1, "กรุณาระบุชื่อสินค้า").max(200),
    detail: z.string().trim().max(2000).optional().default(""),
    currencyCode: z.string().trim().min(3).max(3).default("CNY"),
    mode: z.enum(["SIMPLE", "ADVANCED", "VOLUME"]),
    unitForeignPrice: nonNegative,
    exchangeRate: z.coerce.number().finite().positive(),
    quantity: z.coerce.number().finite().positive(),
    overseasShippingPct: nonNegative,
    domesticPackingPct: nonNegative,
    internationalFreight: nonNegative,
    insurance: nonNegative,
    dutyRatePct: nonNegative,
    otherTaxFees: nonNegative,
    brokerFee: nonNegative,
    domesticLogistics: nonNegative,
    otherExpenses: nonNegative,
    vatRatePct: nonNegative,
    includeVatInCost: z.boolean(),
    gpMarginPct: z.coerce.number().finite().min(0).lt(100),
  })
  .strict();

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อหมวด").max(100),
});

export const categoryUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "ไม่มีข้อมูลที่ต้องแก้ไข",
  });
