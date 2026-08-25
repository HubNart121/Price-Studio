import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { categoryRepository, projectRepository } from "@/lib/repositories";
import type { ProjectInput } from "@/lib/domain/project";

const run = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

run("PostgreSQL repositories", () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let ownerA = "";
  let ownerB = "";

  const input: ProjectInput = {
    categoryId: null,
    projectDate: "2026-07-29",
    productName: "Integration product",
    detail: "",
    currencyCode: "CNY",
    mode: "ADVANCED",
    unitForeignPrice: 100,
    exchangeRate: 5,
    quantity: 10,
    overseasShippingPct: 0,
    domesticPackingPct: 0,
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
  };

  beforeAll(async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { email: `owner-a-${suffix}@example.com` } }),
      prisma.user.create({ data: { email: `owner-b-${suffix}@example.com` } }),
    ]);
    ownerA = a.id;
    ownerB = b.id;
  });

  afterAll(async () => {
    if (ownerA || ownerB) {
      await prisma.user.deleteMany({ where: { id: { in: [ownerA, ownerB] } } });
    }
    await prisma.$disconnect();
  });

  it("แยกข้อมูลของผู้ใช้และป้องกันการลบหมวดที่ถูกใช้งาน", async () => {
    const category = await categoryRepository.create(ownerA, "QA");
    const project = await projectRepository.create(ownerA, {
      ...input,
      categoryId: category.id,
    });

    expect(project.totalCost).toBe(7244.7);
    expect(await projectRepository.get(ownerB, project.id)).toBeNull();
    expect(await projectRepository.list(ownerB)).toHaveLength(0);
    expect(await projectRepository.delete(ownerB, project.id)).toBe(false);
    expect(await categoryRepository.delete(ownerA, category.id)).toBe("in-use");

    expect(await projectRepository.delete(ownerA, project.id)).toBe(true);
    expect(await categoryRepository.delete(ownerA, category.id)).toBe("deleted");
  });
});
