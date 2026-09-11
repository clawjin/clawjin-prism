// src/app/api/analytics/cohorts/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCohorts } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matrix = await getCohorts(user.id);
  return NextResponse.json(matrix);
}
