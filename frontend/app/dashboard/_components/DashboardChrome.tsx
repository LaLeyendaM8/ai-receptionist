"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";

type Props = {
  children: React.ReactNode;
  logoutAction: () => Promise<void>;
  hasActiveSub: boolean;
};

export function DashboardChrome({ children, logoutAction, hasActiveSub }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1E293B]">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar logoutAction={logoutAction} />
        </div>

        {/* Mobile Drawer Overlay */}
        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              aria-label="Sidebar schließen"
              className="absolute inset-0 bg-black/30"
              onClick={() => setOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-[280px] bg-white shadow-xl">
              {/* optional: close button oben */}
              <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
                <span className="text-sm font-semibold text-[#1E293B]">Menü</span>
                <button
                  aria-label="Schließen"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 hover:bg-[#F8FAFC]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Sidebar selbst */}
              <div className="h-[calc(100%-52px)]">
                <Sidebar logoutAction={logoutAction} />
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1">
          {/* Mobile Topbar */}
          <div className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/80 backdrop-blur md:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                aria-label="Menü öffnen"
                onClick={() => setOpen(true)}
                className="rounded-lg p-2 hover:bg-[#F8FAFC]"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="text-sm font-semibold">ReceptaAI</div>

              {/* Spacer rechts (damit Logo zentriert bleibt) */}
              <div className="h-9 w-9" />
            </div>

            {/* Abo-Hinweis bleibt sichtbar */}
            {!hasActiveSub && (
              <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-medium">Kein aktives Abonnement</p>
                <p className="text-xs">
                  Bitte schließe dein Abo über die Landingpage ab.
                </p>
              </div>
            )}
          </div>

          {/* Desktop Abo-Hinweis */}
          {!hasActiveSub && (
            <div className="hidden md:block border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
              <p className="font-medium">Kein aktives Abonnement</p>
              <p className="text-xs">
                Bitte schließe dein Abo über die Landingpage ab.
              </p>
            </div>
          )}

          {/* Padding responsive */}
          <div className="px-4 py-5 sm:px-6 sm:py-6">{children}</div>
        </div>
      </div>
    </main>
  );
}