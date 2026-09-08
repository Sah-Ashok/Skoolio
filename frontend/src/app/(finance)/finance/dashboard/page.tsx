import FeesPage from "@/components/admin/fees/FeesPage";

export default function FinanceDashboardRoute() {
  return <FeesPage mode="finance" basePath="/finance/fees" showHeroGreeting={true} />;
}
