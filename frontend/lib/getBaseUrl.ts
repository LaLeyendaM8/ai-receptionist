// lib/getBaseUrl.ts
export function getBaseUrl(req: Request) {
  const u = new URL(req.url);
  // If you’re behind localtunnel, prefer the PUBLIC_BASE_URL you set (.env.local)
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  return u.origin; // fallback
}
