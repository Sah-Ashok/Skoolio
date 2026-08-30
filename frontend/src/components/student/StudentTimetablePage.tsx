"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const DAYS_OF_WEEK = [
  { key: "sunday",    label: "Sunday",    dayNum: 0 },
  { key: "monday",    label: "Monday",    dayNum: 1 },
  { key: "tuesday",   label: "Tuesday",   dayNum: 2 },
  { key: "wednesday", label: "Wednesday", dayNum: 3 },
  { key: "thursday",  label: "Thursday",  dayNum: 4 },
  { key: "friday",    label: "Friday",    dayNum: 5 },
  { key: "saturday",  label: "Saturday",  dayNum: 6 },
];

const SUBJECT_COLORS = [
  { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
  { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
  { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff" },
  { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
  { bg: "#fff1f2", text: "#be123c", border: "#fecdd3" },
  { bg: "#fefce8", text: "#a16207", border: "#fef08a" },
  { bg: "#f8fafc", text: "#334155", border: "#cbd5e1" },
];

function getSubjectColor(id?: number | null) {
  if (!id) return SUBJECT_COLORS[7];
  return SUBJECT_COLORS[id % SUBJECT_COLORS.length];
}

export default function StudentTimetablePage() {
  const { data: scheduleData, loading } = useApi<any>("/timetable/student/my-schedule");
  const [selectedDayTab, setSelectedDayTab] = useState<string>("all");

  const todayDayKey = useMemo(() => {
    const d = new Date().getDay();
    const found = DAYS_OF_WEEK.find(day => day.dayNum === d);
    return found?.key || "sunday";
  }, []);

  const scheduleByDay = useMemo(() => {
    return scheduleData?.schedule_by_day ?? {};
  }, [scheduleData]);

  const todaySlots = useMemo(() => {
    return scheduleByDay[todayDayKey] ?? [];
  }, [scheduleByDay, todayDayKey]);

  const section = scheduleData?.section;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#1f2d36", display: "flex", alignItems: "center", gap: 10 }}>
            <i className="fa-solid fa-calendar-week" style={{ color: "#ff9b51" }} />
            Class Timetable
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6a7882", fontWeight: 700 }}>
            Weekly class schedule, subject periods, and teacher details for your section.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #c6d0d7",
            background: "#fff",
            color: "#1f2d36",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <i className="fa-solid fa-print" style={{ color: "#12805c" }} /> Print Routine
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "4rem", textAlign: "center" }}>
          <Spinner size={36} color="#FF9B51" />
        </div>
      ) : (scheduleData?.slots?.length ?? 0) === 0 ? (
        <div style={{
          background: "#fff",
          borderRadius: 12,
          padding: "4rem 2rem",
          textAlign: "center",
          border: "1px solid #d4dde2",
          color: "#6a7882",
        }}>
          <i className="fa-solid fa-calendar-xmark" style={{ fontSize: 36, color: "#f97316", marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 6px", color: "#1f2d36", fontSize: 18, fontWeight: 900 }}>No Timetable Available Yet</h3>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Your section routine has not been published by your class teacher or school administrator.</p>
        </div>
      ) : (
        <>
          {/* ── Today's Schedule Card ── */}
          <div style={{
            background: "linear-gradient(135deg, #1e3a5f 0%, #2b4c7e 100%)",
            borderRadius: 12,
            padding: "18px 20px",
            color: "#fff",
            marginBottom: 20,
            boxShadow: "0 4px 16px rgba(30,58,95,0.15)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800, color: "#93c5fd" }}>
                  Today&apos;s Routine
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 900, textTransform: "capitalize" }}>
                  {todayDayKey} ({todaySlots.length} periods)
                </h3>
              </div>
              {section && (
                <span style={{ padding: "4px 12px", borderRadius: 99, background: "rgba(255,255,255,0.15)", fontSize: 12, fontWeight: 800 }}>
                  Section {section.name} {section.room_no ? `· Room ${section.room_no}` : ""}
                </span>
              )}
            </div>

            {todaySlots.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1" }}>No classes scheduled for today.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {todaySlots.map((s: any) => {
                  if (s.is_break) {
                    return (
                      <div key={s.id} style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(255, 155, 81, 0.2)",
                        border: "1px dashed #ff9b51",
                        textAlign: "center",
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#fed7aa" }}>
                          🍜 {s.title || "Break"}
                        </div>
                        <div style={{ fontSize: 11, color: "#ffedd5", marginTop: 2, fontWeight: 700 }}>
                          {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={s.id} style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>
                          {s.subject_name}
                        </strong>
                        <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.2)", fontWeight: 800 }}>
                          P{s.period_number}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#bfdbfe", marginTop: 4, fontWeight: 700 }}>
                        <i className="fa-solid fa-user-tie" style={{ marginRight: 4, fontSize: 9.5 }} />
                        {s.teacher_name || "Teacher"}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#93c5fd", marginTop: 4, fontWeight: 700 }}>
                        <i className="fa-regular fa-clock" style={{ marginRight: 4 }} />
                        {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Filter / Day Selector ── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
            <button
              type="button"
              onClick={() => setSelectedDayTab("all")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: selectedDayTab === "all" ? "#ff9b51" : "#fff",
                color: selectedDayTab === "all" ? "#fff" : "#4a5a65",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                borderWidth: selectedDayTab === "all" ? 0 : 1,
                borderStyle: "solid",
                borderColor: "#d4dde2",
                boxShadow: selectedDayTab === "all" ? "0 2px 8px rgba(255,155,81,0.3)" : "none",
              }}
            >
              Full Week
            </button>

            {DAYS_OF_WEEK.map(d => {
              const count = (scheduleByDay[d.key] ?? []).length;
              if (count === 0 && d.key === "saturday") return null;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDayTab(d.key)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: selectedDayTab === d.key ? "#ff9b51" : "#fff",
                    color: selectedDayTab === d.key ? "#fff" : "#4a5a65",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    borderWidth: selectedDayTab === d.key ? 0 : 1,
                    borderStyle: "solid",
                    borderColor: "#d4dde2",
                    boxShadow: selectedDayTab === d.key ? "0 2px 8px rgba(255,155,81,0.3)" : "none",
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* ── Weekly Schedule Grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {DAYS_OF_WEEK.filter(d => selectedDayTab === "all" || selectedDayTab === d.key).map(d => {
              const daySlots = scheduleByDay[d.key] ?? [];
              if (daySlots.length === 0 && selectedDayTab === "all") return null;
              const isToday = d.key === todayDayKey;

              return (
                <div key={d.key} style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: `1.5px solid ${isToday ? "#ff9b51" : "#d4dde2"}`,
                  boxShadow: isToday ? "0 4px 16px rgba(255,155,81,0.15)" : "0 2px 10px rgba(31,45,54,0.05)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    padding: "12px 16px",
                    background: isToday ? "#fff7ed" : "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 14, fontWeight: 900, color: isToday ? "#c2410c" : "#1e293b", textTransform: "capitalize" }}>
                        {d.label}
                      </strong>
                      {isToday && (
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#ff9b51", color: "#fff", fontWeight: 900 }}>
                          TODAY
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                      {daySlots.length} periods
                    </span>
                  </div>

                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {daySlots.length === 0 ? (
                      <p style={{ margin: 0, padding: "16px 0", textAlign: "center", color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>
                        No periods scheduled
                      </p>
                    ) : (
                      daySlots.map((s: any) => {
                        if (s.is_break) {
                          return (
                            <div key={s.id} style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              background: "#fff7ed",
                              border: "1px dashed #fdba74",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 900, color: "#c2410c" }}>
                                🍜 {s.title || "Break"}
                              </span>
                              <span style={{ fontSize: 11, color: "#9a3412", fontWeight: 800 }}>
                                {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                              </span>
                            </div>
                          );
                        }

                        const colors = getSubjectColor(s.subject_id);
                        return (
                          <div key={s.id} style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: colors.bg,
                            border: `1px solid ${colors.border}`,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div>
                                <strong style={{ fontSize: 13, fontWeight: 900, color: colors.text }}>
                                  {s.subject_name}
                                </strong>
                                <div style={{ fontSize: 11.5, color: "#475569", fontWeight: 700, marginTop: 3 }}>
                                  <i className="fa-solid fa-user-tie" style={{ marginRight: 4, fontSize: 9.5, opacity: 0.7 }} />
                                  {s.teacher_name || "Unassigned"}
                                </div>
                              </div>
                              <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 4, background: "#fff", color: "#475569", fontWeight: 800, border: "1px solid #cbd5e1" }}>
                                Period {s.period_number}
                              </span>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 4, borderTop: "1px solid rgba(0,0,0,0.05)", fontSize: 11, color: "#64748b", fontWeight: 800 }}>
                              <span>
                                <i className="fa-regular fa-clock" style={{ marginRight: 4 }} />
                                {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                              </span>
                              {s.room_no && (
                                <span>Room {s.room_no}</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
