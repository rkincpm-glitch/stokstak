import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Ensures the logged-in user has a row in `profiles`.
// Uses Service Role to avoid RLS edge cases during first login/signup.

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars are not configured." },
      { status: 500 }
    );
  }

  // Read session user from request cookies using anon key
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // No-op in Route Handler (we are not mutating auth cookies here)
        for (const c of cookiesToSet) {
          cookieStore.set(c);
        }
      },
    },
  });

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const userId = user.id;
  const email = user.email || null;

  // Default role/group for normal signups
  const defaultRole = "pm";

  // Upsert profile; preserve existing role if present
  const { data: existing } = await admin
    .from("profiles")
    .select("id, role, display_name, is_active")
    .eq("id", userId)
    .maybeSingle();

  const nextRole = existing?.role || defaultRole;
  const nextName = existing?.display_name || email || userId;
  const nextActive = existing?.is_active ?? true;

  const { error: upErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        role: nextRole,
        display_name: nextName,
        is_active: nextActive,
      },
      { onConflict: "id" }
    );

  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: { id: userId, role: nextRole, display_name: nextName, is_active: nextActive } });
}
