import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Returns the list of companies the currently authenticated user belongs to.
 *
 * Uses the session cookie (anon key) to identify the user, then uses the
 * Service Role key to read company_users and companies, bypassing RLS.
 *
 * This endpoint exists because RLS policies may block reading company_users/companies
 * before a company is selected, which can strand non-admin users on /select-company.
 */
export async function POST() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!url || !anon) {
      return NextResponse.json({ ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL/ANON key." }, { status: 500 });
    }
    if (!serviceRole) {
      return NextResponse.json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const cookieStore = await cookies();

    // Identify the user via SSR session cookies (anon key)
    const ssr = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op (this endpoint is read-only for the session)
        },
      },
    });

    const { data: userData, error: userErr } = await ssr.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const user = userData.user;

    // Service role client (bypass RLS)
    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: memberships, error: mErr } = await admin
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id);

    if (mErr) {
      return NextResponse.json({ ok: false, error: mErr.message }, { status: 400 });
    }

    const companyIds = (memberships || []).map((r: any) => String(r.company_id)).filter(Boolean);

    if (companyIds.length === 0) {
      return NextResponse.json({ ok: true, companies: [] as any[] }, { status: 200 });
    }

    const { data: comps, error: cErr } = await admin
      .from("companies")
      .select("id, name")
      .in("id", companyIds)
      .order("name", { ascending: true });

    if (cErr) {
      // Even if company lookup fails, return raw ids so user can still select
      return NextResponse.json({
        ok: true,
        companies: companyIds.map((id) => ({ id, name: id })),
      }, { status: 200 });
    }

    return NextResponse.json({ ok: true, companies: comps || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
