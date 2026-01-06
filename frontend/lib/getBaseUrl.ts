// lib/getBaseUrl.ts
export function getBaseUrl(req: Request) {
  const u = new URL(req.url);
  const explicit = process.env.PUBLIC_BASE_URL ;
  if (explicit) return explicit;

  if (process.env.NODE_ENV === "production") {
    throw new Error("PUBLIC_BASE_URL is missing in production");
  };
  return u.origin; // fallback
}
