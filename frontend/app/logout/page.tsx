"use client";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      await supabaseBrowser.auth.signOut();
      router.replace("/login");
    })();
  }, [router]);
  return <div className="p-6">Logging out…</div>;
}
