import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * IMPORTANT:
 * Next.js will evaluate modules during build/SSR even for "use client" pages.
 * Creating the Supabase browser client at module scope will therefore fail the build
 * if NEXT_PUBLIC_SUPABASE_* env vars are not available at build time, and is also not
 * correct to run on the server.
 *
 * This file provides a lazy browser-only client while keeping existing imports working.
 */

let _browserClient: SupabaseClient | null = null;

function getEnv(name: string) {
  return process.env[name];
}

function resolveSupabaseConfig() {
  // Support both conventional Next.js public env var names and Supabase-style names.
  const url =
    getEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    getEnv("SUPABASE_URL") ||
    getEnv("SUPABASE_PROJECT_URL");
  const anon =
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    getEnv("SUPABASE_ANON_KEY") ||
    getEnv("SUPABASE_PUBLIC_ANON_KEY");

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
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  _browserClient = createBrowserClient(url, anon);
  return _browserClient;
}

/**
 * Backwards-compatible singleton export.
 * This is a proxy that lazily creates the client on first use in the browser.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = createSupabaseBrowserClient();
    // @ts-expect-error - dynamic proxy
    return client[prop];
  },
}) as SupabaseClient;
