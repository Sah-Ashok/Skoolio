"use client";

import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import ToastNotification from "@/components/shared/ToastNotification";
import styles from "./attendance.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const s  = (name: string) => styles[name] || name;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const todayStr = () => new Date().toISOString().split("T")[0];

export default function TeacherAttendanceOverviewPage() {
  const { data: activeYear } = useApi<any>("/academic-years/active");

  const { data: mySections, loading } = useApi<any[]>(
    activeYear?.id ? `/teachers/me/sections?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );

  const today = todayStr();
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className={s("page")}>
      <Topbar title="Attendance Overview" subtitle="Your assigned sections and today's status" />
      <ToastNotification />

      <main className={s("content")}>

        {/* ── Header ── */}
        <section className={s("head")}>
          <div>
            <h1>Attendance Overview</h1>
            <p>{todayLabel}</p>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btnPrimary"))} href="/teacher/attendance/class">
              <i className="fa-solid fa-clipboard-check" /> Mark Attendance
            </Link>
          </div>
        </section>

        {/* ── Info banner ── */}
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: "#eff6ff", border: "1px solid #bfdbfe",
          display: "flex", alignItems: "center", gap: 12,
          fontSize: 13, fontWeight: 700, color: "#1e40af",
          marginBottom: 4,
        }}>
          <i className="fa-solid fa-circle-info" style={{ fontSize: 15, flexShrink: 0 }} />
          <span>
            You can mark attendance only for your assigned sections.
            Attendance is locked once submitted — contact admin to make changes.
          </span>
        </div>

        {/* ── Sections ── */}
        {(loading || !activeYear) ? (
          <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} /></div>
        ) : !mySections?.length ? (
          <div style={{
            padding: "60px 32px", textAlign: "center",
            border: "1.5px dashed #d4dde2", borderRadius: 16,
            background: "#fafcfc", marginTop: 16,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#fff1df", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 24, color: "#c46a14" }}>
              <i className="fa-solid fa-person-chalkboard" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 8px" }}>No sections assigned</h3>
            <p style={{ fontSize: 13, color: "#6a7882", fontWeight: 700 }}>
              Ask your admin to assign you as a section coordinator.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginTop: 4 }}>
            {mySections.map((sec: any) => (
              <div key={sec.id} style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #d4dde2",
                padding: "18px 20px",
                display: "flex", flexDirection: "column", gap: 14,
                boxShadow: "0 2px 10px rgba(31,45,54,0.06)",
              }}>
                {/* Section identity */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                    background: "linear-gradient(135deg, #fff3e8, #ffe0c2)",
                    color: "#c46a14", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 18, fontWeight: 900,
                  }}>
                    {sec.name}
                  </div>
                  <div>
                    <p style={{ fontWeight: 900, fontSize: 15, color: "#1f2d36", margin: 0 }}>
                      {sec.class_name} — Section {sec.name}
                    </p>
                    <p style={{ fontSize: 12, color: "#6a7882", margin: "3px 0 0", fontWeight: 700 }}>
                      <i className="fa-solid fa-users" style={{ marginRight: 5 }} />
                      Capacity {sec.capacity ?? "—"}
                    </p>
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid #edf2f4", margin: 0 }} />

                {/* Today indicator */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6a7882" }}>
                    <i className="fa-solid fa-calendar-day" style={{ marginRight: 6, color: "#ff9b51" }} />
                    {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 900, padding: "3px 10px",
                    borderRadius: 99, background: "#f1f5f9", color: "#64748b",
                  }}>
                    Check mark attendance →
                  </span>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    href={`/teacher/attendance/class`}
                    className={cx(s("btn"), s("btnPrimary"))}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    <i className="fa-solid fa-clipboard-check" /> Mark Today
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
