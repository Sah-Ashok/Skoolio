import DashboardCharts from "@/components/admin/dashboard/DashboardCharts";
import DashboardStats from "@/components/admin/dashboard/DashboardStats";
import DashboardTables from "@/components/admin/dashboard/DashboardTables";
import Topbar from "@/components/shared/Topbar";
import styles from "./dashboard.module.css";

const s = (className: string) => styles[className];

export default function AdminDashboardPage() {
  return (
    <div className={s("main-wrapper")}>
      <Topbar title="Dashboard" subtitle="Welcome back, Admin | Wednesday, June 10, 2025" />

      <main className={s("page-content")}>
        <DashboardStats />
        <DashboardCharts />
        <DashboardTables />
      </main>
    </div>
  );
}
