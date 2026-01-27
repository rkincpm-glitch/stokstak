"use client";

import { ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { useCompany } from "@/lib/useCompany";

export default function CompanyShell({
  companyId,
  children,
}: {
  companyId: string;
  children: ReactNode;
}) {
  const { role, companyName } = useCompany();

  return (
    <AppShell companyId={companyId} companyName={companyName} role={role}>
      {children}
    </AppShell>
  );
}
