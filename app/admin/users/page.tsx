import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function AdminUsersRedirect() {
  const cookieStore = cookies();
  const companyId = cookieStore.get("stokstak_company_id")?.value;

  if (!companyId) redirect("/select-company");
  redirect(`/${companyId}/settings/users`);
}
