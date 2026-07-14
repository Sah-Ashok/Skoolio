import Sidebar from "@/components/shared/Sidebar";
import RequireRole from "@/components/shared/RequireRole";


export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['student']}>
      <div className="app-shell">
        <Sidebar role="student" />
        <div className="app-main">
          {/* No shared Topbar here — each student page manages its own header */}
          <div className="app-page">{children}</div>
          
        </div>
      </div>
    </RequireRole>
  );
}
