"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { ArrowLeft } from "lucide-react";

type Item = { id: string; name: string; category: string | null; location: string | null; type: string | null; quantity: number | null; };
type Ver = { item_id: string | null; verified_at: string; };

export default function LastVerifiedReport() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [lastByItem, setLastByItem] = useState<Record<string, string>>({});

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

      const { data: it, error: itErr } = await supabase
        .from("items")
        .select("id, name, category, location, type, quantity")
        .eq("company_id", companyId)
        .order("name", { ascending: true });

      if (itErr) {
        setErr(itErr.message);
        setItems([]);
        setLastByItem({});
        setLoading(false);
        return;
      }

      const { data: ver, error: vErr } = await supabase
        .from("stock_verifications")
        .select("item_id, verified_at")
        .eq("company_id", companyId)
        .order("verified_at", { ascending: false });

      if (vErr) {
        setErr(vErr.message);
        setItems((it || []) as Item[]);
        setLastByItem({});
        setLoading(false);
        return;
      }

      const map: Record<string, string> = {};
      (ver || []).forEach((r: any) => {
        const itemId = r.item_id ? String(r.item_id) : "";
        if (!itemId) return;
        if (!map[itemId]) map[itemId] = r.verified_at;
      });

      setItems((it || []) as Item[]);
      setLastByItem(map);
      setLoading(false);
    };

    void run();
  }, [companyId, router]);

  const rows = useMemo(() => {
    const today = new Date();
    return items.map((i) => {
      const last = lastByItem[i.id] || null;
      let ageDays: number | null = null;
      if (last) {
        const d = new Date(last + "T00:00:00");
        ageDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      }
      return { ...i, last_verified: last, age_days: ageDays };
    });
  }, [items, lastByItem]);

  if (loading) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/${companyId}/reports`} className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Reports
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mt-2">Last Verified Report</h1>
          <div className="text-sm text-slate-600 mt-1">Most recent physical stock verification per item.</div>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 bg-slate-50">
            <tr className="text-left">
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3">Last Verified</th>
              <th className="px-4 py-3 text-right">Age (days)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                <td className="px-4 py-3">{r.category || "Uncategorized"}</td>
                <td className="px-4 py-3">{r.location || "—"}</td>
                <td className="px-4 py-3">{r.type || "—"}</td>
                <td className="px-4 py-3 text-right">{r.quantity ?? 0}</td>
                <td className="px-4 py-3">{r.last_verified || "—"}</td>
                <td className="px-4 py-3 text-right">{r.age_days ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
