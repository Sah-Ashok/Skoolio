"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./attendance.module.css";
import { useApi } from "@/lib/useApi";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Spinner } from "@/components/shared/Loader";

const s  = (n: string) => styles[n] || n;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/** Parse a date string like "2025-06-15" without timezone shift */
const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const statusColor: Record<string, string> = {
  present: "#12805c",
  absent:  "#b42318",
  late:    "#c46a14",
  leave:   "#3b5bdb",
};
const statusBg: Record<string, string> = {
  present: "#e2f6ee",
  absent:  "#fde7e7",
  late:    "#fff1df",
  leave:   "#e8edff",
};

export default function StudentAttendancePage() {
  const params   = useParams();
  const pathname = usePathname();
  const studentId = params.studentId as string;
  const backHref  = pathname?.startsWith("/teacher") ? "/teacher/attendance" : "/attendance";

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: student, loading: studentLoading } = useApi<any>(
    studentId ? `/students/${studentId}` : ""
  );
  const { activeYear, academicYearId } = useAcademicYear();

  // Summary: only academic_year_id needed — backend fetches admission_date internally
  const { data: summary, loading: summaryLoading } = useApi<any>(
    academicYearId && studentId
      ? `/attendance/student/${studentId}/summary?academic_year_id=${academicYearId}`
      : "",
    [academicYearId, studentId]
  );

  const { data: monthlyRecords, loading: monthlyLoading } = useApi<any[]>(
    studentId ? `/attendance/student/${studentId}/monthly?year=${year}&month=${month}` : "",
    [studentId, year, month]
  );

  // FIX: use parseLocalDate to avoid timezone-shift off-by-one bug
  const daysInMonth = new Date(year, month, 0).getDate();
  const recordsByDay = new Map<number, any>();
  (monthlyRecords || []).forEach(r => {
    const day = parseLocalDate(r.date).getDate();
    recordsByDay.set(day, r);
  });

  const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const day    = i + 1;
    const record = recordsByDay.get(day);
    return { day, status: record?.status || null };
  });

  // Monthly counts
  const mCounts = (monthlyRecords || []).reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const monthlyTotal = monthlyRecords?.length || 0;
  const monthlyRate  = monthlyTotal > 0
    ? Math.round(((mCounts.present || 0) / monthlyTotal) * 100)
    : 0;

  const initials = student?.full_name
    ? student.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const isLoading = studentLoading || summaryLoading;

  // Month selector options — last 12 months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
  });

  const remaining = Number(summary?.total_remaining ?? 0);

  return (
    <div className={s("page")}>
      <Topbar title="Student Attendance" subtitle="Monthly calendar and attendance summary" />

      <main className={s("content")}>
        {/* ── Header ── */}
        <section className={s("head")}>
          <div>
            <h1>{student?.full_name || "Loading…"}</h1>
            <p>
              {student?.admission_number}
              {activeYear ? ` · ${activeYear.year_name}` : ""}
            </p>
          </div>
          <Link className={cx(s("btn"), s("btnOutline"))} href={backHref}>
            <i className="fa-solid fa-arrow-left" /> Back
          </Link>
        </section>

        {isLoading ? (
          <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} /></div>
        ) : (
          <>
            {/* ── Profile hero ── */}
            <section className={s("profileHero")}>
              <div className={s("studentCell")}>
                <span>{initials}</span>
                <div>
                  <strong>{student?.full_name}</strong>
                  <small>{student?.admission_number}</small>
                </div>
              </div>
              <div className={s("profileMetrics")}>
                {[
                  ["Year %",     `${summary?.attendance_percentage ?? 0}%`, ""],
                  ["Present",    summary?.total_present   ?? 0,             "successText"],
                  ["Absent",     summary?.total_absent    ?? 0,             "dangerText"],
                  ["Late",       summary?.total_late      ?? 0,             "warningText"],
                  ["On Leave",   summary?.total_leave     ?? 0,             ""],
                  ["Remaining",  remaining,                                  ""],
                ].map(([label, val, cls]) => (
                  <span key={label as string}>
                    <b>{label}</b>
                    <strong className={cls ? s(cls as string) : undefined}>{val}</strong>
                  </span>
                ))}
              </div>
            </section>

            {/* Remaining notice */}
            {remaining > 0 && (
              <div style={{
                margin: "0 0 12px",
                padding: "10px 16px", borderRadius: 10,
                background: "#eff6ff", border: "1px solid #bfdbfe",
                fontSize: 13, fontWeight: 600, color: "#3b82f6",
              }}>
                ⏳ <strong>{remaining}</strong> working day{remaining !== 1 ? "s" : ""} in this academic year have not yet been marked by the teacher — these are excluded from the attendance percentage.
              </div>
            )}

            {/* ── Calendar + sidebar ── */}
            <section className={s("layout")}>
              <article className={s("card")}>
                <div className={s("cardHead")}>
                  <div>
                    <h2>{MONTH_NAMES[month - 1]} {year} Calendar</h2>
                    <p>Daily attendance status for each school day</p>
                  </div>
                  <select
                    className={s("miniSelect")}
                    value={`${year}-${month}`}
                    onChange={e => {
                      const [y, m] = e.target.value.split("-").map(Number);
                      setYear(y); setMonth(m);
                    }}
                  >
                    {monthOptions.map(opt => (
                      <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {monthlyLoading ? (
                  <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={24} /></div>
                ) : (
                  <div className={s("studentCalendar")}>
                    {monthDays.map(({ day, status }) => (
                      <div
                        key={day}
                        className={s("studentDay")}
                        style={status ? {
                          background:   statusBg[status]   || "#eef2f3",
                          borderColor:  statusColor[status] || "#d4dde2",
                        } : undefined}
                      >
                        <strong>{day}</strong>
                        <span style={status ? {
                          background: statusBg[status],
                          color:      statusColor[status],
                        } : { background: "#e2e8f0", color: "#6a7882" }}>
                          {status || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <aside className={s("sideStack")}>
                {/* Monthly stats */}
                <article className={s("card")}>
                  <div className={s("cardHead")}>
                    <div><h2>This Month</h2><p>Quick stats for {MONTH_NAMES[month - 1]}</p></div>
                  </div>
                  <div className={s("rules")}>
                    {[
                      ["Days Marked",  monthlyTotal,                  ""],
                      ["Present",      mCounts.present || 0,          "successText"],
                      ["Absent",       mCounts.absent  || 0,          "dangerText"],
                      ["Late",         mCounts.late    || 0,          "warningText"],
                      ["On Leave",     mCounts.leave   || 0,          ""],
                      ["Monthly Rate", `${monthlyRate}%`,             ""],
                    ].map(([label, val, cls]) => (
                      <span key={label as string}>
                        <b>{label}</b>
                        <strong className={cls ? s(cls as string) : undefined}>{val}</strong>
                      </span>
                    ))}
                  </div>
                </article>

                {/* Legend */}
                <article className={s("card")}>
                  <div className={s("cardHead")}><div><h2>Legend</h2><p>Status colors</p></div></div>
                  <div className={s("legend")}>
                    {Object.entries(statusColor).map(([st, col]) => (
                      <span key={st}>
                        <i style={{ background: statusBg[st], border: `1px solid ${col}` }} />
                        <span style={{ textTransform: "capitalize" }}>{st}</span>
                      </span>
                    ))}
                    <span>
                      <i style={{ background: "#e2e8f0", border: "1px solid #d4dde2" }} />
                      <span>No record</span>
                    </span>
                  </div>
                </article>
              </aside>
            </section>

            {/* ── Recent records table ── */}
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h2>Records — {MONTH_NAMES[month - 1]} {year}</h2>
                  <p>All marked attendance entries for this month</p>
                </div>
              </div>
              <div className={s("tableWrap")}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(monthlyRecords || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", padding: "2.5rem", color: "#6a7882" }}>
                          <i className="fa-solid fa-calendar-xmark" style={{ fontSize: 22, display: "block", marginBottom: 8 }} />
                          No attendance records for {MONTH_NAMES[month - 1]} {year}.
                        </td>
                      </tr>
                    ) : (monthlyRecords || []).map(r => (
                      <tr key={r.id}>
                        <td>
                          <strong>
                            {parseLocalDate(r.date).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </strong>
                        </td>
                        <td>
                          <span
                            className={s("badge")}
                            style={{
                              background: statusBg[r.status]   || "#eef2f3",
                              color:      statusColor[r.status] || "#6a7882",
                              textTransform: "capitalize",
                            }}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td style={{ color: "#6a7882", fontSize: 13 }}>{r.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        )}
      </main>
    </div>
  );
}
