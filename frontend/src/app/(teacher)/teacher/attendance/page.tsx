"use client";

import { useState } from "react";
import TeacherAttendanceOverviewPage from "@/components/teacher/TeacherAttendanceOverviewPage";
import TeacherOwnAttendancePage from "@/components/teacher/TeacherOwnAttendancePage";
import TeacherAttendanceRegisterPage from "@/components/teacher/TeacherAttendanceRegisterPage";

type Tab = "own" | "class" | "register";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "own",      label: "My Attendance",     icon: "fa-user-check"     },
  { key: "class",    label: "Class Overview",    icon: "fa-clipboard-list" },
  { key: "register", label: "Attendance Register", icon: "fa-table-list"   },
];

export default function TeacherAttendanceRoutePage() {
  const [tab, setTab] = useState<Tab>("own");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0,
        background: "#fff",
        borderBottom: "2px solid #dce5e9",
        padding: "0 28px",
        flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "13px 20px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 800,
              color:        tab === t.key ? "#ff9b51" : "#6a7882",
              borderBottom: tab === t.key ? "2px solid #ff9b51" : "2px solid transparent",
              marginBottom: -2,
              display: "flex",
              alignItems: "center",
              gap: 7,
              transition: "color .15s",
              whiteSpace: "nowrap",
            }}
          >
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 12 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1 }}>
        {tab === "own"      && <TeacherOwnAttendancePage />}
        {tab === "class"    && <TeacherAttendanceOverviewPage />}
        {tab === "register" && <TeacherAttendanceRegisterPage />}
      </div>
    </div>
  );
}
