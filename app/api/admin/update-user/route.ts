import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuthedServerClient, getSelectedCompanyId, requireUserId } from "@/lib/serverSupabase";
import { requireSameOrigin, rateLimit } from "@/lib/security";

const BodySchema = z.object({
  id: z.string().uuid(),
  role: z.string().min(1).max(32),
  display_name: z.string().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
});

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();
  return "unknown";
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const rl = rateLimit(`update-user:${getClientIp(req)}`, { capacity: 30, refillPerSecond: 1 });
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });

    const companyId = await getSelectedCompanyId();
    if (!companyId) return NextResponse.json({ ok: false, error: "No company selected." }, { status: 400 });

    const requesterId = await requireUserId();
    if (!requesterId) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });

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

    const { id, role, display_name = null, is_active = null } = parsed.data;

    const patch: any = { id, role };
    if (display_name !== null) patch.display_name = display_name;
    if (is_active !== null) patch.is_active = is_active;

    const { error: upErr } = await supabase.from("profiles").upsert(patch, { onConflict: "id" });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
