import Sidebar from "@/components/shared/Sidebar";
import RequireRole from "@/components/shared/RequireRole";
import OfflineGuard from "@/components/shared/OfflineGuard";
import NoActiveYearGuard from "@/components/shared/NoActiveYearGuard";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['student']}>
      <div className="app-shell">
        <Sidebar role="student" />
        <div className="app-main">
          <div className="app-page">
            <OfflineGuard>
              <NoActiveYearGuard role="student">{children}</NoActiveYearGuard>
            </OfflineGuard>
          </div>
        </div>
      </div>
    </RequireRole>
  );
}
