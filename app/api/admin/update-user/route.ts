import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

async function getAuthedUserId(): Promise<string | null> {
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

export async function POST(req: Request) {
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
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: requesterProfile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", requesterId)
    .maybeSingle();

  if (requesterProfile?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "").trim();
  const role = String(body.role || "").trim();
  const display_name =
    body.display_name === null || body.display_name === undefined
      ? null
      : String(body.display_name);
  const is_active = typeof body.is_active === "boolean" ? body.is_active : null;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json({ ok: false, error: "Missing role" }, { status: 400 });
  }

  // Prevent admin from disabling their own account
  if (userId === requesterId && is_active === false) {
    return NextResponse.json(
      { ok: false, error: "You cannot disable your own admin account." },
      { status: 400 }
    );
  }

  const patch: any = { id: userId, role };
  if (display_name !== null) patch.display_name = display_name;
  if (is_active !== null) patch.is_active = is_active;

  const { error: upErr } = await admin
    .from("profiles")
    .upsert(patch, { onConflict: "id" });

  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
