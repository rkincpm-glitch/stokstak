"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { useCompany } from "@/lib/useCompany";

export default function CompanyProfileSettings() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const { companyName, role } = useCompany();
  const canEdit = String(role || "").toLowerCase() === "admin";

  const [name, setName] = useState(companyName || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setName(companyName || "");
  }, [companyName]);

  const save = async () => {
    setMsg(null);
    if (!canEdit) return;
    const n = name.trim();
    if (!n) {
      setMsg("Company name is required.");
      return;
    }

    setSaving(true);
    try {
      const resp = await fetch("/api/company/update-name", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyId, name: n }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j?.error || "Failed to save");
      setMsg("Saved.");
      // Best-effort: reload to refresh header/company name across the app.
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/${companyId}/settings`} className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">Company Profile</h1>
        <p className="text-sm text-slate-600 mt-1">Set the official company name used across the app and in reports.</p>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-slate-900">Official name</label>
          <input
            className="w-full rounded-xl border px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., RK Inc - Albany Site"
            disabled={!canEdit || saving}
          />
          {!canEdit ? (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              Only admins can edit the company name.
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={save}
            disabled={!canEdit || saving}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </button>
          {msg ? <div className="text-sm text-slate-700">{msg}</div> : null}
        </div>
      </div>
    </div>
  );
}
