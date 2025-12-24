"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar, { MobileSidebar } from "@/components/Sidebar";

export default function CompanyShell({
  companyId,
  children,
}: {
  companyId: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <Sidebar companyId={companyId} />

      {/* Mobile drawer */}
      <MobileSidebar companyId={companyId} open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content area: padding left only on md+ */}
      <div className="md:pl-64">
        <header className="h-16 border-b bg-white flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-30">
          <button
            type="button"
            className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-slate-700" />
          </button>

          <div className="text-sm text-slate-600 truncate">
            Workspace: <span className="font-medium text-slate-900">{companyId}</span>
          </div>
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
