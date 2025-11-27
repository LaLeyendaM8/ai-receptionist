// app/api/onboarding/route.ts
import { NextResponse } from "next/server";
import { createClients, createServiceClient } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export async function POST(req: Request) {
  const supabase = await createClients();
  const serviceSupabase = createServiceClient();

  // 1) User ermitteln – WICHTIG: ohne Parameter
  const userId = await getCurrentUserId(supabase);
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
    client_faqs: clientFaqsRaw,
    faqs: faqsRaw,
    staff = [],
  } = body as any;

  const client_faqs: any[] = clientFaqsRaw ?? faqsRaw ?? [];

  try {
    // 3) bestehenden Client für diesen User suchen
    const { data: existingClient, error: findErr } = await supabase
      .from("clients")
      .select("id")
      .eq("owner_user", userId)
      .maybeSingle();

    if (findErr) {
      console.error("client_find_failed", findErr);
      return NextResponse.json(
        { error: "client_find_failed", details: findErr.message },
        { status: 500 }
      );
    }

    let clientId: string;

    if (existingClient) {
      // 3a) Update bestehender Client
      const { data: updated, error: updateErr } = await supabase
        .from("clients")
        .update({
          ...client,
          owner_user: userId,
        })
        .eq("id", existingClient.id)
        .select("id")
        .single();

      if (updateErr || !updated?.id) {
        console.error("client_update_failed", updateErr);
        return NextResponse.json(
          { error: "client_update_failed", details: updateErr?.message },
          { status: 500 }
        );
      }

      clientId = updated.id;
    } else {
      // 3b) Neuer Client
      const { data: inserted, error: insertErr } = await supabase
        .from("clients")
        .insert({
          ...client,
          owner_user: userId,
        })
        .select("id")
        .single();

      if (insertErr || !inserted?.id) {
        console.error("client_insert_failed", insertErr);
        return NextResponse.json(
          { error: "client_insert_failed", details: insertErr?.message },
          { status: 500 }
        );
      }

      clientId = inserted.id;
    }

    // 3c) Stripe-Abo mit diesem Client verknüpfen (falls vorhanden)
    try {
      // Passenden Stripe-Eintrag zu diesem User holen,
      // der noch keinen Client zugeordnet hat
      const { data: stripeRow, error: stripeSelectErr } = await serviceSupabase
        .from("stripe_subscriptions") // ggf. Tabellennamen anpassen
        .select(
          "id, stripe_customer_id, stripe_subscription_id, plan, status"
        )
        .eq("user_id", userId)
        .is("client_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (stripeSelectErr) {
        console.error("stripe_link_select_failed", stripeSelectErr);
      } else if (stripeRow) {
        // Stripe-Daten auf den Client schreiben
        const { error: clientStripeErr } = await serviceSupabase
          .from("clients")
          .update({
            stripe_customer_id: stripeRow.stripe_customer_id,
            stripe_subscription_id: stripeRow.stripe_subscription_id,
            stripe_status: stripeRow.status,
            stripe_plan: stripeRow.plan,
          })
          .eq("id", clientId);

        if (clientStripeErr) {
          console.error("stripe_link_client_update_failed", clientStripeErr);
        } else {
          // Stripe-Eintrag mit dem Client verknüpfen
          const { error: stripeUpdateErr } = await serviceSupabase
            .from("stripe_subscriptions")
            .update({ client_id: clientId })
            .eq("id", stripeRow.id);

          if (stripeUpdateErr) {
            console.error("stripe_link_customer_update_failed", stripeUpdateErr);
          }
        }
      }
    } catch (stripeLinkUnexpected) {
      console.error("stripe_link_unexpected_error", stripeLinkUnexpected);
    }

    // 4) business_hours: alte löschen, neue einfügen
    await supabase.from("business_hours").delete().eq("client_id", clientId);

    if (hours.length > 0) {
      const hourRows = hours.map((h: any) => {
  const isClosed = h.is_closed ?? false;

  return {
    client_id: clientId,
    weekday: h.weekday,
    open_min: isClosed ? 0 : h.open_min ?? 0,
    close_min: isClosed ? 0 : h.close_min ?? 0,
    is_closed: isClosed,
  };
});


      const { error: hoursErr } = await supabase
        .from("business_hours")
        .insert(hourRows);

      if (hoursErr) {
        console.error("business_hours_insert_failed", hoursErr);
        return NextResponse.json(
          { error: "business_hours_insert_failed", details: hoursErr.message },
          { status: 500 }
        );
      }
    }

    // 5) staff: alte löschen, neue einfügen
    await supabase.from("staff").delete().eq("client_id", clientId);

    if (staff.length > 0) {
      const staffRows = staff.map((s: any) => ({
        client_id: clientId,
        name: s.name,
        calendar_id: s.calendar_id ?? null,
        is_default: s.is_default ?? false,
        active: s.active ?? true,
      }));

      const { error: staffErr } = await supabase
        .from("staff")
        .insert(staffRows);

      if (staffErr) {
        console.error("staff_insert_failed", staffErr);
        return NextResponse.json(
          { error: "staff_insert_failed", details: staffErr.message },
          { status: 500 }
        );
      }
    }

    // 6) services: alte löschen, neue einfügen
    await supabase.from("services").delete().eq("client_id", clientId);

    if (services.length > 0) {
      const serviceRows = services.map((srv: any) => ({
        client_id: clientId,
        title: srv.title ?? srv.name,
        duration_min: srv.duration_min,
        price_cents: srv.price_cents ?? null,
        active: srv.active ?? true,
        default_staff_id: srv.default_staff_id ?? null,
      }));

      const { error: servicesErr } = await supabase
        .from("services")
        .insert(serviceRows);

      if (servicesErr) {
        console.error("services_insert_failed", servicesErr);
        return NextResponse.json(
          { error: "services_insert_failed", details: servicesErr.message },
          { status: 500 }
        );
      }
    }

    // 7) client_faqs: alte löschen, neue einfügen
    await supabase.from("client_faqs").delete().eq("client_id", clientId);

    if (client_faqs.length > 0) {
      const faqRows = client_faqs.map((f: any) => ({
        client_id: clientId,
        question: f.question,
        answer: f.answer,
        active: f.active ?? true,
      }));

      const { error: faqErr } = await supabase
        .from("client_faqs")
        .insert(faqRows);

      if (faqErr) {
        console.error("client_faqs_insert_failed", faqErr);
        return NextResponse.json(
          { error: "client_faqs_insert_failed", details: faqErr.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("onboarding_unexpected_error", err);
    return NextResponse.json(
      { error: "onboarding_unexpected_error", details: err?.message },
      { status: 500 }
    );
  }
}
