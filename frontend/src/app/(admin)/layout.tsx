import Sidebar from "@/components/shared/Sidebar";
import RequireRole from "@/components/shared/RequireRole";
import PlanStatusBanner from "@/components/shared/PlanStatusBanner";
import AppFooter from "@/components/shared/AppFooter";
import OfflineGuard from "@/components/shared/OfflineGuard";
import SubscriptionLockGuard from "@/components/shared/SubscriptionLockGuard";
import NoActiveYearGuard from "@/components/shared/NoActiveYearGuard";
import FeedbackWidget from "@/components/shared/FeedbackWidget";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['admin', 'super_admin']}>
      <div className="app-shell">
        <Sidebar role="admin" />
        <div className="app-main">
          <PlanStatusBanner />
          <div className="app-page">
            <OfflineGuard>
              <SubscriptionLockGuard role="admin">
                <NoActiveYearGuard role="admin">{children}</NoActiveYearGuard>
              </SubscriptionLockGuard>
            </OfflineGuard>
          </div>
          <AppFooter role="admin" />
        </div>
      </div>
      <FeedbackWidget />
    </RequireRole>
  );
}
