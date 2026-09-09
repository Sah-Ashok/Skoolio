"use client";

import React from "react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning", icon: "fa-sun", img: "/icons/GoodMorning.svg" };
  if (h < 17) return { text: "Good afternoon", icon: "fa-cloud-sun", img: "/icons/Afternoon.svg" };
  return { text: "Good evening", icon: "fa-moon", img: "/icons/GoodEvening.svg" };
}

export interface DashboardGreetingProps {
  schoolName?: string;
  userName?: string;
  roleLabel?: string;
  statusLabel?: string;
  activeYearName?: string;
  idBadge?: string;
  rightActions?: React.ReactNode;
  containerStyle?: React.CSSProperties;
}

export default function DashboardGreeting({
  schoolName,
  userName = "User",
  roleLabel = "Active Session",
  statusLabel = "Active",
  activeYearName,
  idBadge,
  rightActions,
  containerStyle,
}: DashboardGreetingProps) {
  const greeting = getGreeting();

  return (
    <section
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 20,
        flexWrap: "wrap",
        padding: "4px 2px 0",
        ...containerStyle,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* School Name */}
        {schoolName && (
          <div
            style={{
              fontSize: "clamp(28px, 4.2vw, 38px)",
              fontWeight: 900,
              color: "#FF9B51",
              lineHeight: 1.15,
              margin: "0 0 6px",
              letterSpacing: "-0.5px",
            }}
          >
            {schoolName}
          </div>
        )}

        {/* Time-Aware Greeting with SVG Illustration */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: "clamp(20px, 3.2vw, 28px)",
            color: "#64748b",
            fontWeight: 700,
            margin: "0 0 4px",
          }}
        >
          <img
            src={greeting.img}
            alt={greeting.text}
            width={52}
            height={52}
            style={{ objectFit: "contain", flexShrink: 0 }}
            onError={(e) => {
              // Fallback to font-awesome icon if SVG is missing
              e.currentTarget.style.display = "none";
            }}
          />
          <span>{greeting.text},</span>
        </div>

        {/* User's Full Name */}
        <div
          style={{
            fontSize: "clamp(26px, 3.8vw, 36px)",
            fontWeight: 900,
            color: "#1e293b",
            lineHeight: 1.15,
            margin: "0 0 10px",
            letterSpacing: "-0.5px",
          }}
        >
          {userName}
        </div>

        {/* Status Badges Row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {roleLabel && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 999,
                background: "#dcfce7",
                border: "1px solid #86efac",
                color: "#166534",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#16a34a",
                  display: "inline-block",
                }}
              />
              {roleLabel}
            </span>
          )}

          {activeYearName && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 999,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#475569",
                fontSize: 12,
                fontWeight: 700,
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
              }}
            >
              <i className="fa-regular fa-calendar" style={{ color: "#64748b" }} /> {activeYearName}
            </span>
          )}

          {idBadge && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 999,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#475569",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <i className="fa-regular fa-id-badge" style={{ color: "#64748b" }} /> {idBadge}
            </span>
          )}
        </div>
      </div>

      {/* Right Actions Area */}
      {rightActions && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingTop: 4 }}>
          {rightActions}
        </div>
      )}
    </section>
  );
}
