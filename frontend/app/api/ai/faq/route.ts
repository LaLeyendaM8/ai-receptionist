export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClients, createServiceClient } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";
import { runFaqFlow } from "@/lib/callflow/faq";

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
  return new Response("Not found", { status: 404 });
}

    const body = await req.json();

    const userQuestion: string | undefined = body?.message;
    const clientIdFromBody: string | null = body?.clientId ?? null;

    if (!userQuestion || typeof userQuestion !== "string") {
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }

    // supabase bestimmen
    const supabase = clientIdFromBody ? createServiceClient() : await createClients();

    // userId nur bei Dashboard nötig
    let userId: string | null = null;
    if (!clientIdFromBody) {
      userId = await getCurrentUserId(supabase);
      if (!userId) {
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      }
    }

    return await runFaqFlow({
      supabase,
      message: userQuestion,
      clientId: clientIdFromBody,
      userId,
    });
  } catch (e: any) {
    console.error("[/api/ai/faq] failed:", e);
    return NextResponse.json(
      { error: "faq_failed", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
