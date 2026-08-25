import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth/current-user";
import { PricingValidationError } from "@/lib/domain/pricing";

export function apiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "ข้อมูลไม่ถูกต้อง",
        issues: error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  }
  if (error instanceof PricingValidationError) {
    return NextResponse.json(
      { error: "ข้อมูลคำนวณไม่ถูกต้อง", issues: error.issues },
      { status: 400 },
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return NextResponse.json(
      { error: "มีข้อมูลชื่อนี้อยู่แล้ว" },
      { status: 409 },
    );
  }
  if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") {
    return NextResponse.json({ error: "ไม่พบหมวดสินค้านี้" }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json(
    { error: "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง" },
    { status: 500 },
  );
}
