// app/admin/settings/page.tsx
import { createClients } from "@/lib/supabaseClients";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/authServer";

export const dynamic = "force-dynamic";

async function getClient() {
  const supabase = createClients();

  
  const userId = await getCurrentUserId(supabase);
  if(!userId){
    return null;
  }
  const { data: client } = await supabase
    .from("clients")
    .select("id, ai_enabled")
    .eq("owner_user", userId)
    .single();

  return client;
}

// 🔹 Server Action zum Umschalten
export async function toggleAIAction() {
  "use server";

  const supabase = createClients();
  const userId = await getCurrentUserId(supabase);
           if (!userId) {
             throw new Error("unauthenticated");
           }
  

  const { data: client } = await supabase
    .from("clients")
    .select("id, ai_enabled")
    .eq("owner_user", userId)
    .single();

  if (!client) return;

  await supabase
    .from("clients")
    .update({ ai_enabled: !client.ai_enabled })
    .eq("id", client.id);

  // Seite neu laden, damit der Status-Text sich aktualisiert
  revalidatePath("/dashboard/settings");
}

export default async function SettingsPage() {
  const client = await getClient();
  const aiEnabled = client?.ai_enabled ?? false;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>

      <form action={toggleAIAction}>
        <button
          type="submit"
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          {aiEnabled ? "AI deaktivieren" : "AI aktivieren"}
        </button>
      </form>

      <p className="text-gray-200 mt-4">
        Status:{" "}
        <span className={aiEnabled ? "text-green-400" : "text-red-400"}>
          {aiEnabled ? "Aktiviert" : "Deaktiviert"}
        </span>
      </p>
    </div>
  );
}
