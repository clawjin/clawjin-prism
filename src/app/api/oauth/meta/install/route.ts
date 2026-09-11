// src/app/api/oauth/meta/install/route.ts
// Step 1: redirect to Meta consent screen.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildInstallUrl, isMetaConfigured } from "@/modules/meta/oauth";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMetaConfigured()) {
    return NextResponse.json(
      { error: "Meta app not configured on the server. Set META_APP_ID/SECRET." },
      { status: 501 }
    );
  }

  const url = new URL(req.url);
  const redirectUri = `${url.origin}/api/oauth/meta/callback`;
  const authorizeUrl = await buildInstallUrl(user.id, redirectUri);

  return NextResponse.redirect(authorizeUrl);
}
