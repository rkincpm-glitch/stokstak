"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type Company = {
  id: string;
  name: string;
};

function setActiveCompanyCookie(companyId: string) {
  const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
  const secure = isHttps ? "; Secure" : "";
  document.cookie = `stokstak_company_id=${encodeURIComponent(companyId)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function clearActiveCompanyCookie() {
  const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
  const secure = isHttps ? "; Secure" : "";
  document.cookie = `stokstak_company_id=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export default function SelectCompanyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [attemptedAutoFix, setAttemptedAutoFix] = useState(false);

  const handleSignOut = async () => {
    try {
      clearActiveCompanyCookie();
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut().catch(() => null);
    } finally {
      router.replace("/auth");
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErr(null);

      const supabase = createSupabaseBrowserClient();

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        router.replace("/auth");
        return;
      }

      
const loadCompaniesViaServer = async () => {
  try {
    const resp = await fetch("/api/auth/my-companies", { method: "POST" });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.ok) {
      return { companies: null as null | Company[], error: json?.error || "Unable to load companies." };
    }
    return { companies: (json.companies || []) as Company[], error: null as string | null };
  } catch (e: any) {
    return { companies: null as null | Company[], error: e?.message || "Unable to load companies." };
  }
};

const loadMemberships = async () =>
        supabase
          .from("company_users")
          .select("company_id")
          .eq("user_id", user.id);

      
// Prefer a server-side membership lookup (bypasses RLS that can block initial workspace selection)
let serverCompanies: Company[] | null = null;
const serverLoad1 = await loadCompaniesViaServer();
if (serverLoad1.companies) {
  serverCompanies = serverLoad1.companies;
}

// If server lookup returns empty, try to reconcile membership once (invited user metadata) and retry
if ((serverCompanies?.length || 0) === 0 && !attemptedAutoFix) {
  const metaCompanyId = String((user as any)?.user_metadata?.company_id || "").trim();
  if (metaCompanyId) {
    setAttemptedAutoFix(true);
    try {
      const resp = await fetch("/api/auth/ensure-membership", { method: "POST" });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErr(json?.error || "Unable to auto-add you to the company.");
      } else {
        const serverLoad2 = await loadCompaniesViaServer();
        if (serverLoad2.companies) serverCompanies = serverLoad2.companies;
      }
    } catch (e: any) {
      setErr(e?.message || "Unable to auto-add you to the company.");
    }
  }
}

if (serverCompanies && serverCompanies.length > 0) {
  // If user belongs to exactly one company, auto-enter it.
  if (serverCompanies.length === 1) {
    const only = serverCompanies[0];
    setActiveCompanyCookie(only.id);
    router.replace(`/${only.id}`);
    return;
  }
  setCompanies(serverCompanies);
  setLoading(false);
  return;
}

// Step 1: get membership rows (this should be allowed by policy: user_id = auth.uid())
      let { data: memberships, error: mErr } = await loadMemberships();

      if (cancelled) return;

      if (mErr) {
        setErr(mErr.message);
        setCompanies([]);
        setLoading(false);
        return;
      }

      let companyIds = (memberships || [])
        .map((r: any) => String(r.company_id))
        .filter(Boolean);

      if (companyIds.length === 0) {
        // Clear any stale company selection so the user isn't stuck in a loop.
        clearActiveCompanyCookie();
        setCompanies([]);
        setLoading(false);
        return;
      }

      // Step 2: fetch companies by id without relying on a join (joins can be blocked by overly strict policies)
      const { data: comps, error: cErr } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds)
        .order("name", { ascending: true });

      if (cancelled) return;

      if (cErr) {
        // If your `companies` table has a strict policy tied to `current_company_id()`, the name lookup can be blocked
        // before a company is selected. In that case, fall back to showing raw company IDs.
        setErr(null);
        setCompanies(companyIds.map((id) => ({ id, name: id })));
        setLoading(false);
        return;
      }

      const normalized = (comps || []) as Company[];

      if (normalized.length === 1) {
        setActiveCompanyCookie(normalized[0].id);
        router.replace(`/${normalized[0].id}`);
        return;
      }

      setCompanies(normalized);
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const emptyState = useMemo(() => {
    if (loading) return null;
    if (companies.length > 0) return null;

    return (
      <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-slate-700">
        <div className="font-semibold text-slate-900">No companies found for this user.</div>
        <div className="mt-2 text-slate-600">
          Ask your admin to add your user to a company in <span className="font-medium">company_users</span>.
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }, [companies.length, loading]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Select Company</h1>
        <p className="text-sm text-slate-600 mt-2">Choose the workspace you want to access.</p>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Switch user
          </button>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {emptyState}

        {companies.length > 0 && (
          <div className="mt-6 grid gap-3">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCompanyCookie(c.id);
                  router.push(`/${c.id}`);
                }}
                className="text-left rounded-xl border bg-white p-4 hover:shadow-sm transition-shadow"
              >
                <div className="font-semibold text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-500 mt-1">{c.id}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
