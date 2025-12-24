"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useCompany } from "@/lib/useCompany";
import { Plus, Search } from "lucide-react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  location: string | null;
  quantity: number | null;
  te_number: string | null;
  type: string | null;
  image_url: string | null;
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
    if (companyLoading) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyLoading, companyId]);

  const load = async () => {
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();

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
      .select("id, name, description, category, location, quantity, te_number, type, image_url, created_at")
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
      const hay = `${i.name} ${i.te_number ?? ""} ${i.category ?? ""} ${i.location ?? ""} ${i.type ?? ""}`.toLowerCase();
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
    return <div className="text-slate-500">Loading inventory…</div>;
  }

  if (!companyId) {
    return (
      <div className="bg-white border rounded-xl p-4 text-sm text-slate-700 max-w-md">
        No company selected.
        <div className="mt-3">
          <Link href="/select-company" className="text-emerald-700 hover:underline">
            Select company
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Stock Module</h1>
          <div className="text-sm text-slate-500 mt-1">{filtered.length} item(s)</div>
        </div>

        <Link
          href={`/${companyId}/add-item`}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </Link>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items, TE#, category, location, type"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
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
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg border bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                              {it.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="text-[10px] text-slate-400">No photo</div>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{it.name}</div>
                              {it.description && <div className="text-xs text-slate-500">{it.description}</div>}
                            </div>
                          </div>
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
    </div>
  );
}
