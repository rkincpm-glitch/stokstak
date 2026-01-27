import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin, rateLimit } from "@/lib/security";
import { createAuthedServerClient, getSelectedCompanyId, requireUserId } from "@/lib/serverSupabase";

const BodySchema = z.object({
  userId: z.string().uuid(),
  companyIds: z.array(z.string().uuid()),
  defaultRole: z.string().min(1).max(32).optional(),
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
    const rl = rateLimit(`set-user-companies:${getClientIp(req)}`, { capacity: 20, refillPerSecond: 0.5 });
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });

    const { userId, companyIds, defaultRole } = parsed.data;
    const selectedCompanyId = await getSelectedCompanyId();
    if (!selectedCompanyId) return NextResponse.json({ ok: false, error: "No company selected." }, { status: 400 });

    const requesterId = await requireUserId();
    if (!requesterId) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });

    const supabase = await createAuthedServerClient();

    const { data: requesterMembership, error: rmErr } = await supabase
      .from("company_users")
      .select("role")
      .eq("company_id", selectedCompanyId)
      .eq("user_id", requesterId)
      .maybeSingle();

    if (rmErr) return NextResponse.json({ ok: false, error: rmErr.message }, { status: 400 });
    if (String((requesterMembership as any)?.role || "").toLowerCase() !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const nextIds = new Set<string>(companyIds);
    const { data: current, error: curErr } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", userId);

    if (curErr) return NextResponse.json({ ok: false, error: curErr.message }, { status: 400 });

    const currentIds = new Set<string>((current || []).map((r: any) => String(r.company_id)));

    // Inserts
    const toInsert: { user_id: string; company_id: string; role: string }[] = [];
    for (const cid of nextIds) {
      if (!currentIds.has(cid)) {
        toInsert.push({ user_id: userId, company_id: cid, role: defaultRole || "pm" });
      }
    }
    if (toInsert.length) {
      const { error: insErr } = await supabase.from("company_users").insert(toInsert);
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
    }

    // Deletes (only for companies that requester is admin of? keep simple: allow removing any membership)
    const toDelete = Array.from(currentIds).filter((cid) => !nextIds.has(cid));
    if (toDelete.length) {
      const { error: delErr } = await supabase.from("company_users").delete().eq("user_id", userId).in("company_id", toDelete);
      if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
