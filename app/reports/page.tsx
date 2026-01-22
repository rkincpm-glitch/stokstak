"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/lib/useCompany";

/**
 * Backwards-compatible route.
 * The application is company-scoped, so we redirect to the selected company's reports.
 */
export default function ReportsRedirectPage() {
  const router = useRouter();
  const { companyId, loading } = useCompany();

  useEffect(() => {
    if (loading) return;

    if (!companyId) {
      router.replace("/select-company");
      return;
    }

    router.replace(`/${companyId}/reports`);
  }, [companyId, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Loading reports...
    </div>
  );
}
