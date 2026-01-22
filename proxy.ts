// proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const pathname = req.nextUrl.pathname;

  // Public routes
  const isAuthRoute = pathname.startsWith("/auth");
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    isAuthRoute;

  if (isPublic) return res;

  // Require session for app routes
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Enforce company membership for tenant routes: /{companyId}/...
  // (We are matching the new structure: /<companyId>/...)
  // If you prefer /app/<companyId>/..., adjust matcher + parsing below.
  const segments = pathname.split("/").filter(Boolean);
  const companyId = segments[0];

  // Only enforce tenant membership when the first segment is actually a UUID.
  // This prevents redirect loops for non-tenant top-level routes like /reports, /settings, /admin, etc.
  const isUuid = (s: string | undefined) =>
    !!s &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

  if (!isUuid(companyId)) return res;

  // At this point companyId is a UUID; enforce membership.

  // Check membership
  const { data: membership, error } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !membership) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/select-company";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

// Apply to everything except Next internals/static assets
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
