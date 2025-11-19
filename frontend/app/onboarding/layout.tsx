// app/onboarding/layout.tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/authServer";

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (process.env.ENABLE_TEST !== "true") {
    const userId = await getCurrentUserId();

    if (!userId) {
      redirect("/login");
    }
  }

  return <>{children}</>;
}
