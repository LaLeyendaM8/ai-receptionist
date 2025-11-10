// lib/googleOauth.ts
export function getRedirectUri(req: Request) {
  // Reverse-Proxy Header (loca.lt) comes first
  const proto = req.headers.get("x-forwarded-proto");
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host");

  const base =
    (proto && host)
      ? `${proto}://${host}`
      : (process.env.PUBLIC_BASE_URL || new URL(req.url).origin);

  return `${base}/api/google/oauth/callback`;
}
