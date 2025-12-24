"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import {
  Boxes,
  ClipboardList,
  BarChart3,
  Settings,
  Home,
  LogOut,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type Props = {
  companyId: string;
  /** Optional callback used by mobile drawer to close on navigation */
  onNavigate?: () => void;
};

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
          : "text-slate-700 hover:bg-slate-100",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function clearActiveCompanyCookie() {
  const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
  const secure = isHttps ? "; Secure" : "";
  document.cookie = `stokstak_company_id=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

function SidebarContent({ companyId, onNavigate }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const base = `/${companyId}`;
  const items = [
    { href: `${base}`, label: "Home", icon: Home },
    { href: `${base}/items`, label: "Stock", icon: Boxes },
    { href: `${base}/purchase-requests`, label: "Purchasing", icon: ClipboardList },
    { href: `${base}/reports`, label: "Reports", icon: BarChart3 },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ];

  const onLogout = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      clearActiveCompanyCookie();
      onNavigate?.();
      router.replace("/auth");
      router.refresh();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-16 px-4 flex items-center border-b shrink-0">
        <div className="text-sm font-semibold text-slate-900">Stokstak</div>
      </div>

      <nav className="p-3 space-y-2 overflow-y-auto">
        {items.map((it) => (
          <NavItem
            key={it.href}
            href={it.href}
            label={it.label}
            icon={it.icon}
            active={pathname === it.href || pathname?.startsWith(it.href + "/")}
            onClick={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-auto p-3 border-t space-y-2">
        <Link
          href="/select-company"
          onClick={onNavigate}
          className="block text-xs text-slate-600 hover:text-slate-900"
        >
          Switch company
        </Link>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          type="button"
        >
          <LogOut className="h-4 w-4" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}

/** Desktop sidebar (always visible) */
export default function Sidebar({ companyId }: { companyId: string }) {
  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r bg-white z-40">
      <SidebarContent companyId={companyId} />
    </aside>
  );
}

/** Mobile drawer sidebar (opened on demand) */
export function MobileSidebar({
  companyId,
  open,
  onClose,
}: {
  companyId: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white border-r shadow-xl">
        <div className="h-16 px-4 flex items-center justify-between border-b">
          <div className="text-sm font-semibold text-slate-900">Stokstak</div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-slate-700" />
          </button>
        </div>
        <SidebarContent companyId={companyId} onNavigate={onClose} />
      </aside>
    </div>
  );
}
