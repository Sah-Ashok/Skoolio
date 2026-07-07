"use client";

import Topbar from "@/components/shared/Topbar";
import styles from "./attendance.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

/* ── tiny helpers ── */
const pctOf = (present: number, working: number) =>
  working > 0 ? Math.min(100, Math.round((present / working) * 100)) : null;

const pctColor = (pct: number | null) => {
  if (pct === null) return "#94a3b8";
  if (pct >= 85) return "#12805c";
  if (pct >= 70) return "#c46a14";
  return "#b42318";
};

const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
};

function PctPill({ present, working }: { present: number; working: number }) {
  const pct = pctOf(present, working);
  const color = pctColor(pct);
  const label = pct !== null ? `${pct}%` : "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#6a7882" }}>
          {present} / {working} days
        </span>
        <strong style={{ fontSize: 13, fontWeight: 900, color }}>{label}</strong>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "#e1e8eb", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct ?? 0}%`, background: color, borderRadius: 999, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function SectionCard({ sec, curLabel, prevLabel }: { sec: any; curLabel: string; prevLabel: string }) {
  const hasCoordinator = !!sec.coordinator_id;
  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      border: "1px solid #d4dde2",
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      boxShadow: "0 2px 8px rgba(37,52,63,0.05)",
      transition: "box-shadow 0.2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: "linear-gradient(135deg, #eef2ff, #e0e7ff)",
            color: "#6366f1", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 17, fontWeight: 900,
          }}>
            {sec.section_name}
          </div>
          <div>
            <p style={{ fontWeight: 900, fontSize: 15, color: "#25343F", margin: 0 }}>
              {sec.class_name} — Section {sec.section_name}
            </p>
            <p style={{ fontSize: 12, color: "#6a7882", margin: "3px 0 0", fontWeight: 700 }}>
              <i className="fa-solid fa-user-tie" style={{ marginRight: 5, color: hasCoordinator ? "#FF9B51" : "#94a3b8" }} />
              {sec.coordinator_name}
            </p>
          </div>
        </div>
        {!hasCoordinator && (
          <span style={{
            fontSize: 10.5, fontWeight: 800, padding: "3px 9px",
            borderRadius: 99, background: "#fef3c7", color: "#d97706",
            border: "1px solid #fde68a", whiteSpace: "nowrap", flexShrink: 0,
          }}>
            No Coordinator
          </span>
        )}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #edf2f4", margin: 0 }} />

      {/* Month stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Current month */}
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <p style={{ fontSize: 10.5, fontWeight: 800, color: "#6a7882", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            {curLabel}
          </p>
          <PctPill present={Number(sec.current_month_present)} working={Number(sec.current_working_days)} />
        </div>
        {/* Prev month */}
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <p style={{ fontSize: 10.5, fontWeight: 800, color: "#6a7882", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            {prevLabel}
          </p>
          <PctPill present={Number(sec.prev_month_present)} working={Number(sec.prev_working_days)} />
        </div>
      </div>

      {/* Total all-time */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#6a7882" }}>
          <i className="fa-solid fa-layer-group" style={{ marginRight: 6, color: "#6366f1" }} />
          All-time total present
        </span>
        <strong style={{ fontSize: 14, fontWeight: 900, color: "#25343F" }}>
          {Number(sec.total_present_all_time).toLocaleString()}
        </strong>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const { data: activeYear } = useApi<any>("/academic-years/active");

  const { data: summary, loading } = useApi<any>(
    activeYear?.id ? `/attendance/summary/admin?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );

  const sections: any[]  = summary?.sections ?? [];
  const curLabel = summary?.current_month?.label ? monthLabel(summary.current_month.label) : "Current Month";
  const prevLabel = summary?.prev_month?.label   ? monthLabel(summary.prev_month.label)    : "Previous Month";

  // Group by class_name
  const grouped: Record<string, any[]> = {};
  sections.forEach((sec) => {
    if (!grouped[sec.class_name]) grouped[sec.class_name] = [];
    grouped[sec.class_name].push(sec);
  });

  // Summary stats
  const totalSections  = sections.length;
  const withCoord      = sections.filter((s) => !!s.coordinator_id).length;
  const totalCurPresent  = sections.reduce((acc, s) => acc + Number(s.current_month_present), 0);
  const totalPrevPresent = sections.reduce((acc, s) => acc + Number(s.prev_month_present),    0);

  if (loading || !activeYear) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f8faff" }}>
        <Topbar title="Attendance" subtitle="Section-wise attendance overview" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner size={36} color="#FF9B51" />
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f8faff" }}>
      <Topbar title="Attendance" subtitle="Section-wise attendance overview — marking is done by section coordinators" />

      <main style={{ flex: 1, padding: "1.5rem 2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Info banner */}
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: "#eff6ff", border: "1px solid #bfdbfe",
          display: "flex", alignItems: "center", gap: 12,
          fontSize: 13.5, fontWeight: 700, color: "#1e40af",
        }}>
          <i className="fa-solid fa-circle-info" style={{ fontSize: 16, flexShrink: 0 }} />
          <span>
            Attendance is marked by each section&apos;s assigned coordinator only.
            This page shows a read-only summary based on the school calendar working days.
          </span>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
          {[
            { label: "Total Sections",      value: totalSections,                icon: "fa-table-cells",    color: "#6366f1", bg: "#eef2ff" },
            { label: "With Coordinator",    value: withCoord,                    icon: "fa-user-tie",       color: "#16a34a", bg: "#dcfce7" },
            { label: `${curLabel} Present`, value: totalCurPresent.toLocaleString(), icon: "fa-user-check", color: "#0284c7", bg: "#e0f2fe" },
            { label: `${prevLabel} Present`,value: totalPrevPresent.toLocaleString(),icon: "fa-calendar",   color: "#9333ea", bg: "#f3e8ff" },
          ].map((c) => (
            <div key={c.label} style={{
              background: "#fff", borderRadius: 14, padding: "1.2rem 1.4rem",
              border: "1px solid #e8eaf0", display: "flex", alignItems: "center",
              gap: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11, background: c.bg, color: c.color,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
              }}>
                <i className={`fa-solid ${c.icon}`} />
              </div>
              <div>
                <p style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600, margin: 0 }}>{c.label}</p>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", margin: 0 }}>{c.value}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* Sections grid, grouped by class */}
        {sections.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>
            <i className="fa-solid fa-table-cells" style={{ fontSize: 40, marginBottom: 16 }} />
            <p style={{ fontSize: 15, fontWeight: 700 }}>No sections found for this academic year.</p>
            <p style={{ fontSize: 13 }}>Make sure sections are created and assigned to classes.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([className, secs]) => (
            <div key={className}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "linear-gradient(135deg, #FF9B51, #ff6b1a)",
                  color: "#fff", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0,
                }}>
                  <i className="fa-solid fa-school" />
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 900, color: "#25343F", margin: 0 }}>{className}</h2>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>
                  {secs.length} section{secs.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
                {secs.map((sec: any) => (
                  <SectionCard key={sec.section_id} sec={sec} curLabel={curLabel} prevLabel={prevLabel} />
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
