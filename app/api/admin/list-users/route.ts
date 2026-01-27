import { NextResponse } from "next/server";
import { createAuthedServerClient, getSelectedCompanyId, requireUserId } from "@/lib/serverSupabase";

// Lists users for the currently selected company.
// Does NOT require Service Role; relies on RLS + "admin" membership.
export async function POST() {
  try {
    const companyId = await getSelectedCompanyId();
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "No company selected." }, { status: 400 });
    }

    const requesterId = await requireUserId();
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const supabase = await createAuthedServerClient();

    const { data: requesterMembership, error: rmErr } = await supabase
      .from("company_users")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", requesterId)
      .maybeSingle();

    if (rmErr) return NextResponse.json({ ok: false, error: rmErr.message }, { status: 400 });
    if (String((requesterMembership as any)?.role || "").toLowerCase() !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Memberships for this company
    const { data: memberships, error: mErr } = await supabase
      .from("company_users")
      .select("user_id, company_id, role")
      .eq("company_id", companyId);

    if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 400 });

    const userIds = Array.from(new Set((memberships || []).map((m: any) => String(m.user_id))));

    // Profiles for these users (email may be null if not stored; UI should handle)
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, display_name, role, is_active, email")
      .in("id", userIds);

    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 400 });

    const profileById: Record<string, any> = {};
    for (const pr of profiles || []) profileById[String((pr as any).id)] = pr;

    const users = userIds.map((id) => {
      const pr = profileById[id] || {};
      const email = String((pr as any).email || "");
      return {
        id,
        email,
        display_name: String((pr as any).display_name || ""),
        role: String((pr as any).role || "pm"),
        is_active: (pr as any).is_active === false ? false : true,
      };
    });

    const membershipsByUserId: Record<string, { company_id: string; role: string }[]> = {};
    for (const m of memberships || []) {
      const uid = String((m as any).user_id);
      if (!membershipsByUserId[uid]) membershipsByUserId[uid] = [];
      membershipsByUserId[uid].push({
        company_id: String((m as any).company_id),
        role: String((m as any).role || "member"),
      });
    }

    // Companies list: just current company
    const { data: companies } = await supabase.from("companies").select("id, name").eq("id", companyId);

    return NextResponse.json({ ok: true, users, companies: companies || [], membershipsByUserId });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
