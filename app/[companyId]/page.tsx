"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { LayoutGrid, List, Plus, Search } from "lucide-react";

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

type ViewMode = "list" | "tiles";

export default function CompanyHomePage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewMode>("tiles");

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
        .select("id, name, description, category, location, quantity, te_number, type, image_url, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

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
    return <div className="text-slate-500">Loading dashboard…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Inventory Overview</h1>
          <div className="text-sm text-slate-500 mt-1">
            {filtered.length} item(s) across {grouped.length} categories
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/${companyId}/add-item`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Link>

          <div className="flex rounded-lg border bg-white overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={[
                "px-3 py-2 text-sm flex items-center gap-2",
                view === "list" ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50",
              ].join(" ")}
              aria-label="List view"
              type="button"
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => setView("tiles")}
              className={[
                "px-3 py-2 text-sm flex items-center gap-2 border-l",
                view === "tiles" ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50",
              ].join(" ")}
              aria-label="Tiles view"
              type="button"
            >
              <LayoutGrid className="h-4 w-4" />
              Tiles
            </button>
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
        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
      </div>

      {grouped.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-6 text-sm text-slate-500">
          No inventory found for this company.
          <div className="mt-3">
            <Link className="text-emerald-700 hover:underline" href={`/${companyId}/add-item`}>
              Add your first item
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([category, list]) => (
            <section key={category} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{category}</div>
                  <div className="text-xs text-slate-500">{list.length} item(s)</div>
                </div>
                <Link href={`/${companyId}/items`} className="text-xs text-slate-600 hover:text-slate-900">
                  View stock module →
                </Link>
              </div>

              {view === "list" ? (
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
              ) : (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {list.map((it) => (
                    <Link
                      key={it.id}
                      href={`/${companyId}/edit-item/${it.id}`}
                      className="group rounded-xl border bg-white hover:shadow-md transition-shadow overflow-hidden"
                    >
                      <div className="h-36 bg-slate-50 border-b overflow-hidden flex items-center justify-center">
                        {it.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="text-xs text-slate-400">No photo</div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="font-semibold text-slate-900 group-hover:text-emerald-700">{it.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          TE: {it.te_number || "-"} • Qty: {it.quantity ?? 0}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {it.type || "—"} • {it.location || "—"}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
