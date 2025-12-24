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
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar companyId={companyId} />

      <div className="flex-1 min-w-0">
        <header className="h-16 border-b bg-white flex items-center px-6">
          <div className="text-sm text-slate-600">
            Company: <span className="font-medium text-slate-900">{companyId}</span>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
