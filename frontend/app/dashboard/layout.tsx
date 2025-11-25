// frontend/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // 1) User aus Session holen
  const supabase = await createClients();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    // Nicht eingeloggt -> Login
    redirect("/login");
  }

  // 2) Prüfen, ob es einen Client zu diesem User gibt
   // dein Service-/DB-Client
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error) {
    console.error("Error loading client for dashboard", error);
    redirect("/onboarding");
  }

  if (!client) {
    redirect("/onboarding");
  }

  // 3) Client existiert -> Dashboard anzeigen
  return <>{children}</>;
}
