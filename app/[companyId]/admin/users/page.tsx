import { redirect } from "next/navigation";

/**
 * Tenant-scoped alias for user management.
 * We keep a single source of truth at /admin/users.
 */
export default function CompanyAdminUsersPage() {
  redirect("/admin/users");
}
