import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";

export async function POST(req: Request) {
  const supabase = createClients();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const userId = auth.user.id;

  const body = await req.json(); // { client: {...}, hours: [...], services: [...] }

  // 1) Client upsert (owner_user = userId)
  const { data: client } = await supabase
    .from("clients")
    .upsert({ ...body.client, owner_user: userId }, { onConflict: "owner_user" })
    .select("id")
    .single();

  // 2) Öffnungszeiten upsert (client_id,weekday unique)
  for (const h of body.hours ?? []) {
    await supabase
      .from("business_hours")
      .upsert({ ...h, client_id: client!.id }, { onConflict: "client_id,weekday" });
  }

  // 3) Services upsert (client_id,name unique)
  for (const s of body.services ?? []) {
    await supabase
      .from("services")
      .upsert({ ...s, client_id: client!.id }, { onConflict: "client_id,name" });
  }

  // 4) FAQs upsert
for (const f of body.faqs || []) {
  await supabase
    .from("client_faqs")
    .upsert({ ...f, client_id: client!.id }, { onConflict: "client_id,question" });
}


  return NextResponse.json({ ok: true });
}
