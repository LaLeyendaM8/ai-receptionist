import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getRedirectUri } from "@/lib/googleOauth"; // your helper
import { getCurrentUserId } from "@/lib/authServer";
import { createClients } from "@/lib/supabaseClients";

export async function GET(req: Request) {
  const redirectUri = getRedirectUri(req);
  console.log("OAUTH START ▶ REDIRECT URI:", redirectUri);

  const supabase = createClients();
  const userId = await getCurrentUserId(supabase);
    if (!userId) {
       return NextResponse.json(
       { error: "unauthenticated" },
       { status: 401 }
     );
   }
 
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri
  );

  const scopes =
    process.env.GOOGLE_SCOPES ??
    "https://www.googleapis.com/auth/calendar"; // includes calendar write

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    // IMPORTANT: send a real UUID, not "dev-user"
    state: JSON.stringify({ userId }),
  });

  return NextResponse.redirect(url);
}
