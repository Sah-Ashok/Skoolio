import Sidebar from "@/components/shared/Sidebar";
import RequireRole from "@/components/shared/RequireRole";
import AppFooter from "@/components/shared/AppFooter";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['faculty']}>
      <div className="app-shell">
        <Sidebar role="teacher" />
        <div className="app-main">
          <div className="app-page">{children}</div>
          <AppFooter role="teacher" />
        </div>
      </div>
    </RequireRole>
  );
}
