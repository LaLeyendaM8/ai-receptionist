// lib/googleOauth.ts
import { getBaseUrl } from "./getBaseUrl";

export function getRedirectUri(req: Request) {
  const base = getBaseUrl(req);
  return `${base}/api/google/oauth/callback`;
}
