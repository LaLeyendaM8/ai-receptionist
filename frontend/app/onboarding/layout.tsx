// app/onboarding/layout.tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/authServer";
import { createClients } from "@/lib/supabaseClients";

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (process.env.ENABLE_TEST !== "true") {
    const supabase  = await createClients();
    const userId = await getCurrentUserId(supabase);

    if (!userId) {
      redirect("/login");
    }
  }

  return <>{children}</>;
}
