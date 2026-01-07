// lib/getBaseUrl.ts
export function getBaseUrl(req: Request): string {
  const envBase = process.env.PUBLIC_BASE_URL;

  // ✅ Production: IMMER env erzwingen
  if (process.env.NODE_ENV === "production") {
    if (!envBase) {
      throw new Error("PUBLIC_BASE_URL is required in production");
    }
    return envBase.replace(/\/$/, "");
  }

  // 🧪 Dev / Local: fallback erlaubt
  if (envBase) {
    return envBase.replace(/\/$/, "");
  }

  // Lokal sinnvoller Fallback
  return new URL(req.url).origin;
}
