import { redirect } from "next/navigation";

export default function AdminIndex({ params }: { params: { companyId: string } }) {
  redirect(`/${params.companyId}/admin/users`);
}
