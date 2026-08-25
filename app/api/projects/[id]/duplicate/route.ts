import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { apiError } from "@/lib/http/response";
import { projectRepository } from "@/lib/repositories";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const project = await projectRepository.duplicate(user.id, id);
    if (!project) {
      return NextResponse.json({ error: "ไม่พบโปรเจกต์" }, { status: 404 });
    }
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
