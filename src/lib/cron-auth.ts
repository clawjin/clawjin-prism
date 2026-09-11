// src/lib/cron-auth.ts
// Cron endpoints accept either:
// → Vercel Cron's automatic `Authorization: Bearer ${CRON_SECRET}` header
// → An explicit x-cron-key header (for manual triggers / external schedulers)

export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;

  // No secret configured = open in dev, but log loudly
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[cron] CRON_SECRET not set — endpoint unprotected!");
      return true;
    }
    return true;
  }

  const bearer = req.headers.get("authorization");
  const key = req.headers.get("x-cron-key");

  return (
    bearer === `Bearer ${secret}` ||
    key === secret
  );
}
