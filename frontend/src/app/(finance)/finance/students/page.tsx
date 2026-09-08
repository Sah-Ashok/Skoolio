import StudentsPage from "@/components/admin/students/StudentsPage";

export default function FinanceStudentsRoute() {
  return <StudentsPage basePath="/finance" isFinance={true} />;
}
