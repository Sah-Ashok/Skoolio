import ExpensesPage from "@/components/admin/expenses/ExpensesPage";

export default function FinanceExpensesRoute() {
  return <ExpensesPage readOnly={false} addUrl="/finance/expenses/add" />;
}
