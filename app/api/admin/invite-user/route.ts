import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit, requireSameOrigin } from "@/lib/security";

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}


const BodySchema = z.object({
  email: z.string().email(),
  company_id: z.string().min(1),
  role: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const rl = rateLimit(`invite:${getClientIp(req)}`, { capacity: 10, refillPerSecond: 0.2 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!url || !serviceRole) {
      return NextResponse.json(
        { error: "Missing SUPABASE env vars." },
        { status: 500 }
      );
    }

    const body = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ error: "Invalid request", details: body.error.flatten() }, { status: 400 });
    }

    const email = body.data.email.trim().toLowerCase();
    const company_id = body.data.company_id.trim();
    const role = (body.data.role ?? "member").trim(); // e.g. "admin" | "member"

    // Server-only client (bypasses RLS, can invite users)
    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Invite user (Supabase sends an email invite)
    const { data: inviteData, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { company_id, role },
        // redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`, // optional
      });

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 });
    }

    const invitedUserId = inviteData?.user?.id;
    if (!invitedUserId) {
      return NextResponse.json(
        { error: "Invite succeeded but user id missing in response." },
        { status: 500 }
      );
    }

    // Ensure membership row exists (adjust table/columns to your schema)
    // If you already create this elsewhere, you can remove this block.
    const { error: memberErr } = await admin
      .from("company_users")
      .upsert(
        {
          company_id,
          user_id: invitedUserId,
          role,
        },
        { onConflict: "company_id,user_id" }
      );

    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 400 });
    }

    return NextResponse.json(
      { ok: true, user_id: invitedUserId, email, company_id, role },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
