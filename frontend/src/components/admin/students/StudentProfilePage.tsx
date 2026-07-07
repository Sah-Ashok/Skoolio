"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./students.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

function getInitials(name: string) {
  if (!name) return "";
  return name.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

function pctColor(pct: number) {
  if (pct >= 85) return "#12805c";
  if (pct >= 70) return "#c46a14";
  return "#b42318";
}

const STATUS_STYLE: Record<string, string> = {
  present: "present",
  absent:  "absent",
  late:    "late",
  leave:   "off",
};

export default function StudentProfilePage() {
  const searchParams = useSearchParams();
  const id = searchParams?.get("id");

  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: student, loading } = useApi<any>(id ? `/students/${id}` : "");
  const { data: enrollments } = useApi<any[]>(id ? `/students/${id}/enrollments` : "");
  const { data: fees } = useApi<any[]>(id ? `/fees/collections/student/${id}` : "");

  // ── Attendance state ──
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([]);
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Load summary for active year (full year range)
  useEffect(() => {
    if (!id || !activeYear?.id) return;
    const start = activeYear.start_date?.split("T")[0] || activeYear.start_date;
    const end   = activeYear.end_date?.split("T")[0]   || activeYear.end_date;
    setLoadingAttendance(true);
    apiRequest<{ data: any }>(
      `/attendance/student/${id}/summary?academic_year_id=${activeYear.id}&start_date=${start}&end_date=${end}`
    )
      .then((res) => setAttendanceSummary(res.data))
      .catch(() => setAttendanceSummary(null))
      .finally(() => setLoadingAttendance(false));
  }, [id, activeYear?.id]);

  // Load monthly calendar when month tab changes
  useEffect(() => {
    if (!id) return;
    const [yr, mo] = attendanceMonth.split("-");
    apiRequest<{ data: any[] }>(
      `/attendance/student/${id}/monthly?year=${yr}&month=${parseInt(mo)}`
    )
      .then((res) => setMonthlyAttendance(res.data || []))
      .catch(() => setMonthlyAttendance([]));
  }, [id, attendanceMonth]);

  if (!id)      return <div>No student selected</div>;
  if (loading)  return <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>;
  if (!student) return <div>Student not found</div>;

  const currentEnrollment  = enrollments?.[0];
  const totalFeeAssigned   = fees?.reduce((sum, f) => sum + parseFloat(f.total_amount), 0) || 0;
  const totalFeePaid       = fees?.reduce((sum, f) => sum + parseFloat(f.paid_amount || "0"), 0) || 0;
  const pendingFee         = totalFeeAssigned - totalFeePaid;

  // Attendance numbers — start at 100%, decrease on absences
  const attPct     = attendanceSummary?.attendance_percentage ?? 100;
  const attPresent = attendanceSummary?.total_present ?? 0;
  const attAbsent  = attendanceSummary?.total_absent  ?? 0;
  const attLate    = attendanceSummary?.total_late    ?? 0;
  const attLeave   = attendanceSummary?.total_leave   ?? 0;
  const attWDays   = attendanceSummary?.total_working_days ?? 0;

  // Build calendar grid for selected month
  const [yr, mo] = attendanceMonth.split("-").map(Number);
  const firstDay  = new Date(yr, mo - 1, 1);
  const totalDays = new Date(yr, mo, 0).getDate();
  let leading     = firstDay.getDay() - 1;
  if (leading < 0) leading = 6;

  // Map date string → status
  const dayMap: Record<string, string> = {};
  monthlyAttendance.forEach((rec) => {
    if (rec.date) dayMap[rec.date.split("T")[0]] = rec.status;
  });

  const calDays: { day: number | null; status?: string; dateStr?: string }[] = [];
  for (let i = 0; i < leading; i++) calDays.push({ day: null });
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${yr}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calDays.push({ day: d, status: dayMap[dateStr], dateStr });
  }
  while (calDays.length % 7 !== 0) calDays.push({ day: null });

  const monthOptions = (() => {
    if (!activeYear) return [];
    const opts = [];
    const start = new Date(activeYear.start_date);
    const end   = new Date(activeYear.end_date);
    const d     = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    while (d <= end) {
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      });
      d.setMonth(d.getMonth() + 1);
    }
    return opts;
  })();

  const info = [
    ["Date of Birth",      student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—"],
    ["Gender",             student.gender],
    ["Blood Group",        student.blood_group || "—"],
    ["Email",              student.email || "—"],
    ["Phone",              student.phone || "—"],
    ["Address",            [student.city, student.state, student.country].filter(Boolean).join(", ") || "—"],
    ["Guardian Name",      student.guardian_name || "—"],
    ["Guardian Relation",  student.guardian_relation || "—"],
    ["Guardian Phone",     student.guardian_phone || "—"],
    ["Joined Date",        student.admission_date ? new Date(student.admission_date).toLocaleDateString() : "—"],
  ];

  return (
    <div className={s("students-page")}>
      <Topbar title="Student Profile" subtitle="Student records and details" />
      <main className={s("page-content")}>

        <section className={s("page-head")}>
          <div>
            <h1>Student Profile</h1>
            <p>Record for {student.admission_number}</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/students">
              <i className="fa-solid fa-arrow-left" /> Back
            </Link>
            <Link className={cx(s("btn"), s("btn-primary"))} href={`/students/${id}/edit`}>
              <i className="fa-solid fa-pen-to-square" /> Edit Record
            </Link>
          </div>
        </section>

        {/* Hero */}
        <section className={cx(s("profile-hero"), s("profile-hero-polished"))}>
          <div className={s("profile-main")}>
            <div className={s("profile-avatar")}>{getInitials(student.full_name)}</div>
            <div>
              <div className={s("profile-kicker")} style={{ textTransform: "capitalize" }}>{student.status} Student</div>
              <h1>{student.full_name}</h1>
              <p>
                {currentEnrollment ? `Class ${currentEnrollment.class_name || currentEnrollment.class_id} - Section ${currentEnrollment.section_name || currentEnrollment.section_id} | ` : ""}
                Admitted {student.admission_date ? new Date(student.admission_date).toLocaleDateString() : "—"}
              </p>
              <div className={s("profile-meta")}>
                <span className={cx(s("badge"), s(student.status === "active" ? "badge-green" : "badge-yellow"))} style={{ textTransform: "capitalize" }}>{student.status}</span>
                <span className={cx(s("badge"), s(pendingFee > 0 ? "badge-red" : "badge-green"))}>
                  {pendingFee > 0 ? "Fee Pending" : "Fee Cleared"}
                </span>
              </div>
            </div>
          </div>
          <div className={s("profile-score-panel")}>
            <div>
              <span>Attendance</span>
              <strong style={{ color: pctColor(attPct) }}>{loadingAttendance ? "…" : `${attPct}%`}</strong>
            </div>
            <div><span>Final Result</span><strong>—</strong></div>
            <div><span>Status</span><strong style={{ textTransform: "capitalize" }}>{student.status}</strong></div>
          </div>
        </section>

        {/* Metrics */}
        <section className={s("profile-metrics")}>
          <article className={s("metric-card")}>
            <div className={cx(s("metric-icon"), s("green"))}><i className="fa-solid fa-calendar-check" /></div>
            <div>
              <span>Present Days</span>
              <strong style={{ color: "#12805c" }}>{attPresent}</strong>
            </div>
          </article>
          <article className={s("metric-card")}>
            <div className={cx(s("metric-icon"), s("rose"))}><i className="fa-solid fa-calendar-xmark" /></div>
            <div>
              <span>Absent Days</span>
              <strong style={{ color: "#b42318" }}>{attAbsent}</strong>
            </div>
          </article>
          <article className={s("metric-card")}>
            <div className={cx(s("metric-icon"), s("blue"))}><i className="fa-solid fa-folder-open" /></div>
            <div>
              <span>Enrollments</span>
              <strong>{enrollments?.length || 0} Years</strong>
            </div>
          </article>
          <article className={s("metric-card")}>
            <div className={cx(s("metric-icon"), s("orange"))}><i className="fa-solid fa-receipt" /></div>
            <div>
              <span>Fee Paid</span>
              <strong>₹{totalFeePaid}</strong>
            </div>
          </article>
        </section>

        <div className={s("profile-grid")}>
          {/* Left — Student info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <section className={cx(s("card"), s("profile-card-main"))}>
              <div className={s("card-header")}>
                <div><h3>Student Information</h3><p>Personal and guardian details</p></div>
              </div>
              <div className={s("profile-info-list")}>
                {info.map(([label, value]) => (
                  <div className={s("info-row")} key={label}>
                    <span>{label}</span>
                    <strong style={{ textTransform: label === "Gender" ? "capitalize" : "none" }}>{value}</strong>
                  </div>
                ))}
              </div>

              {/* ── SCHOLARSHIP ── */}
              {student.scholarship_type && (
                <div style={{ margin: "0 18px 18px", padding: "14px 16px", borderRadius: 10, background: "#fefce8", border: "1px solid #fde68a" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <i className="fa-solid fa-graduation-cap" style={{ color: "#b45309", fontSize: 16 }} />
                    <strong style={{ fontSize: 13, color: "#92400e" }}>Scholarship Awarded</strong>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 900, color: "#78350f" }}>Type</p>
                      <strong style={{ textTransform: "capitalize" }}>{student.scholarship_type.replace(/_/g, " ")}</strong>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 900, color: "#78350f" }}>Discount</p>
                      <strong style={{ color: "#92400e", fontSize: 15 }}>{student.scholarship_percent}% off fees</strong>
                    </div>
                    {student.scholarship_remarks && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <p style={{ fontSize: 11, fontWeight: 900, color: "#78350f" }}>Remarks</p>
                        <strong style={{ fontWeight: 700 }}>{student.scholarship_remarks}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ── ATTENDANCE CARD ── */}
            <section className={s("card")}>
              <div className={s("card-header")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3>Attendance</h3>
                  <p>Starts at 100% — decreases per absent day</p>
                </div>
                <select
                  value={attendanceMonth}
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 800, color: "#1f2d36", background: "#fff", fontFamily: "inherit" }}
                >
                  {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Summary bar */}
              <div style={{ padding: "16px 18px", borderBottom: "1px solid #eef2f3", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                {[
                  { label: "Attendance",    val: `${attPct}%`,   color: pctColor(attPct) },
                  { label: "Working Days",  val: attWDays,        color: "#1f2d36" },
                  { label: "Present",       val: attPresent,      color: "#12805c" },
                  { label: "Absent",        val: attAbsent,       color: "#b42318" },
                  { label: "Late / Leave",  val: `${attLate} / ${attLeave}`, color: "#c46a14" },
                ].map((m) => (
                  <div key={m.label} style={{ padding: "10px 12px", border: "1px solid #dce5e9", borderRadius: 9, background: "#f8fbfc" }}>
                    <p style={{ fontSize: 11, fontWeight: 900, color: "#6a7882", margin: 0 }}>{m.label}</p>
                    <strong style={{ fontSize: 16, fontWeight: 900, color: m.color }}>{m.val}</strong>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #eef2f3" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, fontWeight: 900, color: "#6a7882" }}>
                  <span>Attendance Rate (full year)</span>
                  <strong style={{ color: pctColor(attPct) }}>{attPct}%</strong>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "#e1e8eb", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${attPct}%`, background: pctColor(attPct), borderRadius: 999, transition: "width 0.5s" }} />
                </div>
              </div>

              {/* Monthly calendar grid */}
              <div style={{ padding: "16px 18px" }}>
                <p style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", marginBottom: 10 }}>
                  {new Date(yr, mo - 1).toLocaleString("default", { month: "long", year: "numeric" })} — day-by-day
                </p>
                <div className={s("studentCalendar")}>
                  {["M","T","W","T","F","S","S"].map((d, i) => (
                    <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 900, color: "#6a7882", paddingBottom: 6 }}>{d}</div>
                  ))}
                  {calDays.map((cell, i) => (
                    <div
                      key={i}
                      className={cx(
                        s("studentDay"),
                        cell.status ? s(STATUS_STYLE[cell.status] || "off") : (cell.day ? undefined : s("off"))
                      )}
                      style={{ opacity: cell.day ? 1 : 0.25 }}
                    >
                      <strong>{cell.day ?? ""}</strong>
                      {cell.status && (
                        <span className={s(STATUS_STYLE[cell.status] || "off")} style={{ fontSize: 9 }}>
                          {cell.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
                  {[
                    { label: "Present", color: "#12805c", bg: "#e2f6ee" },
                    { label: "Absent",  color: "#b42318", bg: "#fde7e7" },
                    { label: "Late",    color: "#c46a14", bg: "#fff1df" },
                    { label: "Leave",   color: "#6a7882", bg: "#eef2f3" },
                  ].map((l) => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 900, color: l.color }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: l.bg, border: `1.5px solid ${l.color}` }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Right sidebar */}
          <aside className={s("profile-side-stack")}>
            <section className={s("card")}>
              <div className={s("card-header")}>
                <div><h3>Fee Summary</h3><p>Lifetime fee collections</p></div>
                <span className={cx(s("badge"), s(pendingFee > 0 ? "badge-red" : "badge-green"))}>
                  {pendingFee > 0 ? "Pending" : "Cleared"}
                </span>
              </div>
              <div className={s("fee-card")}>
                <div className={s("fee-row")}><span>Total Assigned</span><strong>₹{totalFeeAssigned}</strong></div>
                <div className={s("fee-row")}><span>Total Paid</span><strong className={s("text-success")}>₹{totalFeePaid}</strong></div>
                <div className={s("fee-row")}><span>Pending</span><strong className={s("text-danger")}>₹{pendingFee}</strong></div>
                <div className={s("progress")}>
                  <span style={{ width: totalFeeAssigned > 0 ? `${(totalFeePaid / totalFeeAssigned) * 100}%` : "0%" }} />
                </div>
              </div>
            </section>

            <section className={s("card")}>
              <div className={s("card-header")}><div><h3>Enrollment History</h3><p>Academic years studied</p></div></div>
              <div className={s("quick-detail-list")}>
                {enrollments?.map((en) => (
                  <div key={en.id}>
                    <i className="fa-solid fa-school" />
                    <span>{en.academic_year_name || "Year"} — Class {en.class_name || en.class_id} (Sec {en.section_name || en.section_id})</span>
                  </div>
                ))}
                {!enrollments?.length && <div><i className="fa-solid fa-ban" /><span>No enrollments</span></div>}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
