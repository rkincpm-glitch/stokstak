"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { exportToExcel, exportToPdf } from "@/lib/reportExport";
import { ArrowLeft, Plus, DollarSign, Paperclip, Trash2, Pencil, FileText } from "lucide-react";

// Super vendors are configured per-company in public.super_vendors (separate from vendors).

type Vendor = { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; };
type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  amount: number;
  status: string;
  description: string | null;
  attachment_path: string | null;
  super_vendor_id?: string | null;
  vendor_id?: string;
  vendor_name?: string | null;
};
type PaymentRowFromDb = {
  id: string;
  payment_date: string | null;
  amount: number;
  method: string | null;
  reference: string | null;
  invoice_id: string | null;
  attachment_path: string | null;
};

type Payment = {
  id: string;
  // Nullable in DB (older rows / optional input)
  payment_date: string | null;
  amount: number;
  method: string | null;
  reference: string | null;
  invoice_id: string | null;
  attachment_path: string | null;
  invoice_number: string | null;
};

type StatementRow = {
  date: string; // YYYY-MM-DD
  type: "Invoice" | "Payment";
  reference: string;
  invoice_number: string;
  debit: number;
  credit: number;
  balance: number;
};

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
  const [superVendors, setSuperVendors] = useState<Array<{ id: string; name: string }>>([]);


  // new invoice
  const [showInv, setShowInv] = useState(false);
  const [invNo, setInvNo] = useState("");
  const [invRef, setInvRef] = useState(""); // super vendor id (optional)

  const [invDate, setInvDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [invAmt, setInvAmt] = useState<number>(0);
  const [invDesc, setInvDesc] = useState("");
  const [invFile, setInvFile] = useState<File | null>(null);

  // edit invoice
  const [editInv, setEditInv] = useState<Invoice | null>(null);
  const [editInvNo, setEditInvNo] = useState("");
  const [editInvRef, setEditInvRef] = useState("");

  const [editInvDate, setEditInvDate] = useState<string>("");
  const [editDueDate, setEditDueDate] = useState<string>("");
  const [editInvAmt, setEditInvAmt] = useState<number>(0);
  const [editInvDesc, setEditInvDesc] = useState("");
  const [editInvStatus, setEditInvStatus] = useState<string>("open");
  const [editInvFile, setEditInvFile] = useState<File | null>(null);

  // new payment
  const [showPay, setShowPay] = useState(false);
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [payAmt, setPayAmt] = useState<number>(0);
  const [payMethod, setPayMethod] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payInvoiceId, setPayInvoiceId] = useState<string>("");
  const [payFile, setPayFile] = useState<File | null>(null);

  // edit payment
  const [editPay, setEditPay] = useState<Payment | null>(null);
  const [editPayDate, setEditPayDate] = useState<string>("");
  const [editPayAmt, setEditPayAmt] = useState<number>(0);
  const [editPayMethod, setEditPayMethod] = useState("");
  const [editPayRef, setEditPayRef] = useState("");
  const [editPayInvoiceId, setEditPayInvoiceId] = useState<string>("");
  const [editPayFile, setEditPayFile] = useState<File | null>(null);

  const [activeTab, setActiveTab] = useState<"invoices" | "payments">("invoices");
  const [showEditVendor, setShowEditVendor] = useState(false);
  const [editVendorName, setEditVendorName] = useState("");
  const [editVendorContact, setEditVendorContact] = useState("");
  const [editVendorPhone, setEditVendorPhone] = useState("");
  const [editVendorEmail, setEditVendorEmail] = useState("");
const [showStatement, setShowStatement] = useState(false);
  const [statementStart, setStatementStart] = useState<string>("");
  const [statementEnd, setStatementEnd] = useState<string>("");

  // Private bucket for audit-grade documents/images.
  // Create it in Supabase Storage: bucket name "attachments" (private).
  const ATTACH_BUCKET = "attachments";

  const [previewByPath, setPreviewByPath] = useState<Record<string, string>>({});

  // Hover preview overlay (full-screen) for attachments
  const [activePreview, setActivePreview] = useState<null | { path: string; url: string; kind: "image" | "pdf" }>(null);
  const closePreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [contentTypeByPath, setContentTypeByPath] = useState<Record<string, string>>({});

  /**
   * Decide whether an attachment is viewable inline on hover.
   *
   * - Images: render as <img>
   * - PDFs: render as <embed>/<iframe>
   */
  const isLikelyImage = (pathOrUrl: string) => {
    const ct = contentTypeByPath[pathOrUrl];
    if (ct && ct.toLowerCase().startsWith("image/")) return true;

    const lower = pathOrUrl.toLowerCase();
    return (
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".gif") ||
      lower.endsWith(".bmp") ||
      lower.endsWith(".jfif") ||
      lower.endsWith(".heic") ||
      lower.endsWith(".heif")
    );
  };

  const isLikelyPdf = (pathOrUrl: string) => {
    const ct = contentTypeByPath[pathOrUrl];
    if (ct && ct.toLowerCase().includes("application/pdf")) return true;
    return pathOrUrl.toLowerCase().endsWith(".pdf");
  };

  const getAttachmentUrl = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;

    // cache
    const cached = previewByPath[path];
    if (cached) return cached;

    const { data, error } = await supabase.storage.from(ATTACH_BUCKET).createSignedUrl(path, 60 * 30);
    if (error) return null;
    const signed = data?.signedUrl ?? null;
    if (signed) {
      setPreviewByPath((prev) => ({ ...prev, [path]: signed }));

      // Best-effort: Content-Type for better image detection (e.g., HEIC/HEIF camera uploads).
      // If CORS/HEAD is blocked, silently ignore and fall back to extension checks.
      if (!contentTypeByPath[path]) {
        void (async () => {
          try {
            const res = await fetch(signed, { method: "HEAD" });
            const ct = res.headers.get("content-type") || "";
            if (ct) setContentTypeByPath((prev) => ({ ...prev, [path]: ct }));
          } catch {
            // ignore
          }
        })();
      }
    }
    return signed;
  };


