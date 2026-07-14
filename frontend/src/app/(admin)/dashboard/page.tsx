"use client";

import DashboardCharts from "@/components/admin/dashboard/DashboardCharts";
import DashboardStats from "@/components/admin/dashboard/DashboardStats";
import DashboardTables from "@/components/admin/dashboard/DashboardTables";
import Topbar from "@/components/shared/Topbar";
import styles from "./dashboard.module.css";
import { useApi } from "@/lib/useApi";
import { useAppSelector } from "@/store/hooks";
import { Spinner } from "@/components/shared/Loader";

const s = (className: string) => styles[className];

export default function AdminDashboardPage() {
  const { user } = useAppSelector((st) => st.auth);
  const { data, loading } = useApi<any>("/dashboard");

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const adminName = user?.school_name || "Admin";

  return (
    <div className={s("main-wrapper")}>
      <Topbar
        title="Dashboard"
        subtitle={`Welcome back, ${adminName} | ${dateStr}`}
      />
      <main className={s("page-content")}>
        {loading || !data ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 340 }}>
            <Spinner size={36} />
          </div>
        ) : (
          <>
            <DashboardStats data={data} />
            <DashboardCharts data={data} />
            <DashboardTables data={data} />
          </>
        )}
      </main>
    </div>
  );
}
