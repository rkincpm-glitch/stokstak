"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { BarChart3, Calendar, DollarSign } from "lucide-react";

type Item = {
  id: string;
  name: string;
  category: string | null;
  location: string | null;
  type: string | null;
  quantity: number | null;
  purchase_price: number | null;
  purchase_date: string | null; // YYYY-MM-DD
  life_years?: number | null;
  depreciation_percent?: number | null;
};

type VerificationRow = {
  item_id: string | null;
  verified_at: string; // YYYY-MM-DD
};

function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Depreciation model:
 * - User stores depreciation_percent (annual %) and life_years.
 * - We apply declining-balance style: value = cost * (1 - r)^(yearsElapsed)
 * - YearsElapsed is capped to life_years (if provided).
 */
function depreciatedValue(
  cost: number,
  purchaseDate: string,
  asOfDate: string,
  depPercent?: number | null,
  lifeYears?: number | null
) {
  const r = (depPercent ?? 0) / 100;
  if (!purchaseDate || !asOfDate) return cost;
  if (r <= 0) return cost;

  const p = new Date(purchaseDate + "T00:00:00");
  const asOf = new Date(asOfDate + "T00:00:00");
  if (Number.isNaN(p.getTime()) || Number.isNaN(asOf.getTime())) return cost;

  if (asOf <= p) return cost;

  const years = daysBetween(p, asOf) / 365.25;
  const cappedYears = lifeYears && lifeYears > 0 ? Math.min(years, lifeYears) : years;

  const v = cost * Math.pow(1 - r, cappedYears);
  return Math.max(0, v);
}

export default function CompanyReportsPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [lastVerifiedByItem, setLastVerifiedByItem] = useState<Record<string, string>>({});
  const [asOf, setAsOf] = useState<string>(new Date().toISOString().slice(0, 10));

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

      // Inventory
      const { data: itemsData, error: itemsErr } = await supabase
        .from("items")
        .select("id,name,category,location,type,quantity,purchase_price,purchase_date,life_years,depreciation_percent")
        .eq("company_id", companyId)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (itemsErr) {
        setErr(itemsErr.message);
        setItems([]);
        setLastVerifiedByItem({});
        setLoading(false);
        return;
      }
      setItems((itemsData || []) as Item[]);

      // Verifications (latest per item)
      const { data: verData, error: verErr } = await supabase
        .from("stock_verifications")
        .select("item_id, verified_at")
        .eq("company_id", companyId)
        .order("verified_at", { ascending: false });

      if (verErr) {
        // non-fatal: show reports without last-verified
        console.error(verErr);
        setLastVerifiedByItem({});
        setLoading(false);
        return;
      }

      const map: Record<string, string> = {};
      for (const row of (verData || []) as VerificationRow[]) {
        const id = row.item_id || "";
        if (!id) continue;
        if (!map[id]) map[id] = row.verified_at;
      }
      setLastVerifiedByItem(map);

      setLoading(false);
    };

    void run();
  }, [companyId, router]);

  const verificationRows = useMemo(() => {
    return items.map((it) => {
      const last = lastVerifiedByItem[it.id] || null;
      let ageDays: number | null = null;
      if (last) {
        const d = new Date(last + "T00:00:00");
        if (!Number.isNaN(d.getTime())) {
          ageDays = daysBetween(d, new Date());
          ageDays = clamp(ageDays, 0, 100000);
        }
      }
      return { ...it, lastVerified: last, ageDays };
    });
  }, [items, lastVerifiedByItem]);

  const depreciationRows = useMemo(() => {
    return items.map((it) => {
      const cost = Number(it.purchase_price || 0);
      const v = it.purchase_date
        ? depreciatedValue(cost, it.purchase_date, asOf, it.depreciation_percent, it.life_years)
        : cost;

      return {
        id: it.id,
        name: it.name,
        category: it.category || "Uncategorized",
        purchase_date: it.purchase_date || "",
        purchase_price: cost,
        life_years: it.life_years ?? null,
        depreciation_percent: it.depreciation_percent ?? null,
        value_asof: v,
      };
    });
  }, [items, asOf]);

  const totalDepValue = useMemo(() => {
    return depreciationRows.reduce((sum, r) => sum + (Number(r.value_asof) || 0), 0);
  }, [depreciationRows]);

  if (loading) {
    return <div className="text-slate-500">Loading reports…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-700" />
            Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Inventory verification status and depreciation valuation.
          </p>
        </div>

        <Link
          href={`/${companyId}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Back to Home →
        </Link>
      </div>

      {err && (
        <div className="bg-white border rounded-xl p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Last Verified Report */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <div className="text-sm font-semibold text-slate-900">Last Verified</div>
          <div className="text-xs text-slate-500">
            Shows the most recent stock verification on record for each item.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white border-b">
              <tr className="text-left text-xs text-slate-500">
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Last Verified</th>
                <th className="px-4 py-2 text-right">Age (days)</th>
              </tr>
            </thead>
            <tbody>
              {verificationRows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-slate-700">{r.category || "Uncategorized"}</td>
                  <td className="px-4 py-3 text-slate-700">{r.location || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{r.lastVerified || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.ageDays ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Depreciation Report */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-slate-700" />
              Depreciated Value Report
            </div>
            <div className="text-xs text-slate-500">
              Uses purchase price, purchase date, life (years) and annual depreciation percent.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900"
            />
          </div>
        </div>

        <div className="px-4 py-3 text-xs text-slate-500 border-b">
          Total value as of <span className="font-medium text-slate-900">{asOf}</span>:{" "}
          <span className="font-semibold text-slate-900">${totalDepValue.toFixed(2)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white border-b">
              <tr className="text-left text-xs text-slate-500">
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Purchase Date</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-right">Life (yrs)</th>
                <th className="px-4 py-2 text-right">Dep %</th>
                <th className="px-4 py-2 text-right">Value (as of)</th>
              </tr>
            </thead>
            <tbody>
              {depreciationRows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-slate-700">{r.category}</td>
                  <td className="px-4 py-3 text-slate-700">{r.purchase_date || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-700">${(r.purchase_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.life_years ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {r.depreciation_percent ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    ${Number(r.value_asof || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 text-xs text-slate-500">
          If Life / Depreciation % are blank, the report assumes no depreciation for that item.
          Enter these fields when adding/editing an item for accurate valuation.
        </div>
      </section>
    </div>
  );
}
