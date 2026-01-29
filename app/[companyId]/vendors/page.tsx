"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cacheGet, cacheSet } from "@/lib/clientCache";
import { Plus, Search } from "lucide-react";

type Vendor = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string | null;
  // Computed client-side.
  outstanding?: number;
};


// Super Vendors are managed separately under /[companyId]/super-vendors.
export default function VendorsPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 250);

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const moneyFmt = useMemo(
    () => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );
  const fmtMoney = (v: any) => moneyFmt.format(Number(v || 0));


  // create vendor
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const load = async () => {
    setLoading(true);
    setErr(null);

    // reset pagination when the query changes
    // (handled here to keep it in the same state transition)

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.replace("/auth");
      return;
    }

    const cacheKey = `vendors:list:${companyId}:${qDebounced}:${page}`;
    const cached = cacheGet<Vendor[]>(cacheKey);
    if (cached) {
      setVendors(cached);
      setLoading(false);
      // Still refresh outstanding in the background (cheap perceived speed win)
      void refreshOutstanding(cached.map((v) => v.id));
      return;
    }

    const fromIdx = (page - 1) * PAGE_SIZE;
    const toIdx = fromIdx + PAGE_SIZE - 1;

    let query = supabase
      .from("vendors")
      .select("id, name, contact_name, phone, email, is_active, created_at")
      .eq("company_id", companyId)
      .order("name", { ascending: true })
      .range(fromIdx, toIdx);

    if (qDebounced.trim()) {
      query = query.ilike("name", `%${qDebounced.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      setErr(error.message);
      setVendors([]);
    } else {
      const base = (data || []) as Vendor[];
      // Show the list immediately; compute outstanding asynchronously.
      setVendors(base);
      cacheSet(cacheKey, base, 30_000);
      void refreshOutstanding(base.map((v) => v.id));
    }
    setLoading(false);
  };

  const refreshOutstanding = async (vendorIds: string[]) => {
    if (!vendorIds.length) return;

    const aggKey = `vendors:outstanding:${companyId}:${vendorIds.join(",")}`;
    const cached = cacheGet<Record<string, number>>(aggKey);
    if (cached) {
      setVendors((prev) => prev.map((v) => ({ ...v, outstanding: cached[v.id] ?? v.outstanding })));
      return;
    }

    const [{ data: invRows }, { data: payRows }] = await Promise.all([
      supabase
        .from("vendor_invoices")
        .select("vendor_id, amount")
        .eq("company_id", companyId)
        .in("vendor_id", vendorIds),
      supabase
        .from("vendor_payments")
        .select("vendor_id, amount, invoice_id")
        .eq("company_id", companyId)
        .in("vendor_id", vendorIds)
        .not("invoice_id", "is", null),
    ]);

    const invByVendor = new Map<string, number>();
    for (const r of (invRows || []) as Array<{ vendor_id: string; amount: number | null }>) {
      const key = String(r.vendor_id);
      invByVendor.set(key, (invByVendor.get(key) || 0) + Number(r.amount || 0));
    }
    const payByVendor = new Map<string, number>();
    for (const r of (payRows || []) as Array<{ vendor_id: string; amount: number | null }>) {
      const key = String(r.vendor_id);
      payByVendor.set(key, (payByVendor.get(key) || 0) + Number(r.amount || 0));
    }

    const out: Record<string, number> = {};
    for (const vid of vendorIds) {
      out[vid] = (invByVendor.get(vid) || 0) - (payByVendor.get(vid) || 0);
    }
    cacheSet(aggKey, out, 30_000);
    setVendors((prev) => prev.map((v) => ({ ...v, outstanding: out[v.id] ?? v.outstanding })));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, qDebounced, page]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced]);

  const filtered = useMemo(() => {
    const s = qDebounced.trim().toLowerCase();
    if (!s) return vendors;
    return vendors.filter((v) => (`${v.name} ${v.contact_name ?? ""} ${v.email ?? ""}`.toLowerCase().includes(s)));
  }, [vendors, qDebounced]);

  const totalOutstandingAllVendors = useMemo(() => {
    // Super Vendors are managed as a separate module/table, so the Vendors list
    // contains only standard vendors; roll up all shown vendors.
    return vendors.reduce((sum, v) => sum + (Number(v.outstanding ?? 0) || 0), 0);
  }, [vendors]);

  const createVendor = async () => {
    setErr(null);
    if (!name.trim()) {
      setErr("Vendor name is required.");
      return;
    }

    const { data: created, error } = await supabase
      .from("vendors")
      .insert({
      company_id: companyId,
      name: name.trim(),
      contact_name: contact.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      setErr(error.message);
      return;
    }

    setShowNew(false);
    setName("");
    setContact("");
    setPhone("");
    setEmail("");
    await load();
  };

  if (loading) return <div className="text-slate-500">Loading vendors…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Vendors</h1>
          <div className="text-sm text-slate-600 mt-1">Subcontractors and suppliers by company.</div>
        </div>

        <Link
          href={`/${companyId}/super-vendors`}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-slate-900 text-sm font-medium hover:bg-slate-50"
        >
          Manage super vendors
        </Link>

        <button
          onClick={() => {
            setShowNew(true);
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          New vendor
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vendors…"
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>
        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div>{filtered.length} vendor(s)</div>
          <div className="font-medium text-slate-700">
            Total outstanding (all vendors): ${fmtMoney(totalOutstandingAllVendors)}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-6 text-sm text-slate-500">No vendors found.</div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="px-4 py-3 font-medium text-slate-900">{v.name}</td>
                  <td className="px-4 py-3">{v.contact_name || "—"}</td>
                  <td className="px-4 py-3">{v.phone || "—"}</td>
                  <td className="px-4 py-3">{v.email || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(v.outstanding ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">{v.is_active ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/${companyId}/vendors/${v.id}`} className="text-emerald-700 hover:text-emerald-900">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between gap-3 p-3 border-t text-sm">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-50"
            >
              Prev
            </button>
            <div className="text-xs text-slate-500">Page {page}</div>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={filtered.length < PAGE_SIZE}
              className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNew(false)} aria-hidden="true" />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl p-4">
            <div className="text-lg font-semibold text-slate-900">New vendor</div>
            <div className="grid grid-cols-1 gap-3 mt-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Vendor name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Contact name</label>
                <input value={contact} onChange={(e) => setContact(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="px-3 py-2 rounded-lg border bg-white text-sm">
                Cancel
              </button>
              <button onClick={() => void createVendor()} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
