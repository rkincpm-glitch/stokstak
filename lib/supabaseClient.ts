import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * NOTE:
 * Do NOT create the Supabase client at module scope.
 * Next.js may evaluate modules during build/prerender where env vars are not present,
 * which would throw and fail the build.
 *
 * We instead lazily create the browser client the first time it is used in the browser.
 */

let _client: SupabaseClient | null = null;

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anon };
}

function ensureClient(): SupabaseClient {
  if (_client) return _client;

  const { url, anon } = getEnv();

  // Only attempt to create in a browser context.
  if (typeof window === "undefined") {
    throw new Error(
      "Supabase browser client requested on the server. Use a server client factory instead."
    );
  }

  if (!url || !anon) {
    throw new Error(
      "@supabase/ssr: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."
    );
  }

  _client = createBrowserClient(url, anon);
  return _client;
}

/**
 * Singleton browser client (keeps existing imports working).
 * Implemented as a Proxy so it does not initialize at import time.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = ensureClient();
    // @ts-expect-error - dynamic proxy dispatch
    const value = client[prop];
    if (typeof value === "function") return value.bind(client);
    return Reflect.get(client as any, prop, receiver);
  },
}) as SupabaseClient;

/**
 * Factory function (recommended for new code)
 */
export function createSupabaseBrowserClient() {
  // Return the lazy proxy; it will only instantiate the real client on first use in the browser.
  return supabase;
}
