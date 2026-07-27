import TeacherStudentDetailPage from "@/components/teacher/TeacherStudentDetailPage";

export default async function TeacherStudentDetailRoute({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <TeacherStudentDetailPage studentId={Number(studentId)} />;
}
