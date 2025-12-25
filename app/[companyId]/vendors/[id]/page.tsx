"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { ArrowLeft, Plus, DollarSign } from "lucide-react";

type Vendor = { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; };
type Invoice = { id: string; invoice_number: string; invoice_date: string | null; due_date: string | null; amount: number; status: string; description: string | null; };
type Payment = { id: string; payment_date: string; amount: number; method: string | null; reference: string | null; invoice_id: string | null; };

export default function VendorDetailPage() {
  const params = useParams<{ companyId: string; id: string }>();
  const companyId = params.companyId;
  const vendorId = params.id;
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // new invoice
  const [showInv, setShowInv] = useState(false);
  const [invNo, setInvNo] = useState("");
  const [invDate, setInvDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [invAmt, setInvAmt] = useState<number>(0);
  const [invDesc, setInvDesc] = useState("");

  // new payment
  const [showPay, setShowPay] = useState(false);
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [payAmt, setPayAmt] = useState<number>(0);
  const [payMethod, setPayMethod] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payInvoiceId, setPayInvoiceId] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.replace("/auth");
      return;
    }

    const { data: v, error: vErr } = await supabase
      .from("vendors")
      .select("id, name, contact_name, phone, email")
      .eq("company_id", companyId)
      .eq("id", vendorId)
      .maybeSingle();

    if (vErr) {
      setErr(vErr.message);
      setVendor(null);
      setInvoices([]);
      setPayments([]);
      setLoading(false);
      return;
    }

    const { data: inv, error: iErr } = await supabase
      .from("vendor_invoices")
      .select("id, invoice_number, invoice_date, due_date, amount, status, description")
      .eq("company_id", companyId)
      .eq("vendor_id", vendorId)
      .order("invoice_date", { ascending: false });

    const { data: pay, error: pErr } = await supabase
      .from("vendor_payments")
      .select("id, payment_date, amount, method, reference, invoice_id")
      .eq("company_id", companyId)
      .eq("vendor_id", vendorId)
      .order("payment_date", { ascending: false });

    if (iErr || pErr) setErr((iErr || pErr)?.message || null);

    setVendor((v || null) as Vendor | null);
    setInvoices((inv || []) as Invoice[]);
    setPayments((pay || []) as Payment[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, vendorId]);

  const totalInvoiced = useMemo(() => invoices.reduce((s, i) => s + Number(i.amount || 0), 0), [invoices]);
  const totalPaid = useMemo(() => payments.reduce((s, p) => s + Number(p.amount || 0), 0), [payments]);
  const balance = totalInvoiced - totalPaid;

  const createInvoice = async () => {
    setErr(null);
    if (!invNo.trim()) return setErr("Invoice number is required.");
    if (invAmt <= 0) return setErr("Invoice amount must be > 0.");

    const { error } = await supabase.from("vendor_invoices").insert({
      company_id: companyId,
      vendor_id: vendorId,
      invoice_number: invNo.trim(),
      invoice_date: invDate || null,
      due_date: dueDate || null,
      amount: invAmt,
      description: invDesc || null,
    });

    if (error) return setErr(error.message);

    setShowInv(false);
    setInvNo("");
    setInvDate("");
    setDueDate("");
    setInvAmt(0);
    setInvDesc("");
    await load();
  };

  const createPayment = async () => {
    setErr(null);
    if (payAmt <= 0) return setErr("Payment amount must be > 0.");

    const { error } = await supabase.from("vendor_payments").insert({
      company_id: companyId,
      vendor_id: vendorId,
      invoice_id: payInvoiceId || null,
      payment_date: payDate,
      amount: payAmt,
      method: payMethod || null,
      reference: payRef || null,
    });

    if (error) return setErr(error.message);

    setShowPay(false);
    setPayAmt(0);
    setPayMethod("");
    setPayRef("");
    setPayInvoiceId("");
    await load();
  };

  if (loading) return <div className="text-slate-500">Loading…</div>;

  if (!vendor) {
    return (
      <div className="space-y-3">
        <Link href={`/${companyId}/vendors`} className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Vendors
        </Link>
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-700">Vendor not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href={`/${companyId}/vendors`} className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Vendors
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 mt-2">{vendor.name}</h1>
          <div className="text-sm text-slate-600 mt-1">
            {vendor.contact_name || "—"} • {vendor.phone || "—"} • {vendor.email || "—"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowInv(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50">
            <Plus className="h-4 w-4" />
            Add invoice
          </button>
          <button onClick={() => setShowPay(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
            <DollarSign className="h-4 w-4" />
            Record payment
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-slate-500">Total invoiced</div>
          <div className="text-xl font-semibold text-slate-900 mt-1">{totalInvoiced.toFixed(2)}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-slate-500">Total paid</div>
          <div className="text-xl font-semibold text-slate-900 mt-1">{totalPaid.toFixed(2)}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-slate-500">Balance</div>
          <div className="text-xl font-semibold text-slate-900 mt-1">{balance.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white overflow-x-auto">
          <div className="px-4 py-3 border-b font-semibold text-slate-900">Invoices</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-4 py-3 font-medium text-slate-900">{i.invoice_number}</td>
                  <td className="px-4 py-3">{i.invoice_date || "—"}</td>
                  <td className="px-4 py-3 text-right">{Number(i.amount).toFixed(2)}</td>
                  <td className="px-4 py-3">{i.status}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={4}>
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border bg-white overflow-x-auto">
          <div className="px-4 py-3 border-b font-semibold text-slate-900">Payments</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3">{p.payment_date}</td>
                  <td className="px-4 py-3 text-right">{Number(p.amount).toFixed(2)}</td>
                  <td className="px-4 py-3">{p.method || "—"}</td>
                  <td className="px-4 py-3">{p.reference || "—"}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={4}>
                    No payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add invoice modal */}
      {showInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowInv(false)} aria-hidden="true" />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl p-4">
            <div className="text-lg font-semibold text-slate-900">Add invoice</div>
            <div className="grid grid-cols-1 gap-3 mt-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Invoice number</label>
                <input value={invNo} onChange={(e) => setInvNo(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Invoice date</label>
                  <input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Due date</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Amount</label>
                <input type="number" value={invAmt} onChange={(e) => setInvAmt(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Description</label>
                <textarea value={invDesc} onChange={(e) => setInvDesc(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" rows={3} />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setShowInv(false)} className="px-3 py-2 rounded-lg border bg-white text-sm">
                Cancel
              </button>
              <button onClick={() => void createInvoice()} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record payment modal */}
      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPay(false)} aria-hidden="true" />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl p-4">
            <div className="text-lg font-semibold text-slate-900">Record payment</div>
            <div className="grid grid-cols-1 gap-3 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Payment date</label>
                  <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Amount</label>
                  <input type="number" value={payAmt} onChange={(e) => setPayAmt(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Apply to invoice (optional)</label>
                <select value={payInvoiceId} onChange={(e) => setPayInvoiceId(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900">
                  <option value="">Unallocated</option>
                  {invoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoice_number} ({Number(i.amount).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Method</label>
                  <input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Reference</label>
                  <input value={payRef} onChange={(e) => setPayRef(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setShowPay(false)} className="px-3 py-2 rounded-lg border bg-white text-sm">
                Cancel
              </button>
              <button onClick={() => void createPayment()} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
