"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { ArrowLeft, Save } from "lucide-react";

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
  purchase_price: number | null;
  purchase_date: string | null;
  useful_life_years: number | null;
  depreciation_rate: number | null;
};

export default function EditItemCompanyPage() {
  const params = useParams<{ companyId: string; id: string }>();
  const companyId = params.companyId;
  const id = params.id;
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("items")
        .select("id, name, description, category, location, quantity, te_number, type, image_url, purchase_price, purchase_date, useful_life_years, depreciation_rate")
        .eq("company_id", companyId)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        setErr(error.message);
        setItem(null);
      } else {
        setItem((data || null) as Item | null);
      }

      setLoading(false);
    };

    void run();
  }, [companyId, id, router, supabase]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return;

    setSaving(true);
    setErr(null);

    const payload = {
      name: item.name,
      description: item.description || null,
      category: item.category || null,
      location: item.location || null,
      quantity: item.quantity ?? 0,
      te_number: item.te_number || null,
      type: item.type || null,
      image_url: item.image_url || null,
      purchase_price: item.purchase_price ?? null,
      purchase_date: item.purchase_date || null,
      useful_life_years: item.useful_life_years ?? null,
      depreciation_rate: item.depreciation_rate ?? null,
    };

    const { error } = await supabase.from("items").update(payload).eq("company_id", companyId).eq("id", id);

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push(`/${companyId}/items?open=${id}`);
  };

  if (loading) return <div className="text-slate-500">Loading…</div>;

  if (!item) {
    return (
      <div className="space-y-3">
        <Link href={`/${companyId}/items`} className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Stock
        </Link>
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-700">Item not found.</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href={`/${companyId}/items?open=${id}`} className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to item
        </Link>
        <h1 className="text-xl font-semibold text-slate-900 mt-2">Edit Item</h1>
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <form onSubmit={save} className="bg-white rounded-2xl border shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Name</label>
            <input
              value={item.name}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">TE #</label>
            <input
              value={item.te_number || ""}
              onChange={(e) => setItem({ ...item, te_number: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Category</label>
            <input
              value={item.category || ""}
              onChange={(e) => setItem({ ...item, category: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Location</label>
            <input
              value={item.location || ""}
              onChange={(e) => setItem({ ...item, location: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Type</label>
            <input
              value={item.type || ""}
              onChange={(e) => setItem({ ...item, type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Quantity</label>
            <input
              type="number"
              value={item.quantity ?? 0}
              onChange={(e) => setItem({ ...item, quantity: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-600 mb-1">Description</label>
            <textarea
              value={item.description || ""}
              onChange={(e) => setItem({ ...item, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
              rows={3}
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="font-semibold text-slate-900">Financial / Depreciation</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Purchase price</label>
              <input
                type="number"
                value={item.purchase_price ?? 0}
                onChange={(e) => setItem({ ...item, purchase_price: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Purchase date</label>
              <input
                type="date"
                value={item.purchase_date || ""}
                onChange={(e) => setItem({ ...item, purchase_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Useful life (years)</label>
              <input
                type="number"
                value={item.useful_life_years ?? ""}
                onChange={(e) =>
                  setItem({ ...item, useful_life_years: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Depreciation % per year</label>
              <input
                type="number"
                value={item.depreciation_rate ?? ""}
                onChange={(e) =>
                  setItem({ ...item, depreciation_rate: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push(`/${companyId}/items?open=${id}`)}
            className="px-3 py-2 rounded-lg border bg-white text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
