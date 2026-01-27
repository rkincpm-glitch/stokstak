import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/security";
import { createAuthedServerClient, getSelectedCompanyId, requireUserId } from "@/lib/serverSupabase";

const BodySchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(120),
});

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    const { companyId, name } = parsed.data;

    // Enforce that the requested company matches the current selected company to avoid cross-tenant writes
    const selectedCompanyId = await getSelectedCompanyId();
    if (selectedCompanyId && selectedCompanyId !== companyId) {
      return NextResponse.json({ ok: false, error: "Company mismatch" }, { status: 403 });
    }

    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });

    const supabase = await createAuthedServerClient();

    // Must be admin for this company
    const { data: membership, error: memErr } = await supabase
      .from("company_users")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 400 });
    if (String((membership as any)?.role || "").toLowerCase() !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase.from("companies").update({ name }).eq("id", companyId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
