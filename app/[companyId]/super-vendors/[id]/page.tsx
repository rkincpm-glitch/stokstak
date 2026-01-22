"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { ArrowLeft } from "lucide-react";

type SuperVendor = { id: string; name: string };
type Invoice = {
  id: string;
  vendor_id: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  amount: number;
  status: string;
  description: string | null;
  attachment_path: string | null;
  vendor_name: string | null;
};

export default function SuperVendorDetailPage() {
  const params = useParams<{ companyId: string; id: string }>();
  const companyId = params.companyId;
  const superVendorId = params.id;
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sv, setSv] = useState<SuperVendor | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.replace("/auth");
      return;
    }

    const { data: svRow, error: svErr } = await supabase
      .from("super_vendors")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("id", superVendorId)
      .maybeSingle();

    if (svErr || !svRow) {
      setErr(svErr?.message || "Super vendor not found.");
      setSv(null);
      setInvoices([]);
      setLoading(false);
      return;
    }
    setSv({ id: String(svRow.id), name: String(svRow.name) });

    // Mapped invoices
    const { data: maps, error: mapErr } = await supabase
      .from("vendor_invoice_supervendor_sv")
      .select("invoice_id")
      .eq("company_id", companyId)
      .eq("super_vendor_id", superVendorId);
    if (mapErr) {
      setErr(mapErr.message);
      setInvoices([]);
      setLoading(false);
      return;
    }

    const ids = (maps || []).map((m: any) => String(m.invoice_id)).filter(Boolean);
    if (ids.length === 0) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    const { data: invRows, error: invErr } = await supabase
      .from("vendor_invoices")
      .select("id, vendor_id, invoice_number, invoice_date, due_date, amount, status, description, attachment_path")
      .eq("company_id", companyId)
      .in("id", ids)
      .order("invoice_date", { ascending: false });
    if (invErr) {
      setErr(invErr.message);
      setInvoices([]);
      setLoading(false);
      return;
    }

    const inv = (invRows || []) as any[];
    const vendorIds = Array.from(new Set(inv.map((r) => String(r.vendor_id)).filter(Boolean)));
    const vendorNameById = new Map<string, string>();
    if (vendorIds.length > 0) {
      const { data: vnames } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("company_id", companyId)
        .in("id", vendorIds);
      for (const r of (vnames || []) as any[]) {
        if (r?.id) vendorNameById.set(String(r.id), String(r.name ?? ""));
      }
    }

    setInvoices(
      inv.map((r) => ({
        id: String(r.id),
        vendor_id: String(r.vendor_id),
        invoice_number: r.invoice_number ?? "",
        invoice_date: r.invoice_date ?? null,
        due_date: r.due_date ?? null,
        amount: Number(r.amount || 0),
        status: r.status ?? "",
        description: r.description ?? null,
        attachment_path: r.attachment_path ?? null,
        vendor_name: vendorNameById.get(String(r.vendor_id)) ?? null,
      })) as Invoice[]
    );

    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, superVendorId]);

  if (loading) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/${companyId}/super-vendors`} className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mt-2">{sv?.name ?? "Super Vendor"}</h1>
          <div className="text-sm text-slate-600 mt-1">Invoices referenced to this super vendor.</div>
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">Invoice</th>
              <th className="px-4 py-3 text-left">Vendor</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                  No invoices referenced to this super vendor yet.
                </td>
              </tr>
            ) : (
              invoices.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-4 py-3 font-medium text-slate-900">{i.invoice_number || "—"}</td>
                  <td className="px-4 py-3">{i.vendor_name || "—"}</td>
                  <td className="px-4 py-3">{i.invoice_date || "—"}</td>
                  <td className="px-4 py-3">{i.due_date || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {i.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">{i.status || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/${companyId}/vendors/${i.vendor_id}`} className="text-emerald-700 hover:text-emerald-900">
                      View vendor →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
