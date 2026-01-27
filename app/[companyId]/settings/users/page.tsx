"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, Save, RefreshCw } from "lucide-react";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  // derived (not saved via /update-user)
  company_ids?: string[];
};

type CompanyMini = {
  id: string;
  name: string;
};

const ROLE_OPTIONS = ["pm", "requester", "purchaser", "receiver", "president", "admin"] as const;

export default function CompanyUsersSettingsPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyMini[]>([]);
  const [editingCompaniesFor, setEditingCompaniesFor] = useState<UserRow | null>(null);
  const [companySelection, setCompanySelection] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSaveStatus("idle");

    try {
      const resp = await fetch("/api/admin/list-users", { method: "POST" });
      const json = await resp.json().catch(() => ({}));
      if (resp.status === 401) {
        router.replace("/auth");
        return;
      }
      if (!resp.ok || !json?.ok) {
        setErrorMsg(json?.error || "Unable to load users.");
        setRows([]);
        setLoading(false);
        return;
      }
      const users = (json.users || []) as UserRow[];
      const comps = (json.companies || []) as CompanyMini[];
      const membershipsByUserId = (json.membershipsByUserId || {}) as Record<string, { company_id: string }[]>;

      for (const u of users) {
        const mem = membershipsByUserId[u.id] || [];
        u.company_ids = mem.map((m: any) => String(m.company_id));
      }

      setCompanies(comps);
      setRows(users);
      setLoading(false);
    } catch (e: any) {
      setErrorMsg(e?.message || "Unable to load users.");
      setRows([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasChanges = useMemo(() => saveStatus === "idle" && rows.length > 0, [rows.length, saveStatus]);

  const onChange = (id: string, patch: Partial<UserRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaveStatus("idle");
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMsg(null);

    try {
      for (const row of rows) {
        const resp = await fetch("/api/admin/update-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: row.id,
            role: row.role,
            display_name: row.display_name,
            is_active: row.is_active,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok) {
          throw new Error(json?.error || "Failed to save user changes.");
        }
      }
      setSaveStatus("saved");
    } catch (e: any) {
      setErrorMsg(e?.message || "Error saving changes.");
      setSaveStatus("idle");
    }
  };

  const openCompanyEditor = (u: UserRow) => {
    setEditingCompaniesFor(u);
    const initial: Record<string, boolean> = {};
    for (const c of companies) initial[c.id] = false;
    for (const cid of u.company_ids || []) initial[cid] = true;
    setCompanySelection(initial);
  };

  const saveCompanyAssignments = async () => {
    if (!editingCompaniesFor) return;
    setErrorMsg(null);

    const companyIds = Object.entries(companySelection)
      .filter(([, v]) => v)
      .map(([k]) => k);

    try {
      const resp = await fetch("/api/admin/set-user-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editingCompaniesFor.id, companyIds }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Unable to update company assignments.");

      // reflect in UI
      setRows((prev) =>
        prev.map((r) => (r.id === editingCompaniesFor.id ? { ...r, company_ids: companyIds } : r))
      );
      setEditingCompaniesFor(null);
    } catch (e: any) {
      setErrorMsg(e?.message || "Unable to update company assignments.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading users...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-700" />
          <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Users sign up with email and password. Access is controlled by the <span className="font-medium">role</span> (profile group).
        </p>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
        )}

        <div className="mt-6 overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Display name</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Companies</th>
                <th className="px-4 py-3 text-left font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{r.email}</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-lg border px-3 py-2 bg-white"
                      value={r.display_name || ""}
                      onChange={(e) => onChange(r.id, { display_name: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border px-3 py-2 bg-white"
                      value={r.role}
                      onChange={(e) => onChange(r.id, { role: e.target.value })}
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(r.company_ids || []).slice(0, 3).map((cid) => {
                        const name = companies.find((c) => c.id === cid)?.name || cid;
                        return (
                          <span key={cid} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            {name}
                          </span>
                        );
                      })}
                      {(r.company_ids || []).length > 3 && (
                        <span className="text-xs text-slate-500">+{(r.company_ids || []).length - 3} more</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openCompanyEditor(r)}
                      className="mt-2 text-xs text-blue-700 hover:text-blue-900"
                    >
                      Edit companies
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!r.is_active}
                      onChange={(e) => onChange(r.id, { is_active: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Company assignment modal */}
        {editingCompaniesFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
              <div className="border-b px-5 py-4">
                <div className="text-sm font-semibold text-slate-900">Assign companies</div>
                <div className="mt-1 text-xs text-slate-500">
                  {editingCompaniesFor.email}
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
                {companies.length === 0 ? (
                  <div className="text-sm text-slate-600">No companies found.</div>
                ) : (
                  <div className="space-y-2">
                    {companies.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={!!companySelection[c.id]}
                          onChange={(e) =>
                            setCompanySelection((prev) => ({ ...prev, [c.id]: e.target.checked }))
                          }
                        />
                        <div className="min-w-0">
                          <div className="text-sm text-slate-900 truncate">{c.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">{c.id}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t px-5 py-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCompaniesFor(null)}
                  className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveCompanyAssignments()}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                >
                  Save companies
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-slate-500">
          {saveStatus === "saved" ? "Saved." : hasChanges ? "Edit fields and click Save." : ""}
        </div>
      </main>
    </div>
  );
}
