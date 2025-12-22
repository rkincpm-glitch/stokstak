"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useCompany } from "@/lib/useCompany";
import { ArrowLeft, Plus, Search } from "lucide-react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  location: string | null;
  quantity: number | null;
  te_number: string | null;
  type: string | null;
  created_at: string | null;
};

export default function ItemsPage() {
  const router = useRouter();
  const { loading: companyLoading, companyId } = useCompany();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (companyLoading) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyLoading, companyId]);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.replace("/auth");
      return;
    }

    if (!companyId) {
      setLoading(false);
      setItems([]);
      return;
    }

    const { data, error } = await supabase
      .from("items")
      .select("id, name, description, category, location, quantity, te_number, type, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setItems((data || []) as Item[]);
    }

    setLoading(false);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => {
      const hay = `${i.name} ${i.te_number ?? ""} ${i.category ?? ""} ${i.location ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [items, q]);

  const grouped = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of filtered) {
      const key = (it.category || "Uncategorized").trim() || "Uncategorized";
      const arr = m.get(key) || [];
      arr.push(it);
      m.set(key, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (loading || companyLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading inventory...</div>;
  }

  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white border rounded-xl p-4 text-sm text-slate-700 max-w-md w-full">
          No company selected.
          <div className="mt-3">
            <Link href="/select-company" className="text-emerald-700 hover:underline">
              Select company
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/${companyId}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/${companyId}/add-item`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items, TE#, category, location"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
          <div className="mt-2 text-xs text-slate-500">{filtered.length} item(s)</div>
        </div>

        {grouped.length === 0 ? (
          <div className="bg-white rounded-xl border shadow-sm p-4 text-sm text-slate-500">No items found.</div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([category, list]) => (
              <section key={category} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b">
                  <div className="text-sm font-semibold text-slate-900">{category}</div>
                  <div className="text-xs text-slate-500">{list.length} item(s)</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white border-b">
                      <tr className="text-left text-xs text-slate-500">
                        <th className="px-4 py-2">Item</th>
                        <th className="px-4 py-2">TE #</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Location</th>
                        <th className="px-4 py-2 text-right">Qty</th>
                        <th className="px-4 py-2 text-right">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{it.name}</div>
                            {it.description && <div className="text-xs text-slate-500">{it.description}</div>}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{it.te_number || "-"}</td>
                          <td className="px-4 py-3 text-slate-700">{it.type || "-"}</td>
                          <td className="px-4 py-3 text-slate-700">{it.location || "-"}</td>
                          <td className="px-4 py-3 text-right">{it.quantity ?? 0}</td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/${companyId}/edit-item/${it.id}`} className="text-emerald-700 hover:text-emerald-900">
                              Edit →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
