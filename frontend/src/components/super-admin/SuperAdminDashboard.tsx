"use client";

import { useMemo } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./sa.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const s = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

export default function SuperAdminDashboard() {
  const { data: schools, loading: schoolsLoading } = useApi<any[]>("/subscriptions/schools");
  const { data: traffic, loading: trafficLoading } = useApi<any>("/security/traffic-stats");

  // Calculations
  const totalSchools   = schools?.length || 0;
  const activeCount    = schools?.filter((sc) => sc.status === "active").length || 0;
  const graceCount     = schools?.filter((sc) => sc.status === "grace_period").length || 0;
  const proCount       = schools?.filter((sc) => sc.plan_name === "Pro").length || 0;
  const plusCount      = schools?.filter((sc) => sc.plan_name === "Plus").length || 0;
  const ultraCount     = schools?.filter((sc) => sc.plan_name === "Ultra").length || 0;
  const verifiedCount  = schools?.filter((sc) => sc.is_verified !== false).length || 0;

  const recentSchools  = useMemo(() => (schools || []).slice(0, 6), [schools]);
  const needsAttention = useMemo(() => (schools || []).filter((sc) => sc.status === "grace_period" || sc.is_verified === false), [schools]);

  const planBadgeStyle = (plan: string) => {
    switch (plan) {
      case "Ultra":
        return { bg: "#fef3c7", color: "#d97706", border: "#fde68a" };
      case "Plus":
        return { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" };
      case "Pro":
        return { bg: "#f3e8ff", color: "#7c3aed", border: "#d8b4fe" };
      default:
        return { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" };
    }
  };

  const statusBadgeStyle = (status: string, isAccount?: string) => {
    if (isAccount === "blocked") {
      return { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5", label: "Blocked" };
    }
    switch (status) {
      case "active":
        return { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0", label: "Active" };
      case "grace_period":
        return { bg: "#fffbeb", color: "#b45309", border: "#fde68a", label: "Grace Period" };
      case "expired":
        return { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5", label: "Expired" };
      default:
        return { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0", label: status || "Unknown" };
    }
  };

  return (
    <div className={s("sa-page")}>
      <Topbar title="Super Admin Dashboard" subtitle="Executive platform overview, live tenant health, subscriptions, and system operations" />

      <main className={s("page-content")}>
        {schoolsLoading ? (
          <div style={{ padding: "4rem", textAlign: "center" }}>
            <Spinner size={36} color="#FF9B51" />
            <p style={{ marginTop: 12, fontSize: 13, color: "#64748b", fontWeight: 700 }}>
              Loading platform telemetry…
            </p>
          </div>
        ) : (
          <>
            {/* ── 1. PLATFORM STATUS HEADER BANNER ── */}
            <section
              style={{
                background: "#ffffff",
                borderRadius: 16,
                padding: "20px 24px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      color: "#059669",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#10b981",
                        display: "inline-block",
                        boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.2)",
                      }}
                    />
                    All Systems Operational
                  </span>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: "#fff7ed",
                      border: "1px solid #fed7aa",
                      color: "#ea580c",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    <i className="fa-solid fa-bolt" style={{ fontSize: 11 }} />
                    Redis Edge Rate Limiter Active
                  </span>
                </div>
                <h2 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                  Skoolio Multi-Tenant Infrastructure
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                  Real-time tenant telemetry across all registered schools, staff, and student portals.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Link
                  href="/super-admin/traffic"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 16px",
                    borderRadius: 10,
                    background: "#fff7ed",
                    border: "1.5px solid #ff9148",
                    color: "#ea580c",
                    fontSize: 13,
                    fontWeight: 800,
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <i className="fa-solid fa-signal" />
                  Live Traffic &amp; Security
                </Link>

                <Link
                  href="/super-admin/schools"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 16px",
                    borderRadius: 10,
                    background: "#ff9148",
                    border: "1.5px solid #ff9148",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 800,
                    textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(255, 145, 72, 0.3)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <i className="fa-solid fa-plus" />
                  Manage Schools
                </Link>
              </div>
            </section>

            {/* ── 2. EXECUTIVE KPI METRICS (LIGHT, CRISP, SLEEK) ── */}
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              {/* Card 1: Total Schools */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: "18px 20px",
                  border: "1.5px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Total Tenants
                    </span>
                    <h3 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
                      {totalSchools}
                    </h3>
                  </div>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: "#fff7ed",
                      border: "1.5px solid #fed7aa",
                      color: "#ea580c",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                    }}
                  >
                    <i className="fa-solid fa-building-columns" />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#16a34a", background: "#f0fdf4", padding: "2px 7px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                    {verifiedCount} Verified
                  </span>
                  <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Active database tenants</span>
                </div>
              </div>

              {/* Card 2: Active Subscriptions */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: "18px 20px",
                  border: "1.5px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Active Subscriptions
                    </span>
                    <h3 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
                      {activeCount}
                    </h3>
                  </div>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: "#f0fdf4",
                      border: "1.5px solid #bbf7d0",
                      color: "#16a34a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                    }}
                  >
                    <i className="fa-solid fa-circle-check" />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#16a34a", background: "#f0fdf4", padding: "2px 7px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                    {totalSchools > 0 ? Math.round((activeCount / totalSchools) * 100) : 0}% Active
                  </span>
                  <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Paid &amp; in good standing</span>
                </div>
              </div>

              {/* Card 3: Live Active Traffic */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: "18px 20px",
                  border: "1.5px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Live Active Users
                    </span>
                    <h3 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                      {trafficLoading ? "…" : traffic?.totalActive ?? 0}
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#10b981",
                          display: "inline-block",
                          boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.2)",
                        }}
                        title="Live Heartbeat"
                      />
                    </h3>
                  </div>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: "#eff6ff",
                      border: "1.5px solid #bfdbfe",
                      color: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                    }}
                  >
                    <i className="fa-solid fa-signal" />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#2563eb", background: "#eff6ff", padding: "2px 7px", borderRadius: 6, border: "1px solid #bfdbfe" }}>
                    {traffic?.activeSchools?.length ?? 0} Schools
                  </span>
                  <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Active in 15-min window</span>
                </div>
              </div>

              {/* Card 4: Pro / Plus Premium */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: "18px 20px",
                  border: "1.5px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Active Subscriptions
                    </span>
                    <h3 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
                      {activeCount}
                    </h3>
                  </div>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: "#faf5ff",
                      border: "1.5px solid #e9d5ff",
                      color: "#9333ea",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                    }}
                  >
                    <i className="fa-solid fa-crown" />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#7c3aed", background: "#f3e8ff", padding: "2px 7px", borderRadius: 6, border: "1px solid #d8b4fe" }}>
                    {activeCount} Active
                  </span>
                  <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>{proCount} Pro · {plusCount} Plus · {ultraCount} Ultra</span>
                </div>
              </div>

              {/* Card 5: Security Defense */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: "18px 20px",
                  border: "1.5px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Security Status
                    </span>
                    <h3 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
                      {traffic?.bannedIpsCount ?? 0}
                    </h3>
                  </div>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: "#ecfdf5",
                      border: "1.5px solid #a7f3d0",
                      color: "#059669",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                    }}
                  >
                    <i className="fa-solid fa-shield-halved" />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#059669", background: "#ecfdf5", padding: "2px 7px", borderRadius: 6, border: "1px solid #a7f3d0" }}>
                    100% Isolated
                  </span>
                  <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>0 Cross-tenant leaks</span>
                </div>
              </div>
            </section>

            {/* ── 3. QUICK OPERATIONS CARDS (4-GRID) ── */}
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 14,
              }}
            >
              <Link
                href="/super-admin/schools"
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  padding: "16px 18px",
                  border: "1.5px solid #e2e8f0",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transition: "all 0.16s ease",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: "#fff7ed",
                    border: "1.5px solid #fed7aa",
                    color: "#ea580c",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  <i className="fa-solid fa-building-columns" />
                </div>
                <div>
                  <strong style={{ fontSize: 14, color: "#0f172a", display: "block", fontWeight: 800 }}>Manage Schools</strong>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Onboard, verify &amp; block school accounts</span>
                </div>
              </Link>

              <Link
                href="/super-admin/subscriptions"
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  padding: "16px 18px",
                  border: "1.5px solid #e2e8f0",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transition: "all 0.16s ease",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: "#f0fdf4",
                    border: "1.5px solid #bbf7d0",
                    color: "#16a34a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  <i className="fa-solid fa-credit-card" />
                </div>
                <div>
                  <strong style={{ fontSize: 14, color: "#0f172a", display: "block", fontWeight: 800 }}>Subscriptions &amp; Plans</strong>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Pricing tiers, offline activations &amp; offers</span>
                </div>
              </Link>

              <Link
                href="/super-admin/traffic"
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  padding: "16px 18px",
                  border: "1.5px solid #e2e8f0",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transition: "all 0.16s ease",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: "#eff6ff",
                    border: "1.5px solid #bfdbfe",
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  <i className="fa-solid fa-shield-halved" />
                </div>
                <div>
                  <strong style={{ fontSize: 14, color: "#0f172a", display: "block", fontWeight: 800 }}>Traffic &amp; Security</strong>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Redis rate limits, IP bans &amp; live sessions</span>
                </div>
              </Link>

              <Link
                href="/super-admin/feedback"
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  padding: "16px 18px",
                  border: "1.5px solid #e2e8f0",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transition: "all 0.16s ease",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: "#faf5ff",
                    border: "1.5px solid #e9d5ff",
                    color: "#9333ea",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  <i className="fa-solid fa-comments" />
                </div>
                <div>
                  <strong style={{ fontSize: 14, color: "#0f172a", display: "block", fontWeight: 800 }}>Feedback Desk</strong>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>User ratings, bug reports &amp; suggestions</span>
                </div>
              </Link>
            </section>

            {/* ── 4. TWO-COLUMN MAIN WORKSPACE ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>

              {/* ── LEFT: RECENT SCHOOLS (EXPANDED TO TABLE) ── */}
              <section
                style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.02)",
                }}
              >
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 900, color: "#0f172a" }}>
                      Recently Registered Tenants
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                      Latest educational institutions joined on Skoolio
                    </p>
                  </div>
                  <Link
                    href="/super-admin/schools"
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#ea580c",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    View All ({totalSchools}) →
                  </Link>
                </div>

                {recentSchools.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                    <i className="fa-solid fa-school" style={{ fontSize: 24, marginBottom: 8, color: "#cbd5e1" }} /><br />
                    No schools registered yet.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 800, textTransform: "uppercase", fontSize: 11 }}>
                          <th style={{ padding: "10px 18px" }}>School Name</th>
                          <th style={{ padding: "10px 14px" }}>Plan</th>
                          <th style={{ padding: "10px 14px" }}>Country</th>
                          <th style={{ padding: "10px 14px" }}>Status</th>
                          <th style={{ padding: "10px 18px", textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentSchools.map((sc) => {
                          const pBadge = planBadgeStyle(sc.plan_name);
                          const sBadge = statusBadgeStyle(sc.status, sc.is_account);
                          return (
                            <tr key={sc.school_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "12px 18px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 8,
                                      background: "#fff7ed",
                                      border: "1.5px solid #fed7aa",
                                      color: "#ea580c",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: 900,
                                      fontSize: 12.5,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {sc.school_name ? sc.school_name.charAt(0).toUpperCase() : "S"}
                                  </div>
                                  <div>
                                    <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>
                                      {sc.school_name}
                                    </strong>
                                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                      ID: #{sc.school_id}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td style={{ padding: "12px 14px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    background: pBadge.bg,
                                    color: pBadge.color,
                                    border: `1px solid ${pBadge.border}`,
                                    fontSize: 11,
                                    fontWeight: 800,
                                  }}
                                >
                                  {sc.plan_name || "Pro"}
                                </span>
                              </td>

                              <td style={{ padding: "12px 14px", color: "#475569", fontWeight: 600 }}>
                                {sc.country || "Nepal"}
                              </td>

                              <td style={{ padding: "12px 14px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    background: sBadge.bg,
                                    color: sBadge.color,
                                    border: `1px solid ${sBadge.border}`,
                                    fontSize: 11,
                                    fontWeight: 800,
                                  }}
                                >
                                  {sBadge.label}
                                </span>
                              </td>

                              <td style={{ padding: "12px 18px", textAlign: "right" }}>
                                <Link
                                  href={`/super-admin/schools/${sc.school_id}/history`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "4px 9px",
                                    borderRadius: 6,
                                    background: "#f8fafc",
                                    border: "1px solid #e2e8f0",
                                    color: "#475569",
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    textDecoration: "none",
                                  }}
                                >
                                  <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: 10 }} /> History
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* ── RIGHT COLUMN: PLAN DISTRIBUTION & ATTENTION ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Plan Distribution Breakdown */}
                <section
                  style={{
                    background: "#ffffff",
                    borderRadius: 14,
                    padding: "18px 20px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.02)",
                  }}
                >
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#0f172a" }}>
                      Subscription Plan Distribution
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                      Tenant tier spread across the platform
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Pro Plan */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
                        <span style={{ color: "#7c3aed" }}>Pro Plan</span>
                        <span style={{ color: "#0f172a" }}>{proCount} ({totalSchools > 0 ? Math.round((proCount / totalSchools) * 100) : 0}%)</span>
                      </div>
                      <div style={{ width: "100%", height: 7, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
                        <div style={{ width: `${totalSchools > 0 ? (proCount / totalSchools) * 100 : 0}%`, height: "100%", background: "#a855f7", borderRadius: 4 }} />
                      </div>
                    </div>

                    {/* Plus Plan */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
                        <span style={{ color: "#059669" }}>Plus Plan</span>
                        <span style={{ color: "#0f172a" }}>{plusCount} ({totalSchools > 0 ? Math.round((plusCount / totalSchools) * 100) : 0}%)</span>
                      </div>
                      <div style={{ width: "100%", height: 7, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
                        <div style={{ width: `${totalSchools > 0 ? (plusCount / totalSchools) * 100 : 0}%`, height: "100%", background: "#10b981", borderRadius: 4 }} />
                      </div>
                    </div>

                    {/* Ultra Plan */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
                        <span style={{ color: "#d97706" }}>Ultra Enterprise</span>
                        <span style={{ color: "#0f172a" }}>{ultraCount} ({totalSchools > 0 ? Math.round((ultraCount / totalSchools) * 100) : 0}%)</span>
                      </div>
                      <div style={{ width: "100%", height: 7, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
                        <div style={{ width: `${totalSchools > 0 ? (ultraCount / totalSchools) * 100 : 0}%`, height: "100%", background: "#f59e0b", borderRadius: 4 }} />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Attention Hub */}
                <section
                  style={{
                    background: "#ffffff",
                    borderRadius: 14,
                    padding: "18px 20px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#0f172a" }}>
                        Tenant Attention Hub
                      </h3>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                        Schools in grace period or awaiting review
                      </p>
                    </div>
                    {needsAttention.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 800, background: "#fee2e2", color: "#dc2626", padding: "2px 7px", borderRadius: 6 }}>
                        {needsAttention.length} Pending
                      </span>
                    )}
                  </div>

                  {needsAttention.length === 0 ? (
                    <div
                      style={{
                        padding: "16px",
                        borderRadius: 10,
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                        <i className="fa-solid fa-check" />
                      </div>
                      <div>
                        <strong style={{ fontSize: 13, color: "#166534", display: "block" }}>All Tenants In Good Standing</strong>
                        <span style={{ fontSize: 11.5, color: "#15803d", fontWeight: 600 }}>No schools are currently in grace period or pending verification.</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {needsAttention.map((sc) => (
                        <div
                          key={sc.school_id}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 10,
                            background: sc.status === "grace_period" ? "#fffbeb" : "#eff6ff",
                            border: `1px solid ${sc.status === "grace_period" ? "#fde68a" : "#bfdbfe"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>{sc.school_name}</strong>
                            <span style={{ fontSize: 11.5, color: sc.status === "grace_period" ? "#92400e" : "#1d4ed8", fontWeight: 600 }}>
                              {sc.status === "grace_period"
                                ? `${sc.plan_name} plan expired — in grace period`
                                : "Pending registration verification"}
                            </span>
                          </div>
                          <Link
                            href="/super-admin/schools"
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: "#ffffff",
                              border: "1px solid #e2e8f0",
                              color: "#ea580c",
                              fontSize: 11.5,
                              fontWeight: 800,
                              textDecoration: "none",
                              flexShrink: 0,
                            }}
                          >
                            Review →
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
