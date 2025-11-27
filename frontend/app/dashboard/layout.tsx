// frontend/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

type ClientRow = {
  id: string;
  owner_user: string;
  stripe_status: string | null;
  stripe_plan: string | null;
};

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

  if (error) {
    console.error("Error loading client for dashboard", error);
    redirect("/onboarding");
  }

  if (!client) {
    redirect("/onboarding");
  }

  const stripeStatus = (client as ClientRow).stripe_status;
  const hasActiveSub =
    stripeStatus === "active" || stripeStatus === "trialing";

  return (
    <main className="min-h-screen">
      {!hasActiveSub && (
        <div className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Kein aktives Abo</p>
          <p className="mt-1">
            Du hast aktuell kein aktives ReceptaAI-Abo.{" "}
            <a href="/pricing" className="font-medium underline">
              Hier kannst du dein Abo abschließen oder erneuern.
            </a>
          </p>
        </div>
      )}

      {children}
    </main>
  );
}