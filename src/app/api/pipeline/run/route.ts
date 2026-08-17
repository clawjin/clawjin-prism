import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runIngestion } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runIngestion(user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Pipeline run error", err);
    return NextResponse.json(
      { error: "Could not run the data pipeline." },
      { status: 500 },
    );
  }
}
