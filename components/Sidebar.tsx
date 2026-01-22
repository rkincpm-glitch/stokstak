"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  Home,
  Boxes,
  ClipboardList,
  BarChart3,
  Settings,
  Building2,
  LogOut,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export type AppRole = "admin" | "president" | "pm" | "purchaser" | "receiver" | "user" | string;

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  showIf?: (role: AppRole | null) => boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cx(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors border",
        active
          ? "bg-emerald-50 text-emerald-800 border-emerald-100"
          : "text-slate-700 hover:bg-slate-100 border-transparent"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

export default function Sidebar({
  companyId,
  role,
  onNavigate,
}: {
  companyId: string;
  role: AppRole | null;
  onNavigate?: () => void; // used to close mobile drawer
}) {
  const pathname = usePathname();
  const router = useRouter();

  const items: NavItem[] = useMemo(() => {
    const base = `/${companyId}`;
    return [
      { key: "home", label: "Home", href: `${base}`, icon: Home },
      { key: "stock", label: "Stock", href: `${base}/items`, icon: Boxes },
      { key: "purchasing", label: "Purchasing", href: `${base}/purchase-requests`, icon: ClipboardList },
      {
        key: "vendors",
        label: "Vendors",
        href: `${base}/vendors`,
        icon: Building2,
        showIf: (r) => ["admin", "purchaser", "president"].includes(String(r || "").toLowerCase()),
      },
      {
        key: "reports",
        label: "Reports",
        href: `${base}/reports`,
        icon: BarChart3,
        showIf: (r) => ["admin", "pm", "president", "purchaser"].includes(String(r || "").toLowerCase()),
      },
      {
        key: "settings",
        label: "Settings",
        href: `${base}/settings`,
        icon: Settings,
        showIf: (r) => ["admin", "president"].includes(String(r || "").toLowerCase()),
      },
    ];
  }, [companyId]);

  const visible = items.filter((it) => (it.showIf ? it.showIf(role) : true));

  const logout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();

    // Clear active company cookie
    const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
    const secure = isHttps ? "; Secure" : "";
    document.cookie = `stokstak_company_id=; Path=/; Max-Age=0; SameSite=Lax${secure}`;

    router.replace("/auth");
  };

  return (
    <aside className="h-full w-72 border-r bg-white flex flex-col">
      <div className="h-16 px-4 flex items-center border-b">
        <div className="text-sm font-semibold text-slate-900">Stokstak</div>
      </div>

      <nav className="p-3 space-y-2 flex-1">
        {visible.map((it) => (
          <NavLink
            key={it.key}
            href={it.href}
            label={it.label}
            icon={it.icon}
            active={pathname === it.href || pathname?.startsWith(it.href + "/")}
            onClick={onNavigate}
          />
        ))}
      </nav>

      <div className="p-3 border-t space-y-2">
        <Link
          href="/select-company"
          onClick={onNavigate}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          <span className="font-medium">Switch company</span>
          <span className="text-xs text-slate-400">↗</span>
        </Link>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
