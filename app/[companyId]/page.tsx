"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { ChevronDown, ChevronRight, LayoutGrid, List, Plus, Search, SlidersHorizontal } from "lucide-react";

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

type ViewMode = "tiles" | "list";
type SortMode = "recent" | "name" | "qty_desc" | "qty_asc";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function CompanyHomePage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewMode>("tiles"); // default tiles
  const [sort, setSort] = useState<SortMode>("recent");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const locations = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.location && set.add(i.location));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const types = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.type && set.add(i.type));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = items;

    if (filterLocation !== "all") {
      list = list.filter((i) => (i.location || "") === filterLocation);
    }
    if (filterType !== "all") {
      list = list.filter((i) => (i.type || "") === filterType);
    }
    if (s) {
      list = list.filter((i) => {
        const hay = `${i.name} ${i.te_number ?? ""} ${i.category ?? ""} ${i.location ?? ""} ${i.type ?? ""}`.toLowerCase();
        return hay.includes(s);
      });
    }

    // sorting
    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sort === "qty_desc") {
      sorted.sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0));
    } else if (sort === "qty_asc") {
      sorted.sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0));
    } // recent already via query

    return sorted;
  }, [items, q, sort, filterLocation, filterType]);

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

  const toggleCategory = (category: string) => {
    setExpanded((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    grouped.forEach(([c]) => (next[c] = true));
    setExpanded(next);
  };

  const collapseAll = () => {
    setExpanded({});
  };

  if (loading) {
    return <div className="text-slate-500">Loading…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Home</h1>
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

          <div className="flex rounded-lg border bg-white overflow-hidden">
            <button
              onClick={() => setView("tiles")}
              className={cx(
                "px-3 py-2 text-sm flex items-center gap-2",
                view === "tiles" ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Tiles
            </button>
            <button
              onClick={() => setView("list")}
              className={cx(
                "px-3 py-2 text-sm flex items-center gap-2 border-l",
                view === "list" ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <List className="h-4 w-4" />
              List
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search inventory…"
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="inline-flex items-center gap-2 text-slate-600">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </div>

          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white text-slate-900"
          >
            <option value="all">All locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white text-slate-900"
          >
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="px-3 py-2 border rounded-lg bg-white text-slate-900"
          >
            <option value="recent">Sort: Recent</option>
            <option value="name">Sort: Name</option>
            <option value="qty_desc">Sort: Qty (high → low)</option>
            <option value="qty_asc">Sort: Qty (low → high)</option>
          </select>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={expandAll} className="text-slate-700 hover:text-slate-900">
              Expand all
            </button>
            <span className="text-slate-300">|</span>
            <button onClick={collapseAll} className="text-slate-700 hover:text-slate-900">
              Collapse all
            </button>
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>

      {grouped.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-6 text-sm text-slate-500">
          No items found.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([category, list]) => {
            const isOpen = Boolean(expanded[category]);
            return (
              <div key={category} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-4 py-3 bg-slate-50 border-b flex items-center justify-between text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{category}</div>
                    <div className="text-xs text-slate-500">{list.length} item(s)</div>
                  </div>
                  <div className="text-slate-600">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="p-4">
                    {view === "tiles" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {list.map((it) => (
                          <Link
                            key={it.id}
                            href={`/${companyId}/items?open=${it.id}`}
                            className="group rounded-xl border bg-white hover:shadow-md transition-shadow overflow-hidden"
                          >
                            <div className="h-32 bg-slate-50 border-b overflow-hidden flex items-center justify-center">
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
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-white border-b">
                            <tr className="text-left text-xs text-slate-500">
                              <th className="px-3 py-2">Item</th>
                              <th className="px-3 py-2">TE #</th>
                              <th className="px-3 py-2">Type</th>
                              <th className="px-3 py-2">Location</th>
                              <th className="px-3 py-2 text-right">Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((it) => (
                              <tr key={it.id} className="border-t">
                                <td className="px-3 py-3">
                                  <div className="font-medium text-slate-900">{it.name}</div>
                                  <div className="text-xs text-slate-500">{it.description || ""}</div>
                                </td>
                                <td className="px-3 py-3">{it.te_number || "-"}</td>
                                <td className="px-3 py-3">{it.type || "-"}</td>
                                <td className="px-3 py-3">{it.location || "-"}</td>
                                <td className="px-3 py-3 text-right">{it.quantity ?? 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
