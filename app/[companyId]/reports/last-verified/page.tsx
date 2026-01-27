"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useCompany } from "@/lib/useCompany";
import { ArrowLeft, Download } from "lucide-react";
import { exportToExcel, exportToPdf } from "@/lib/reportExport";

type Item = {
  id: string;
  name: string;
  category: string | null;
  location: string | null;
  type: string | null;
  quantity: number | null;
  image_url: string | null;
};
type Ver = {
  item_id: string | null;
  verified_at: string;
  verified_qty: number;
  verified_by: string | null;
};

type ProfileMini = { id: string; display_name: string | null };

function Thumbnail({ src, alt }: { src: string | null | undefined; alt: string }) {
  const safeSrc = (src || "").trim();
  const isUrl = /^https?:\/\//i.test(safeSrc);

  if (!safeSrc || !isUrl) {
    return (
      <div
        className="h-10 w-10 rounded-lg border bg-slate-100 flex items-center justify-center text-[10px] text-slate-500"
        aria-label="No image"
      >
        N/A
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safeSrc}
      alt={alt}
      className="h-10 w-10 rounded-lg border object-cover bg-slate-100"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        // Replace with placeholder if the URL is invalid / blocked.
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

export default function LastVerifiedReport() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const { companyName } = useCompany();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [lastByItem, setLastByItem] = useState<Record<string, { date: string; qty: number; by: string | null }>>({});
  const [profilesById, setProfilesById] = useState<Record<string, ProfileMini>>({});

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
        .select("id, name, category, location, type, quantity, image_url")
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
        .select("item_id, verified_at, verified_qty, verified_by")
        .eq("company_id", companyId)
        .order("verified_at", { ascending: false });

      if (vErr) {
        setErr(vErr.message);
        setItems((it || []) as Item[]);
        setLastByItem({});
        setLoading(false);
        return;
      }

      const map: Record<string, { date: string; qty: number; by: string | null }> = {};
      const verifierIds = new Set<string>();
      (ver || []).forEach((r: Ver) => {
        const itemId = r.item_id ? String(r.item_id) : "";
        if (!itemId) return;
        if (!map[itemId]) {
          map[itemId] = { date: r.verified_at, qty: Number(r.verified_qty ?? 0), by: r.verified_by ? String(r.verified_by) : null };
          if (r.verified_by) verifierIds.add(String(r.verified_by));
        }
      });

      // Best-effort: resolve verifier names (profiles table does not have RLS enabled in your schema).
      const ids = Array.from(verifierIds);
      if (ids.length > 0) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        const pMap: Record<string, ProfileMini> = {};
        (prof || []).forEach((p: any) => {
          if (!p?.id) return;
          pMap[String(p.id)] = { id: String(p.id), display_name: p.display_name ?? null };
        });
        setProfilesById(pMap);
      } else {
        setProfilesById({});
      }

      setItems((it || []) as Item[]);
      setLastByItem(map);
      setLoading(false);
    };

    void run();
  }, [companyId, router]);

  const rows = useMemo(() => {
    const today = new Date();
    return items.map((i) => {
      const last = lastByItem[i.id]?.date || null;
      let ageDays: number | null = null;
      if (last) {
        const d = new Date(last + "T00:00:00");
        ageDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      }
      const verifierId = lastByItem[i.id]?.by || null;
      const verifierName = verifierId ? profilesById[verifierId]?.display_name || verifierId : null;
      return {
        ...(i as any),
        last_verified: last,
        last_verified_qty: lastByItem[i.id]?.qty ?? null,
        verified_by: verifierName,
        age_days: ageDays,
      };
    });
  }, [items, lastByItem, profilesById]);

  const exportExcel = async () => {
    await exportToExcel(
      "last-verified.xlsx",
      rows,
      [
        { header: "Item", value: (r) => r.name },
        { header: "Category", value: (r) => r.category ?? "" },
        { header: "Location", value: (r) => r.location ?? "" },
        { header: "Last verified date", value: (r) => r.last_verified ?? "" },
        { header: "Last verified qty", value: (r) => r.last_verified_qty ?? "" },
        { header: "Verified by", value: (r) => r.verified_by ?? "" },
      ]
    );
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    setErr(null);

    const toDataUrl = async (url: string): Promise<string | null> => {
  try {
    const resp = await fetch(url, { cache: "force-cache" });
    if (!resp.ok) return null;
    const blob = await resp.blob();

    // Normalize orientation by letting the browser decode EXIF and then re-encoding.
    // This prevents rotated photos in exported PDFs.
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = objectUrl;
      // decode() is supported in modern browsers; falls back to load event.
      if ("decode" in img) {
        // @ts-expect-error - decode exists on HTMLImageElement in modern browsers
        await img.decode();
      } else {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image"));
        });
      }

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);

      // Use JPEG to keep size reasonable.
      return canvas.toDataURL("image/jpeg", 0.92);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
};

const enriched = await Promise.all(
      rows.map(async (r) => {
        const dataUrl = r.image_url ? await toDataUrl(r.image_url) : null;
        return {
          ...r,
          __thumb: dataUrl ? ({ __imageDataUrl: dataUrl } as const) : "",
        };
      })
    );

    await exportToPdf("last-verified.pdf", "Last Verified", enriched, [
      { header: "Photo", value: (r) => (r as any).__thumb },
      { header: "Item", value: (r) => r.name },
      { header: "Category", value: (r) => r.category ?? "" },
      { header: "Location", value: (r) => r.location ?? "" },
      { header: "Last verified", value: (r) => r.last_verified ?? "" },
      { header: "Qty", value: (r) => r.last_verified_qty ?? "" },
      { header: "Verified by", value: (r) => r.verified_by ?? "" },
    ], { companyName: companyName ?? undefined });

    setExportingPdf(false);
  };

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

        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
          <button
            onClick={exportPdf}
            disabled={exportingPdf}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            {exportingPdf ? "Exporting..." : "Export PDF"}
          </button>
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
              <th className="px-4 py-3">Last Verified</th>
              <th className="px-4 py-3 text-right">Verified Qty</th>
              <th className="px-4 py-3">Verified By</th>
              <th className="px-4 py-3 text-right">Age (days)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Thumbnail src={(r as any).image_url} alt={r.name} />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{r.name}</div>
                      <div className="text-xs text-slate-500 truncate">{r.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{r.category || "Uncategorized"}</td>
                <td className="px-4 py-3">{r.location || "—"}</td>
                <td className="px-4 py-3">{r.type || "—"}</td>
                <td className="px-4 py-3">{r.last_verified || "—"}</td>
                <td className="px-4 py-3 text-right">{r.last_verified_qty ?? "—"}</td>
                <td className="px-4 py-3">{r.verified_by ?? "—"}</td>
                <td className="px-4 py-3 text-right">{r.age_days ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
