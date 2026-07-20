import Sidebar from "@/components/shared/Sidebar";
import RequireRole from "@/components/shared/RequireRole";
import AppFooter from "@/components/shared/AppFooter";
import OfflineGuard from "@/components/shared/OfflineGuard";
import NoActiveYearGuard from "@/components/shared/NoActiveYearGuard";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['faculty']}>
      <div className="app-shell">
        <Sidebar role="teacher" />
        <div className="app-main">
          <div className="app-page">
            <OfflineGuard>
              <NoActiveYearGuard role="teacher">{children}</NoActiveYearGuard>
            </OfflineGuard>
          </div>
          <AppFooter role="teacher" />
        </div>
      </div>
    </RequireRole>
  );
}
