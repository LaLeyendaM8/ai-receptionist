// app/api/handoffs/open/route.ts
import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export async function GET() {
  const supabase = await createClients();
  const userId = await getCurrentUserId(supabase);
    if (!userId) {
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 }
      );
    }

  // Client des Owners holen
  const { data: client } = await supabase
    .from("clients").select("id").eq("owner_user", userId).single();

  if (!client) return NextResponse.json({ items: [] });

  const { data } = await supabase
    .from("handoffs")
    .select("id, question, intent, confidence, status, created_at")
    .eq("client_id", client.id)
    .neq("status", "resolved")
    .order("created_at", { ascending: false });

  return NextResponse.json({ items: data ?? [] });
}
