import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/current-user";
import type { ProjectInput } from "@/lib/domain/project";
import { projectInputSchema } from "@/lib/domain/schemas";
import { apiError } from "@/lib/http/response";
import { categoryRepository, projectRepository } from "@/lib/repositories";
import { clearOwnerData } from "@/lib/repositories/maintenance";

const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  ownerEmail: z.string().email(),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(100),
      isActive: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  projects: z.array(z.record(z.string(), z.unknown())),
});

function pickProjectInput(raw: Record<string, unknown>): ProjectInput {
  return projectInputSchema.parse({
    categoryId:
      typeof raw.categoryId === "string" ? raw.categoryId : null,
    projectDate: raw.projectDate,
    productName: raw.productName,
    detail: raw.detail,
    currencyCode: raw.currencyCode,
    mode: raw.mode,
    unitForeignPrice: raw.unitForeignPrice,
    exchangeRate: raw.exchangeRate,
    quantity: raw.quantity,
    overseasShippingPct: raw.overseasShippingPct,
    domesticPackingPct: raw.domesticPackingPct,
    internationalFreight: raw.internationalFreight,
    insurance: raw.insurance,
    dutyRatePct: raw.dutyRatePct,
    otherTaxFees: raw.otherTaxFees,
    brokerFee: raw.brokerFee,
    domesticLogistics: raw.domesticLogistics,
    otherExpenses: raw.otherExpenses,
    vatRatePct: raw.vatRatePct,
    includeVatInCost: raw.includeVatInCost,
    gpMarginPct: raw.gpMarginPct,
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json();
    const mode = body.mode === "merge" ? "merge" : "replace";
    const backup = backupSchema.parse(body.backup);
    const parsedProjects = backup.projects.map(pickProjectInput);

    if (mode === "replace") {
      await clearOwnerData(user.id);
    }

    const categoryMap = new Map<string, string>();
    let existingCategories = await categoryRepository.list(user.id);
    for (const category of backup.categories) {
      const existing = existingCategories.find((item) => item.name === category.name);
      const saved =
        existing ??
        (await categoryRepository.create(user.id, category.name));
      if (existing && existing.isActive !== category.isActive) {
        await categoryRepository.update(user.id, existing.id, {
          isActive: category.isActive,
        });
      }
      categoryMap.set(category.id, saved.id);
      existingCategories = await categoryRepository.list(user.id);
    }

    let imported = 0;
    for (const project of parsedProjects) {
      await projectRepository.create(user.id, {
        ...project,
        categoryId: project.categoryId
          ? categoryMap.get(project.categoryId) ?? null
          : null,
      });
      imported += 1;
    }

    if (backup.categories.length === 0) {
      await categoryRepository.create(user.id, "ทั่วไป");
      await categoryRepository.create(user.id, "อื่น ๆ");
    }

    return NextResponse.json({
      success: true,
      importedProjects: imported,
      importedCategories: backup.categories.length,
      mode,
    });
  } catch (error) {
    return apiError(error);
  }
}
