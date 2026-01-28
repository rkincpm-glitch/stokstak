"use client";

import { ReactNode, useState } from "react";
import { Menu, X } from "lucide-react";
import Sidebar, { AppRole } from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import SwitchUserButton from "@/components/SwitchUserButton";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function AppShell({
  companyId,
  companyName,
  role,
  headerRight,
  children,
}: {
  companyId: string;
  companyName?: string | null;
  role: AppRole | null;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile drawer */}
      <div className={cx("fixed inset-0 z-40 lg:hidden", open ? "block" : "hidden")}>
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        <div className="absolute inset-y-0 left-0 w-72 shadow-xl">
          <Sidebar companyId={companyId} role={role} onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:left-0 lg:w-72">
          <Sidebar companyId={companyId} role={role} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 lg:pl-72">
          <header className="sticky top-0 z-30 h-16 border-b bg-white flex items-center px-4 sm:px-6">
            <button
              className="lg:hidden inline-flex items-center justify-center rounded-lg border px-2 py-2 text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="ml-3 text-sm text-slate-600 truncate">
              Company: <span className="font-medium text-slate-900">{companyName || companyId}</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <SwitchUserButton />
              {headerRight}
            </div>
          </header>

          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
