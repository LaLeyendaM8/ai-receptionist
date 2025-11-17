// app/admin/layout.tsx
import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const isAuthed = cookieStore.get("admin_auth")?.value === "1";

  if (!isAuthed) {
    redirect("/login");
  }

  return <>{children}</>;
}
