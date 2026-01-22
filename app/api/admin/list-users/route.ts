import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

async function getAuthedUserId() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const c of cookiesToSet) cookieStore.set(c);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars are not configured." },
      { status: 500 }
    );
  }

  const requesterId = await getAuthedUserId();
  if (!requesterId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Authorization: requester must have profile.role === 'admin'
  const { data: requesterProfile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", requesterId)
    .maybeSingle();

  if (requesterProfile?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // List auth users (email) + profiles (group/active/display_name)
  const { data: usersResp, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) {
    return NextResponse.json({ ok: false, error: usersErr.message }, { status: 500 });
  }

  const users = usersResp?.users || [];
  const userIds = users.map((u) => u.id);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, role, display_name, is_active, created_at")
    .in("id", userIds);

  const byId = new Map<string, any>();
  for (const p of profiles || []) byId.set(p.id, p);

  const rows = users
    .map((u) => {
      const p = byId.get(u.id);
      return {
        id: u.id,
        email: u.email || "",
        display_name: p?.display_name || u.email || u.id,
        role: p?.role || "pm",
        is_active: p?.is_active ?? true,
        created_at: p?.created_at || u.created_at,
      };
    })
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));

  // Companies + memberships (for UI assignment)
  const { data: companies, error: compErr } = await admin
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });

  if (compErr) {
    return NextResponse.json({ ok: true, users: rows, companies: [], membershipsByUserId: {} });
  }

  const { data: memberships } = await admin
    .from("company_users")
    .select("user_id, company_id, role")
    .in("user_id", userIds);

  const membershipsByUserId: Record<string, { company_id: string; role: string }[]> = {};
  for (const m of memberships || []) {
    const uid = String((m as any).user_id);
    if (!membershipsByUserId[uid]) membershipsByUserId[uid] = [];
    membershipsByUserId[uid].push({
      company_id: String((m as any).company_id),
      role: String((m as any).role || "member"),
    });
  }

  return NextResponse.json({ ok: true, users: rows, companies: companies || [], membershipsByUserId });
}
