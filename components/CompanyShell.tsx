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
  const { role } = useCompany();

  return (
    <AppShell companyId={companyId} role={role}>
      {children}
    </AppShell>
  );
}
