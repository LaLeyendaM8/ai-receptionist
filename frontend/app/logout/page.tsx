// app/logout/page.tsx
"use client";

import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <button
        onClick={handleLogout}
        className="rounded bg-black text-white px-4 py-2 text-sm"
      >
        Ausloggen
      </button>
    </div>
  );
}
