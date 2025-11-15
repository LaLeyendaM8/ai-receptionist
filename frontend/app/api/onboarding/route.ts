// app/api/onboarding/route.ts
import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";

export async function POST(req: Request) {
  const supabase = createClients();

  // 1) User ermitteln
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? process.env.DEV_USER_ID ?? null;
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 2) Body parsen
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const {
    client,
    hours = [],
    services = [],
    faqs = [],
    staff = [],
  } = body;

  try {
    // 3) client upsert (owner_user = userId)
    const { data: clientRow, error: cErr } = await supabase
      .from("clients")
      .upsert(
        { ...client, owner_user: userId },
        { onConflict: "owner_user" },
      )
      .select("id")
      .single();

    if (cErr || !clientRow?.id) {
      return NextResponse.json(
        { error: "client_upsert_failed", details: cErr?.message },
        { status: 500 },
      );
    }

    const clientId = clientRow.id;

    // 4) business_hours upsert
    for (const h of hours) {
      const row = {
        client_id: clientId,
        weekday: h.weekday, // 0–6
        open_min: h.open_min,
        close_min: h.close_min,
        is_closed: h.is_closed ?? false,
      };

      await supabase
        .from("business_hours")
        .upsert(row, { onConflict: "client_id,weekday" });
    }

    // 5) services upsert
    for (const s of services) {
      const row = {
        client_id: clientId,
        name: s.name,
        duration_min: s.duration_min,
        price_cents: s.price_cents ?? 0,
        active: s.active ?? true,
      };

      await supabase
        .from("services")
        .upsert(row, { onConflict: "client_id,name" });
    }

    // 6) faqs upsert
    for (const f of faqs) {
      const row = {
        client_id: clientId,
        question: f.question,
        answer: f.answer,
        active: f.active ?? true,
      };

      await supabase
        .from("faqs")
        .upsert(row, { onConflict: "client_id,question" });
    }

    // 7) staff upsert (NEU)
    for (const st of staff) {
      const row = {
        client_id: clientId,
        name: st.name,
        calendar_id: st.calendar_id ?? null,
        is_default: st.is_default ?? false,
        active: st.active ?? true,
      };

      await supabase
        .from("staff")
        .upsert(row, { onConflict: "client_id,name" });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("onboarding_error", e);
    return NextResponse.json(
      { error: "onboarding_failed", details: e?.message },
      { status: 500 },
    );
  }
}
