import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSameOrigin, rateLimit } from "@/lib/security";

const BodySchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(120),
});

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return { supabaseUrl, anonKey, serviceKey };
}

async function getAuthedUserId() {
  const { supabaseUrl, anonKey } = getEnv();
  if (!supabaseUrl || !anonKey) return null;

  // Next.js 16+ may type cookies() as Promise<ReadonlyRequestCookies> in some builds.
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // no-op: route only validates identity
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const rl = rateLimit(`company-name:${ip}`, { capacity: 20, refillPerSecond: 0.5 });
    if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }
    const { companyId, name } = parsed.data;

    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { supabaseUrl, serviceKey } = getEnv();
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "Supabase env vars are not configured." }, { status: 500 });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Must be admin of this company.
    const { data: membership } = await admin
      .from("company_users")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle();

    const role = String((membership as any)?.role || "").toLowerCase();
    if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await admin.from("companies").update({ name }).eq("id", companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
