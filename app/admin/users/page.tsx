import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminUsersRedirect() {
  // Next.js 16+ may type cookies() as Promise<ReadonlyRequestCookies> in some builds.
  const cookieStore = await cookies();
  const companyId = cookieStore.get("stokstak_company_id")?.value;

  if (!companyId) redirect("/select-company");
  redirect(`/${companyId}/settings/users`);
}
