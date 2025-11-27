// frontend/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";
import { Sidebar } from "./_components/Sidebar";

type ClientRow = {
  id: string;
  owner_user: string;
  stripe_status: string | null;
  stripe_plan: string | null;
};

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClients();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    redirect("/login");
  }

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, owner_user, stripe_status, stripe_plan")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error || !client) {
    console.error("Error loading client for dashboard", error);
    redirect("/onboarding");
  }

  const stripeStatus = (client as ClientRow).stripe_status;
  const hasActiveSub =
    stripeStatus === "active" || stripeStatus === "trialing";

  // ---- Server Action für direkten Logout ----
  async function logoutAction() {
    "use server";

    const supabase = await createClients();
    await supabase.auth.signOut();

    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1E293B]">
      <div className="flex h-screen">
        {/* Sidebar links */}
        <Sidebar logoutAction={logoutAction} />

        {/* Content rechts */}
        <div className="flex-1 overflow-y-auto">
          {/* Hinweis, falls kein aktives Abo */}
          {!hasActiveSub && (
            <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
              <p className="font-medium">Kein aktives Abonnement</p>
              <p className="text-xs">
                Du hast aktuell noch kein aktives ReceptaAI-Abo. Bitte schließe
                dein Abo über die Landingpage ab.
              </p>
            </div>
          )}

          {/* Dashboard-Content mit 24px Padding (Figma-Spec) */}
          <div className="px-6 py-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
