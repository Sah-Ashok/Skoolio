"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const pctColor = (p: number) => p >= 85 ? "#12805c" : p >= 70 ? "#c46a14" : "#b42318";
const pctBg    = (p: number) => p >= 85 ? "#e2f6ee" : p >= 70 ? "#fff1df" : "#fde7e7";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  submitted: { bg: "#e2f6ee", color: "#12805c", label: "Submitted" },
  draft:     { bg: "#fff1df", color: "#c46a14", label: "Draft"     },
  pending:   { bg: "#f1f5f9", color: "#64748b", label: "Pending"   },
};

const STATUS_ICON: Record<string, string> = {
  present: "fa-circle-check",
  absent:  "fa-circle-xmark",
  late:    "fa-clock",
  leave:   "fa-calendar-minus",
};

const STATUS_COLOR: Record<string, string> = {
  present: "#12805c",
  absent:  "#b42318",
  late:    "#c46a14",
  leave:   "#3b5bdb",
};

export default function TeacherAttendanceOverviewPage() {
  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: mySections, loading: sectionsLoading } = useApi<any[]>("/teachers/me/sections");

  const [sectionId, setSectionId] = useState("");
  const [viewMonth, setViewMonth] = useState(new Date().toISOString().slice(0, 7));
  const [records,   setRecords]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState<number | null>(null);
  const [recDetail, setRecDetail] = useState<Record<number, any>>({});

  // Auto-select first section
  useEffect(() => {
    if (mySections?.length && !sectionId) {
      setSectionId(String(mySections[0].id));
    }
  }, [mySections]);

  // Month options from academic year start → today
  const monthOptions = (() => {
    if (!activeYear) return [];
    const opts: { value: string; label: string }[] = [];
    const start = new Date(activeYear.start_date);
    const today = new Date();
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= today) {
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      });
      d.setMonth(d.getMonth() + 1);
    }
    return opts.reverse();
  })();

  // Load records for section + month
  const loadRecords = useCallback(async () => {
    if (!sectionId || !activeYear?.id || !viewMonth) return;
    setLoading(true);
    setRecords([]);
    setExpanded(null);
    try {
      const res = await apiRequest<{ data: any[] }>(
        `/attendance/section/${sectionId}?academic_year_id=${activeYear.id}`
      );
      const all: any[] = Array.isArray(res) ? res : (res.data ?? []);
      const filtered = all
        .filter((r: any) => r.date?.startsWith(viewMonth))
        .sort((a: any, b: any) => (b.date > a.date ? 1 : -1));
      setRecords(filtered);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [sectionId, activeYear?.id, viewMonth]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // Expand/collapse row — load detail lazily
  const toggleExpand = async (rec: any) => {
    if (expanded === rec.id) { setExpanded(null); return; }
    setExpanded(rec.id);
    if (recDetail[rec.id]) return;
    try {
      const res = await apiRequest<{ data: any }>(`/attendance/${rec.id}`);
      const detail = res.data ?? res;
      setRecDetail((prev) => ({ ...prev, [rec.id]: detail }));
    } catch { /* row still visible, detail just won't expand */ }
  };

  // Month stats
  const totalDays    = records.length;
  const submitted    = records.filter((r) => r.status === "submitted").length;
  const draft        = records.filter((r) => r.status === "draft").length;
  const totalPresent = records.reduce((s, r) => s + Number(r.present_count ?? 0), 0);
  const totalAbsent  = records.reduce((s, r) => s + Number(r.absent_count  ?? 0), 0);

  const selectedSection = mySections?.find((s) => String(s.id) === sectionId);

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
      <Topbar title="Attendance Overview" subtitle="Browse past attendance records for your section" />

      <main style={{ padding: "24px 28px 48px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Page head */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Attendance Overview</h1>
            <p style={{ color: "#6a7882", fontSize: 13, fontWeight: 700, marginTop: 4 }}>
              {selectedSection ? `Section ${selectedSection.name} · ${selectedSection.class_name}` : "Select your section below"}
            </p>
          </div>
          <Link
            href="/teacher/attendance/class"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", minHeight: 38, borderRadius: 8, border: "none", background: "#ff9b51", color: "#fff", fontWeight: 900, fontSize: 13, textDecoration: "none" }}
          >
            <i className="fa-solid fa-clipboard-check" /> Mark Today&apos;s Attendance
          </Link>
        </div>

        {/* Controls */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", padding: "16px 20px", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", boxShadow: "0 2px 8px rgba(31,45,54,.05)" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 900, flex: "1 1 200px" }}>
            Section
            {sectionsLoading
              ? <div style={{ height: 44, display: "flex", alignItems: "center" }}><Spinner size={18} color="#ff9b51" /></div>
              : <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={{ minHeight: 44, padding: "0 12px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 14, fontWeight: 800, color: "#1f2d36", background: "#fff", fontFamily: "inherit", outline: "none" }}>
                  {(mySections ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.class_name} — Section {s.name}</option>
                  ))}
                </select>
            }
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 900, flex: "1 1 180px" }}>
            Month
            <select value={viewMonth} onChange={(e) => setViewMonth(e.target.value)} style={{ minHeight: 44, padding: "0 12px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 14, fontWeight: 800, color: "#1f2d36", background: "#fff", fontFamily: "inherit", outline: "none" }}>
              {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        {/* Month summary strip */}
        {!loading && records.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              { label: "Days Marked",   value: totalDays,    color: "#1f2d36", bg: "#f8fafc" },
              { label: "Submitted",     value: submitted,    color: "#12805c", bg: "#e2f6ee" },
              { label: "Draft",         value: draft,        color: "#c46a14", bg: "#fff1df" },
              { label: "Total Present", value: totalPresent, color: "#3b5bdb", bg: "#e8edff" },
              { label: "Total Absent",  value: totalAbsent,  color: "#b42318", bg: "#fde7e7" },
            ].map((c) => (
              <div key={c.label} style={{ padding: "14px 16px", borderRadius: 10, background: c.bg, border: "1px solid rgba(191,201,209,0.5)" }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: "#6a7882", margin: 0 }}>{c.label}</p>
                <strong style={{ fontSize: 22, fontWeight: 900, color: c.color }}>{c.value}</strong>
              </div>
            ))}
          </div>
        )}

        {/* Records table */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", overflow: "hidden", boxShadow: "0 2px 8px rgba(31,45,54,.05)" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8eef0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
              {monthOptions.find((o) => o.value === viewMonth)?.label ?? viewMonth} — Records
            </h2>
            <p style={{ fontSize: 12, color: "#6a7882", fontWeight: 700, marginTop: 3 }}>Click any row to see per-student details.</p>
          </div>

          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#ff9b51" /></div>
          ) : records.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#6a7882" }}>
              <i className="fa-solid fa-calendar-xmark" style={{ fontSize: 32, display: "block", marginBottom: 12, opacity: 0.35 }} />
              <p style={{ fontWeight: 700, fontSize: 14 }}>No attendance records for this month.</p>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px 80px 80px 80px 110px 40px", padding: "10px 20px", background: "#f7fafb", borderBottom: "1px solid #e8eef0", fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                <span>Date</span><span>Day</span><span>Status</span>
                <span style={{ textAlign: "center" }}>Present</span>
                <span style={{ textAlign: "center" }}>Absent</span>
                <span style={{ textAlign: "center" }}>Leave</span>
                <span style={{ textAlign: "center" }}>Att. %</span>
                <span />
              </div>

              {records.map((rec) => {
                const date    = new Date(rec.date + "T00:00:00");
                const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
                const dateStr = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                const st      = STATUS_STYLE[rec.status] ?? STATUS_STYLE.pending;
                const present = Number(rec.present_count ?? 0);
                const absent  = Number(rec.absent_count  ?? 0);
                const leave   = Number(rec.leave_count   ?? 0);
                const total   = present + absent + leave;
                const pct     = total > 0 ? Math.round((present / total) * 100) : null;
                const isOpen  = expanded === rec.id;
                const detail  = recDetail[rec.id];

                return (
                  <div key={rec.id} style={{ borderBottom: "1px solid #f0f4f5" }}>
                    <div
                      onClick={() => toggleExpand(rec)}
                      style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px 80px 80px 80px 110px 40px", padding: "13px 20px", alignItems: "center", cursor: "pointer", background: isOpen ? "#fafbff" : "#fff" }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 900 }}>{dateStr}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#6a7882" }}>{dayName}</span>
                      <span>
                        <span style={{ fontSize: 11, fontWeight: 900, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                      </span>
                      <span style={{ textAlign: "center", fontSize: 14, fontWeight: 900, color: "#12805c" }}>{present}</span>
                      <span style={{ textAlign: "center", fontSize: 14, fontWeight: 900, color: "#b42318" }}>{absent}</span>
                      <span style={{ textAlign: "center", fontSize: 14, fontWeight: 900, color: "#3b5bdb" }}>{leave}</span>
                      <span style={{ textAlign: "center" }}>
                        {pct !== null
                          ? <span style={{ fontSize: 12, fontWeight: 900, padding: "3px 10px", borderRadius: 999, background: pctBg(pct), color: pctColor(pct) }}>{pct}%</span>
                          : <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                        }
                      </span>
                      <span style={{ textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                        <i className={`fa-solid ${isOpen ? "fa-chevron-up" : "fa-chevron-down"}`} />
                      </span>
                    </div>

                    {isOpen && (
                      <div style={{ padding: "0 20px 16px", background: "#fafbff", borderTop: "1px solid #eef2f3" }}>
                        {!detail ? (
                          <div style={{ padding: "1.5rem", textAlign: "center" }}><Spinner size={22} color="#ff9b51" /></div>
                        ) : (
                          <>
                            {rec.status !== "submitted" && (
                              <div style={{ padding: "10px 0 12px", display: "flex", justifyContent: "flex-end" }}>
                                <Link href="/teacher/attendance/class" style={{ fontSize: 12, fontWeight: 900, color: "#ff9b51", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                                  <i className="fa-solid fa-pen" /> Edit this record
                                </Link>
                              </div>
                            )}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                              {(detail.details ?? []).map((d: any) => {
                                const sc = STATUS_COLOR[d.status] ?? "#6a7882";
                                const si = STATUS_ICON[d.status]  ?? "fa-circle";
                                return (
                                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, background: "#fff", border: "1px solid #e8eef0" }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: sc + "18", color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                                      <i className={`fa-solid ${si}`} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p style={{ fontSize: 12, fontWeight: 900, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {d.full_name ?? `Student #${d.student_id}`}
                                      </p>
                                      <p style={{ fontSize: 10.5, fontWeight: 700, color: "#6a7882", margin: "2px 0 0" }}>
                                        {d.admission_number ?? ""}{d.roll_number ? ` · Roll ${d.roll_number}` : ""}
                                      </p>
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 900, color: sc, textTransform: "capitalize", flexShrink: 0 }}>{d.status}</span>
                                  </div>
                                );
                              })}
                              {(!detail.details || detail.details.length === 0) && (
                                <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>No student details available.</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
