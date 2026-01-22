"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { Plus, Search, X, ClipboardCheck, Settings2, Pencil } from "lucide-react";

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

type Verification = {
  id: string;
  verified_at: string;
  verified_qty: number;
  notes: string | null;
  created_at: string | null;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function ItemsPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 250);

  const [active, setActive] = useState<Item | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [verLoading, setVerLoading] = useState(false);

  const [showVerify, setShowVerify] = useState(false);
  const [verifyDate, setVerifyDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [verifyQty, setVerifyQty] = useState<number>(0);
  const [verifyNotes, setVerifyNotes] = useState<string>("");

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const loadItems = async () => {
    setLoading(true);
    setError(null);

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

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Realtime: reflect inventory changes across users
  useEffect(() => {
    const channel = supabase
      .channel(`items:${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `company_id=eq.${companyId}` },
        (payload) => {
          // Minimal strategy: update local list without a full reload
          const row = payload.new as Partial<Item> & { id?: string };
          const old = payload.old as Partial<Item> & { id?: string };

          setItems((prev) => {
            if (payload.eventType === "DELETE") {
              const id = old?.id;
              if (!id) return prev;
              return prev.filter((x) => x.id !== id);
            }
            if (!row?.id) return prev;
            const idx = prev.findIndex((x) => x.id === row.id);
            if (idx === -1) {
              return [row as Item, ...prev];
            }
            const next = [...prev];
            next[idx] = { ...next[idx], ...(row as Item) };
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, supabase]);

  // Auto-open item if ?open=<id> was passed
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("open");
    if (!id) return;
    const found = items.find((i) => i.id === id);
    if (found) setActive(found);
  }, [items]);

  const filtered = useMemo(() => {
    const s = qDebounced.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => {
      const hay = `${i.name} ${i.te_number ?? ""} ${i.category ?? ""} ${i.location ?? ""} ${i.type ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [items, qDebounced]);

  const openItem = async (it: Item) => {
    setActive(it);
    setShowVerify(false);
    setVerifyQty(it.quantity ?? 0);
    setVerifyNotes("");
    setVerifications([]);
    setVerLoading(true);

    const { data, error } = await supabase
      .from("stock_verifications")
      .select("id, verified_at, verified_qty, notes, created_at")
      .eq("company_id", companyId)
      .eq("item_id", it.id)
      .order("verified_at", { ascending: false })
      .limit(10);

    if (!error) setVerifications((data || []) as Verification[]);
    setVerLoading(false);
  };

  const submitVerification = async () => {
    if (!active) return;

    const { error } = await supabase.from("stock_verifications").insert({
      company_id: companyId,
      item_id: active.id,
      verified_at: verifyDate,
      verified_qty: verifyQty,
      notes: verifyNotes || null,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setShowVerify(false);
    await openItem(active); // refresh history
  };

  if (loading) {
    return <div className="text-slate-500">Loading inventory…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Stock</h1>
          <div className="text-sm text-slate-500 mt-1">{filtered.length} item(s)</div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/${companyId}/settings`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm text-slate-700 hover:bg-slate-50"
          >
            <Settings2 className="h-4 w-4" />
            Manage Types / Categories / Locations
          </Link>

          <Link
            href={`/${companyId}/add-item`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items…"
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((it) => (
          <button
            key={it.id}
            onClick={() => void openItem(it)}
            className="text-left rounded-xl border bg-white hover:shadow-md transition-shadow overflow-hidden"
          >
            <div className="h-32 bg-slate-50 border-b overflow-hidden flex items-center justify-center">
              {it.image_url ? (
                <Image
                  src={it.image_url}
                  alt={it.name}
                  width={800}
                  height={400}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-xs text-slate-400">No photo</div>
              )}
            </div>
            <div className="p-3">
              <div className="font-semibold text-slate-900">{it.name}</div>
              <div className="text-xs text-slate-500 mt-1">
                TE: {it.te_number || "-"} • Qty: {it.quantity ?? 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {it.category || "Uncategorized"} • {it.location || "—"} • {it.type || "—"}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Modal */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setActive(null)} aria-hidden="true" />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="p-4 border-b flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">{active.name}</div>
                <div className="text-sm text-slate-500 mt-1">
                  {active.category || "Uncategorized"} • {active.location || "—"} • {active.type || "—"}
                </div>
              </div>
              <button className="p-2 rounded-lg hover:bg-slate-100" onClick={() => setActive(null)} aria-label="Close">
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-slate-50 overflow-hidden">
                <div className="h-48 flex items-center justify-center">
                  {active.image_url ? (
                    <Image
                      src={active.image_url}
                      alt={active.name}
                      width={1200}
                      height={600}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-sm text-slate-400">No photo</div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-slate-500">Quantity</div>
                  <div className="text-xl font-semibold text-slate-900">{active.quantity ?? 0}</div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs text-slate-500">TE #</div>
                  <div className="text-sm font-medium text-slate-900">{active.te_number || "-"}</div>
                </div>

                {active.description && (
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-slate-500">Description</div>
                    <div className="text-sm text-slate-800 mt-1">{active.description}</div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/${companyId}/edit-item/${active.id}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit item
                  </Link>

                  <button
                    onClick={() => setShowVerify((v) => !v)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    {showVerify ? "Close verification" : "Verify stock"}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t space-y-4">
              {showVerify && (
                <div className="rounded-xl border p-4 bg-slate-50">
                  <div className="font-semibold text-slate-900">Record physical verification</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Verification date</label>
                      <input
                        type="date"
                        value={verifyDate}
                        onChange={(e) => setVerifyDate(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Verified quantity</label>
                      <input
                        type="number"
                        value={verifyQty}
                        onChange={(e) => setVerifyQty(Number(e.target.value))}
                        className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Comments</label>
                      <textarea
                        value={verifyNotes}
                        onChange={(e) => setVerifyNotes(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                        rows={3}
                        placeholder="Notes from the physical verification…"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button onClick={() => setShowVerify(false)} className="px-3 py-2 rounded-lg border bg-white text-sm">
                      Cancel
                    </button>
                    <button
                      onClick={() => void submitVerification()}
                      className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                    >
                      Save verification
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="font-semibold text-slate-900">Verification history</div>
                {verLoading ? (
                  <div className="text-sm text-slate-500 mt-2">Loading history…</div>
                ) : verifications.length === 0 ? (
                  <div className="text-sm text-slate-500 mt-2">No verification records yet.</div>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr className="text-left">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3 text-right">Qty</th>
                          <th className="py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verifications.map((v) => (
                          <tr key={v.id} className="border-t">
                            <td className="py-2 pr-3">{v.verified_at}</td>
                            <td className="py-2 pr-3 text-right">{v.verified_qty}</td>
                            <td className="py-2 text-slate-700">{v.notes || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
