import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import type { BackupPayload } from "@/lib/domain/project";
import { apiError } from "@/lib/http/response";
import { categoryRepository, projectRepository } from "@/lib/repositories";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const [categories, projects] = await Promise.all([
      categoryRepository.list(user.id),
      projectRepository.list(user.id),
    ]);
    const payload: BackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      ownerEmail: user.email,
      categories: categories.map(({ projectCount: _projectCount, ...rest }) => rest),
      projects,
    };
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="pricing-backup-${stamp}.json"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
