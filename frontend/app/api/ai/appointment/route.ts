// app/api/ai/appointment/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClients, createServiceClient } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";
import { runAppointmentFlow } from "@/lib/callflow/appointment";



export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
  return new Response("Not found", { status: 404 });
}

    const body = (await req.json()) as {
      message: string;
      clientId?: string | null;
      sessionId?: string | null;
      intent?: string | null;
      parsed?: any;
    };

    const { message, clientId: bodyClientId, sessionId, intent: brainIntent } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "invalid_message" }, { status: 400 });
    }

    // ✅ supabase client bestimmen: clientId => ServiceClient, sonst Cookie Client
    const supabase = bodyClientId ? createServiceClient() : await createClients();

    // --- Client bestimmen: entweder über clientId ODER eingeloggten User ---
    type ClientRow = {
      id: string;
      timezone: string | null;
      owner_user: string;
      staff_enabled: boolean | null;
    };

    let client: ClientRow | null = null;

    if (bodyClientId) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, timezone, owner_user, staff_enabled")
        .eq("id", bodyClientId)
        .maybeSingle();

      if (error) {
        console.error("[APPOINTMENT] client load error (by clientId)", error);
        return NextResponse.json({ error: "client_load_failed" }, { status: 500 });
      }
      if (!data) return NextResponse.json({ error: "client_not_found" }, { status: 404 });
      client = data;
    } else {
      const userId = await getCurrentUserId(supabase);
      if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

      const { data, error } = await supabase
        .from("clients")
        .select("id, timezone, owner_user, staff_enabled")
        .eq("owner_user", userId)
        .maybeSingle();

      if (error) {
        console.error("[APPOINTMENT] client load error (by user)", error);
        return NextResponse.json({ error: "client_load_failed" }, { status: 500 });
      }
      if (!data) return NextResponse.json({ error: "no_client_for_user" }, { status: 404 });
      client = data;
    }

    const clientId = client.id;
    const ownerUserId = client.owner_user;
    const timezone = client.timezone || "Europe/Berlin";
    const staffEnabled = Boolean(client.staff_enabled);

    // ✅ callflow
    return await runAppointmentFlow({
      supabase,
      clientId,
      ownerUserId,
      timezone,
      staffEnabled,
      message,
      sessionId,
      brainIntent,
    });
  } catch (err: unknown) {
    console.error("[/api/ai/appointment] ERROR", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err, null, 2);
    return NextResponse.json(
      { status: "error", error: "internal_error", details: message },
      { status: 500 }
    );
  }
}
