"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PurchaseRequestsIndex() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  useEffect(() => {
    router.replace(`/${companyId}/purchase-requests/new`);
  }, [companyId, router]);

  return <div className="text-slate-500">Redirecting…</div>;
}
