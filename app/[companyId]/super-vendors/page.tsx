"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { Plus } from "lucide-react";

type SuperVendor = {
  id: string;
  name: string;
  created_at: string | null;
};

export default function SuperVendorsPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<SuperVendor[]>([]);

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.replace("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("super_vendors")
      .select("id, name, created_at")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows((data || []) as SuperVendor[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const createOne = async () => {
    setErr(null);
    if (!name.trim()) {
      setErr("Name is required.");
      return;
    }

    const { error } = await supabase.from("super_vendors").insert({
      company_id: companyId,
      name: name.trim(),
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setShowNew(false);
    setName("");
    await load();
  };

  if (loading) return <div className="text-slate-500">Loading super vendors…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Super Vendors</h1>
          <div className="text-sm text-slate-600 mt-1">Aggregator parties used only for rollups (separate from Vendors).</div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/${companyId}/vendors`}
            className="px-3 py-2 rounded-lg border bg-white text-sm text-slate-900 hover:bg-slate-50"
          >
            Back to vendors
          </Link>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            New super vendor
          </button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={2}>
                  No super vendors yet.
                </td>
              </tr>
            ) : (
              rows.map((sv) => (
                <tr key={sv.id} className="border-t">
                  <td className="px-4 py-3 font-medium text-slate-900">{sv.name}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/${companyId}/super-vendors/${sv.id}`} className="text-emerald-700 hover:text-emerald-900">
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNew(false)} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl p-4">
            <div className="text-lg font-semibold text-slate-900">New super vendor</div>
            <div className="mt-3">
              <label className="block text-xs text-slate-600 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900"
              />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="px-3 py-2 rounded-lg border bg-white text-sm">
                Cancel
              </button>
              <button onClick={() => void createOne()} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
