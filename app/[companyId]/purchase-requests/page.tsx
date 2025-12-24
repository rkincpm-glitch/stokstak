import { redirect } from "next/navigation";

export default async function PurchaseRequestsIndex({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  redirect(`/${companyId}/purchase-requests/new`);
}
