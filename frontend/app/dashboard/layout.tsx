// frontend/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";
import { DashboardChrome } from "./_components/DashboardChrome";

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
  <DashboardChrome logoutAction={logoutAction} hasActiveSub={hasActiveSub}>
    {children}
  </DashboardChrome>
);
}
