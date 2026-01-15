"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Save, RefreshCw } from "lucide-react";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
};

const ROLE_OPTIONS = ["pm", "requester", "purchaser", "receiver", "president", "admin"] as const;

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);
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
      setRows((json.users || []) as UserRow[]);
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

        <div className="mt-4 text-xs text-slate-500">
          {saveStatus === "saved" ? "Saved." : hasChanges ? "Edit fields and click Save." : ""}
        </div>
      </main>
    </div>
  );
}
