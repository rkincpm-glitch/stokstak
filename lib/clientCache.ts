"use client";

// Tiny sessionStorage cache with TTL.
// Used to speed up list pages (vendors/items) without changing server behavior.

type CacheEntry<T> = { at: number; ttlMs: number; value: T };

export function cacheGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed !== "object") return null;
    if (Date.now() - parsed.at > parsed.ttlMs) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T, ttlMs = 60_000) {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = { at: Date.now(), ttlMs, value };
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore
  }
}
