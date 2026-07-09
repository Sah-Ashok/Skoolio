import FeeReceiptPage from "@/components/admin/fees/FeeReceiptPage";

export default async function FeeReceiptRoute({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return <FeeReceiptPage paymentId={paymentId} />;
}
