import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  return { url, anon };
}

export async function createAuthedServerClient() {
  const { url, anon } = getPublicSupabaseEnv();
  if (!url || !anon) {
    throw new Error("Supabase env vars are not configured.");
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // no-op in route handlers
      },
    },
  });
  return supabase;
}

export async function requireUserId() {
  const supabase = await createAuthedServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function getSelectedCompanyId() {
  const cookieStore = await cookies();
  return cookieStore.get("stokstak_company_id")?.value || null;
}
