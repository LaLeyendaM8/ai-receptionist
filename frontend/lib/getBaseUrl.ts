// lib/getBaseUrl.ts
export function getBaseUrl(req: Request) {
  // 1) Wenn explizit gesetzt, nimm env (z.B. für Sonderfälle / feste Domain)
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, ""); // trailing slash weg

  // 2) Proxy-safe Origin bauen (wichtig bei Deployments hinter Proxy)
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req.headers.get("host");

  const proto = forwardedProto ?? "https";

  if (host) {
    return `${proto}://${host}`;
  }

  // 3) Fallback: req.url origin (funktioniert oft lokal)
  return new URL(req.url).origin;
}
