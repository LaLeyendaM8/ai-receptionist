import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";

export async function POST(req: Request) {
  try {
    const { draftId } = await req.json();
    if (!draftId) return NextResponse.json({ error: "missing draftId" }, { status: 400 });

    const supabase = createClients();
    await supabase.from("appointment_drafts").delete().eq("id", draftId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "cancel_failed", details: e?.message }, { status: 500 });
  }
}
