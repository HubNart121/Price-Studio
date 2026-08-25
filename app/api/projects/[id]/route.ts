import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { projectInputSchema } from "@/lib/domain/schemas";
import { apiError } from "@/lib/http/response";
import { projectRepository } from "@/lib/repositories";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const project = await projectRepository.get(user.id, id);
    if (!project) {
      return NextResponse.json({ error: "ไม่พบโปรเจกต์" }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const input = projectInputSchema.parse(await request.json());
    const project = await projectRepository.update(user.id, id, input);
    if (!project) {
      return NextResponse.json({ error: "ไม่พบโปรเจกต์" }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const deleted = await projectRepository.delete(user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "ไม่พบโปรเจกต์" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
