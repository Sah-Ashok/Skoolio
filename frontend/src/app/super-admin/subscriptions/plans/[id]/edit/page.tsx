import EditPlanPage from "@/components/super-admin/EditPlanPage";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPlanRoutePage({ params }: Props) {
  const { id } = await params;
  const planId = parseInt(id, 10);
  return <EditPlanPage planId={isNaN(planId) ? null : planId} />;
}
