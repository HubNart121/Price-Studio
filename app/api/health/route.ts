import { NextResponse } from "next/server";
import { getDataBackend } from "@/lib/config/data-backend";

export async function GET() {
  const backend = getDataBackend();
  try {
    if (backend === "firestore") {
      const { getFirestoreDb } = await import("@/lib/firebase/admin");
      await getFirestoreDb().collection("users").limit(1).get();
    } else {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.$queryRaw`SELECT 1`;
    }
    return NextResponse.json({ status: "ok", backend });
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json({ status: "error", backend }, { status: 503 });
  }
}
