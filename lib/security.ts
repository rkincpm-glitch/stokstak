import { NextRequest } from "next/server";

// Basic CSRF protection for cookie-authenticated requests.
// Strategy: for non-GET methods, require same-origin via Origin/Host checks.
// This is lightweight and works well for same-site apps. If you later embed
// the app cross-origin, you'll need token-based CSRF.
export function requireSameOrigin(req: Pick<Request, "method" | "headers">) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) {
    throw new Error("Missing Origin/Host headers");
  }
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Error("Invalid Origin header");
  }
  if (originHost !== host) {
    throw new Error("CSRF protection: cross-origin request blocked");
  }
}

// Simple in-memory rate limiting.
// Note: In serverless/multi-instance deployments, use a shared store (Redis).
type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  {
    capacity,
    refillPerSecond,
  }: {
    capacity: number;
    refillPerSecond: number;
  }
) {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
  const elapsed = Math.max(0, (now - b.updatedAt) / 1000);
  const refill = elapsed * refillPerSecond;
  const tokens = Math.min(capacity, b.tokens + refill);
  if (tokens < 1) {
    buckets.set(key, { tokens, updatedAt: now });
    return { ok: false as const, retryAfterSeconds: Math.ceil((1 - tokens) / refillPerSecond) };
  }
  buckets.set(key, { tokens: tokens - 1, updatedAt: now });
  return { ok: true as const, retryAfterSeconds: 0 };
}
