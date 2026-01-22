"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ClipboardCheck, TrendingDown } from "lucide-react";

function Card({ title, desc, href, icon: Icon }: any) {
  return (
    <Link href={href} className="rounded-2xl border bg-white p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <div className="font-semibold text-slate-900">{title}</div>
          <div className="text-sm text-slate-600 mt-1">{desc}</div>
        </div>
      </div>
    </Link>
  );
}

export default function ReportsHome() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <div className="text-sm text-slate-600 mt-1">Operational and financial visibility by company.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          title="Last Verified"
          desc="Shows the most recent physical verification date for each item."
          href={`/${companyId}/reports/last-verified`}
          icon={ClipboardCheck}
        />
        <Card
          title="Depreciated Value"
          desc="Calculates value as-of a selected date using purchase data and depreciation settings."
          href={`/${companyId}/reports/depreciation`}
          icon={TrendingDown}
        />
      </div>
    </div>
  );
}
