import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default function CompanyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { companyId: string };
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar companyId={params.companyId} />

      <div className="flex-1 min-w-0">
        <header className="h-16 border-b bg-white flex items-center justify-between px-6">
          <div className="text-sm text-slate-600">
            Workspace: <span className="font-medium text-slate-900">{params.companyId}</span>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
