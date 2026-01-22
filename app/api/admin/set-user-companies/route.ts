import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit, requireSameOrigin } from "@/lib/security";

const BodySchema = z.object({
  userId: z.string().min(1),
  companyIds: z.array(z.string().min(1)).default([]),
});

async function getRequesterId() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const cookieStore = await cookies();
  const ssr = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const c of cookiesToSet) cookieStore.set(c);
      },
    },
  });

  const { data } = await ssr.auth.getUser();
  return data?.user?.id || null;
}

/**
 * Admin-only: sets the list of companies a given user belongs to.
 * - Adds missing memberships
 * - Removes memberships not included
 * Role for new memberships defaults to the user's profile.role (or "member").
 */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const rl = rateLimit(`set-user-companies:${(req as any).ip ?? "unknown"}`, { capacity: 30, refillPerSecond: 1 });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ ok: false, error: "Supabase env vars are not configured." }, { status: 500 });
    }

    const requesterId = await getRequesterId();
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }
    const userId = parsed.data.userId.trim();
    const companyIds = parsed.data.companyIds.map((x) => x.trim()).filter(Boolean);

    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required." }, { status: 400 });
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

    // Determine default role for new memberships
    const { data: userProfile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    const defaultRole = String(userProfile?.role || "member");

    // Current memberships
    const { data: current, error: curErr } = await admin
      .from("company_users")
      .select("company_id")
      .eq("user_id", userId);

    if (curErr) {
      return NextResponse.json({ ok: false, error: curErr.message }, { status: 400 });
    }

    const currentIds = new Set((current || []).map((r: any) => String(r.company_id)).filter(Boolean));
    const nextIds = new Set<string>(companyIds);

    // Remove memberships not in nextIds
    const removeIds: string[] = [];
    for (const cid of currentIds) {
      if (!nextIds.has(cid)) removeIds.push(cid);
    }
    if (removeIds.length > 0) {
      await admin.from("company_users").delete().eq("user_id", userId).in("company_id", removeIds);
    }

    // Add missing
    const toInsert: any[] = [];
    for (const cid of nextIds) {
      if (!currentIds.has(cid)) {
        toInsert.push({ user_id: userId, company_id: cid, role: defaultRole });
      }
    }
    if (toInsert.length > 0) {
      const { error: insErr } = await admin.from("company_users").insert(toInsert);
      if (insErr) {
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
