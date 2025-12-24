"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { X, Plus, Search, SlidersHorizontal } from "lucide-react";

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

function ItemModal({
  companyId,
  item,
  onClose,
}: {
  companyId: string;
  item: Item;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
            <div>
              <div className="text-sm font-semibold text-slate-900">{item.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                TE: {item.te_number || "-"} • Qty: {item.quantity ?? 0}
              </div>
            </div>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-slate-100"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-slate-50 overflow-hidden flex items-center justify-center min-h-[220px]">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="text-sm text-slate-400">No image</div>
              )}
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl border bg-white">
                  <div className="text-xs text-slate-500">Category</div>
                  <div className="font-medium text-slate-900 mt-1">{item.category || "Uncategorized"}</div>
                </div>
                <div className="p-3 rounded-xl border bg-white">
                  <div className="text-xs text-slate-500">Type</div>
                  <div className="font-medium text-slate-900 mt-1">{item.type || "—"}</div>
                </div>
                <div className="p-3 rounded-xl border bg-white">
                  <div className="text-xs text-slate-500">Location</div>
                  <div className="font-medium text-slate-900 mt-1">{item.location || "—"}</div>
                </div>
                <div className="p-3 rounded-xl border bg-white">
                  <div className="text-xs text-slate-500">Quantity</div>
                  <div className="font-medium text-slate-900 mt-1">{item.quantity ?? 0}</div>
                </div>
              </div>

              {item.description ? (
                <div className="p-3 rounded-xl border bg-white">
                  <div className="text-xs text-slate-500">Description</div>
                  <div className="text-sm text-slate-900 mt-1 whitespace-pre-wrap">{item.description}</div>
                </div>
              ) : null}

              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/${companyId}/edit-item/${item.id}`}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                >
                  Edit Item
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg border bg-white text-sm font-medium hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ItemsPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const supabase = createSupabaseBrowserClient();

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.replace("/auth");
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

    void load();
  }, [companyId, router]);

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

  if (loading) {
    return <div className="text-slate-500">Loading inventory…</div>;
  }

  return (
    <div className="space-y-5">
      {selected && <ItemModal companyId={companyId} item={selected} onClose={() => setSelected(null)} />}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Stock</h1>
          <div className="text-sm text-slate-500 mt-1">{filtered.length} item(s)</div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/${companyId}/add-item`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Link>

          <div className="relative">
            <Link
              href={`/${companyId}/settings`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm font-medium hover:bg-slate-50"
              title="Manage types, categories and locations"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Manage Master Data
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, TE#, category, location, type"
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
                      <tr
                        key={it.id}
                        className="border-t hover:bg-slate-50 cursor-pointer"
                        onClick={() => setSelected(it)}
                      >
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
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
