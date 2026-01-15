"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type UseCompanyResult = {
  loading: boolean;
  companyId: string | null;
  role: string | null;
  error: string | null;
};

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

export function useCompany(): UseCompanyResult {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      const supabase = createSupabaseBrowserClient();

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        if (!cancelled) {
          setError(authErr.message);
          setCompanyId(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      const user = authData?.user;
      if (!user) {
        if (!cancelled) {
          setCompanyId(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      const activeCompanyId = getCookie("stokstak_company_id");
      if (!activeCompanyId) {
        if (!cancelled) {
          setCompanyId(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      const { data, error: cuErr } = await supabase
        .from("company_users")
        .select("company_id, role")
        .eq("user_id", user.id)
        .eq("company_id", activeCompanyId)
        .maybeSingle();

      if (cuErr) {
        if (!cancelled) {
          setError("Failed to load company membership.");
          setCompanyId(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      if (!data?.company_id) {
        if (!cancelled) {
          setCompanyId(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setCompanyId(String(data.company_id));
        setRole((data as any).role ?? null);
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, companyId, role, error };
}
