"use client";

import { useEffect } from "react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Auth } from "@supabase/auth-ui-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirectTo = sp.get("redirectTo") || "/calendar-test";

  useEffect(() => {
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        router.push(redirectTo); // nach Login weiter
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [redirectTo, router]);

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-4">Login</h1>
      <Auth
        supabaseClient={supabaseBrowser}
        view="sign_in"   // du kannst auch "magic_link" testen
        appearance={{ theme: ThemeSupa }}
        providers={[]}   // optional: Google/GitHub etc.
        redirectTo={typeof window !== "undefined" ? window.location.origin + "/login?redirectTo=" + encodeURIComponent(redirectTo) : undefined}
      />
      <p className="mt-3 text-sm text-gray-500">
        Tipp: Wenn du über deine <b>loca.lt</b>-Domain eingeloggt bist, funktioniert der Google-Flow.
      </p>
    </div>
  );
}
