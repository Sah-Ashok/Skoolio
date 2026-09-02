"use client";

import { useState } from "react";

import TeacherOwnAttendancePage from "@/components/teacher/TeacherOwnAttendancePage";
import TeacherAttendanceRegisterPage from "@/components/teacher/TeacherAttendanceRegisterPage";

type Tab = "own" | "class" | "register";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "own",      label: "My Attendance",     icon: "fa-user-check"     },
  { key: "register", label: "Attendance Register", icon: "fa-table-list"   },
];

export default function TeacherAttendanceRoutePage() {
  const [tab, setTab] = useState<Tab>("own");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        padding: "12px 24px",
        flexShrink: 0,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
      }}>
        {TABS.map(t => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 18px",
                borderRadius: 9,
                border: isActive ? "1.5px solid #ff9148" : "1.5px solid #e2e8f0",
                background: isActive ? "#fff7ed" : "#ffffff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 800,
                color: isActive ? "#ea580c" : "#64748b",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.18s ease",
                whiteSpace: "nowrap",
                boxShadow: isActive ? "0 1px 4px rgba(255, 145, 72, 0.15)" : "none",
              }}
            >
              <i
                className={`fa-solid ${t.icon}`}
                style={{
                  fontSize: 13,
                  color: isActive ? "#ff9148" : "#94a3b8",
                }}
              />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {tab === "own"      && <TeacherOwnAttendancePage />}
        {tab === "register" && <TeacherAttendanceRegisterPage />}
      </div>
    </div>
  );
}
