
import Sidebar from "@/components/shared/Sidebar";
import RequireRole from "@/components/shared/RequireRole";
import PlanStatusBanner from "@/components/shared/PlanStatusBanner";
import AppFooter from "@/components/shared/AppFooter";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['admin', 'super_admin']}>
      <div className="app-shell">
        <Sidebar role="admin" />
        <div className="app-main">
          <PlanStatusBanner />
          <div className="app-page">{children}</div>
          <AppFooter role="admin" />
        </div>
      </div>
    </RequireRole>
  );
}

