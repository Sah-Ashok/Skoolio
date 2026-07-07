"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "../../admin/attendance/attendance.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function StudentOwnAttendancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: me } = useApi<any>('/auth/me');
  const { data: activeYear } = useApi<any>('/academic-years/active');

  const startOfYear = activeYear ? `${activeYear.start_date}` : `${year}-01-01`;
  const today = now.toISOString().split('T')[0];

  const { data: summary, loading: summaryLoading } = useApi<any>(
    activeYear?.id ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${startOfYear}&end_date=${today}` : '',
    [activeYear?.id]
  );

  const { data: monthlyRecords, loading: monthlyLoading } = useApi<any[]>(
    `/attendance/me/monthly?year=${year}&month=${month}`,
    [year, month]
  );

  const daysInMonth = new Date(year, month, 0).getDate();
  const recordsByDay = new Map<number, any>();
  (monthlyRecords || []).forEach((r) => recordsByDay.set(new Date(r.date).getDate(), r));

  const monthDays = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const record = recordsByDay.get(day);
    return { day, status: record?.status || null };
  });

  const presentCount = (monthlyRecords || []).filter((r) => r.status === 'present').length;
  const absentCount = (monthlyRecords || []).filter((r) => r.status === 'absent').length;
  const monthlyTotal = (monthlyRecords || []).length;
  const monthlyRate = monthlyTotal > 0 ? Math.round((presentCount / monthlyTotal) * 100) : 0;

  return (
    <div className={s("page")}>
      <Topbar title="My Attendance" subtitle="Your attendance record for the current academic year" />
      <main className={s("content")}>
        <section className={s("head")}>
          <div>
            <h1>{me?.full_name || 'My'} Attendance</h1>
            <p>{me?.admission_number} {activeYear ? `| Academic Year ${activeYear.year_name}` : ''}</p>
          </div>
        </section>

        {summaryLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} /></div>
        ) : (
          <>
            <section className={s("metricStrip")}>
              <div><span>Year Attendance</span><strong>{summary?.attendance_percentage ?? 0}%</strong><small>Since {activeYear?.year_name}</small></div>
              <div><span>Present</span><strong className={s("successText")}>{summary?.total_present ?? 0}</strong><small>Total days</small></div>
              <div><span>Absent</span><strong className={s("dangerText")}>{summary?.total_absent ?? 0}</strong><small>Total days</small></div>
              <div><span>Late</span><strong>{summary?.total_late ?? 0}</strong><small>Total days</small></div>
            </section>

            <section className={s("layout")}>
              <article className={s("card")}>
                <div className={s("cardHead")}>
                  <div><h2>{monthNames[month - 1]} {year} Calendar</h2><p>Your daily attendance status</p></div>
                  <select
                    className={s("miniSelect")}
                    value={`${year}-${month}`}
                    onChange={(e) => {
                      const [y, m] = e.target.value.split('-').map(Number);
                      setYear(y);
                      setMonth(m);
                    }}
                  >
                    {Array.from({ length: 6 }, (_, i) => {
                      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      return (
                        <option key={`${d.getFullYear()}-${d.getMonth() + 1}`} value={`${d.getFullYear()}-${d.getMonth() + 1}`}>
                          {monthNames[d.getMonth()]} {d.getFullYear()}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {monthlyLoading ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}><Spinner size={24} /></div>
                ) : (
                  <div className={s("studentCalendar")}>
                    {monthDays.map(({ day, status }) => (
                      <div className={cx(s("studentDay"), s(status || 'off'))} key={day}>
                        <strong>{day}</strong><span>{status || 'No record'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <aside className={s("sideStack")}>
                <article className={s("card")}>
                  <div className={s("cardHead")}><div><h2>This Month</h2><p>Quick stats</p></div></div>
                  <div className={s("rules")}>
                    <span><b>Days Marked</b><strong>{monthlyTotal}</strong></span>
                    <span><b>Present</b><strong className={s("successText")}>{presentCount}</strong></span>
                    <span><b>Absent</b><strong className={s("dangerText")}>{absentCount}</strong></span>
                    <span><b>Monthly Rate</b><strong>{monthlyRate}%</strong></span>
                  </div>
                </article>
                <article className={s("card")}>
                  <div className={s("cardHead")}><div><h2>Legend</h2><p>Status color guide</p></div></div>
                  <div className={s("legend")}>
                    <span><i className={s("present")} /> Present</span>
                    <span><i className={s("absent")} /> Absent</span>
                    <span><i className={s("late")} /> Late</span>
                    <span><i className={s("off")} /> No record / Holiday</span>
                  </div>
                </article>
              </aside>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
