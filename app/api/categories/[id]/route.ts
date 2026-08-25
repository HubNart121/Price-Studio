import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { categoryUpdateSchema } from "@/lib/domain/schemas";
import { apiError } from "@/lib/http/response";
import { categoryRepository } from "@/lib/repositories";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const patch = categoryUpdateSchema.parse(await request.json());
    const category = await categoryRepository.update(user.id, id, patch);
    if (!category) {
      return NextResponse.json({ error: "ไม่พบหมวดสินค้า" }, { status: 404 });
    }
    return NextResponse.json(category);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const result = await categoryRepository.delete(user.id, id);
    if (result === "missing") {
      return NextResponse.json({ error: "ไม่พบหมวดสินค้า" }, { status: 404 });
    }
    if (result === "in-use") {
      return NextResponse.json(
        { error: "หมวดนี้มีโปรเจกต์ใช้งานอยู่ จึงยังลบไม่ได้" },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
