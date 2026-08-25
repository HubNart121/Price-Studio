import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { categoryCreateSchema } from "@/lib/domain/schemas";
import { apiError } from "@/lib/http/response";
import { categoryRepository } from "@/lib/repositories";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    return NextResponse.json(await categoryRepository.list(user.id));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const input = categoryCreateSchema.parse(await request.json());
    const category = await categoryRepository.create(user.id, input.name);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
