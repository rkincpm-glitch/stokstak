import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Ensures the currently-authenticated user has a row in company_users.
 *
 * Intended use-case:
 * - A user was invited (or otherwise provisioned) with user_metadata.company_id (+ role)
 *   but the company_users row is missing.
 *
 * This route:
 * 1) Reads the current user via the session cookie (anon key).
 * 2) Reads company_id (+ optional role) from user.user_metadata.
 * 3) Upserts company_users using the Service Role key.
 */
export async function POST() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anon) {
      return NextResponse.json(
        { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY" },
        { status: 500 }
      );
    }

    if (!serviceRole) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    // Next.js 16+ returns cookies() as a Promise in some contexts.
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op: this endpoint only needs to READ the current auth cookie
        },
      },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const user = userRes.user;
    const company_id = (user.user_metadata as any)?.company_id as string | undefined;
    const role = ((user.user_metadata as any)?.role as string | undefined) ?? "pm";

    if (!company_id) {
      return NextResponse.json(
        { ok: false, error: "No company_id on user metadata" },
        { status: 400 }
      );
    }

    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: upsertErr } = await admin
      .from("company_users")
      .upsert(
        {
          company_id,
          user_id: user.id,
          role,
        },
        { onConflict: "company_id,user_id" }
      );

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, company_id, role }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
