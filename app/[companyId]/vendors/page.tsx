"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { Plus, Search } from "lucide-react";

type Vendor = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string | null;
};

export default function VendorsPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [q, setQ] = useState("");

  // create vendor
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.replace("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("vendors")
      .select("id, name, contact_name, phone, email, is_active, created_at")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (error) {
      setErr(error.message);
      setVendors([]);
    } else {
      setVendors((data || []) as Vendor[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vendors;
    return vendors.filter((v) => (`${v.name} ${v.contact_name ?? ""} ${v.email ?? ""}`.toLowerCase().includes(s)));
  }, [vendors, q]);

  const createVendor = async () => {
    setErr(null);
    if (!name.trim()) {
      setErr("Vendor name is required.");
      return;
    }

    const { error } = await supabase.from("vendors").insert({
      company_id: companyId,
      name: name.trim(),
      contact_name: contact.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
    });

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

        <button
          onClick={() => setShowNew(true)}
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
