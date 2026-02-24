"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  PhoneCall,
  CalendarDays,
  Settings,
  LogOut,
  ClipboardList, // ✅ neu
} from "lucide-react";

type SidebarProps = {
  logoutAction: () => Promise<void>;
};

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/calls", label: "Calls", icon: PhoneCall },
  { href: "/dashboard/appointments", label: "Appointments", icon: CalendarDays },
  // ✅ Clients raus
  { href: "/dashboard/handoffs", label: "Handoffs", icon: ClipboardList }, // ✅ neu
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ logoutAction }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[260px] flex-col border-r border-[#E2E8F0] bg-white">
      {/* Logo-Bereich */}
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]/10">
          <Image
            src="/branding/ReceptaAI-logo-icon.svg"
            alt="ReceptaAI Logo"
            width={28}
            height={28}
          />
        </div>
        <span className="text-base font-semibold text-[#1E293B]">
          ReceptaAI
        </span>
      </div>

      {/* Navigation */}
      <nav className="mt-2 flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isDashboardRoot = item.href === "/dashboard";
          const active = isDashboardRoot
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-[#3B82F6] text-white shadow-sm"
                  : "text-[#64748B] hover:bg-[#F8FAFC]",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout unten */}
      <div className="border-t border-[#E2E8F0] px-3 py-4">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
