import { google } from "googleapis";
import { createClients } from "@/lib/supabaseClients";

export async function getOAuth2ForUser(userId: string) {
  const supabase = await createClients();
  const { data: tok, error } = await supabase
    .from("google_tokens").select("*").eq("user_id", userId).single();
  if (error || !tok) throw new Error("no_tokens");

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );
  oauth2.setCredentials({
    access_token: tok.access_token ?? undefined,
    refresh_token: tok.refresh_token ?? undefined,
    expiry_date: typeof tok.expiry_date === "number" ? tok.expiry_date : undefined,
    token_type: tok.token_type ?? undefined,
    scope: tok.scope ?? undefined,
  });
  return { oauth2, supabase };
}
