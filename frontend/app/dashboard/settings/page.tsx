// app/dashboard/settings/page.tsx
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClientTyped } from "@/lib/supabaseServer";
import { getCurrentUserId } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// --- Hilfsfunktion: Client des eingeloggten Users holen ---
async function getClient() {
  const supabase = await createServerClientTyped();

  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    redirect("/login");
  }

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, ai_enabled")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error) {
    console.error("[SETTINGS] getClient error", error);
  }

  return client;
}

// --- Server-Action: AI an/aus schalten ---
export async function toggleAIAction() {
  "use server";

  const supabase = await createServerClientTyped();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    redirect("/login");
  }

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, ai_enabled")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error || !client) {
    console.error("[SETTINGS] toggleAIAction get client error", error);
    return;
  }

  const { error: updErr } = await supabase
    .from("clients")
    .update({ ai_enabled: !client.ai_enabled })
    .eq("id", client.id);

  if (updErr) {
    console.error("[SETTINGS] toggleAIAction update error", updErr);
    return;
  }

  // Seite neu laden, damit Status sofort aktualisiert wird
  revalidatePath("/dashboard/settings");
}

// --- Page-Komponente ---
export default async function SettingsPage() {
  const client = await getClient();
  const aiEnabled = client?.ai_enabled ?? false;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>

      <form action={toggleAIAction}>
        <button
          type="submit"
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          {aiEnabled ? "AI deaktivieren" : "AI aktivieren"}
        </button>
      </form>

      <p className="text-gray-700 mt-4">
        Status:{" "}
        <span
          className={
            aiEnabled ? "text-green-600 font-semibold" : "text-red-600 font-semibold"
          }
        >
          {aiEnabled ? "Aktiviert" : "Deaktiviert"}
        </span>
      </p>
    </div>
  );
}
