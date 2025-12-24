import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar companyId={companyId} />

      {/* Main content area (offset for fixed sidebar) */}
      <div className="pl-64">
        <header className="h-16 border-b bg-white flex items-center px-6 sticky top-0 z-30">
          <div className="text-sm text-slate-600">
            Workspace: <span className="font-medium text-slate-900">{companyId}</span>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
