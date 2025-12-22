import { redirect } from "next/navigation";

export default function SettingsIndex({ params }: { params: { companyId: string } }) {
  redirect(`/${params.companyId}/settings/categories`);
}
