import Link from "next/link";

export default async function SettingsHome({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  const cards = [
    {
      title: "User Settings",
      desc: "Manage your profile and role-based capabilities (as allowed).",
      href: `/${companyId}/admin/users`,
    },
    {
      title: "Categories",
      desc: "Add, edit, or deactivate inventory categories.",
      href: `/${companyId}/settings/categories`,
    },
    {
      title: "Locations",
      desc: "Add, edit, or deactivate storage / application locations.",
      href: `/${companyId}/settings/locations`,
    },
    {
      title: "Types",
      desc: "Manage item types for consistent reporting and filters.",
      href: `/${companyId}/settings/types`,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Company configuration and master data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="text-sm font-semibold text-slate-900">{c.title}</div>
            <div className="text-sm text-slate-500 mt-1">{c.desc}</div>
            <div className="text-xs text-emerald-700 mt-3">Open →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
