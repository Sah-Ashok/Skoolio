"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./sa.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import ConfirmModal from "@/components/shared/ConfirmModal";

const s  = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

type Tab = "traffic" | "events" | "banned" | "maintenance";

export default function SuperAdminTrafficPage() {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>("traffic");

  // Fetch Traffic Stats
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useApi<any>("/security/traffic-stats");
  // Fetch Security Events
  const [eventFilter, setEventFilter] = useState("");
  const { data: events, loading: eventsLoading, refetch: refetchEvents } = useApi<any[]>(
    `/security/events${eventFilter ? `?event_type=${eventFilter}` : ""}`,
    [eventFilter]
  );
  // Fetch Banned IPs
  const { data: bannedIps, loading: ipsLoading, refetch: refetchIps } = useApi<any[]>("/security/banned-ips");

  // Maintenance & Announcement state
  const [maintEnabled, setMaintEnabled] = useState(false);
  const [maintMsg, setMaintMsg]         = useState("");
  const [annActive, setAnnActive]       = useState(false);
  const [annMsg, setAnnMsg]             = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Sync state once stats load
  if (stats && !settingsLoaded) {
    setMaintEnabled(Boolean(stats.maintenance?.enabled));
    setMaintMsg(stats.maintenance?.message || "Skoolio is currently undergoing scheduled maintenance.");
    setAnnActive(Boolean(stats.announcement?.active));
    setAnnMsg(stats.announcement?.message || "");
    setSettingsLoaded(true);
  }

  // Ban IP form modal state
  const [showBanModal, setShowBanModal] = useState(false);
  const [banIpInput, setBanIpInput]     = useState("");
  const [banReason, setBanReason]       = useState("");
  const [banDuration, setBanDuration]   = useState("86400"); // 1 day in seconds
  const [submittingBan, setSubmittingBan] = useState(false);

  // Active members search, role filter & pagination
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState("all");
  const [memberPage, setMemberPage] = useState(1);
  const [memberRowsPerPage, setMemberRowsPerPage] = useState(10);

  const activeMembers: any[] = useMemo(() => stats?.activeMembers ?? [], [stats?.activeMembers]);

  const filteredMembers = useMemo(() => {
    return activeMembers.filter((m) => {
      const roleMatch =
        memberRoleFilter === "all" ||
        (memberRoleFilter === "admin" && m.role === "admin") ||
        (memberRoleFilter === "teacher" && (m.role === "faculty" || m.role === "teacher")) ||
        (memberRoleFilter === "student" && m.role === "student") ||
        (memberRoleFilter === "super_admin" && m.role === "super_admin");

      if (!roleMatch) return false;

      if (!memberSearch.trim()) return true;
      const q = memberSearch.toLowerCase();
      return (
        m.name?.toLowerCase().includes(q) ||
        m.school_name?.toLowerCase().includes(q) ||
        m.school_code?.toLowerCase().includes(q) ||
        m.ip?.toLowerCase().includes(q) ||
        m.role?.toLowerCase().includes(q) ||
        String(m.user_id).includes(q)
      );
    });
  }, [activeMembers, memberRoleFilter, memberSearch]);

  const totalMemberPages = Math.max(1, Math.ceil(filteredMembers.length / memberRowsPerPage));
  const currentMembers = useMemo(() => {
    const start = (memberPage - 1) * memberRowsPerPage;
    return filteredMembers.slice(start, start + memberRowsPerPage);
  }, [filteredMembers, memberPage, memberRowsPerPage]);

  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return "—";
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 45) return "Just now";
    if (diffSec < 90) return "1m ago";
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <span style={{ padding: "3px 9px", borderRadius: 6, background: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <i className="fa-solid fa-school" style={{ fontSize: 10 }} /> School Admin
          </span>
        );
      case "faculty":
      case "teacher":
        return (
          <span style={{ padding: "3px 9px", borderRadius: 6, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <i className="fa-solid fa-chalkboard-user" style={{ fontSize: 10 }} /> Teacher
          </span>
        );
      case "student":
        return (
          <span style={{ padding: "3px 9px", borderRadius: 6, background: "#faf5ff", color: "#7c3aed", border: "1px solid #e9d5ff", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <i className="fa-solid fa-user-graduate" style={{ fontSize: 10 }} /> Student
          </span>
        );
      case "super_admin":
        return (
          <span style={{ padding: "3px 9px", borderRadius: 6, background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <i className="fa-solid fa-shield-halved" style={{ fontSize: 10 }} /> Super Admin
          </span>
        );
      default:
        return (
          <span style={{ padding: "3px 9px", borderRadius: 6, background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", fontSize: 11.5, fontWeight: 800 }}>
            {role}
          </span>
        );
    }
  };

  // Handlers
  const handleBanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banIpInput.trim()) return;
    setSubmittingBan(true);
    try {
      await apiRequest("/security/ban-ip", {
        method: "POST",
        body: JSON.stringify({
          ip: banIpInput.trim(),
          reason: banReason.trim() || "Manual ban by Super Admin",
          durationSeconds: Number(banDuration),
        }),
      });
      dispatch(showToast({ type: "success", title: "IP Banned", message: `${banIpInput} has been added to the blacklist.` }));
      setShowBanModal(false);
      setBanIpInput("");
      setBanReason("");
      refetchIps();
      refetchStats();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to ban IP." }));
    } finally {
      setSubmittingBan(false);
    }
  };

  const [ipToUnban, setIpToUnban] = useState<string | null>(null);

  const handleConfirmUnban = async () => {
    if (!ipToUnban) return;
    try {
      await apiRequest(`/security/unban-ip/${encodeURIComponent(ipToUnban)}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "IP Unbanned", message: `${ipToUnban} removed from blacklist.` }));
      refetchIps();
      refetchStats();
      setIpToUnban(null);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to unban IP." }));
    }
  };

  const handleSaveMaintenance = async () => {
    setSavingSettings(true);
    try {
      await apiRequest("/security/maintenance", {
        method: "POST",
        body: JSON.stringify({ enabled: maintEnabled, message: maintMsg }),
      });
      dispatch(showToast({
        type: maintEnabled ? "warning" : "success",
        title: maintEnabled ? "Maintenance Mode Enabled" : "Maintenance Mode Disabled",
        message: maintEnabled ? "Platform is now restricted to Super Admin only." : "Platform is now open to all schools.",
      }));
      refetchStats();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to update maintenance mode." }));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    setSavingSettings(true);
    try {
      await apiRequest("/security/announcement", {
        method: "POST",
        body: JSON.stringify({ active: annActive, message: annMsg }),
      });
      dispatch(showToast({
        type: "success",
        title: "Announcement Saved",
        message: annActive ? "Broadcast announcement is now live across portals." : "Broadcast banner deactivated.",
      }));
      refetchStats();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to update announcement." }));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSyncBlocked = async () => {
    try {
      await apiRequest("/security/sync-blocked-schools", { method: "POST" });
      dispatch(showToast({ type: "success", title: "Synchronized", message: "Blocked schools list synced with Redis." }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Sync failed." }));
    }
  };

  const eventBadge = (type: string) => {
    switch (type) {
      case "BRUTE_FORCE_BLOCKED":
        return { bg: "#fee2e2", color: "#dc2626", border: "#fca5a5", icon: "fa-ban", label: "Brute Force" };
      case "CROSS_TENANT_ATTEMPT":
        return { bg: "#fef2f2", color: "#b91c1c", border: "#f87171", icon: "fa-shield-virus", label: "Cross-Tenant" };
      case "RATE_LIMIT_EXCEEDED":
        return { bg: "#fff7ed", color: "#ea580c", border: "#fed7aa", icon: "fa-gauge-high", label: "Rate Limit" };
      default:
        return { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", icon: "fa-shield-halved", label: type };
    }
  };

  return (
    <div className={s("sa-page")}>
      <Topbar
        title="Traffic & Security Control Center"
        subtitle="Real-time user traffic, Redis rate limiting, threat blocking, and tenant isolation"
      />

      <main className={s("page-content")}>

        {/* ── HEADER ACTIONS ROW ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "#ecfdf5", border: "1.5px solid #a7f3d0", color: "#059669", fontSize: 12, fontWeight: 800 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.2)" }} />
              Redis Security Active
            </span>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              Sliding Window: 15-min active session window
            </span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSyncBlocked}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "#fff", border: "1.5px solid #e2e8f0", color: "#475569", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
            >
              <i className="fa-solid fa-arrows-rotate" /> Sync Blocked Schools
            </button>
            <button
              onClick={() => { refetchStats(); refetchEvents(); refetchIps(); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "#fff7ed", border: "1.5px solid #ff9148", color: "#ea580c", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
            >
              <i className="fa-solid fa-rotate-right" /> Refresh
            </button>
          </div>
        </div>

        {/* ── 4 KPI METRIC CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
          {/* Card 1: Total Active */}
          <div style={{ padding: "18px 20px", borderRadius: 14, background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Active Members</span>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                <i className="fa-solid fa-users" />
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
                {statsLoading ? "…" : stats?.totalActive ?? 0}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#059669" }}>Live now</span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>Across all tenant portals</p>
          </div>

          {/* Card 2: Role Breakdown */}
          <div style={{ padding: "18px 20px", borderRadius: 14, background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Active by Role</span>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                <i className="fa-solid fa-user-gear" />
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#ea580c" }}>Admins: {stats?.adminsActive ?? 0}</span>
              <span style={{ color: "#cbd5e1" }}>·</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#2563eb" }}>Teachers: {stats?.teachersActive ?? 0}</span>
              <span style={{ color: "#cbd5e1" }}>·</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed" }}>Students: {stats?.studentsActive ?? 0}</span>
              {Boolean(stats?.superAdminsActive) && (
                <>
                  <span style={{ color: "#cbd5e1" }}>·</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#059669" }}>Super: {stats?.superAdminsActive}</span>
                </>
              )}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>Active session heartbeats</p>
          </div>

          {/* Card 3: Banned IPs */}
          <div style={{ padding: "18px 20px", borderRadius: 14, background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Banned IPs</span>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                <i className="fa-solid fa-ban" />
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
                {stats?.bannedIpsCount ?? 0}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#dc2626" }}>Threats Blocked</span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>Edge protection blacklist</p>
          </div>

          {/* Card 4: Security Events 24h */}
          <div style={{ padding: "18px 20px", borderRadius: 14, background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Incidents (24h)</span>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                <i className="fa-solid fa-triangle-exclamation" />
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
                {stats?.eventsLast24Hours ?? 0}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#ea580c" }}>Logged Triggers</span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>Rate limits &amp; attacks</p>
          </div>
        </div>

        {/* ── TABS NAVIGATION ── */}
        <div style={{ display: "flex", gap: 8, borderBottom: "1.5px solid #e2e8f0", paddingBottom: 10, marginBottom: 20 }}>
          <button
            onClick={() => setTab("traffic")}
            style={{
              padding: "7px 16px", borderRadius: 8, border: tab === "traffic" ? "1.5px solid #ff9148" : "1.5px solid #e2e8f0",
              background: tab === "traffic" ? "#fff7ed" : "#fff", color: tab === "traffic" ? "#ea580c" : "#475569",
              fontSize: 13, fontWeight: tab === "traffic" ? 800 : 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="fa-solid fa-users" /> Live Active Members ({stats?.totalActive ?? 0})
          </button>

          <button
            onClick={() => setTab("events")}
            style={{
              padding: "7px 16px", borderRadius: 8, border: tab === "events" ? "1.5px solid #ff9148" : "1.5px solid #e2e8f0",
              background: tab === "events" ? "#fff7ed" : "#fff", color: tab === "events" ? "#ea580c" : "#475569",
              fontSize: 13, fontWeight: tab === "events" ? 800 : 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="fa-solid fa-shield-halved" /> Security Audit Log
          </button>

          <button
            onClick={() => setTab("banned")}
            style={{
              padding: "7px 16px", borderRadius: 8, border: tab === "banned" ? "1.5px solid #ff9148" : "1.5px solid #e2e8f0",
              background: tab === "banned" ? "#fff7ed" : "#fff", color: tab === "banned" ? "#ea580c" : "#475569",
              fontSize: 13, fontWeight: tab === "banned" ? 800 : 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="fa-solid fa-ban" /> Banned IPs ({bannedIps?.length ?? 0})
          </button>

          <button
            onClick={() => setTab("maintenance")}
            style={{
              padding: "7px 16px", borderRadius: 8, border: tab === "maintenance" ? "1.5px solid #ff9148" : "1.5px solid #e2e8f0",
              background: tab === "maintenance" ? "#fff7ed" : "#fff", color: tab === "maintenance" ? "#ea580c" : "#475569",
              fontSize: 13, fontWeight: tab === "maintenance" ? 800 : 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="fa-solid fa-bullhorn" /> Maintenance &amp; Broadcast
          </button>
        </div>

        {/* ── TAB 1: LIVE ACTIVE MEMBERS & SCHOOLS ── */}
        {tab === "traffic" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Live Active Members Section */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                    <i className="fa-solid fa-users" style={{ color: "#ff9148" }} />
                    Live Active Members
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>
                    All students, teachers, school admins, and staff currently active on the platform in the last 15 minutes.
                  </p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#059669", background: "#ecfdf5", padding: "4px 10px", borderRadius: 8, border: "1px solid #a7f3d0" }}>
                  ● {stats?.totalActive ?? 0} Live Sessions
                </span>
              </div>

              {/* Filters & Search Toolbar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                <div style={{ position: "relative", minWidth: 260, flex: 1, maxWidth: 380 }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 12 }} />
                  <input
                    type="text"
                    placeholder="Search by member name, role, school, or IP..."
                    value={memberSearch}
                    onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1); }}
                    style={{
                      width: "100%", padding: "7px 12px 7px 32px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 12.5, outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Role:</span>
                  <select
                    value={memberRoleFilter}
                    onChange={(e) => { setMemberRoleFilter(e.target.value); setMemberPage(1); }}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 700, background: "#fff" }}
                  >
                    <option value="all">All Roles ({stats?.totalActive ?? 0})</option>
                    <option value="admin">School Admins ({stats?.adminsActive ?? 0})</option>
                    <option value="teacher">Teachers ({stats?.teachersActive ?? 0})</option>
                    <option value="student">Students ({stats?.studentsActive ?? 0})</option>
                    <option value="super_admin">Super Admins ({stats?.superAdminsActive ?? 0})</option>
                  </select>
                </div>
              </div>

              {/* Members Table */}
              {statsLoading ? (
                <div style={{ padding: "40px", textAlign: "center" }}><Spinner size={28} color="#ff9148" /></div>
              ) : filteredMembers.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13.5 }}>
                  <i className="fa-solid fa-user-slash" style={{ fontSize: 24, marginBottom: 8, color: "#cbd5e1" }} /><br />
                  No active members matching your filters in the last 15 minutes.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0", color: "#64748b", fontWeight: 800, textTransform: "uppercase", fontSize: 11 }}>
                        <th style={{ padding: "10px 14px", width: 50 }}>#</th>
                        <th style={{ padding: "10px 14px" }}>Member Name</th>
                        <th style={{ padding: "10px 14px" }}>Role</th>
                        <th style={{ padding: "10px 14px" }}>School / Tenant</th>
                        <th style={{ padding: "10px 14px" }}>IP Address</th>
                        <th style={{ padding: "10px 14px" }}>Last Active</th>
                        <th style={{ padding: "10px 14px" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentMembers.map((m, idx) => {
                        const serial = (memberPage - 1) * memberRowsPerPage + idx + 1;
                        return (
                          <tr key={`${m.school_id}-${m.role}-${m.user_id}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px 14px", color: "#94a3b8", fontWeight: 700 }}>
                              {serial}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f1f5f9", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>
                                  {(m.name?.[0] || m.role[0] || "U").toUpperCase()}
                                </div>
                                <div>
                                  <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>
                                    {m.name || `${m.role.toUpperCase()} #${m.user_id}`}
                                  </strong>
                                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>ID #{m.user_id}</span>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              {getRoleBadge(m.role)}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              {m.school_id > 0 ? (
                                <div>
                                  <Link href={`/super-admin/schools/${m.school_id}`} style={{ fontSize: 13, fontWeight: 700, color: "#ea580c", textDecoration: "none" }}>
                                    {m.school_name}
                                  </Link>
                                  {m.school_code && (
                                    <span style={{ display: "block", fontSize: 11, color: "#94a3b8" }}>
                                      Code: {m.school_code}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>
                                  Platform Control Center
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 12, color: "#475569" }}>
                              {m.ip || "127.0.0.1"}
                            </td>
                            <td style={{ padding: "12px 14px", color: "#64748b", fontWeight: 600, fontSize: 12 }}>
                              {formatLastSeen(m.last_seen)}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, background: "#ecfdf5", color: "#059669", fontSize: 11.5, fontWeight: 800, border: "1px solid #a7f3d0" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                                Online
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination Bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "#fafafa",
                      borderTop: "1px solid #e2e8f0",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>
                      <span>Showing {filteredMembers.length === 0 ? 0 : (memberPage - 1) * memberRowsPerPage + 1} to {Math.min(memberPage * memberRowsPerPage, filteredMembers.length)} of {filteredMembers.length} active members</span>
                      <select
                        value={memberRowsPerPage}
                        onChange={(e) => { setMemberRowsPerPage(Number(e.target.value)); setMemberPage(1); }}
                        style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12, background: "#fff" }}
                      >
                        <option value={10}>10 / page</option>
                        <option value={20}>20 / page</option>
                        <option value={50}>50 / page</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                        disabled={memberPage === 1}
                        style={{
                          padding: "4px 10px", borderRadius: 6, border: "1px solid #cbd5e1",
                          background: memberPage === 1 ? "#f1f5f9" : "#fff", color: memberPage === 1 ? "#94a3b8" : "#334155",
                          fontSize: 12, fontWeight: 700, cursor: memberPage === 1 ? "not-allowed" : "pointer",
                        }}
                      >
                        Prev
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: "0 8px", color: "#ea580c" }}>
                        {memberPage} / {totalMemberPages}
                      </span>
                      <button
                        onClick={() => setMemberPage((p) => Math.min(totalMemberPages, p + 1))}
                        disabled={memberPage === totalMemberPages || filteredMembers.length === 0}
                        style={{
                          padding: "4px 10px", borderRadius: 6, border: "1px solid #cbd5e1",
                          background: memberPage === totalMemberPages || filteredMembers.length === 0 ? "#f1f5f9" : "#fff",
                          color: memberPage === totalMemberPages || filteredMembers.length === 0 ? "#94a3b8" : "#334155",
                          fontSize: 12, fontWeight: 700, cursor: memberPage === totalMemberPages || filteredMembers.length === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Active Schools Section */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Schools with Active Traffic</h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>Tenants currently generating heartbeats and API requests in the last 15 minutes.</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#059669", background: "#ecfdf5", padding: "4px 10px", borderRadius: 8, border: "1px solid #a7f3d0" }}>
                  {stats?.activeSchools?.length ?? 0} Active School{stats?.activeSchools?.length === 1 ? "" : "s"}
                </span>
              </div>

              {(!stats?.activeSchools || stats.activeSchools.length === 0) ? (
                <div style={{ padding: "30px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                  <i className="fa-solid fa-signal" style={{ fontSize: 22, marginBottom: 8, color: "#cbd5e1" }} /><br />
                  No school traffic detected in the last 15 minutes.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {stats.activeSchools.map((sc: any) => (
                    <Link
                      key={sc.school_id}
                      href={`/super-admin/schools/${sc.school_id}`}
                      style={{
                        padding: "14px 16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0",
                        display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fff7ed", border: "1.5px solid #ff9148", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13 }}>
                          {sc.school_id}
                        </div>
                        <div>
                          <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>{sc.school_name || `School #${sc.school_id}`}</strong>
                          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{sc.school_code ? `Code: ${sc.school_code}` : "Active Tenant"}</span>
                        </div>
                      </div>
                      <span style={{ padding: "4px 10px", borderRadius: 6, background: "#ecfdf5", color: "#059669", fontSize: 12, fontWeight: 800, border: "1px solid #a7f3d0" }}>
                        ● {sc.active_count} online
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: SECURITY EVENTS AUDIT LOG ── */}
        {tab === "events" && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Platform Security Events</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Live log from `platform_security_events` table (Rate limits, cross-tenant attempts, auto-bans)</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Filter Event:</span>
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 700, background: "#fff" }}
                >
                  <option value="">All Events</option>
                  <option value="BRUTE_FORCE_BLOCKED">Brute Force Attacks</option>
                  <option value="CROSS_TENANT_ATTEMPT">Cross-Tenant Attempts</option>
                  <option value="RATE_LIMIT_EXCEEDED">Rate Limit Exceeded</option>
                </select>
              </div>
            </div>

            {eventsLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}><Spinner size={28} color="#ff9148" /></div>
            ) : (!events || events.length === 0) ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                <i className="fa-solid fa-shield-check" style={{ fontSize: 24, marginBottom: 8, color: "#10b981" }} /><br />
                No security incidents logged. Platform is completely secure.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 800, textTransform: "uppercase", fontSize: 11 }}>
                      <th style={{ padding: "10px 16px" }}>Time</th>
                      <th style={{ padding: "10px 16px" }}>Event Type</th>
                      <th style={{ padding: "10px 16px" }}>Tenant / School</th>
                      <th style={{ padding: "10px 16px" }}>IP Address</th>
                      <th style={{ padding: "10px 16px" }}>Endpoint</th>
                      <th style={{ padding: "10px 16px" }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => {
                      const badge = eventBadge(ev.event_type);
                      return (
                        <tr key={ev.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 16px", color: "#64748b", whiteSpace: "nowrap" }}>
                            {new Date(ev.created_at).toLocaleString()}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, fontSize: 11, fontWeight: 800 }}>
                              <i className={`fa-solid ${badge.icon}`} /> {badge.label}
                            </span>
                          </td>
                          <td style={{ padding: "10px 16px", fontWeight: 700, color: "#0f172a" }}>
                            {ev.school_name || (ev.school_id ? `School #${ev.school_id}` : "Global")}
                          </td>
                          <td style={{ padding: "10px 16px", fontFamily: "monospace", color: "#2563eb", fontWeight: 700 }}>
                            {ev.ip_address || "—"}
                          </td>
                          <td style={{ padding: "10px 16px", color: "#475569", fontFamily: "monospace", fontSize: 11.5 }}>
                            {ev.endpoint || "—"}
                          </td>
                          <td style={{ padding: "10px 16px", color: "#64748b", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {typeof ev.details === "object" ? JSON.stringify(ev.details) : String(ev.details || "—")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: BANNED IPS MANAGEMENT ── */}
        {tab === "banned" && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Blacklisted IP Addresses</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>IPs permanently or temporarily dropped at the Redis edge middleware</p>
              </div>

              <button
                onClick={() => setShowBanModal(true)}
                style={{ padding: "7px 14px", borderRadius: 8, background: "#dc2626", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <i className="fa-solid fa-plus" /> Ban an IP Address
              </button>
            </div>

            {ipsLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}><Spinner size={28} color="#ff9148" /></div>
            ) : (!bannedIps || bannedIps.length === 0) ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                <i className="fa-solid fa-shield" style={{ fontSize: 24, marginBottom: 8, color: "#cbd5e1" }} /><br />
                No IP addresses are currently banned.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 800, textTransform: "uppercase", fontSize: 11 }}>
                      <th style={{ padding: "10px 16px" }}>IP Address</th>
                      <th style={{ padding: "10px 16px" }}>Reason</th>
                      <th style={{ padding: "10px 16px" }}>Banned At</th>
                      <th style={{ padding: "10px 16px" }}>Expires</th>
                      <th style={{ padding: "10px 16px", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bannedIps.map((b) => (
                      <tr key={b.ip} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 800, color: "#dc2626" }}>
                          {b.ip}
                        </td>
                        <td style={{ padding: "10px 16px", color: "#475569", fontWeight: 600 }}>
                          {b.reason || "Suspicious traffic"}
                        </td>
                        <td style={{ padding: "10px 16px", color: "#64748b" }}>
                          {b.banned_at ? new Date(b.banned_at).toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "10px 16px", color: "#64748b" }}>
                          {b.expires_at ? new Date(b.expires_at).toLocaleString() : "Permanent"}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          <button
                            onClick={() => setIpToUnban(b.ip)}
                            style={{ padding: "5px 10px", borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0", color: "#16a34a", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                          >
                            <i className="fa-solid fa-lock-open" /> Unban
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: MAINTENANCE & ANNOUNCEMENT ── */}
        {tab === "maintenance" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
            {/* Maintenance Box */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Platform Maintenance Mode</h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>When enabled, non-super-admin users will receive HTTP 503.</p>
                </div>
                <input
                  type="checkbox"
                  checked={maintEnabled}
                  onChange={(e) => setMaintEnabled(e.target.checked)}
                  style={{ width: 20, height: 20, cursor: "pointer", accentColor: "#ea580c" }}
                />
              </div>

              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>
                Maintenance Notice Message
              </label>
              <textarea
                value={maintMsg}
                onChange={(e) => setMaintMsg(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                placeholder="Skoolio is currently undergoing scheduled maintenance..."
              />

              <button
                onClick={handleSaveMaintenance}
                disabled={savingSettings}
                style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, background: "#ff9148", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
              >
                {savingSettings ? "Saving…" : "Save Maintenance Settings"}
              </button>
            </div>

            {/* Broadcast Box */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Global Announcement Banner</h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>Broadcast an alert banner across all school portals.</p>
                </div>
                <input
                  type="checkbox"
                  checked={annActive}
                  onChange={(e) => setAnnActive(e.target.checked)}
                  style={{ width: 20, height: 20, cursor: "pointer", accentColor: "#ea580c" }}
                />
              </div>

              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>
                Announcement Text
              </label>
              <textarea
                value={annMsg}
                onChange={(e) => setAnnMsg(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                placeholder="e.g. Scheduled system upgrade tonight at 11:00 PM."
              />

              <button
                onClick={handleSaveAnnouncement}
                disabled={savingSettings}
                style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, background: "#ff9148", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
              >
                {savingSettings ? "Saving…" : "Save Announcement Banner"}
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ── BAN IP MODAL ── */}
      {showBanModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, maxWidth: 420, width: "100%", padding: 24, boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 900, color: "#0f172a" }}>Blacklist IP Address</h3>
            <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#64748b" }}>Block all requests originating from this IP at the Redis layer.</p>

            <form onSubmit={handleBanSubmit}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 5 }}>
                IP Address *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 192.168.1.100"
                value={banIpInput}
                onChange={(e) => setBanIpInput(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
              />

              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 5 }}>
                Reason for Ban
              </label>
              <input
                type="text"
                placeholder="e.g. Malicious brute force attempts"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
              />

              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 5 }}>
                Duration
              </label>
              <select
                value={banDuration}
                onChange={(e) => setBanDuration(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, marginBottom: 18, boxSizing: "border-box" }}
              >
                <option value="3600">1 Hour</option>
                <option value="86400">24 Hours (1 Day)</option>
                <option value="604800">7 Days</option>
                <option value="2592000">30 Days</option>
              </select>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowBanModal(false)}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBan}
                  style={{ padding: "8px 16px", borderRadius: 8, background: "#dc2626", border: "none", color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}
                >
                  {submittingBan ? "Banning…" : "Confirm Ban"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unban IP Modal */}
      <ConfirmModal
        isOpen={!!ipToUnban}
        onClose={() => setIpToUnban(null)}
        onConfirm={handleConfirmUnban}
        title="Unban IP Address"
        message={`Are you sure you want to unban IP address ${ipToUnban}? Traffic from this IP will once again be allowed.`}
        confirmText="Unban IP"
        cancelText="Cancel"
        confirmVariant="primary"
        icon="fa-lock-open"
      />
    </div>
  );
}
