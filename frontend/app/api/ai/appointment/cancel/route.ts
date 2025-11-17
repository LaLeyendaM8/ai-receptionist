import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export async function POST(req: Request) {
  try {
    const { draftId } = await req.json();
    if (!draftId) return NextResponse.json({ error: "missing draftId" }, { status: 400 });

    const supabase = createClients();

    const userId = await getCurrentUserId(supabase);
    if (!userId) {
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 }
      );
    }
    
    await supabase.from("appointment_drafts").delete().eq("id", draftId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "cancel_failed", details: e?.message }, { status: 500 });
  }
}
