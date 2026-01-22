"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { ArrowLeft, Save } from "lucide-react";

const ITEM_IMAGE_BUCKET = "item-images";

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
  image_url_2: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  // DB column names
  life_years: number | null;
  depreciation_percent: number | null;
};

export default function EditItemCompanyPage() {
  const params = useParams<{ companyId: string; id: string }>();
  const companyId = params.companyId;
  const id = params.id;
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingAlt, setUploadingAlt] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);

  const uploadImage = async (file: File, slot: "main" | "alt") => {
    if (!item) return;
    const setUploading = slot === "main" ? setUploadingMain : setUploadingAlt;
    try {
      setUploading(true);
      setErr(null);

      // Basic client-side guardrails
      if (!file.type.startsWith("image/")) {
        setErr("Please select an image file.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        setErr("Image is too large. Please use a file under 8 MB.");
        return;
      }

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ext.replace(/[^a-z0-9]/g, "");
      const path = `items/${companyId}/${id}/${slot}-${Date.now()}.${safeExt || "jpg"}`;

      const { error: upErr } = await supabase.storage
        .from(ITEM_IMAGE_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from(ITEM_IMAGE_BUCKET).getPublicUrl(path);
      const publicUrl = data?.publicUrl || null;

      setItem((prev) => {
        if (!prev) return prev;
        if (slot === "main") return { ...prev, image_url: publicUrl };
        return { ...prev, image_url_2: publicUrl };
      });
    } catch (e: any) {
      setErr(e?.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  // Remove image from the form (does not delete from Storage).
  const clearImage = (slot: "main" | "alt") => {
    setItem((prev) => {
      if (!prev) return prev;
      if (slot === "main") return { ...prev, image_url: null };
      return { ...prev, image_url_2: null };
    });
  };

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
        .select(
          "id, name, description, category, location, quantity, te_number, type, image_url, image_url_2, purchase_price, purchase_date, life_years, depreciation_percent"
        )
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
      image_url_2: item.image_url_2 || null,
      purchase_price: item.purchase_price ?? null,
      purchase_date: item.purchase_date || null,
      life_years: item.life_years ?? null,
      depreciation_percent: item.depreciation_percent ?? null,
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
    <div className="max-w-3xl mx-auto space-y-4 px-4 sm:px-6">
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
          <div className="rounded-xl border p-3">
            <div className="text-sm font-medium text-slate-900">Main photo</div>
            <div className="mt-2">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt="Main"
                  className="h-44 w-full object-cover rounded-lg border bg-slate-50"
                />
              ) : (
                <div className="h-44 w-full rounded-lg border bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                  No image
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <label className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadImage(f, "main");
                    e.currentTarget.value = "";
                  }}
                />
                {uploadingMain ? "Uploading…" : "Add / Replace"}
              </label>
              {item.image_url && (
                <button
                  type="button"
                  onClick={() => clearImage("main")}
                  className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Remove
                </button>
              )}
              <div className="text-xs text-slate-500">You can take a photo on mobile.</div>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-sm font-medium text-slate-900">Secondary photo</div>
            <div className="mt-2">
              {item.image_url_2 ? (
                <img
                  src={item.image_url_2}
                  alt="Secondary"
                  className="h-44 w-full object-cover rounded-lg border bg-slate-50"
                />
              ) : (
                <div className="h-44 w-full rounded-lg border bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                  No image
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <label className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadImage(f, "alt");
                    e.currentTarget.value = "";
                  }}
                />
                {uploadingAlt ? "Uploading…" : "Add / Replace"}
              </label>
              {item.image_url_2 && (
                <button
                  type="button"
                  onClick={() => clearImage("alt")}
                  className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

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
                value={item.life_years ?? ""}
                onChange={(e) =>
                  setItem({ ...item, life_years: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Depreciation % per year</label>
              <input
                type="number"
                value={item.depreciation_percent ?? ""}
                onChange={(e) =>
                  setItem({ ...item, depreciation_percent: e.target.value === "" ? null : Number(e.target.value) })
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
