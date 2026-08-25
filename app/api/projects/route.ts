import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { projectInputSchema } from "@/lib/domain/schemas";
import type { PricingMode } from "@/lib/domain/pricing";
import { apiError } from "@/lib/http/response";
import { projectRepository } from "@/lib/repositories";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUser();
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");
    const projects = await projectRepository.list(user.id, {
      query: url.searchParams.get("q") || undefined,
      categoryId: url.searchParams.get("categoryId") || undefined,
      mode:
        mode === "SIMPLE" || mode === "ADVANCED"
          ? (mode as PricingMode)
          : undefined,
    });
    return NextResponse.json(projects);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const input = projectInputSchema.parse(await request.json());
    const project = await projectRepository.create(user.id, input);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
