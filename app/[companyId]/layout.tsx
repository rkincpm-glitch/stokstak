import type { ReactNode } from "react";
import CompanyShell from "@/components/CompanyShell";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  return <CompanyShell companyId={companyId}>{children}</CompanyShell>;
}
