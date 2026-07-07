"use client";

import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { useAppSelector } from "@/store/hooks";
import { Spinner } from "@/components/shared/Loader";

/* ── tiny helpers ── */
const fmt = (d: string | undefined | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long", day: "2-digit", month: "long", year: "numeric",
});

const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

/* ── colour tokens ── */
const SUBJECT_COLORS = [
  { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff" },
  { bg: "#fff1f2", color: "#be123c", border: "#fecdd3" },
  { bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" },
];

/* ═══════════════════════════════════════════════════════
   STAT CHIP
═══════════════════════════════════════════════════════ */
function StatChip({
  icon, label, value, accent = "#FF9B51", bg = "#fff7ed",
}: {
  icon: string; label: string; value: React.ReactNode;
  accent?: string; bg?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      background: "#fff", borderRadius: 14, padding: "16px 20px",
      border: "1.5px solid #e0e8ec",
      boxShadow: "0 2px 12px rgba(37,52,63,0.06)",
      flex: "1 1 180px",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: bg, color: accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18,
      }}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</p>
        <p style={{ fontSize: 17, fontWeight: 900, color: "#25343F", margin: "2px 0 0", lineHeight: 1.2 }}>{value || "—"}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   QUICK ACTION BUTTON
═══════════════════════════════════════════════════════ */
function ActionBtn({
  href, icon, label, sub, primary,
}: {
  href: string; icon: string; label: string; sub: string; primary?: boolean;
}) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px", borderRadius: 12, textDecoration: "none",
      background: primary ? "#FF9B51" : "#fff",
      border: primary ? "none" : "1.5px solid #e0e8ec",
      boxShadow: primary ? "0 4px 16px rgba(255,155,81,0.28)" : "0 1px 4px rgba(37,52,63,0.06)",
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = primary ? "0 8px 24px rgba(255,155,81,0.36)" : "0 6px 20px rgba(37,52,63,0.10)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = primary ? "0 4px 16px rgba(255,155,81,0.28)" : "0 1px 4px rgba(37,52,63,0.06)"; }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: primary ? "rgba(255,255,255,0.2)" : "#fff7ed",
        color: primary ? "#fff" : "#FF9B51",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
      }}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 900, color: primary ? "#fff" : "#25343F", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: primary ? "rgba(255,255,255,0.8)" : "#6a7882", margin: "2px 0 0" }}>{sub}</p>
      </div>
      <i className="fa-solid fa-arrow-right" style={{ marginLeft: "auto", fontSize: 11, color: primary ? "rgba(255,255,255,0.7)" : "#c0cdd4" }} />
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function TeacherDashboardPage() {
  const { user } = useAppSelector((s) => s.auth);
  const { data: me, loading } = useApi<any>("/auth/me");

  /* derived values */
  const initials = (me?.full_name || user?.full_name || "T")
    .split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  const subjects: any[]  = me?.subjects  || [];
  const sections: any[]  = me?.sections  || [];

  const statusColor = me?.status === "active"
    ? { bg: "#dcfce7", color: "#15803d" }
    : { bg: "#fee2e2", color: "#b91c1c" };

  return (
    <div style={{ minHeight: "100vh", background: "#EAEFEF" }}>
      <Topbar title="Dashboard" subtitle={`Good morning · ${today}`} />

      <main style={{ padding: "24px 28px 48px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6rem 0", gap: 16 }}>
            <Spinner size={36} color="#FF9B51" />
            <p style={{ color: "#6a7882", fontWeight: 700, fontSize: 13 }}>Loading your dashboard…</p>
          </div>
        ) : (
          <>

            {/* ══════════════════════════════════════
                PAGE HEADING — School name as H1
            ══════════════════════════════════════ */}
            <div style={{ marginBottom: 20 }}>
              <h1 style={{
                fontSize: 26, fontWeight: 900, color: "#25343F",
                letterSpacing: "-0.4px", margin: 0, lineHeight: 1.15,
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: 9,
                  background: "#FF9B51", color: "#25343F",
                  fontSize: 15, fontWeight: 900, flexShrink: 0,
                }}>
                  {(me?.school_name || "S").charAt(0).toUpperCase()}
                </span>
                {me?.school_name || "Your School"}
              </h1>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#6a7882", margin: "5px 0 0" }}>
                {today}
              </p>
            </div>
            <div style={{
              background: "linear-gradient(135deg, #25343F 0%, #314653 55%, #3d5060 100%)",
              borderRadius: 20, padding: "28px 32px", marginBottom: 24,
              display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
              boxShadow: "0 8px 32px rgba(37,52,63,0.22)",
              position: "relative", overflow: "hidden",
            }}>
              {/* decorative orbs */}
              <div style={{ position: "absolute", top: -40, right: -30, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,155,81,0.07)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -60, right: 160, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,155,81,0.04)", pointerEvents: "none" }} />

              {/* Avatar */}
              <div style={{
                width: 72, height: 72, borderRadius: 20, flexShrink: 0,
                background: "linear-gradient(135deg, #FF9B51 0%, #e8883e 100%)",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, fontWeight: 900,
                boxShadow: "0 4px 18px rgba(255,155,81,0.4)",
                zIndex: 1,
              }}>
                {initials}
              </div>

              {/* Name & meta */}
              <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.3px" }}>
                    {me?.full_name || user?.full_name || "Teacher"}
                  </h2>
                  <span style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                    background: statusColor.bg, color: statusColor.color, textTransform: "capitalize",
                  }}>
                    {me?.status || "active"}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px" }}>
                  {me?.email && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#BFC9D1", display: "flex", alignItems: "center", gap: 6 }}>
                      <i className="fa-solid fa-envelope" style={{ color: "#FF9B51", fontSize: 11 }} />
                      {me.email}
                    </span>
                  )}
                  {me?.phone && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#BFC9D1", display: "flex", alignItems: "center", gap: 6 }}>
                      <i className="fa-solid fa-phone" style={{ color: "#FF9B51", fontSize: 11 }} />
                      {me.phone}
                    </span>
                  )}
                  {me?.qualification && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#BFC9D1", display: "flex", alignItems: "center", gap: 6 }}>
                      <i className="fa-solid fa-graduation-cap" style={{ color: "#FF9B51", fontSize: 11 }} />
                      {me.qualification}
                    </span>
                  )}
                </div>
              </div>

              {/* Right info chips */}
              <div style={{ display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap", zIndex: 1 }}>
                {[
                  { label: "Subjects", value: subjects.length || "—" },
                  { label: "Experience", value: me?.experience_years ? `${me.experience_years} yrs` : "—" },
                  { label: "Joined", value: me?.join_date ? new Date(me.join_date).getFullYear() : "—" },
                ].map(c => (
                  <div key={c.label} style={{
                    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                    backdropFilter: "blur(6px)", borderRadius: 10, padding: "10px 16px", textAlign: "center", minWidth: 80,
                  }}>
                    <p style={{ fontSize: 20, fontWeight: 900, color: "#FF9B51", margin: 0, lineHeight: 1 }}>{c.value}</p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#BFC9D1", margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>{c.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ══════════════════════════════════════
                STAT CHIPS ROW
            ══════════════════════════════════════ */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <StatChip icon="fa-graduation-cap"   label="Qualification"  value={me?.qualification || "—"}                         accent="#6366f1" bg="#eef2ff" />
              <StatChip icon="fa-calendar-check"   label="Experience"     value={me?.experience_years ? `${me.experience_years} yrs` : "—"} accent="#16a34a" bg="#f0fdf4" />
              <StatChip icon="fa-calendar-day"     label="Join Date"      value={fmt(me?.join_date)}                                accent="#0284c7" bg="#eff6ff" />
              <StatChip icon="fa-chalkboard-user"  label="Today"          value={dayOfWeek}                                         accent="#FF9B51" bg="#fff7ed" />
            </div>

            {/* ══════════════════════════════════════
                MAIN GRID — 3 columns
            ══════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

              {/* ── Quick Actions ── */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e0e8ec", boxShadow: "0 2px 12px rgba(37,52,63,0.06)", overflow: "hidden", gridColumn: "1" }}>
                <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f0f4f6", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "#fff7ed", color: "#FF9B51", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                    <i className="fa-solid fa-bolt" />
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: "#25343F", margin: 0 }}>Quick Actions</h3>
                </div>
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <ActionBtn href="/teacher/attendance/class" icon="fa-clipboard-check" label="Mark Attendance"        sub="Take today's class roll"     primary />
                  <ActionBtn href="/teacher/attendance"       icon="fa-user-check"      label="Attendance Overview"    sub="View all records"            />
                  <ActionBtn href="/teacher/results"          icon="fa-pen-to-square"   label="Enter Exam Results"     sub="Update student marks"        />
                  <ActionBtn href="/teacher/profile"          icon="fa-id-badge"        label="My Profile"             sub="Personal & professional info" />
                </div>
              </div>

              {/* ── My Subjects ── */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e0e8ec", boxShadow: "0 2px 12px rgba(37,52,63,0.06)", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f0f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: "#eef2ff", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                      <i className="fa-solid fa-book" />
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 900, color: "#25343F", margin: 0 }}>My Subjects</h3>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#6a7882", background: "#f0f4f6", padding: "2px 8px", borderRadius: 6 }}>
                    {subjects.length} assigned
                  </span>
                </div>
                <div style={{ padding: "16px" }}>
                  {subjects.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {subjects.map((sub: any, i: number) => {
                        const c = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                        return (
                          <div key={sub.id} style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "10px 14px", borderRadius: 10,
                            background: c.bg, border: `1px solid ${c.border}`,
                          }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                              background: c.color + "22", color: c.color,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 13, fontWeight: 900,
                            }}>
                              {(sub.name || sub.subject_name || "S").charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 900, color: "#25343F", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {sub.name || sub.subject_name}
                              </p>
                              {sub.code && <p style={{ fontSize: 10.5, fontWeight: 700, color: "#6a7882", margin: "2px 0 0" }}>{sub.code}</p>}
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 800, color: c.color, background: c.border + "88", padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>
                              Subject
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: "28px 0", textAlign: "center" }}>
                      <i className="fa-solid fa-book-open" style={{ fontSize: 28, color: "#d4dde2", marginBottom: 10 }} />
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#6a7882", margin: "0 0 4px" }}>No subjects yet</p>
                      <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, margin: 0 }}>Contact your school admin.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── My Sections / Classes ── */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e0e8ec", boxShadow: "0 2px 12px rgba(37,52,63,0.06)", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f0f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                      <i className="fa-solid fa-table-cells" />
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 900, color: "#25343F", margin: 0 }}>My Sections</h3>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#6a7882", background: "#f0f4f6", padding: "2px 8px", borderRadius: 6 }}>
                    {sections.length} section{sections.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ padding: "16px" }}>
                  {sections.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {sections.map((sec: any, i: number) => (
                        <div key={sec.id || i} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 14px", borderRadius: 10,
                          background: "#f8fafc", border: "1px solid #e0e8ec",
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                            background: "#25343F", color: "#FF9B51",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 900,
                          }}>
                            {(sec.name || "S").charAt(0)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 900, color: "#25343F", margin: 0 }}>
                              Section {sec.name}
                              {sec.class_name && <span style={{ color: "#6a7882", fontWeight: 700 }}> · {sec.class_name}</span>}
                            </p>
                            <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                              {sec.room_no && (
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#6a7882" }}>
                                  <i className="fa-solid fa-door-open" style={{ marginRight: 3, fontSize: 9 }} />
                                  {sec.room_no}
                                </span>
                              )}
                              {sec.capacity && (
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#6a7882" }}>
                                  <i className="fa-solid fa-users" style={{ marginRight: 3, fontSize: 9 }} />
                                  {sec.capacity} cap
                                </span>
                              )}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
                            background: sec.status === "inactive" ? "#f1f5f9" : "#dcfce7",
                            color: sec.status === "inactive" ? "#6a7882" : "#15803d",
                            textTransform: "capitalize", flexShrink: 0,
                          }}>
                            {sec.status || "active"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: "28px 0", textAlign: "center" }}>
                      <i className="fa-solid fa-table-cells" style={{ fontSize: 28, color: "#d4dde2", marginBottom: 10 }} />
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#6a7882", margin: "0 0 4px" }}>No sections assigned</p>
                      <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, margin: 0 }}>Contact your school admin.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ══════════════════════════════════════
                BOTTOM ROW — School info + Personal details
            ══════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>

              {/* School Information */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e0e8ec", boxShadow: "0 2px 12px rgba(37,52,63,0.06)", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f0f4f6", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "#fff7ed", color: "#FF9B51", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                    <i className="fa-solid fa-building-columns" />
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: "#25343F", margin: 0 }}>School Information</h3>
                </div>
                <div style={{ padding: "18px 20px" }}>
                  {/* School name banner */}
                  <div style={{
                    background: "linear-gradient(135deg, #25343F 0%, #3d5060 100%)",
                    borderRadius: 12, padding: "16px 18px", marginBottom: 16,
                    display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: "#FF9B51", color: "#25343F",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 900,
                    }}>
                      {(me?.school_name || "S").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 900, color: "#fff", margin: 0 }}>{me?.school_name || "Your School"}</p>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#BFC9D1", margin: "3px 0 0" }}>
                        {me?.role === "faculty" ? "Faculty Member" : "Teacher"} · {me?.status || "active"}
                      </p>
                    </div>
                  </div>
                  {/* details grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { icon: "fa-envelope",        label: "School Email", value: me?.email },
                      { icon: "fa-phone",            label: "Phone",       value: me?.phone },
                      { icon: "fa-location-dot",     label: "City",        value: me?.city  },
                      { icon: "fa-earth-asia",       label: "Country",     value: me?.country },
                    ].map(r => (
                      <div key={r.label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <i className={`fa-solid ${r.icon}`} style={{ color: "#FF9B51", fontSize: 12, marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 10.5, fontWeight: 700, color: "#6a7882", margin: 0, textTransform: "uppercase", letterSpacing: "0.4px" }}>{r.label}</p>
                          <p style={{ fontSize: 13, fontWeight: 800, color: "#25343F", margin: "2px 0 0" }}>{r.value || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Personal Details */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e0e8ec", boxShadow: "0 2px 12px rgba(37,52,63,0.06)", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f0f4f6", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "#eff6ff", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                    <i className="fa-solid fa-id-badge" />
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: "#25343F", margin: 0 }}>Personal Details</h3>
                  <Link href="/teacher/profile" style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#FF9B51", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                    Edit <i className="fa-solid fa-pen" style={{ fontSize: 9 }} />
                  </Link>
                </div>
                <div style={{ padding: "18px 20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                      { icon: "fa-user",             label: "Full Name",     value: me?.full_name },
                      { icon: "fa-venus-mars",        label: "Gender",        value: me?.gender },
                      { icon: "fa-cake-candles",      label: "Date of Birth", value: fmt(me?.date_of_birth) },
                      { icon: "fa-graduation-cap",    label: "Qualification", value: me?.qualification },
                      { icon: "fa-briefcase",         label: "Experience",    value: me?.experience_years ? `${me.experience_years} years` : null },
                      { icon: "fa-calendar-plus",     label: "Joined",        value: fmt(me?.join_date) },
                    ].map(r => (
                      <div key={r.label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <i className={`fa-solid ${r.icon}`} style={{ color: "#0284c7", fontSize: 12, marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 10.5, fontWeight: 700, color: "#6a7882", margin: 0, textTransform: "uppercase", letterSpacing: "0.4px" }}>{r.label}</p>
                          <p style={{ fontSize: 13, fontWeight: 800, color: "#25343F", margin: "2px 0 0", textTransform: "capitalize" }}>{r.value || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

          </>
        )}
      </main>

      {/* responsive overrides */}
      <style>{`
        @media (max-width: 1100px) {
          main > div:nth-of-type(2) { grid-template-columns: 1fr 1fr !important; }
          main > div:nth-of-type(2) > div:first-child { grid-column: 1 / -1; }
        }
        @media (max-width: 768px) {
          main { padding: 16px !important; }
          main > div:nth-of-type(2) { grid-template-columns: 1fr !important; }
          main > div:nth-of-type(3) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
