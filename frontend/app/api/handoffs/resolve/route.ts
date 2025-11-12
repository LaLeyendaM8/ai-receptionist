import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createClients();

  try {
    // 1) User bestimmen
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      console.error("resolve: auth error:", authErr);
    }

    const userId = auth?.user?.id ?? process.env.DEV_USER_ID ?? null;

    if (!userId) {
      console.error("resolve: no userId (auth + DEV_USER_ID both null)");
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    // 2) Body lesen
    const body = await req.json().catch((e) => {
      console.error("resolve: body parse error:", e);
      return null;
    });

    const id: string | undefined = body?.id;
    if (!id) {
      console.error("resolve: missing id in body:", body);
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    // 3) Handoff laden
    const { data: handoff, error: hErr } = await supabase
      .from("handoffs")
      .select("*")
      .eq("id", id)
      .single();

    if (hErr) {
      console.error("resolve: handoff select error:", hErr);
      return NextResponse.json(
        { error: "handoff_lookup_failed", details: hErr.message },
        { status: 500 }
      );
    }

    if (!handoff) {
      console.error("resolve: no handoff found for id", id);
      return NextResponse.json(
        { error: "handoff_not_found" },
        { status: 404 }
      );
    }

    // 4) Owner prüfen
    if (handoff.user_id !== userId) {
      console.error(
        "resolve: forbidden – handoff.user_id != userId",
        handoff.user_id,
        userId
      );
      return NextResponse.json(
        { error: "forbidden", message: "handoff does not belong to this user" },
        { status: 403 }
      );
    }

    // 5) Status auf "resolved" setzen
    const { error: upErr } = await supabase
      .from("handoffs")
      .update({ status: "resolved" })
      .eq("id", id);

    if (upErr) {
      console.error("resolve: update error:", upErr);
      return NextResponse.json(
        { error: "handoff_update_failed", details: upErr.message },
        { status: 500 }
      );
    }

    console.log("resolve: success for id", id);

    return NextResponse.json({ status: "resolved", id }, { status: 200 });
  } catch (e: any) {
    console.error("resolve: top-level error:", e);
    return NextResponse.json(
      { error: "resolve_failed", details: e?.message },
      { status: 500 }
    );
  }
}
