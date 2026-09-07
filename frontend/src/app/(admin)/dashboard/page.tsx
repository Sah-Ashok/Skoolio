"use client";

import DashboardCharts from "@/components/admin/dashboard/DashboardCharts";
import DashboardStats from "@/components/admin/dashboard/DashboardStats";
import DashboardTables from "@/components/admin/dashboard/DashboardTables";
import styles from "./dashboard.module.css";
import { useApi } from "@/lib/useApi";
import { useAppSelector } from "@/store/hooks";
import { useDateFormat } from "@/lib/useDateFormat";
import { Spinner } from "@/components/shared/Loader";

const s = (className: string) => styles[className];

export default function AdminDashboardPage() {
  const { user } = useAppSelector((st) => st.auth);
  const { isBS, formatDate } = useDateFormat();
  const { data, loading } = useApi<any>("/dashboard");

  const now = new Date();
  const dateStr = isBS
    ? `${now.toLocaleDateString("en-US", { weekday: "long" })}, ${formatDate(now.toISOString().slice(0, 10))}`
    : now.toLocaleDateString("en-IN", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      });
  const adminName = user?.school_name || "School Admin";

  return (
    <div className={s("main-wrapper")}>
      <main className={s("page-content")}>
        {/* ── Executive In-Page Header Banner ── */}
        <div className={s("header-banner")}>
          <div>
            <h1 className={s("greeting-title")}>Welcome back, {adminName}</h1>
            <p className={s("greeting-subtitle")}>
              <i className="fa-regular fa-calendar" style={{ marginRight: 4 }} />
              {dateStr}
            </p>
          </div>
          <div className={s("header-actions")}>
            <div className={s("session-badge")}>
              <span className={s("pulse-dot")} />
              Academic Session Active
            </div>
          </div>
        </div>

        {!data ? (
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
