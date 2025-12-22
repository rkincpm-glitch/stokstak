"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";

type UseCompanyResult = {
  loading: boolean;
  companyId: string | null;
  role: string | null;
  error: string | null;
};

export function useCompany(): UseCompanyResult {
  const params = useParams<{ companyId?: string }>();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) console.error(userErr);

      const user = userData?.user;
      if (!user) {
        if (!cancelled) {
          setCompanyId(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      // Prefer companyId from route: /[companyId]/...
      // This keeps the UI aligned with middleware enforcement.
      const routeCompanyId = typeof params?.companyId === "string" ? params.companyId : null;

      // With RLS, user can only read their own membership rows.
      // If we have a route company, load role for that company.
      // Otherwise, fall back to the first membership (legacy pages).
      const membershipQuery = supabase
        .from("company_users")
        .select("company_id, role")
        .eq("user_id", user.id);

      const { data, error: cuErr } = routeCompanyId
        ? await membershipQuery.eq("company_id", routeCompanyId).maybeSingle()
        : await membershipQuery.order("created_at", { ascending: true }).limit(1).maybeSingle();

      if (cuErr) {
        console.error(cuErr);
        if (!cancelled) {
          setError("Failed to load company membership.");
          setCompanyId(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        // If routeCompanyId is present but user is not a member, treat as no access.
        if (routeCompanyId && !data?.company_id) {
          setError("You do not have access to this company.");
          setCompanyId(null);
          setRole(null);
          setLoading(false);
          return;
        }

        setCompanyId((data?.company_id ?? routeCompanyId) ?? null);
        setRole(data?.role ?? null);
        setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [params?.companyId]);

  return { loading, companyId, role, error };
}
