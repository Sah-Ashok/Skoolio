import SuperAdminSidebar from "@/components/super-admin/SuperAdminSidebar";
import RequireRole from "@/components/shared/RequireRole";
import AppFooter from "@/components/shared/AppFooter";
import OfflineGuard from "@/components/shared/OfflineGuard";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['super_admin']}>
      <div className="app-shell">
        <SuperAdminSidebar />
        <div className="app-main">
          <div className="app-page">
            <OfflineGuard>{children}</OfflineGuard>
          </div>
          <AppFooter role="super_admin" />
        </div>
      </div>
    </RequireRole>
  );
}
