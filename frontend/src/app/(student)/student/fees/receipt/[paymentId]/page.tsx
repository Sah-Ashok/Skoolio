import FeeReceiptPage from "@/components/admin/fees/FeeReceiptPage";

export default async function StudentFeeReceiptRoute({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return <FeeReceiptPage paymentId={paymentId} />;
}
