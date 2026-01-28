import { NextResponse } from "next/server";
import { createAuthedServerClient, requireUserId } from "@/lib/serverSupabase";

// Ensures the logged-in user has a row in `profiles`.
// Uses the authed server client (anon + cookies) and relies on RLS allowing users to upsert their own profile.

export async function POST() {
  try {
    const supabase = await createAuthedServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const user = data.user;
    const userId = user.id;
    const email = user.email || null;

    // Default role for new users
    const nextRole = (user.user_metadata as any)?.role || "pm";
    const nextName = (user.user_metadata as any)?.display_name || "";
    const nextActive = true;

    const { error: upErr } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          role: nextRole,
          display_name: nextName,
          is_active: nextActive,
          email,
        },
        { onConflict: "id" }
      );

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      profile: { id: userId, role: nextRole, display_name: nextName, is_active: nextActive, email },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
