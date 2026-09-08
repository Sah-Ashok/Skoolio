"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./sa.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Loader } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import ConfirmModal from "@/components/shared/ConfirmModal";

const s  = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

interface Props {
  schoolId?: number | string;
}

export default function SuperAdminSchoolDetailPage({ schoolId: propId }: Props) {
  const router   = useRouter();
  const params   = useParams<{ schoolId: string }>();
  const schoolId = Number(propId || params?.schoolId);
  const dispatch = useAppDispatch();

  const { data, loading, refetch } = useApi<any>(`/school/${schoolId}/details`);
  const { data: plans }            = useApi<any[]>("/subscriptions/plans/all");

  const [activeTab, setActiveTab]       = useState<"overview" | "storage" | "subscription" | "history">("overview");
  const [actionLoading, setActionLoading] = useState(false);

  // Activate Plan Modal
  const [showPlanModal, setShowPlanModal]   = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | "">("");
  const [billingCycle, setBillingCycle]     = useState<"yearly" | "monthly">("yearly");
  const [customDays, setCustomDays]         = useState("365");
  const [customPrice, setCustomPrice]       = useState("");
  const [paymentMethod, setPaymentMethod]   = useState("bank_transfer");
  const [paymentRef, setPaymentRef]         = useState("");
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  if (loading) {
    return (
      <div className={s("sa-page")}>
        <Topbar title="School Details" subtitle="Loading tenant information…" />
        <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <Loader fullScreen={false} size="md" text="Fetching tenant metrics, storage usage, and subscription history…" />
        </div>
      </div>
    );
  }

  if (!data?.school) {
    return (
      <div className={s("sa-page")}>
        <Topbar title="School Not Found" subtitle="Could not locate school tenant" />
        <div style={{ padding: "4rem", textAlign: "center" }}>
          <p style={{ fontSize: 15, color: "#dc2626", fontWeight: 800 }}>School #{schoolId} does not exist or has been deleted.</p>
          <Link
            href="/super-admin/schools"
            style={{
              display: "inline-block",
              marginTop: 12,
              padding: "8px 18px",
              borderRadius: 8,
              background: "#ff9148",
              color: "#fff",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            ← Back to Schools Directory
          </Link>
        </div>
      </div>
    );
  }

  const { school, metrics, plan, history, storage } = data;

  // Normalized Subscription Properties
  const currentPlanName = plan?.plan_name || plan?.plan?.name || plan?.subscription?.plan_name || "Pro";
  const currentSubStatus = plan?.status || plan?.subscription?.status || "active";
  const currentBillingCycle = plan?.billing_cycle || plan?.subscription?.billing_cycle || "monthly";
  const currentEndDate = plan?.end_date || plan?.subscription?.end_date;
  const currentPricePaid = plan?.price_paid ?? plan?.subscription?.amount_paid;
  const daysLeft = currentEndDate
    ? Math.ceil((new Date(currentEndDate).getTime() - Date.now()) / 86400000)
    : null;

  const isUltra = currentPlanName.toLowerCase().includes("ultra");
  const isPlusOrHigher = isUltra || currentPlanName.toLowerCase().includes("plus");
  const isProOrHigher = isPlusOrHigher || currentPlanName.toLowerCase().includes("pro");

  // Actions
  const handleVerify = async () => {
    setActionLoading(true);
    try {
      await apiRequest(`/school/${schoolId}/verify`, { method: "PATCH" });
      dispatch(showToast({ type: "success", title: "School Verified", message: `${school.school_name} can now log in.` }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not verify school." }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmBlockUnblock = async () => {
    if (!school) return;
    const action = school.is_account === "blocked" ? "unblock" : "block";
    setActionLoading(true);
    try {
      await apiRequest(`/school/${schoolId}/${action}`, { method: "PATCH" });
      dispatch(showToast({
        type: action === "block" ? "error" : "success",
        title: action === "block" ? "School Blocked" : "School Unblocked",
        message: `${school.school_name} has been ${action === "block" ? "blocked" : "unblocked"}.`,
      }));
      refetch();
      setShowBlockModal(false);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || `Could not ${action} school.` }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    const enable = !school.two_fa_enabled;
    setActionLoading(true);
    try {
      await apiRequest(`/school/${schoolId}/toggle-2fa`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: enable }),
      });
      dispatch(showToast({
        type: "success",
        title: enable ? "2FA Enabled" : "2FA Disabled",
        message: `Two-factor authentication ${enable ? "enabled" : "disabled"} for ${school.school_name}.`,
      }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not update 2FA." }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivatePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    setSubmittingPlan(true);
    try {
      const selectedPlan = (plans || []).find((p) => p.id === Number(selectedPlanId));
      const isFree = selectedPlan?.name?.toLowerCase() === "free";
      const days = Number(customDays) || (billingCycle === "yearly" ? 365 : 30);
      const startDate = new Date().toISOString().split("T")[0];
      const endDate = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];

      await apiRequest("/subscriptions/activate", {
        method: "POST",
        body: JSON.stringify({
          school_id: schoolId,
          plan_id: Number(selectedPlanId),
          billing_cycle: isFree ? "free" : billingCycle,
          amount_paid: isFree ? 0 : Number(customPrice || 0),
          currency: isFree ? undefined : (school.currency || "NPR"),
          start_date: startDate,
          end_date: isFree ? undefined : endDate,
          payment_method: isFree ? undefined : paymentMethod,
          payment_reference: paymentRef.trim() || "Manual Offline Activation",
          notes: `Activated via Super Admin console for ${days} days`,
        }),
      });
      dispatch(showToast({ type: "success", title: "Plan Activated", message: `${selectedPlan?.name || "Subscription"} plan successfully activated.` }));
      setShowPlanModal(false);
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not activate plan." }));
    } finally {
      setSubmittingPlan(false);
    }
  };

  const planBadgeColor = (pName: string) => {
    switch (pName) {
      case "Ultra": return { bg: "#fef3c7", color: "#d97706", border: "#fde68a" };
      case "Plus":  return { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" };
      case "Pro":   return { bg: "#f3e8ff", color: "#7c3aed", border: "#d8b4fe" };
      default:      return { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" };
    }
  };

  const planStyle = planBadgeColor(currentPlanName);

  return (
    <div className={s("sa-page")}>
      <Topbar
        title="School Control Center"
        subtitle={`Detailed metrics, storage footprint, and subscription history for ${school.school_name}`}
      />

      <main className={s("page-content")}>

        {/* ── BREADCRUMB & BACK LINK ── */}
        <div>
          <Link
            href="/super-admin/schools"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 800,
              color: "#ea580c",
              textDecoration: "none",
            }}
          >
            <i className="fa-solid fa-arrow-left" /> Back to Schools Directory
          </Link>
        </div>

        {/* ── 1. SCHOOL PROFILE HEADER CARD ── */}
        <section
          style={{
            background: "#ffffff",
            borderRadius: 16,
            padding: "22px 26px",
            border: "1.5px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {school.logo ? (
              <img
                src={school.logo}
                alt={school.school_name}
                style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover", border: "1.5px solid #e2e8f0" }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  background: "#fff7ed",
                  border: "2px solid #fed7aa",
                  color: "#ea580c",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 900,
                }}
              >
                {school.school_name.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: "#0f172a" }}>
                  {school.school_name}
                </h2>
                <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>
                  (ID: #{school.id})
                </span>

                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: planStyle.bg,
                    color: planStyle.color,
                    border: `1px solid ${planStyle.border}`,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {currentPlanName}
                </span>

                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: school.is_verified ? "#ecfdf5" : "#fffbeb",
                    color: school.is_verified ? "#059669" : "#b45309",
                    border: `1px solid ${school.is_verified ? "#a7f3d0" : "#fde68a"}`,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  <i className={`fa-solid ${school.is_verified ? "fa-circle-check" : "fa-clock"}`} />{" "}
                  {school.is_verified ? "Verified" : "Pending Verification"}
                </span>

                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: school.is_account === "blocked" ? "#fef2f2" : "#ecfdf5",
                    color: school.is_account === "blocked" ? "#dc2626" : "#059669",
                    border: `1px solid ${school.is_account === "blocked" ? "#fca5a5" : "#a7f3d0"}`,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {school.is_account === "blocked" ? "Account Blocked" : "Active Account"}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: 12.5, color: "#64748b", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span><i className="fa-regular fa-envelope" /> {school.email}</span>
                {school.phone && <span><i className="fa-solid fa-phone" /> {school.phone}</span>}
                <span><i className="fa-solid fa-location-dot" /> {school.city ? `${school.city}, ` : ""}{school.country || "Nepal"}</span>
                <span><i className="fa-regular fa-calendar" /> Joined {new Date(school.created_at).toLocaleDateString()}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {!school.is_verified && (
              <button
                onClick={handleVerify}
                disabled={actionLoading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: "#16a34a",
                  color: "#fff",
                  border: "none",
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                <i className="fa-solid fa-circle-check" /> Verify School
              </button>
            )}

            <button
              onClick={() => setShowPlanModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                background: "#fff7ed",
                border: "1.5px solid #ff9148",
                color: "#ea580c",
                fontSize: 12.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              <i className="fa-solid fa-arrows-rotate" /> Activate / Upgrade Plan
            </button>

            <button
              onClick={handleToggle2FA}
              disabled={actionLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                background: school.two_fa_enabled ? "#f1f5f9" : "#ffffff",
                border: "1.5px solid #e2e8f0",
                color: school.two_fa_enabled ? "#059669" : "#475569",
                fontSize: 12.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              <i className={`fa-solid fa-shield-${school.two_fa_enabled ? "halved" : "blank"}`} />
              {school.two_fa_enabled ? "2FA Enabled" : "2FA Disabled"}
            </button>

            <button
              onClick={() => setShowBlockModal(true)}
              disabled={actionLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                background: school.is_account === "blocked" ? "#f0fdf4" : "#fef2f2",
                border: `1.5px solid ${school.is_account === "blocked" ? "#bbf7d0" : "#fca5a5"}`,
                color: school.is_account === "blocked" ? "#16a34a" : "#dc2626",
                fontSize: 12.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              <i className={`fa-solid ${school.is_account === "blocked" ? "fa-lock-open" : "fa-ban"}`} />
              {school.is_account === "blocked" ? "Unblock School" : "Block School"}
            </button>
          </div>
        </section>

        {/* ── 2. RESOURCE TELEMETRY KPI STRIP (6 METRICS) ── */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {/* Metric 1: Students */}
          <div style={{ background: "#ffffff", borderRadius: 12, padding: "16px 18px", border: "1.5px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Total Students</span>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                <i className="fa-solid fa-user-graduate" />
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{metrics.totalStudents}</h3>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Enrolled profiles</span>
          </div>

          {/* Metric 2: Teachers */}
          <div style={{ background: "#ffffff", borderRadius: 12, padding: "16px 18px", border: "1.5px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Faculty / Teachers</span>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                <i className="fa-solid fa-chalkboard-user" />
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{metrics.totalTeachers}</h3>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Registered faculty</span>
          </div>

          {/* Metric 3: Staff */}
          <div style={{ background: "#ffffff", borderRadius: 12, padding: "16px 18px", border: "1.5px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Support Staff</span>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: "#faf5ff", color: "#9333ea", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                <i className="fa-solid fa-users-gear" />
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{metrics.totalStaff}</h3>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Non-teaching staff</span>
          </div>

          {/* Metric 4: Classes */}
          <div style={{ background: "#ffffff", borderRadius: 12, padding: "16px 18px", border: "1.5px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Classes / Sections</span>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                <i className="fa-solid fa-door-open" />
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
              {metrics.totalClasses} <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>/ {metrics.totalSections} sec</span>
            </h3>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Active grade levels</span>
          </div>

          {/* Metric 5: Live Users */}
          <div style={{ background: "#ffffff", borderRadius: 12, padding: "16px 18px", border: "1.5px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Live Active Users</span>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                <i className="fa-solid fa-signal" />
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
              {metrics.liveActiveUsers ?? 0}
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            </h3>
            <span style={{ fontSize: 11, color: "#059669", fontWeight: 800 }}>In 15-min window</span>
          </div>

          {/* Metric 6: Blob Storage Footprint */}
          <div style={{ background: "#ffffff", borderRadius: 12, padding: "16px 18px", border: "1.5px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Azure Blob Storage</span>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                <i className="fa-solid fa-cloud-arrow-up" />
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
              {storage?.totalMB ?? "0.00"} <span style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>MB</span>
            </h3>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{storage?.totalFiles ?? 0} media files stored</span>
          </div>
        </section>

        {/* ── 3. TABS NAVIGATION ── */}
        <div style={{ display: "flex", gap: 8, borderBottom: "1.5px solid #e2e8f0", paddingBottom: 10 }}>
          <button
            onClick={() => setActiveTab("overview")}
            style={{
              padding: "7px 16px", borderRadius: 8,
              border: activeTab === "overview" ? "1.5px solid #ff9148" : "1.5px solid #e2e8f0",
              background: activeTab === "overview" ? "#fff7ed" : "#fff",
              color: activeTab === "overview" ? "#ea580c" : "#475569",
              fontSize: 13, fontWeight: activeTab === "overview" ? 800 : 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="fa-solid fa-circle-info" /> Profile &amp; Contact
          </button>

          <button
            onClick={() => setActiveTab("storage")}
            style={{
              padding: "7px 16px", borderRadius: 8,
              border: activeTab === "storage" ? "1.5px solid #ff9148" : "1.5px solid #e2e8f0",
              background: activeTab === "storage" ? "#fff7ed" : "#fff",
              color: activeTab === "storage" ? "#ea580c" : "#475569",
              fontSize: 13, fontWeight: activeTab === "storage" ? 800 : 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="fa-solid fa-database" /> Blob Storage Usage ({storage?.totalMB ?? 0} MB)
          </button>

          <button
            onClick={() => setActiveTab("subscription")}
            style={{
              padding: "7px 16px", borderRadius: 8,
              border: activeTab === "subscription" ? "1.5px solid #ff9148" : "1.5px solid #e2e8f0",
              background: activeTab === "subscription" ? "#fff7ed" : "#fff",
              color: activeTab === "subscription" ? "#ea580c" : "#475569",
              fontSize: 13, fontWeight: activeTab === "subscription" ? 800 : 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="fa-solid fa-credit-card" /> Current Plan &amp; Features
          </button>

          <button
            onClick={() => setActiveTab("history")}
            style={{
              padding: "7px 16px", borderRadius: 8,
              border: activeTab === "history" ? "1.5px solid #ff9148" : "1.5px solid #e2e8f0",
              background: activeTab === "history" ? "#fff7ed" : "#fff",
              color: activeTab === "history" ? "#ea580c" : "#475569",
              fontSize: 13, fontWeight: activeTab === "history" ? 800 : 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="fa-solid fa-clock-rotate-left" /> Subscription History ({history?.length ?? 0})
          </button>
        </div>

        {/* ── TAB 1: OVERVIEW & PROFILE ── */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {/* Contact & Location Details */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 20 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                Contact &amp; Administrative Details
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Owner / Administrator:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>{school.owner_full_name || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>School Code:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800, fontFamily: "monospace" }}>{school.school_code || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>School Type:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800, textTransform: "capitalize" }}>{school.school_type || "K-12 / School"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Established Year:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>{school.established_year || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Official Email:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>{school.email}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Phone Number:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>{school.phone || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>City &amp; State:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>
                    {[school.city, school.state].filter(Boolean).join(", ") || "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Pincode / Postal:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>{school.pincode || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Country:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>{school.country || "Nepal"}</span>
                </div>
              </div>
            </div>

            {/* System Configuration */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 20 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                Tenant Configuration &amp; Telemetry
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Calendar System:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>
                    {school.calendar_system === "BS" ? "Bikram Sambat (BS - Nepal)" : "Gregorian (AD)"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Currency:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>{school.currency || "NPR"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Timezone:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>{school.timezone || "Asia/Kathmandu"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Website:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>{school.website || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Academic Sessions Recorded:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>{metrics.totalAcademicYears} Academic Year(s)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Account Security Status:</span>
                  <span style={{ color: school.is_account === "blocked" ? "#dc2626" : "#16a34a", fontWeight: 800 }}>
                    {school.is_account === "blocked" ? "Locked (Session Blocked in Redis)" : "Verified & Active"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>2FA Security Enforcement:</span>
                  <span style={{ color: school.two_fa_enabled ? "#16a34a" : "#64748b", fontWeight: 800 }}>
                    {school.two_fa_enabled ? "Mandatory for Admin Login" : "Optional / Disabled"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: BLOB STORAGE USAGE BREAKDOWN ── */}
        {activeTab === "storage" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Storage Header Banner */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                padding: "20px 24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
                  Azure Blob Storage Breakdown for School #{school.id}
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                  Isolated tenant container storage. All files are scoped by tenant ID preventing cross-school access.
                </p>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
                  {storage?.totalMB ?? "0.00"} MB
                </span>
                <span style={{ display: "block", fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                  {storage?.totalFiles ?? 0} Total Media Files
                </span>
              </div>
            </div>

            {/* Storage Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {/* Item 1: Student & Teacher Profile Photos */}
              <div style={{ background: "#ffffff", borderRadius: 12, padding: "18px 20px", border: "1.5px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Profile Photos</span>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    <i className="fa-solid fa-id-badge" />
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                  {storage?.breakdown?.profiles?.bytes ? (storage.breakdown.profiles.bytes / (1024 * 1024)).toFixed(2) : "0.00"} MB
                </div>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                  {storage?.breakdown?.profiles?.count ?? 0} Student &amp; Faculty photos
                </span>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                  Container: skoolio-profiles
                </p>
              </div>

              {/* Item 2: PDF Receipts */}
              <div style={{ background: "#ffffff", borderRadius: 12, padding: "18px 20px", border: "1.5px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Fee Receipts (PDF)</span>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    <i className="fa-solid fa-file-pdf" />
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                  {storage?.breakdown?.receipts?.bytes ? (storage.breakdown.receipts.bytes / (1024 * 1024)).toFixed(2) : "0.00"} MB
                </div>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                  {storage?.breakdown?.receipts?.count ?? 0} Generated payment receipts
                </span>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                  Container: school-receipts
                </p>
              </div>

              {/* Item 3: Fee Payment Screenshots */}
              <div style={{ background: "#ffffff", borderRadius: 12, padding: "18px 20px", border: "1.5px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Payment Slips</span>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    <i className="fa-solid fa-receipt" />
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                  {storage?.breakdown?.screenshots?.bytes ? (storage.breakdown.screenshots.bytes / (1024 * 1024)).toFixed(2) : "0.00"} MB
                </div>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                  {storage?.breakdown?.screenshots?.count ?? 0} Online transfer slips
                </span>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                  Container: skoolio-screenshots
                </p>
              </div>

              {/* Item 4: Logos & Bank QR Codes */}
              <div style={{ background: "#ffffff", borderRadius: 12, padding: "18px 20px", border: "1.5px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Logos &amp; Bank QR</span>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: "#faf5ff", color: "#9333ea", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    <i className="fa-solid fa-qrcode" />
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                  {((storage?.breakdown?.logos?.bytes || 0) + (storage?.breakdown?.qrCodes?.bytes || 0)) ?
                    (((storage?.breakdown?.logos?.bytes || 0) + (storage?.breakdown?.qrCodes?.bytes || 0)) / (1024 * 1024)).toFixed(2)
                    : "0.00"} MB
                </div>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                  {(storage?.breakdown?.logos?.count || 0) + (storage?.breakdown?.qrCodes?.count || 0)} Branding assets
                </span>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                  Containers: skoolio-logos, bank-qr
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: CURRENT SUBSCRIPTION & ENTITLEMENTS ── */}
        {activeTab === "subscription" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {/* Current Plan Card */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Current Subscription</span>
                  <h3 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
                    {currentPlanName}
                  </h3>
                </div>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 8,
                    background: currentSubStatus === "active" ? "#ecfdf5" : currentSubStatus === "grace_period" ? "#fffbeb" : "#eff6ff",
                    color: currentSubStatus === "active" ? "#059669" : currentSubStatus === "grace_period" ? "#b45309" : "#2563eb",
                    border: "1px solid rgba(0,0,0,0.06)",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "capitalize",
                  }}
                >
                  ● {currentSubStatus.replace("_", " ")}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Billing Cycle:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800, textTransform: "capitalize" }}>{currentBillingCycle}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Expiration Date:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>
                    {currentEndDate ? new Date(currentEndDate).toLocaleDateString() : "Never / Active"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Days Remaining:</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>
                    {daysLeft != null ? `${daysLeft} day(s)` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b", fontWeight: 700 }}>Price Paid:</span>
                  <span style={{ color: "#16a34a", fontWeight: 900 }}>
                    {currentPricePaid ? `${school.currency || "NPR"} ${currentPricePaid}` : "Free / Trial"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowPlanModal(true)}
                style={{
                  width: "100%",
                  marginTop: 18,
                  padding: "10px",
                  borderRadius: 8,
                  background: "#ff9148",
                  color: "#fff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Change or Renew Subscription
              </button>
            </div>

            {/* Plan Entitlements / Feature Flags */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 22 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                Feature Entitlements
              </h3>
              <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#64748b" }}>
                Modules unlocked for this school based on the current plan tier:
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { name: "Student & Staff Management", enabled: true },
                  { name: "Attendance & Calendar",      enabled: true },
                  { name: "Exams & Results",            enabled: true },
                  { name: "Fee Invoicing & Receipts",   enabled: true },
                  { name: "Hostel Management",          enabled: isProOrHigher },
                  { name: "Transport & Route Tracking", enabled: isProOrHigher },
                  { name: "Dedicated Finance Role",     enabled: isPlusOrHigher },
                  { name: "Online Student Payments",    enabled: isPlusOrHigher },
                ].map((mod) => (
                  <div
                    key={mod.name}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: mod.enabled ? "#f0fdf4" : "#f8fafc",
                      border: `1px solid ${mod.enabled ? "#bbf7d0" : "#e2e8f0"}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      color: mod.enabled ? "#166534" : "#94a3b8",
                    }}
                  >
                    <i className={`fa-solid ${mod.enabled ? "fa-circle-check" : "fa-circle-xmark"}`} style={{ color: mod.enabled ? "#16a34a" : "#cbd5e1" }} />
                    {mod.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: SUBSCRIPTION HISTORY TABLE ── */}
        {activeTab === "history" && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                  Subscription Invoicing History
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                  Record of all manual and automated plan activations for {school.school_name}
                </p>
              </div>
              <button
                onClick={() => setShowPlanModal(true)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "#ff9148",
                  color: "#fff",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                + Activate New Plan
              </button>
            </div>

            {(!history || history.length === 0) ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                <i className="fa-solid fa-receipt" style={{ fontSize: 24, marginBottom: 8, color: "#cbd5e1" }} /><br />
                No past subscription activations recorded for this school.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 800, textTransform: "uppercase", fontSize: 11 }}>
                      <th style={{ padding: "10px 16px" }}>Activated Date</th>
                      <th style={{ padding: "10px 16px" }}>Plan</th>
                      <th style={{ padding: "10px 16px" }}>Valid Until</th>
                      <th style={{ padding: "10px 16px" }}>Price Paid</th>
                      <th style={{ padding: "10px 16px" }}>Payment Ref</th>
                      <th style={{ padding: "10px 16px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h: any) => (
                      <tr key={h.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 16px", color: "#0f172a", fontWeight: 700 }}>
                          {new Date(h.start_date || h.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ padding: "2px 7px", borderRadius: 4, background: "#f3e8ff", color: "#7c3aed", fontWeight: 800, fontSize: 11 }}>
                            {h.plan_name}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", color: "#475569" }}>
                          {h.end_date ? new Date(h.end_date).toLocaleDateString() : "Unlimited"}
                        </td>
                        <td style={{ padding: "10px 16px", fontWeight: 800, color: "#16a34a" }}>
                          {school.currency || "NPR"} {h.amount_paid ?? h.price_paid ?? 0}
                        </td>
                        <td style={{ padding: "10px 16px", color: "#64748b", fontFamily: "monospace" }}>
                          {h.payment_reference ?? h.payment_ref ?? "Manual"}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ padding: "2px 7px", borderRadius: 4, background: h.status === "active" ? "#ecfdf5" : "#f1f5f9", color: h.status === "active" ? "#059669" : "#64748b", fontSize: 11, fontWeight: 800 }}>
                            {h.status || "Completed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── ACTIVATE / RENEW PLAN MODAL ── */}
      {showPlanModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, maxWidth: 440, width: "100%", padding: 24, boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
              Activate Subscription Plan
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#64748b" }}>
              Manually apply or renew a subscription tier for <strong>{school.school_name}</strong>.
            </p>

            <form onSubmit={handleActivatePlanSubmit}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 5 }}>
                Select Plan Tier *
              </label>
              <select
                required
                value={selectedPlanId}
                onChange={(e) => {
                  const pId = Number(e.target.value);
                  setSelectedPlanId(pId);
                  const p = (plans || []).find((x) => x.id === pId);
                  if (p) {
                    const curr = (school.currency || "NPR").toLowerCase();
                    const price = billingCycle === "yearly"
                      ? (p[`price_${curr}_yearly`] ?? p.price_npr_yearly ?? 0)
                      : (p[`price_${curr}_monthly`] ?? p.price_npr_monthly ?? 0);
                    setCustomPrice(price ? String(price) : "0");
                  }
                }}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
              >
                <option value="">-- Choose a Plan --</option>
                {(plans || []).map((p) => {
                  const curr = (school.currency || "NPR").toLowerCase();
                  const yrPrice = p[`price_${curr}_yearly`] ?? p.price_npr_yearly ?? 0;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} Plan — {school.currency || "NPR"} {yrPrice}/yr
                    </option>
                  );
                })}
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 5 }}>
                    Billing Cycle
                  </label>
                  <select
                    value={billingCycle}
                    onChange={(e) => {
                      const newCycle = e.target.value as "yearly" | "monthly";
                      setBillingCycle(newCycle);
                      setCustomDays(newCycle === "yearly" ? "365" : "30");
                      const p = (plans || []).find((x) => x.id === Number(selectedPlanId));
                      if (p) {
                        const curr = (school.currency || "NPR").toLowerCase();
                        const price = newCycle === "yearly"
                          ? (p[`price_${curr}_yearly`] ?? p.price_npr_yearly ?? 0)
                          : (p[`price_${curr}_monthly`] ?? p.price_npr_monthly ?? 0);
                        setCustomPrice(price ? String(price) : "0");
                      }
                    }}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }}
                  >
                    <option value="yearly">Yearly (Annual)</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 5 }}>
                    Duration (Days) *
                  </label>
                  <input
                    type="number"
                    required
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder="365"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 5 }}>
                    Price Paid ({school.currency || "NPR"})
                  </label>
                  <input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="e.g. 35000"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 5 }}>
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }}
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="esewa">eSewa</option>
                    <option value="khalti">Khalti</option>
                    <option value="cash">Cash Offline</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 5 }}>
                Payment Reference / Transaction ID
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. Bank Voucher Ref #12345 or eSewa TXN"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, marginBottom: 18, boxSizing: "border-box" }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPlan}
                  style={{ padding: "8px 16px", borderRadius: 8, background: "#ff9148", border: "none", color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}
                >
                  {submittingPlan ? "Activating…" : "Confirm Activation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Block / Unblock School Modal */}
      <ConfirmModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onConfirm={handleConfirmBlockUnblock}
        title={school?.is_account === "blocked" ? "Unblock School?" : "Block School?"}
        message={
          school?.is_account === "blocked"
            ? `Are you sure you want to unblock ${school?.school_name}? Teachers, students and admins will regain access.`
            : `Are you sure you want to block ${school?.school_name}? All users for this school will be prevented from accessing the platform.`
        }
        confirmText={school?.is_account === "blocked" ? "Unblock School" : "Block School"}
        cancelText="Cancel"
        confirmVariant={school?.is_account === "blocked" ? "primary" : "danger"}
        icon={school?.is_account === "blocked" ? "fa-lock-open" : "fa-ban"}
      />
    </div>
  );
}
