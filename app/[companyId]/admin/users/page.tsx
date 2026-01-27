import { redirect } from "next/navigation";

export default function CompanyAdminUsersPage({ params }: { params: { companyId: string } }) {
  redirect(`/${params.companyId}/settings/users`);
}
