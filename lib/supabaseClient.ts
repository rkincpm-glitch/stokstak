import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * IMPORTANT:
 * In Next.js client bundles, NEXT_PUBLIC_* env vars must be referenced statically.
 * Accessing env vars as process.env[name] will NOT be inlined and will be undefined at runtime.
 */

let _browserClient: SupabaseClient | null = null;

function resolveSupabaseConfig() {
  // These MUST be static references for Next.js to inline them into the client bundle.
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL; // optional fallback if you ever use it

  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_ANON_KEY; // optional fallback if you ever use it

  return { url, anon };
}

export function createSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("createSupabaseBrowserClient() can only be used in the browser.");
  }

  if (_browserClient) return _browserClient;

  const { url, anon } = resolveSupabaseConfig();

  if (!url || !anon) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel (Production) and redeploy."
    );
  }

  _browserClient = createBrowserClient(url, anon);
  return _browserClient;
}

/**
 * Backwards-compatible singleton export.
 * Proxy lazily creates the client on first use in the browser.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = createSupabaseBrowserClient();
    // @ts-expect-error - dynamic proxy
    return client[prop];
  },
}) as SupabaseClient;
