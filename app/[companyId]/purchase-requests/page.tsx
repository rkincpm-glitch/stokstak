import { redirect } from "next/navigation";

export default function PurchaseRequestsIndex({ params }: { params: { companyId: string } }) {
  redirect(`/${params.companyId}`);
}
