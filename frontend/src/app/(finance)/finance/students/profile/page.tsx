import StudentProfilePage from "@/components/admin/students/StudentProfilePage";

export default function FinanceStudentProfileRoute() {
  return <StudentProfilePage basePath="/finance" isFinance={true} />;
}
