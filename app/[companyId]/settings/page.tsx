"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { User, Tags, MapPin, Shapes, Users, Building2 } from "lucide-react";
import { useCompany } from "@/lib/useCompany";

function Card({ title, desc, href, icon: Icon }: any) {
  return (
    <Link href={href} className="rounded-2xl border bg-white p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <div className="font-semibold text-slate-900">{title}</div>
          <div className="text-sm text-slate-600 mt-1">{desc}</div>
        </div>
      </div>
    </Link>
  );
}

export default function CompanySettingsPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const { role } = useCompany();

  const canAdminUsers = ["admin"].includes(String(role || "").toLowerCase());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <div className="text-sm text-slate-600 mt-1">Manage your workspace configuration.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          title="Company profile"
          desc="Official company name and branding."
          href={`/${companyId}/settings/company`}
          icon={Building2}
        />

        <Card
          title="Users"
          desc="Invite and manage members and access."
          href={`/${companyId}/settings/users`}
          icon={Users}
        />
<Card
          title="Categories"
          desc="Create, edit, and deactivate categories."
          href={`/${companyId}/settings/categories`}
          icon={Tags}
        />

        <Card
          title="Locations"
          desc="Create, edit, and deactivate locations."
          href={`/${companyId}/settings/locations`}
          icon={MapPin}
        />

        <Card
          title="Item types"
          desc="Create, edit, and deactivate types."
          href={`/${companyId}/settings/types`}
          icon={Shapes}
        />
      </div>
    </div>
  );
}
