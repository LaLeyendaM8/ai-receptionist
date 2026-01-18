import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseClients";
import { runGptReceptionistFlow } from "@/lib/callflow/gpt-receptionist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return NextResponse.json({ ok: true, route: "/api/gpt-receptionist" });
}

export async function POST(req: Request): Promise<Response> {
  try {
    if (process.env.NODE_ENV === "production") {
      return new Response("Not found", { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as {
      text?: string;
      fromNumber?: string | null;
      toNumber?: string | null;
      clientId?: string | null;
      sessionId?: string | null;
    } | null;

    const supabase = createServiceClient();

    const out = await runGptReceptionistFlow({
      supabase,
      text: body?.text ?? "",
      fromNumber: body?.fromNumber ?? null,
      toNumber: body?.toNumber ?? null,
      clientId: body?.clientId ?? null,
      sessionId: body?.sessionId ?? null,
    });

    // ✅ Always return Response, never a union
    return NextResponse.json(out, { status: out.success ? 200 : 500 });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: "bad_request", details: e?.message ?? String(e) },
      { status: 400 }
    );
  }
}
