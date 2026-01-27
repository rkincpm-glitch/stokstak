"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useCompany } from "@/lib/useCompany";
import { ArrowLeft, Download } from "lucide-react";
import { exportToExcel, exportToPdf } from "@/lib/reportExport";

type Item = {
  id: string;
  name: string;
  purchase_price: number | null;
  purchase_date: string | null;
  life_years: number | null;
  depreciation_percent: number | null; // percent per year (0-100)
};

function yearsBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

export default function DepreciationReport() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const { companyName } = useCompany();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr(null);

      const supabase = createSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("items")
        .select("id, name, purchase_price, purchase_date, life_years, depreciation_percent")
        .eq("company_id", companyId)
        .order("name", { ascending: true });

      if (error) {
        setErr(error.message);
        setItems([]);
      } else {
        setItems((data || []) as Item[]);
      }

      setLoading(false);
    };

    void run();
  }, [companyId, router]);

  const rows = useMemo(() => {
    const asOfDate = new Date(asOf + "T00:00:00");

    return items.map((i) => {
      const price = i.purchase_price ?? 0;
      if (!i.purchase_date || !price) {
        return { ...i, value_as_of: null, years: null };
      }

      const pd = new Date(i.purchase_date + "T00:00:00");
      const yrs = Math.max(0, yearsBetween(pd, asOfDate));
      const life = i.life_years ?? null;
      const ratePct = i.depreciation_percent ?? null;

      let effectiveYears = yrs;
      if (life !== null) effectiveYears = Math.min(effectiveYears, Math.max(0, life));

      // percent per year straight-line (e.g., 20 means 20% / yr)
      let value = price;

      if (ratePct !== null) {
        const rate = Math.max(0, Number(ratePct)) / 100;
        value = price * Math.max(0, 1 - rate * effectiveYears);
      } else if (life !== null && life > 0) {
        // fallback to straight-line to zero over life
        value = price * Math.max(0, 1 - effectiveYears / life);
      }

      return { ...i, years: yrs, value_as_of: Number.isFinite(value) ? value : null };
    });
  }, [items, asOf]);

  const exportExcel = async () => {
    await exportToExcel(
      "depreciation.xlsx",
      rows,
      [
        { header: "Item", value: (r) => r.name },
        { header: "Purchase Price", value: (r) => r.purchase_price ?? "" },
        { header: "Purchase Date", value: (r) => r.purchase_date ?? "" },
        { header: "Life (years)", value: (r) => r.life_years ?? "" },
        { header: "Depreciation %", value: (r) => r.depreciation_percent ?? "" },
        { header: `Value as of ${asOf}`, value: (r) => r.value_as_of ?? "" },
      ]
    );
  };

  const exportPdf = async () => {
    await exportToPdf(
      "depreciation.pdf",
      `Depreciation (as of ${asOf})`,
      rows,
      [
        { header: "Item", value: (r) => r.name },
        { header: "Purchase Price", value: (r) => r.purchase_price ?? "" },
        { header: "Purchase Date", value: (r) => r.purchase_date ?? "" },
        { header: "Life", value: (r) => r.life_years ?? "" },
        { header: "Dep %", value: (r) => r.depreciation_percent ?? "" },
        { header: "Value", value: (r) => r.value_as_of ?? "" },
      ]
    );
  };

  if (loading) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href={`/${companyId}/reports`} className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Reports
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 mt-2">Depreciated Value Report</h1>
          <div className="text-sm text-slate-600 mt-1">Value as-of a selected date (company-scoped).</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg bg-white text-slate-900 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
          <button
            onClick={exportPdf}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg bg-white text-slate-900 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>

          <label className="text-sm text-slate-600">As of</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white text-slate-900"
          />
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 bg-slate-50">
            <tr className="text-left">
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Purchase Price</th>
              <th className="px-4 py-3">Purchase Date</th>
              <th className="px-4 py-3 text-right">Life (yrs)</th>
              <th className="px-4 py-3 text-right">Dep% / yr</th>
              <th className="px-4 py-3 text-right">Value as of</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                <td className="px-4 py-3 text-right">{r.purchase_price ?? "—"}</td>
                <td className="px-4 py-3">{r.purchase_date ?? "—"}</td>
                <td className="px-4 py-3 text-right">{r.life_years ?? "—"}</td>
                <td className="px-4 py-3 text-right">{r.depreciation_percent ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {r.value_as_of === null ? "—" : r.value_as_of.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-slate-600">
        Note: If <span className="font-medium">Dep% / yr</span> is missing, the report falls back to straight-line depreciation to zero over <span className="font-medium">Life (yrs)</span>.
      </div>
    </div>
  );
}