const hoveringTriggerRef = useRef(false);
  const hoveringOverlayRef = useRef(false);

  const clearClosePreviewTimer = () => {
    if (closePreviewTimerRef.current) {
      clearTimeout(closePreviewTimerRef.current);
      closePreviewTimerRef.current = null;
    }
  };

  const scheduleClosePreview = () => {
    clearClosePreviewTimer();
    closePreviewTimerRef.current = setTimeout(() => {
      if (!hoveringTriggerRef.current && !hoveringOverlayRef.current) {
        setActivePreview(null);
      }
    }, 120);
  };

  const onAttachmentTriggerEnter = (attachmentPath: string) => {
    hoveringTriggerRef.current = true;
    clearClosePreviewTimer();
    void showPreviewForPath(attachmentPath);
  };

  const onAttachmentTriggerLeave = () => {
    hoveringTriggerRef.current = false;
    scheduleClosePreview();
  };

  const onPreviewOverlayEnter = () => {
    hoveringOverlayRef.current = true;
    clearClosePreviewTimer();
  };

  const onPreviewOverlayLeave = () => {
    hoveringOverlayRef.current = false;
    scheduleClosePreview();
  };

  const showPreviewForPath = async (attachmentPath: string) => {
  clearClosePreviewTimer();
  const url = await getAttachmentUrl(attachmentPath);
  if (!url) return;

  const kind: "image" | "pdf" = isLikelyPdf(attachmentPath) ? "pdf" : "image";
  setActivePreview({ path: attachmentPath, url, kind });
};
  const uploadAttachment = async (folder: "invoices" | "payments", file: File): Promise<string> => {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
    const base = file.name.replace(/\.[^/.]+$/, "");
    const safeBase = base.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "file";
    const safeExt = ext ? ext.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 10) : "";

    // HEIC/HEIF uploads are not reliably previewable in browsers (especially Chrome on Windows).
    // Convert server-side to a single-page PDF and upload that instead.
    const lowerExt = safeExt.toLowerCase();
    const isHeic =
      lowerExt === "heic" ||
      lowerExt === "heif" ||
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      file.type === "image/heic-sequence" ||
      file.type === "image/heif-sequence";

    if (isHeic) {
      const form = new FormData();
      form.append("file", file);
      form.append("companyId", companyId);
      form.append("vendorId", vendorId);
      form.append("folder", folder);
      form.append("baseName", safeBase);

      const res = await fetch("/api/uploads/heic-to-pdf", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to convert HEIC/HEIF file");
      const path = String(json?.path || "");
      if (!path) throw new Error("Conversion succeeded but no path returned");
      return path;
    }

    const fname = `${crypto.randomUUID()}-${safeBase}${safeExt ? `.${safeExt}` : ""}`;
    const path = `${companyId}/vendors/${vendorId}/${folder}/${fname}`;
    const { error } = await supabase.storage.from(ATTACH_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) throw error;
    return path; // store storage path in DB; generate signed URLs at read-time
  };


