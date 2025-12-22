import { redirect } from "next/navigation";

export default function EditItemIndex({ params }: { params: { companyId: string } }) {
  redirect(`/${params.companyId}`);
}
