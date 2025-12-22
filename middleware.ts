// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
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

  // Routes that are currently defined outside /[companyId]/...
  // We support them by rewriting to /<activeCompanyId>/<route> when possible.
  const topLevelCompanyScopedRoutes = [
    "purchase-requests",
    "items",
    "add-item",
    "reports",
    "settings",
    "admin",
    "edit-item",
  ];

  if (topLevelCompanyScopedRoutes.includes(companyId)) {
    const activeCompanyId = req.cookies.get("stokstak_company_id")?.value;
    if (!activeCompanyId || activeCompanyId.length < 30) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/select-company";
      return NextResponse.redirect(redirectUrl);
    }

    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/${activeCompanyId}${pathname}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  // Routes that are allowed without a companyId
  const allowedNoCompany = ["select-company", "onboarding"];
  if (allowedNoCompany.includes(companyId)) return res;

  // Validate UUID-ish length (basic guard)
  if (!companyId || companyId.length < 30) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/select-company";
    return NextResponse.redirect(redirectUrl);
  }

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