useEffect(() => {
  if (!activePreview) return;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") setActivePreview(null);
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [activePreview]);

  const openAttachment = async (storagePathOrUrl: string | null | undefined) => {
    if (!storagePathOrUrl) return;
    try {
      const url = await getAttachmentUrl(storagePathOrUrl);
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message || "Failed to open attachment");
    }
  };

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


    // Load super vendors for reference dropdown.
    // NOTE: Super vendors are separate of vendors; they live in public.super_vendors.
    const { data: svRows, error: svErr } = await supabase
      .from("super_vendors")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name", { ascending: true });
    if (svErr) setSuperVendors([]);
    else setSuperVendors(((svRows || []) as any[]).map((r) => ({ id: String(r.id), name: String(r.name) })));

    // Base invoice query (no "reference" column assumed in schema).
    const baseInvQuery = supabase
      .from("vendor_invoices")
      .select(
        // IMPORTANT: Avoid embedding vendors here. Some schemas have multiple FKs between
        // vendor_invoices and vendors (e.g., vendor_id plus other vendor-like columns), which
        // makes PostgREST embedding ambiguous.
        "id, vendor_id, invoice_number, invoice_date, due_date, amount, status, description, attachment_path"
      )
      .eq("company_id", companyId)
      .order("invoice_date", { ascending: false });

    // Vendor invoice query (vendor pages show invoices owned by that vendor only).
    const { data: invRowsRaw, error: invErr } = await baseInvQuery.eq("vendor_id", vendorId);
    const inv = (invRowsRaw || []) as any[];
    const iErr = invErr;

    const { data: pay, error: pErr } = await supabase
      .from("vendor_payments")
      // IMPORTANT: Do NOT embed vendor_invoices here. In some schemas there can be multiple FKs
      // between vendor_payments and vendor_invoices, which makes PostgREST embedding ambiguous.
      .select("id, payment_date, amount, method, reference, invoice_id, attachment_path")
      .eq("company_id", companyId)
      .eq("vendor_id", vendorId)
      .order("payment_date", { ascending: false });

    if (iErr || pErr) setErr((iErr || pErr)?.message || null);

    const _v = (v || null) as Vendor | null;
    setVendor(_v);
    if (_v) {
      setEditVendorName(_v.name ?? "");
      setEditVendorContact(_v.contact_name ?? "");
      setEditVendorPhone(_v.phone ?? "");
      setEditVendorEmail(_v.email ?? "");
    }
    const invRows = inv;

    // Resolve vendor names for invoice rows without using PostgREST embeds (avoids ambiguous relationships).
    const vendorNameById = new Map<string, string>();
    const invoiceVendorIds = Array.from(
      new Set(invRows.map((r) => (r?.vendor_id ? String(r.vendor_id) : null)).filter(Boolean) as string[])
    );
    if (invoiceVendorIds.length > 0) {
      const { data: vnames } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("company_id", companyId)
        .in("id", invoiceVendorIds);
      for (const row of (vnames || []) as any[]) {
        if (row?.id) vendorNameById.set(String(row.id), String(row.name ?? ""));
      }
    }

    // Attach Super Vendor mapping (if any) to invoices so UI can show "Reference".
    const invIds = invRows.map((r) => String(r.id)).filter(Boolean);
    const superByInvoiceId = new Map<string, string>();
    if (invIds.length > 0) {
      const { data: maps } = await supabase
        .from("vendor_invoice_supervendor_sv")
        .select("invoice_id, super_vendor_id")
        .eq("company_id", companyId)
        .in("invoice_id", invIds);
      for (const m of (maps || []) as any[]) {
        if (m?.invoice_id && m?.super_vendor_id) superByInvoiceId.set(String(m.invoice_id), String(m.super_vendor_id));
      }
    }

    setInvoices(invRows.map((r) => ({
      id: String(r.id),
      invoice_number: r.invoice_number ?? "",
      invoice_date: r.invoice_date ?? null,
      due_date: r.due_date ?? null,
      amount: r.amount ?? 0,
      status: r.status ?? "",
      description: r.description ?? null,
      attachment_path: r.attachment_path ?? null,
      vendor_id: r.vendor_id ?? undefined,
      vendor_name: (r?.vendor_id ? (vendorNameById.get(String(r.vendor_id)) ?? null) : null),
      super_vendor_id: superByInvoiceId.get(String(r.id)) ?? null,
    })) as Invoice[]);

    // Build a lookup so we can display invoice_number for each payment without embedding.
    const invoiceNumberById = new Map<string, string | null>();
    for (const row of (inv || []) as any[]) {
      const id = row?.id ? String(row.id) : null;
      if (id) invoiceNumberById.set(id, row.invoice_number ?? null);
    }

    const payRows = (pay ?? []) as unknown as PaymentRowFromDb[];
    const payNorm: Payment[] = payRows.map((p) => ({
      id: String(p.id),
      payment_date: p.payment_date ?? "",
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      invoice_id: p.invoice_id,
      attachment_path: p.attachment_path,
      invoice_number: p.invoice_id ? (invoiceNumberById.get(String(p.invoice_id)) ?? null) : null,
    }));
    setPayments(payNorm);
    setLoading(false);
  };

  // Enforce vendor-specific uniqueness of invoice numbers (defense-in-depth; DB constraint should also exist).
  const invoiceNumberExists = async (invoiceNumber: string, excludeId?: string) => {
    let q = supabase
      .from("vendor_invoices")
      .select("id")
      .eq("company_id", companyId)
      .eq("vendor_id", vendorId)
      .eq("invoice_number", invoiceNumber)
      .limit(1);

    if (excludeId) q = q.neq("id", excludeId);

    const { data, error } = await q;
    if (error) {
      // If the check fails for any reason, do not block the user; the DB constraint will still protect.
      console.warn("invoiceNumberExists check failed:", error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, vendorId]);

  const totalInvoiced = useMemo(() => invoices.reduce((s, i) => s + Number(i.amount || 0), 0), [invoices]);
  const totalPaid = useMemo(() => payments.reduce((s, p) => s + Number(p.amount || 0), 0), [payments]);
  const balance = totalInvoiced - totalPaid;

  const statementRows = useMemo(() => {
    const start = statementStart || "0001-01-01";
    const end = statementEnd || "9999-12-31";

    const invRows: StatementRow[] = invoices
      .filter((i) => !!i.invoice_date && i.invoice_date >= start && i.invoice_date <= end)
      .map((i): StatementRow => ({
        date: i.invoice_date!,
        type: "Invoice",
        reference: i.invoice_number,
        invoice_number: i.invoice_number,
        debit: Number(i.amount || 0),
        credit: 0,
        balance: 0,
      }));

    const payRows: StatementRow[] = payments
      .filter((p) => !!p.payment_date && p.payment_date >= start && p.payment_date <= end)
      .map((p): StatementRow => ({
        date: p.payment_date!,
        type: "Payment",
        reference: p.reference || p.id,
        invoice_number: p.invoice_number || "—",
        debit: 0,
        credit: Number(p.amount || 0),
        balance: 0,
      }));

    const merged = [...invRows, ...payRows].sort((a, b) => {
      const ad = a.date ?? "";
      const bd = b.date ?? "";
      if (ad < bd) return -1;
      if (ad > bd) return 1;
      // same date: invoices first
      if (a.type === b.type) return 0;
      return a.type === "Invoice" ? -1 : 1;
    });

    let running = 0;
    const out: StatementRow[] = merged.map((r) => {
      running += r.debit - r.credit;
      return { ...r, balance: running };
    });
    return out;
  }, [invoices, payments, statementStart, statementEnd]);

  const createInvoice = async () => {
    setErr(null);
    if (!invNo.trim()) return setErr("Invoice number is required.");
    if (invAmt <= 0) return setErr("Invoice amount must be > 0.");

    // Duplicate invoice numbers are not allowed per vendor.
    const dup = await invoiceNumberExists(invNo.trim());
    if (dup) return setErr("Invoice number already exists for this vendor.");

    let attachmentPath: string | null = null;
    if (invFile) {
      try {
        attachmentPath = await uploadAttachment("invoices", invFile);
      } catch (e: any) {
        return setErr(e?.message || "Failed to upload invoice attachment.");
      }
    }

    const { data: created, error } = await supabase
      .from("vendor_invoices")
      .insert({
      company_id: companyId,
      vendor_id: vendorId,
      invoice_number: invNo.trim(),
      invoice_date: invDate || null,
      due_date: dueDate || null,
      amount: invAmt,
      description: invDesc || null,
      attachment_path: attachmentPath,
      })
      .select("id")
      .maybeSingle();

    if (error) return setErr(error.message);

    // Optional mapping to Super Vendor
    if (invRef && created?.id) {
      const { error: mapErr } = await supabase
        .from("vendor_invoice_supervendor_sv")
        .upsert(
          {
            company_id: companyId,
            invoice_id: String(created.id),
            super_vendor_id: invRef,
          },
          { onConflict: "invoice_id" }
        );
      if (mapErr) return setErr(mapErr.message);
    }

    setShowInv(false);
    setInvNo("");
    setInvRef("");
    setInvDate("");
    setDueDate("");
    setInvAmt(0);
    setInvDesc("");
    setInvFile(null);
    await load();
  };

  const startEditInvoice = (inv: Invoice) => {
    setErr(null);
    setEditInv(inv);
    setEditInvNo(inv.invoice_number || "");
    setEditInvRef(inv.super_vendor_id || "");
    setEditInvDate(inv.invoice_date || "");
    setEditDueDate(inv.due_date || "");
    setEditInvAmt(Number(inv.amount || 0));
    setEditInvDesc(inv.description || "");
    setEditInvFile(null);
  };

  const updateInvoice = async () => {
    if (!editInv) return;
    setErr(null);
    if (!editInvNo.trim()) return setErr("Invoice number is required.");
    if (editInvAmt <= 0) return setErr("Invoice amount must be > 0.");

    // Duplicate invoice numbers are not allowed per vendor.
    const dup = await invoiceNumberExists(editInvNo.trim(), editInv.id);
    if (dup) return setErr("Invoice number already exists for this vendor.");

    let nextAttachment = editInv.attachment_path || null;
    if (editInvFile) {
      try {
        const uploaded = await uploadAttachment("invoices", editInvFile);
        // best-effort cleanup of old file
        if (nextAttachment) {
          await supabase.storage.from(ATTACH_BUCKET).remove([nextAttachment]);
        }
        nextAttachment = uploaded;
      } catch (e: any) {
        return setErr(e?.message || "Failed to upload invoice attachment.");
      }
    }

    const { error } = await supabase
      .from("vendor_invoices")
      .update({
        invoice_number: editInvNo.trim(),
        invoice_date: editInvDate || null,
        due_date: editDueDate || null,
        amount: editInvAmt,
        description: editInvDesc || null,
        attachment_path: nextAttachment,
      })
      .eq("company_id", companyId)
      .eq("vendor_id", vendorId)
      .eq("id", editInv.id);

    if (error) return setErr(error.message);

    // Update Super Vendor mapping (upsert or delete)
    if (editInvRef) {
      const { error: mapErr } = await supabase
        .from("vendor_invoice_supervendor_sv")
        .upsert(
          {
            company_id: companyId,
            invoice_id: editInv.id,
            super_vendor_id: editInvRef,
          },
          { onConflict: "invoice_id" }
        );
      if (mapErr) return setErr(mapErr.message);
    } else {
      // Remove mapping if cleared
      await supabase
        .from("vendor_invoice_supervendor_sv")
        .delete()
        .eq("company_id", companyId)
        .eq("invoice_id", editInv.id);
    }
    setEditInv(null);
    await load();
  };

  const createPayment = async () => {
    setErr(null);
    if (payAmt <= 0) return setErr("Payment amount must be > 0.");

    if (!payFile) {
      return setErr("Please attach a PDF/image of the payment record (file picker or camera).");
    }

    let attachmentPath: string | null = null;
    try {
      attachmentPath = await uploadAttachment("payments", payFile);
    } catch (e: any) {
      return setErr(e?.message || "Failed to upload payment attachment.");
    }

    const { error } = await supabase.from("vendor_payments").insert({
      company_id: companyId,
      vendor_id: vendorId,
      invoice_id: payInvoiceId || null,
      payment_date: payDate,
      amount: payAmt,
      method: payMethod || null,
      reference: payRef || null,
      attachment_path: attachmentPath,
    });

    if (error) return setErr(error.message);

    setShowPay(false);
    setPayAmt(0);
    setPayMethod("");
    setPayRef("");
    setPayInvoiceId("");
    setPayFile(null);
    await load();
  };

  const startEditPayment = (p: Payment) => {
    setErr(null);
    setEditPay(p);
    setEditPayDate(p.payment_date || "");
    setEditPayAmt(Number(p.amount ?? 0));
    setEditPayMethod(p.method || "");
    setEditPayRef(p.reference || "");
    setEditPayInvoiceId(p.invoice_id || "");
    setEditPayFile(null);
  };

  const updatePayment = async () => {
    if (!editPay) return;
    setErr(null);
    if (editPayAmt <= 0) return setErr("Payment amount must be > 0.");

    let nextAttachment = editPay.attachment_path || null;
    if (editPayFile) {
      try {
        nextAttachment = await uploadAttachment("payments", editPayFile);
        if (editPay.attachment_path) {
          void supabase.storage.from(ATTACH_BUCKET).remove([editPay.attachment_path]);
        }
      } catch (e: any) {
        return setErr(e?.message || "Failed to upload payment attachment.");
      }
    }

    const { error } = await supabase
      .from("vendor_payments")
      .update({
        invoice_id: editPayInvoiceId || null,
        payment_date: editPayDate || null,
        amount: editPayAmt,
        method: editPayMethod || null,
        reference: editPayRef || null,
        attachment_path: nextAttachment,
      })
      .eq("company_id", companyId)
      .eq("vendor_id", vendorId)
      .eq("id", editPay.id);

    if (error) return setErr(error.message);
    setEditPay(null);
    await load();
  };

  const deleteInvoice = async (id: string, attachment_path: string | null) => {
    setErr(null);
    const ok = window.confirm("Delete this invoice? This cannot be undone.");
    if (!ok) return;

    const { error } = await supabase
      .from("vendor_invoices")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      setErr(error.message);
      return;
    }

    if (attachment_path) {
      await supabase.storage.from(ATTACH_BUCKET).remove([attachment_path]);
    }
    await load();
  };

  const deletePayment = async (id: string, attachment_path: string | null) => {
    setErr(null);
    const ok = window.confirm("Delete this payment? This cannot be undone.");
    if (!ok) return;

    const { error } = await supabase
      .from("vendor_payments")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      setErr(error.message);
      return;
    }

    if (attachment_path) {
      await supabase.storage.from(ATTACH_BUCKET).remove([attachment_path]);
    }
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
<button
            onClick={() => setShowEditVendor(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" />
            Edit vendor
          </button>
          <button
            onClick={() => setShowStatement(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" />
            Statement
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={`px-3 py-2 rounded-lg text-sm border ${activeTab === "invoices" ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"}`}
          >
            Invoices <span className={`ml-2 inline-flex items-center justify-center min-w-[1.75rem] h-5 px-1 rounded-full text-xs ${activeTab === "invoices" ? "bg-white/20" : "bg-slate-100 text-slate-700"}`}>{invoices.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payments")}
            className={`px-3 py-2 rounded-lg text-sm border ${activeTab === "payments" ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"}`}
          >
            Payments <span className={`ml-2 inline-flex items-center justify-center min-w-[1.75rem] h-5 px-1 rounded-full text-xs ${activeTab === "payments" ? "bg-white/20" : "bg-slate-100 text-slate-700"}`}>{payments.length}</span>
          </button>
        </div>
        <div className="text-xs text-slate-500">Hover “View” to preview attachments full screen.</div>
      </div>

      {activeTab === "invoices" ? (
        <div className="rounded-2xl border bg-white overflow-x-auto overflow-y-visible">
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
            <div className="font-semibold text-slate-900">Invoices</div>
            <button
              type="button"
              onClick={() => {
                setErr(null);
                setShowInv(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add invoice
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-3">Invoice</th>
                {/* Vendor column removed */}
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attachment</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-4 py-3 font-medium text-slate-900">{i.invoice_number}</td>
                  {/* Vendor column removed */}
                  <td className="px-4 py-3">{superVendors.find((sv) => sv.id === i.super_vendor_id)?.name || (i.super_vendor_id ? "(Unknown)" : "—")}</td>
                  <td className="px-4 py-3">{i.invoice_date || "—"}</td>
                  <td className="px-4 py-3">{i.due_date || "—"}</td>
                  <td className="px-4 py-3 text-right">{Number(i.amount).toFixed(2)}</td>
                  <td className="px-4 py-3">{i.status}</td>
                  <td className="px-4 py-3">
                    {i.attachment_path ? (
                      <div className="relative inline-flex items-center gap-2">
                        <button
                          type="button"
                          onMouseEnter={() => i.attachment_path && onAttachmentTriggerEnter(i.attachment_path)}
                          onMouseLeave={onAttachmentTriggerLeave}
                          onFocus={() => i.attachment_path && onAttachmentTriggerEnter(i.attachment_path)}
                          onBlur={onAttachmentTriggerLeave}
                          onClick={() => openAttachment(i.attachment_path)}
                          className="inline-flex items-center gap-2 text-slate-900 underline underline-offset-4"
                        >
                          <Paperclip className="h-4 w-4" />
                          View
                        </button>

                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEditInvoice(i)}
                      className="mr-2 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      title="Edit invoice"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteInvoice(i.id, i.attachment_path)}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      title="Delete invoice"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={8}>
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        
      ) : payments.length === 0 ? (
        <div className="rounded-2xl border bg-white shadow-sm p-10 text-center">
          <div className="text-sm font-medium text-slate-900">No payments yet</div>
          <div className="text-xs text-slate-600 mt-1">Record a payment to start building this vendor’s ledger.</div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-x-auto overflow-y-visible">
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
            <div className="font-semibold text-slate-900">Payments</div>
            <button
              type="button"
              onClick={() => {
                setErr(null);
                setShowPay(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add payment
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Attachment</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3">{p.payment_date || "—"}</td>
                  <td className="px-4 py-3">{p.invoice_number || "—"}</td>
                  <td className="px-4 py-3 text-right">{Number(p.amount).toFixed(2)}</td>
                  <td className="px-4 py-3">{p.method || "—"}</td>
                  <td className="px-4 py-3">{p.reference || "—"}</td>
                  <td className="px-4 py-3">
                    {p.attachment_path ? (
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onMouseEnter={() => p.attachment_path && onAttachmentTriggerEnter(p.attachment_path)}
                          onMouseLeave={onAttachmentTriggerLeave}
                          onFocus={() => p.attachment_path && onAttachmentTriggerEnter(p.attachment_path)}
                          onBlur={onAttachmentTriggerLeave}
                          onClick={() => openAttachment(p.attachment_path)}
                          className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900"
                        >
                          <Paperclip size={16} />
                          View
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => startEditPayment(p)}
                      className="inline-flex items-center gap-2 text-sm text-slate-900 hover:text-slate-700 mr-4"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePayment(p.id, p.attachment_path)}
                      className="inline-flex items-center gap-2 text-sm text-rose-700 hover:text-rose-900"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={8}>
                    No payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        
        </div>
      )}


      {/* Edit vendor modal */}
      {showEditVendor && vendor && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Edit vendor</div>
                <div className="text-xs text-slate-500 mt-0.5">Update vendor profile details.</div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditVendor(false)}
                className="px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">Vendor name</label>
                <input
                  value={editVendorName}
                  onChange={(e) => setEditVendorName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Vendor name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Contact name</label>
                <input
                  value={editVendorContact}
                  onChange={(e) => setEditVendorContact(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Contact name"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Phone</label>
                  <input
                    value={editVendorPhone}
                    onChange={(e) => setEditVendorPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Phone"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Email</label>
                  <input
                    value={editVendorEmail}
                    onChange={(e) => setEditVendorEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Email"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEditVendor(false)}
                className="px-4 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!vendor) return;
                  setErr(null);
                  const supabase = createSupabaseBrowserClient();
                  const { error } = await supabase
                    .from("vendors")
                    .update({
                      name: editVendorName.trim() || vendor.name,
                      contact_name: editVendorContact.trim() || null,
                      phone: editVendorPhone.trim() || null,
                      email: editVendorEmail.trim() || null,
                    })
                    .eq("company_id", companyId)
                    .eq("id", vendor.id);

                  if (error) {
                    setErr(error.message);
                    return;
                  }
                  setVendor({
                    ...vendor,
                    name: editVendorName.trim() || vendor.name,
                    contact_name: editVendorContact.trim() || null,
                    phone: editVendorPhone.trim() || null,
                    email: editVendorEmail.trim() || null,
                  });
                  setShowEditVendor(false);
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div>
                <label className="block text-xs text-slate-600 mb-1">Reference (Super Vendor)</label>
                <select value={invRef} onChange={(e) => setInvRef(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900">
                  <option value="">None</option>
                  {superVendors.map((sv) => (
                    <option key={sv.id} value={sv.id}>
                      {sv.name}
                    </option>
                  ))}
                </select>
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

              <div>
                <label className="block text-xs text-slate-600 mb-1">Attachment (optional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setInvFile(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                    />
                    <div className="mt-1 text-xs text-slate-500">Attach from computer</div>
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setInvFile(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                    />
                    <div className="mt-1 text-xs text-slate-500">Take photo on mobile</div>
                  </div>
                </div>
                {invFile && <div className="mt-1 text-xs text-slate-600">Selected: {invFile.name}</div>}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowInv(false);
                  setInvFile(null);
                }}
                className="px-3 py-2 rounded-lg border bg-white text-sm"
              >
                Cancel
              </button>
              <button onClick={() => void createInvoice()} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit invoice modal */}
      {editInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditInv(null)} aria-hidden="true" />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl p-4">
            <div className="text-lg font-semibold text-slate-900">Edit invoice</div>
            <div className="grid grid-cols-1 gap-3 mt-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Invoice number</label>
                <input value={editInvNo} onChange={(e) => setEditInvNo(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Reference (Super Vendor)</label>
                <select value={editInvRef} onChange={(e) => setEditInvRef(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900">
                  <option value="">None</option>
                  {superVendors.map((sv) => (
                    <option key={sv.id} value={sv.id}>
                      {sv.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Invoice date</label>
                  <input type="date" value={editInvDate} onChange={(e) => setEditInvDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Due date</label>
                  <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Amount</label>
                <input type="number" value={editInvAmt} onChange={(e) => setEditInvAmt(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Description</label>
                <textarea value={editInvDesc} onChange={(e) => setEditInvDesc(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900" rows={3} />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Replace attachment (optional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setEditInvFile(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                    />
                    <div className="mt-1 text-xs text-slate-500">Attach from computer</div>
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditInvFile(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                    />
                    <div className="mt-1 text-xs text-slate-500">Take photo on mobile</div>
                  </div>
                </div>
                {editInvFile && <div className="mt-1 text-xs text-slate-600">Selected: {editInvFile.name}</div>}
                {!editInvFile && editInv.attachment_path && (
                  <div className="mt-1 text-xs text-slate-600">Current attachment: {editInv.attachment_path}</div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setEditInv(null);
                  setEditInvFile(null);
                }}
                className="px-3 py-2 rounded-lg border bg-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void updateInvoice()}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
              >
                Update
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

              <div>
                <label className="block text-xs text-slate-600 mb-1">Attachment (optional)</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-900 hover:file:bg-slate-200"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-900 hover:file:bg-slate-200"
                  />
                  <p className="text-xs text-slate-500">
                    On mobile, the second chooser opens the camera on most devices.
                  </p>
                  {payFile ? <p className="text-xs text-slate-700">Selected: {payFile.name}</p> : null}
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

      {/* Edit payment modal */}
      {editPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setEditPay(null);
              setEditPayFile(null);
            }}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl p-4">
            <div className="text-lg font-semibold text-slate-900">Edit payment</div>

            <div className="grid grid-cols-1 gap-3 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Payment date</label>
                  <input
                    type="date"
                    value={editPayDate}
                    onChange={(e) => setEditPayDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Amount</label>
                  <input
                    type="number"
                    value={editPayAmt}
                    onChange={(e) => setEditPayAmt(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Apply to invoice (optional)</label>
                <select
                  value={editPayInvoiceId}
                  onChange={(e) => setEditPayInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                >
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
                  <input
                    value={editPayMethod}
                    onChange={(e) => setEditPayMethod(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Reference</label>
                  <input
                    value={editPayRef}
                    onChange={(e) => setEditPayRef(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Attachment (optional)</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setEditPayFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-900 hover:file:bg-slate-200"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditPayFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-900 hover:file:bg-slate-200"
                  />
                  <p className="text-xs text-slate-500">
                    Upload a replacement attachment. If you do not select a file, the existing attachment remains.
                  </p>
                  {editPayFile ? <p className="text-xs text-slate-700">Selected: {editPayFile.name}</p> : null}
                  {!editPayFile && editPay.attachment_path ? (
                    <p className="text-xs text-slate-600">Current attachment: {editPay.attachment_path}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setEditPay(null);
                  setEditPayFile(null);
                }}
                className="px-3 py-2 rounded-lg border bg-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void updatePayment()}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatement && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowStatement(false)} aria-hidden="true" />
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Account statement</div>
                <div className="text-xs text-slate-600 mt-1">{vendor?.name ?? "Vendor"}</div>
              </div>
              <button
                onClick={() => setShowStatement(false)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Start date</label>
                <input
                  type="date"
                  value={statementStart}
                  onChange={(e) => setStatementStart(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">End date</label>
                <input
                  type="date"
                  value={statementEnd}
                  onChange={(e) => setStatementEnd(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (statementRows.length === 0) return;

                    const filename = `Vendor Statement - ${vendor?.name ?? "vendor"}`;
                    const rows = statementRows.map((r) => ({
                      Date: r.date,
                      Type: r.type,
                      Reference: r.reference,
                      Invoice: r.invoice_number,
                      Debit: r.debit,
                      Credit: r.credit,
                      Balance: r.balance,
                    }));

                    const cols = [
                      { header: "Date", value: (x: any) => x.Date ?? "" },
                      { header: "Type", value: (x: any) => x.Type ?? "" },
                      { header: "Reference", value: (x: any) => x.Reference ?? "" },
                      { header: "Invoice", value: (x: any) => x.Invoice ?? "" },
                      { header: "Debit", value: (x: any) => x.Debit ?? "" },
                      { header: "Credit", value: (x: any) => x.Credit ?? "" },
                      { header: "Balance", value: (x: any) => x.Balance ?? "" },
                    ];

                    exportToExcel(filename, rows, cols);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800"
                >
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (statementRows.length === 0) return;

                    const filename = `Vendor Statement - ${vendor?.name ?? "vendor"}`;
                    const rows = statementRows.map((r) => ({
                      Date: r.date,
                      Type: r.type,
                      Reference: r.reference,
                      Invoice: r.invoice_number,
                      Debit: r.debit,
                      Credit: r.credit,
                      Balance: r.balance,
                    }));

                    const cols = [
                      { header: "Date", value: (x: any) => x.Date ?? "" },
                      { header: "Type", value: (x: any) => x.Type ?? "" },
                      { header: "Reference", value: (x: any) => x.Reference ?? "" },
                      { header: "Invoice", value: (x: any) => x.Invoice ?? "" },
                      { header: "Debit", value: (x: any) => x.Debit ?? "" },
                      { header: "Credit", value: (x: any) => x.Credit ?? "" },
                      { header: "Balance", value: (x: any) => x.Balance ?? "" },
                    ];

                    exportToPdf(filename, filename, rows, cols);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50"
                >
                  Export PDF
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Invoice</th>
                    <th className="px-4 py-3 text-left">Reference</th>
                    <th className="px-4 py-3 text-right">Debit</th>
                    <th className="px-4 py-3 text-right">Credit</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                        No transactions found for the selected date range.
                      </td>
                    </tr>
                  ) : (
                    statementRows.map((r, idx) => (
                      <tr key={`${r.type}-${r.reference}-${idx}`} className="bg-white">
                        <td className="px-4 py-3">{r.date}</td>
                        <td className="px-4 py-3">{r.type}</td>
                        <td className="px-4 py-3">{r.invoice_number}</td>
                        <td className="px-4 py-3">{r.reference}</td>
                        <td className="px-4 py-3 text-right">{r.debit ? r.debit.toFixed(2) : "—"}</td>
                        <td className="px-4 py-3 text-right">{r.credit ? r.credit.toFixed(2) : "—"}</td>
                        <td className="px-4 py-3 text-right font-medium">{r.balance.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

{activePreview &&
  createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70"
      onMouseEnter={onPreviewOverlayEnter}
      onMouseLeave={onPreviewOverlayLeave}
      onClick={(e) => {
        if (e.target === e.currentTarget) setActivePreview(null);
      }}
    >
      <button
        type="button"
        onClick={() => setActivePreview(null)}
        className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-slate-900 shadow hover:bg-white"
        aria-label="Close preview"
      >
        Close
      </button>

      <div
        className="max-h-[92vh] max-w-[96vw] w-full h-full p-4 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {activePreview.kind === "pdf" ? (
          <iframe
            src={`${activePreview.url}#toolbar=0&navpanes=0&scrollbar=1`}
            className="h-full w-full rounded-xl bg-white"
            title="Attachment PDF preview"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activePreview.url}
            alt="Attachment preview"
            className="max-h-[92vh] max-w-[96vw] w-auto h-auto object-contain rounded-xl bg-white"
          />
        )}
      </div>
    </div>,
    document.body
  )}
    </div>
  );
}