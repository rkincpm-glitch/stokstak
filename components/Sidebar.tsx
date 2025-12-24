"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Boxes, ClipboardList, BarChart3, Settings, Home } from "lucide-react";

type Props = {
  companyId: string;
};

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
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

export default function Sidebar({ companyId }: Props) {
  const pathname = usePathname();

  const base = `/${companyId}`;
  const items = [
    { href: `${base}`, label: "Home", icon: Home },
    { href: `${base}/items`, label: "Stock", icon: Boxes },
    { href: `${base}/purchase-requests/new`, label: "Purchasing", icon: ClipboardList },
    { href: `${base}/reports`, label: "Reports", icon: BarChart3 },
    { href: `${base}/settings/categories`, label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-64 shrink-0 border-r bg-white min-h-screen flex flex-col">
      <div className="h-16 px-4 flex items-center border-b">
        <div className="text-sm font-semibold text-slate-900">Stokstak</div>
      </div>

      <nav className="p-3 space-y-2">
        {items.map((it) => (
          <NavItem
            key={it.href}
            href={it.href}
            label={it.label}
            icon={it.icon}
            active={pathname === it.href || pathname?.startsWith(it.href + "/")}
          />
        ))}
      </nav>

      <div className="mt-auto p-3 border-t">
        <Link href="/select-company" className="block text-xs text-slate-500 hover:text-slate-700">
          Switch company
        </Link>
      </div>
    </aside>
  );
}
