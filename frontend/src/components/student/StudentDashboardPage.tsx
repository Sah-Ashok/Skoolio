"use client";

import Image from "next/image";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppSelector } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import AttendanceOverviewCard from "@/components/shared/AttendanceOverviewCard";

function fmtCurrency(amount: number) {
  return `₹ ${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatDateLabel(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning", img: "/icons/GoodMorning.svg" };
  if (hour < 17) return { text: "Good afternoon", img: "/icons/Afternoon.svg" };
  return { text: "Good evening", img: "/icons/GoodEvening.svg" };
}

export default function StudentDashboardPage() {
  const { user } = useAppSelector((s) => s.auth);
  const { data: me, loading: meLoading } = useApi<any>("/auth/me");
  const { activeYear } = useAcademicYear();
  const { data: notices } = useApi<any[]>("/notices/student");

  const { data: feeCollections } = useApi<any[]>(
    activeYear?.id ? `/fees/me/collections?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );

  const { data: examResults } = useApi<any[]>(
    activeYear?.id ? `/exams/my-results?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );

  // ── Fees ──
  const pendingFees = (feeCollections || []).filter((f) => f.status !== "paid");
  const totalDue = pendingFees.reduce((sum, f) => sum + Number(f.remaining_amount || 0), 0);

  const paidFees = (feeCollections || [])
    .filter((f) => f.status === "paid" || Number(f.paid_amount || f.amount_paid || 0) > 0)
    .map((f) => ({
      id: f.id,
      title: f.fee_name || f.fee_type || f.description || "Fee Payment",
      date: f.payment_date || f.paid_at || f.updated_at || f.created_at,
      amount: Number(f.paid_amount ?? f.amount_paid ?? f.amount ?? 0),
    }))
    .sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime())
    .slice(0, 3);

  // ── Notices ──
  const activeNotices = (notices || []).filter((n) => n.is_active !== false).slice(0, 3);

  // ── Exam Results ──
  const publishedResults = (examResults || []).filter((r: any) => r.is_published);
  const hasResults = publishedResults.length > 0;
  let semesterAvg = 0;
  let semesterGrade = "—";
  if (hasResults) {
    const totalMarks = publishedResults.reduce((s: number, r: any) => s + Number(r.marks_obtained ?? 0), 0);
    const totalFull  = publishedResults.reduce((s: number, r: any) => s + Number(r.full_marks ?? 100), 0);
    semesterAvg = totalFull > 0 ? Math.round((totalMarks / totalFull) * 100) : 0;
    if (semesterAvg >= 90)      semesterGrade = "A+";
    else if (semesterAvg >= 80) semesterGrade = "A";
    else if (semesterAvg >= 70) semesterGrade = "B+";
    else if (semesterAvg >= 60) semesterGrade = "B";
    else if (semesterAvg >= 50) semesterGrade = "C";
    else                        semesterGrade = "D";
  }

  const greeting   = getGreeting();
  const firstName  = (me?.full_name || user?.full_name || "Student").split(" ")[0];
  const schoolName = me?.school_name || (user as any)?.school_name || "";

  // Attendance overview URLs
  const attSummaryBaseUrl = "/attendance/me/summary";
  const attMonthlyUrl = (year: number, month: number): string =>
    activeYear?.id
      ? `/attendance/me/monthly?year=${year}&month=${month}&academic_year_id=${activeYear.id}`
      : "";

  const quickLinks = [
    { href: "/student/attendance",          icon: "fa-calendar-check",    label: "Attendance",  color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
    { href: "/student/fees",                icon: "fa-receipt",           label: "My Fees",     color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    { href: "/student/results",             icon: "fa-file-circle-check", label: "Results",     color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0" },
    { href: "/student/calendar",            icon: "fa-calendar-days",     label: "Calendar",    color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
    { href: "/student/profile",             icon: "fa-user",              label: "Profile",     color: "#ec4899", bg: "#fdf2f8", border: "#fbcfe8" },
    { href: "/student/fees/submit-pay-form",icon: "fa-paper-plane",       label: "Pay Now",     color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd" },
    { href: "/student/fees/bank-details",   icon: "fa-building-columns",  label: "Bank Info",   color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
    { href: "/student/fees/my-submissions", icon: "fa-clock-rotate-left", label: "My Payments", color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
  ];

  return (
    <>
      <style>{`
        .sdb { background: var(--bg-main); min-height: 100vh; }
        .sdb-content { padding: 24px; display: flex; flex-direction: column; gap: 20px; }

        /* ── Hero (no container — bare layout) ── */
        .sdb-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 4px 2px 0;
        }
        .sdb-hero-left { flex: 1; min-width: 0; }
        .sdb-hero-school {
          font-size: 55px;
          font-weight: 900;
          color: #FF9B51;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
          line-height: 1.2;
        }
        .sdb-hero-greeting {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 40px;
          color: #64748b;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .sdb-hero-name {
          font-size: 36px;
          font-weight: 900;
          color: #1e293b;
          line-height: 1.15;
          margin-bottom: 12px;
        }
        .sdb-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          background: #dcfce7;
          border: 1px solid #86efac;
          color: #166534;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.2px;
        }
        .sdb-hero-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
        .sdb-hero-right { flex-shrink: 0; }
        .sdb-hero-avatar {
          width: 68px; height: 68px;
          border-radius: 16px;
          border: 2.5px solid #FF9B51;
          background: #fff7ed;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 900;
          color: #FF9B51;
          box-shadow: 0 4px 14px rgba(255,155,81,0.2);
        }

        /* ── Stat cards ── */
        .sdb-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .sdb-stat {
          background: #fff;
          border: 1px solid #e8eef2;
          border-radius: 14px;
          padding: 16px 18px 14px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(21,41,54,0.05);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .sdb-stat:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(21,41,54,0.10); }
        .sdb-stat-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; border-radius: 4px 0 0 4px; }
        .sdb-stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #94a3b8;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 800;
        }
        .sdb-stat-value { font-size: 30px; font-weight: 900; line-height: 1; margin-bottom: 5px; }
        .sdb-stat-sub { font-size: 11px; color: #64748b; display: flex; align-items: center; gap: 5px; font-weight: 600; }
        .sdb-ring { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); }

        /* ── Section head ── */
        .sdb-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .sdb-section-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 7px;
          font-weight: 900;
        }
        .sdb-see-all {
          font-size: 12px;
          color: #3b82f6;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 700;
        }
        .sdb-see-all:hover { color: #1d4ed8; }

        /* ── Quick access ── */
        .sdb-quick { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .sdb-quick-card {
          background: #fff;
          border: 1px solid #e8eef2;
          border-radius: 14px;
          padding: 16px 10px 14px;
          text-decoration: none;
          text-align: center;
          transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 2px 8px rgba(21,41,54,0.04);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .sdb-quick-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(21,41,54,0.11); }
        .sdb-quick-icon-wrap {
          width: 48px; height: 48px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          border: 1.5px solid;
          transition: transform 0.15s;
        }
        .sdb-quick-card:hover .sdb-quick-icon-wrap { transform: scale(1.08); }
        .sdb-quick-label { font-size: 11.5px; color: #334155; font-weight: 700; line-height: 1.2; }

        /* ── Panels ── */
        .sdb-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .sdb-panel {
          background: #fff;
          border: 1px solid #e8eef2;
          border-radius: 14px;
          padding: 18px 20px;
          box-shadow: 0 2px 8px rgba(21,41,54,0.05);
        }

        /* ── Notice items ── */
        .sdb-notice-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .sdb-notice-item:last-child { border-bottom: none; padding-bottom: 0; }
        .sdb-notice-dot { width: 7px; height: 7px; border-radius: 50%; background: #f97316; margin-top: 5px; flex-shrink: 0; }
        .sdb-notice-dot.read { background: #cbd5e1; }
        .sdb-notice-title { font-size: 12.5px; font-weight: 600; color: #1e293b; }
        .sdb-notice-meta { font-size: 10.5px; color: #94a3b8; margin-top: 2px; }

        /* ── Payment items ── */
        .sdb-pay-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .sdb-pay-item:last-child { border-bottom: none; padding-bottom: 0; }
        .sdb-pay-left { display: flex; align-items: center; gap: 10px; }
        .sdb-pay-icon { width: 32px; height: 32px; border-radius: 9px; background: #f0fdf4; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; color: #16a34a; font-size: 13px; }
        .sdb-pay-name { font-size: 12.5px; font-weight: 600; color: #1e293b; }
        .sdb-pay-date { font-size: 10.5px; color: #94a3b8; margin-top: 1px; }
        .sdb-pay-amount { font-size: 13px; font-weight: 700; color: #16a34a; }
        .sdb-paid { font-size: 9.5px; padding: 2px 8px; border-radius: 999px; background: #dcfce7; color: #166534; border: 1px solid #86efac; font-weight: 700; display: inline-block; margin-top: 2px; }

        /* ── Exam result card ── */
        .sdb-result-card {
          background: #fff;
          border: 1px solid #e8eef2;
          border-radius: 14px;
          padding: 18px 20px;
          box-shadow: 0 2px 8px rgba(21,41,54,0.05);
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .sdb-result-grade { font-size: 36px; font-weight: 900; color: #4f46e5; line-height: 1; }
        .sdb-result-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 4px; }
        .sdb-result-subjects { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .sdb-result-subj-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 10.5px;
          color: #475569;
          font-weight: 600;
        }
        .sdb-result-subj-score { color: #4f46e5; font-weight: 700; }

        /* ── Attendance overview wrapper ── */
        .sdb-att-panel {
          background: #fff;
          border: 1px solid #e8eef2;
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(21,41,54,0.05);
          overflow: hidden;
        }
        .sdb-att-head {
          padding: 14px 20px;
          border-bottom: 1px solid #f0f4f5;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sdb-empty { font-size: 12px; color: #94a3b8; padding: 12px 0; font-weight: 500; }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .sdb-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 600px) {
          .sdb-stats { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        }
        @media (max-width: 900px) {
          .sdb-two-col { grid-template-columns: 1fr; }
        }
        @media (max-width: 700px) {
          .sdb-quick { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
          .sdb-quick-icon-wrap { width: 42px; height: 42px; font-size: 16px; }
          .sdb-quick-label { font-size: 10.5px; }
          .sdb-result-card { flex-direction: column; align-items: flex-start; }
        }
        @media (max-width: 560px) {
          .sdb-content { padding: 14px; gap: 14px; }
          .sdb-hero { flex-direction: column; align-items: flex-start; }
          .sdb-hero-right { display: none; }
          .sdb-hero-school { font-size: 22px; }
          .sdb-hero-greeting { font-size: 15px; }
          .sdb-hero-name { font-size: 26px; }
          .sdb-stat-value { font-size: 24px; }
        }
        @media (max-width: 400px) {
          .sdb-quick { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
          .sdb-quick-card { padding: 10px 6px 9px; }
          .sdb-quick-icon-wrap { width: 36px; height: 36px; border-radius: 10px; font-size: 14px; }
          .sdb-quick-label { font-size: 9.5px; }
        }
      `}</style>

      <div className="sdb">
        {meLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <Spinner size={30} color="#f97316" />
          </div>
        ) : (
          <div className="sdb-content">

            {/* ── Hero: no container — school h1, greeting + name h2 ── */}
            <div className="sdb-hero">
              <div className="sdb-hero-left">
                {schoolName && (
                  <h1 className="sdb-hero-school">
                  
                    {schoolName}
                  </h1>
                )}
                <div className="sdb-hero-greeting">
                  <Image
                    src={greeting.img}
                    alt={greeting.text}
                    width={28}
                    height={28}
                    style={{ objectFit: "contain" }}
                  />
                  {greeting.text},
                </div>
                <h2 className="sdb-hero-name">{firstName}</h2>
                <div className="sdb-hero-badge">
                  <span className="sdb-hero-badge-dot" />
                  Active Student · {activeYear?.year_name || "2082-83"}
                </div>
              </div>
            
            </div>

            {/* ── Stat cards ── */}
            <div className="sdb-stats">
              {/* Fees Due */}
              <div className="sdb-stat">
                <div className="sdb-stat-accent" style={{ background: totalDue > 0 ? "#ef4444" : "#22c55e" }} />
                <div className="sdb-stat-label">
                  <i className="fa-solid fa-indian-rupee-sign" style={{ color: "#f59e0b" }} />
                  Fees Due
                </div>
                <div className="sdb-stat-value" style={{ color: totalDue > 0 ? "#ef4444" : "#16a34a", fontSize: totalDue > 0 ? 22 : 30 }}>
                  {totalDue > 0 ? fmtCurrency(totalDue) : "Clear ✓"}
                </div>
                <div className="sdb-stat-sub">
                  <i className="fa-solid fa-circle" style={{ color: totalDue > 0 ? "#ef4444" : "#22c55e", fontSize: 7 }} />
                  {totalDue > 0 ? `${pendingFees.length} pending` : "All paid"}
                </div>
              </div>

              {/* Notices */}
              <div className="sdb-stat">
                <div className="sdb-stat-accent" style={{ background: "#3b82f6" }} />
                <div className="sdb-stat-label">
                  <i className="fa-regular fa-bell" style={{ color: "#3b82f6" }} />
                  Notices
                </div>
                <div className="sdb-stat-value" style={{ color: "#3b82f6" }}>{activeNotices.length}</div>
                <div className="sdb-stat-sub" style={{ color: "#3b82f6" }}>
                  <i className="fa-solid fa-circle" style={{ color: "#3b82f6", fontSize: 7 }} />
                  {activeNotices.length > 0 ? "New notices" : "Nothing new"}
                </div>
              </div>

              {/* Semester / Exam */}
              {hasResults ? (
                <div className="sdb-stat">
                  <div className="sdb-stat-accent" style={{ background: "#4f46e5" }} />
                  <div className="sdb-stat-label">
                    <i className="fa-regular fa-star" style={{ color: "#4f46e5" }} />
                    Semester Avg
                  </div>
                  <div className="sdb-stat-value" style={{ color: "#4f46e5" }}>{semesterGrade}</div>
                  <div className="sdb-stat-sub">
                    <i className="fa-solid fa-circle" style={{ color: "#4f46e5", fontSize: 7 }} />
                    {semesterAvg}% · {activeYear?.year_name || ""}
                  </div>
                </div>
              ) : (
                <div className="sdb-stat">
                  <div className="sdb-stat-accent" style={{ background: "#cbd5e1" }} />
                  <div className="sdb-stat-label">
                    <i className="fa-regular fa-star" style={{ color: "#94a3b8" }} />
                    Exam Results
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginTop: 4 }}>No exams yet</div>
                  <div className="sdb-stat-sub" style={{ color: "#cbd5e1", marginTop: 6 }}>Results will appear here</div>
                </div>
              )}


            </div>

            {/* ── Quick Access ── */}
            <div>
              <div className="sdb-section-head">
                <div className="sdb-section-title">
                  <i className="fa-solid fa-bolt" style={{ color: "#f59e0b" }} />
                  Quick Access
                </div>
              </div>
              <div className="sdb-quick">
                {quickLinks.map((q) => (
                  <Link
                    key={q.href}
                    href={q.href}
                    className="sdb-quick-card"
                    style={{ borderColor: q.border }}
                  >
                    <div
                      className="sdb-quick-icon-wrap"
                      style={{ background: q.bg, borderColor: q.border, color: q.color }}
                    >
                      <i className={`fa-solid ${q.icon}`} />
                    </div>
                    <div className="sdb-quick-label">{q.label}</div>
                  </Link>
                ))}
              </div>
            </div>

            {/* ── Attendance Overview (shared AttendanceOverviewCard) ── */}
            <div className="sdb-att-panel">
              <div className="sdb-att-head">
                <div className="sdb-section-title">
                  <i className="fa-solid fa-chart-pie" style={{ color: "#f97316" }} />
                  Attendance Overview
                </div>
                <Link href="/student/attendance" className="sdb-see-all">
                  View all <i className="fa-solid fa-chevron-right" style={{ fontSize: 10 }} />
                </Link>
              </div>
              <div style={{ padding: "14px 20px" }}>
                <AttendanceOverviewCard
                  activeYear={activeYear}
                  summaryBaseUrl={attSummaryBaseUrl}
                  monthlyUrl={attMonthlyUrl}
                />
              </div>
            </div>

            {/* ── Exam Results (only if published results exist) ── */}
            {hasResults && (
              <div>
                <div className="sdb-section-head">
                  <div className="sdb-section-title">
                    <i className="fa-solid fa-chart-bar" style={{ color: "#4f46e5" }} />
                    Semester Results
                  </div>
                  <Link href="/student/results" className="sdb-see-all">
                    Full report <i className="fa-solid fa-chevron-right" style={{ fontSize: 10 }} />
                  </Link>
                </div>
                <div className="sdb-result-card">
                  <div style={{ flexShrink: 0 }}>
                    <svg width="80" height="80" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="30" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                      <circle
                        cx="40" cy="40" r="30"
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="6"
                        strokeDasharray={`${(semesterAvg / 100) * 2 * Math.PI * 30} ${2 * Math.PI * 30}`}
                        strokeDashoffset={2 * Math.PI * 30 * 0.25}
                        strokeLinecap="round"
                      />
                      <text x="40" y="37" textAnchor="middle" fontSize="14" fontWeight="800" fill="#4f46e5">{semesterGrade}</text>
                      <text x="40" y="52" textAnchor="middle" fontSize="10" fill="#94a3b8">{semesterAvg}%</text>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sdb-result-label">Semester Average · {activeYear?.year_name || ""}</div>
                    <div className="sdb-result-grade">{semesterGrade}</div>
                    <div className="sdb-result-subjects">
                      {publishedResults.slice(0, 6).map((r: any, i: number) => {
                        const score = Math.round((Number(r.marks_obtained ?? 0) / Number(r.full_marks ?? 100)) * 100);
                        return (
                          <span key={i} className="sdb-result-subj-tag">
                            {r.subject_name || r.subject || `Sub ${i + 1}`}
                            <span className="sdb-result-subj-score">{score}%</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Notices + Recent Payments ── */}
            <div className="sdb-two-col">
              <div className="sdb-panel">
                <div className="sdb-section-head" style={{ marginBottom: 8 }}>
                  <div className="sdb-section-title">
                    <i className="fa-regular fa-bell" style={{ color: "#3b82f6" }} />
                    Notices
                  </div>
                  <Link href="/student/notices" className="sdb-see-all">See all</Link>
                </div>
                {activeNotices.length === 0 ? (
                  <div className="sdb-empty">No notices right now</div>
                ) : (
                  activeNotices.map((n, i) => (
                    <div key={n.id || i} className="sdb-notice-item">
                      <span className={`sdb-notice-dot ${i > 0 ? "read" : ""}`} />
                      <div>
                        <div className="sdb-notice-title" style={i > 0 ? { color: "#64748b", fontWeight: 500 } : {}}>
                          {n.title || "Notice"}
                        </div>
                        <div className="sdb-notice-meta">{formatDateLabel(n.created_at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="sdb-panel">
                <div className="sdb-section-head" style={{ marginBottom: 8 }}>
                  <div className="sdb-section-title">
                    <i className="fa-solid fa-clock-rotate-left" style={{ color: "#22c55e" }} />
                    Recent Payments
                  </div>
                  <Link href="/student/fees/my-submissions" className="sdb-see-all">
                    View all <i className="fa-solid fa-chevron-right" style={{ fontSize: 10 }} />
                  </Link>
                </div>
                {paidFees.length === 0 ? (
                  <div className="sdb-empty">No recent payments</div>
                ) : (
                  paidFees.map((p) => (
                    <div key={p.id} className="sdb-pay-item">
                      <div className="sdb-pay-left">
                        <div className="sdb-pay-icon">
                          <i className="fa-regular fa-receipt" />
                        </div>
                        <div>
                          <div className="sdb-pay-name">{p.title}</div>
                          <div className="sdb-pay-date">{formatDateLabel(p.date)}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="sdb-pay-amount">{fmtCurrency(p.amount)}</div>
                        <span className="sdb-paid">Paid</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
