// app/dashboard/layout.tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/authServer";
import { createClients } from "@/lib/supabaseClients";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // 1. User check (inkl. DEV_USER_ID, wenn ENABLE_TEST = "true")
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect("/login");
  }

  // 2. Prüfen, ob es einen Client für diesen User gibt
  const supabase = createClients();

  const { data: client, error } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_user", userId)
    .maybeSingle();

  // Optional: Logging, falls irgendwas schiefgeht
  if (error) {
    console.error("Error loading client for dashboard", error);
    // Du kannst hier auch eine Fehler-Seite bauen,
    // aber für MVP ist Redirect zu /onboarding okay:
    redirect("/onboarding");
  }

  // 3. Kein Client → Onboarding
  if (!client) {
    redirect("/onboarding");
  }

  // 4. Client existiert → Dashboard ganz normal rendern
  return <>{children}</>;
}
