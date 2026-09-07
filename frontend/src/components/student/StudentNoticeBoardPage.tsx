"use client";

import React, { useState, useMemo } from "react";
import { useApi } from "@/lib/useApi";
import { Loader } from "@/components/shared/Loader";

/* ─────────────────────────────── types ─── */
interface Notice {
  id: number;
  title: string;
  content: string;
  created_by_role: "admin" | "faculty";
  created_by_name: string;
  target_type: "section" | null;
  section_name: string | null;
  class_name: string | null;
  is_pinned: boolean;
  expires_at: string | null;
  status: "active" | "archived";
  created_at: string;
}

/* ─────────────────────────────── helpers ─ */
const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const isExpired = (e: string | null) =>
  e ? new Date(e) < new Date() : false;

const timeAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hrs   = Math.floor(mins / 60);
  const days  = Math.floor(hrs / 24);
  if (days  > 0) return `${days}d ago`;
  if (hrs   > 0) return `${hrs}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return "Just now";
};

/* ─────────────────────────────── detail sheet ─ */
function DetailSheet({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.5)",
          zIndex: 200,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 201,
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          maxHeight: "82vh",
          overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "12px 0 4px",
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: "#e2e8f0",
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            padding: "10px 20px 14px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            {notice.is_pinned && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#f59e0b",
                  background: "#fffbeb",
                  padding: "3px 9px",
                  borderRadius: 99,
                  marginBottom: 8,
                }}
              >
                <i className="fa-solid fa-thumbtack" style={{ fontSize: 10 }} />
                Pinned
              </span>
            )}
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 900,
                color: "#0f172a",
                lineHeight: 1.3,
              }}
            >
              {notice.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#f1f5f9",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              fontSize: 14,
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Meta pills */}
        <div
          style={{
            padding: "12px 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          {/* Source badge */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 99,
              background:
                notice.target_type === null ? "#eff6ff" : "#f0fdf4",
              color:
                notice.target_type === null ? "#3b82f6" : "#16a34a",
            }}
          >
            <i
              className={`fa-solid ${
                notice.target_type === null ? "fa-school" : "fa-users"
              }`}
              style={{ fontSize: 10 }}
            />
            {notice.target_type === null
              ? "School-wide"
              : `${notice.class_name ?? ""} – ${notice.section_name ?? ""}`}
          </span>

          {/* Author */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 99,
              background: "#f8fafc",
              color: "#64748b",
            }}
          >
            <i className="fa-solid fa-user" style={{ fontSize: 10 }} />
            {notice.created_by_name}
            {notice.created_by_role === "faculty" && " (Teacher)"}
          </span>

          {/* Date */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 99,
              background: "#f8fafc",
              color: "#64748b",
            }}
          >
            <i className="fa-solid fa-calendar" style={{ fontSize: 10 }} />
            {fmt(notice.created_at)}
          </span>

          {/* Expiry */}
          {notice.expires_at && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 99,
                background: isExpired(notice.expires_at)
                  ? "#fef2f2"
                  : "#fff7ed",
                color: isExpired(notice.expires_at) ? "#ef4444" : "#f59e0b",
              }}
            >
              <i
                className="fa-solid fa-hourglass-end"
                style={{ fontSize: 10 }}
              />
              {isExpired(notice.expires_at)
                ? `Expired ${fmt(notice.expires_at)}`
                : `Expires ${fmt(notice.expires_at)}`}
            </span>
          )}
        </div>

        {/* Content */}
        <div
          style={{
            padding: "20px 20px 40px",
            fontSize: 15,
            fontWeight: 500,
            lineHeight: 1.8,
            color: "#334155",
            whiteSpace: "pre-wrap",
          }}
        >
          {notice.content}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────── notice card ─ */
function NoticeCard({
  notice,
  onClick,
}: {
  notice: Notice;
  onClick: () => void;
}) {
  const isSchoolWide = notice.target_type === null;
  const expired = isExpired(notice.expires_at);

  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "16px",
        boxShadow: notice.is_pinned
          ? "0 4px 20px rgba(245,158,11,0.12), 0 1px 4px rgba(0,0,0,0.04)"
          : "0 2px 12px rgba(0,0,0,0.04)",
        border: notice.is_pinned
          ? "1.5px solid #fcd34d"
          : "1.5px solid transparent",
        cursor: "pointer",
        transition: "transform 0.15s, box-shadow 0.15s",
        position: "relative",
        overflow: "hidden",
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Pinned accent bar */}
      {notice.is_pinned && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg,#f59e0b,#fcd34d)",
            borderRadius: "16px 16px 0 0",
          }}
        />
      )}

      {/* Top row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          marginTop: notice.is_pinned ? 4 : 0,
        }}
      >
        {/* Icon */}
        <div
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: 12,
            background: isSchoolWide ? "#eff6ff" : "#f0fdf4",
            color: isSchoolWide ? "#3b82f6" : "#16a34a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
          }}
        >
          <i
            className={`fa-solid ${
              isSchoolWide ? "fa-school" : "fa-users"
            }`}
          />
        </div>

        {/* Title + preview */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#0f172a",
              lineHeight: 1.3,
              marginBottom: 5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {notice.is_pinned && (
              <i
                className="fa-solid fa-thumbtack"
                style={{
                  fontSize: 11,
                  color: "#f59e0b",
                  marginRight: 5,
                  verticalAlign: "middle",
                }}
              />
            )}
            {notice.title}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 500,
              color: "#64748b",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {notice.content}
          </p>
        </div>

        {/* Arrow */}
        <div
          style={{
            flexShrink: 0,
            color: "#cbd5e1",
            fontSize: 13,
            marginTop: 2,
          }}
        >
          <i className="fa-solid fa-chevron-right" />
        </div>
      </div>

      {/* Bottom meta row */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {/* Source pill */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: "3px 9px",
            borderRadius: 99,
            background: isSchoolWide ? "#eff6ff" : "#f0fdf4",
            color: isSchoolWide ? "#3b82f6" : "#16a34a",
          }}
        >
          {isSchoolWide
            ? "School Notice"
            : `${notice.class_name ?? ""} – ${notice.section_name ?? ""}`}
        </span>

        {expired && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              padding: "3px 9px",
              borderRadius: 99,
              background: "#fef2f2",
              color: "#ef4444",
            }}
          >
            Expired
          </span>
        )}

        {/* Time */}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
          }}
        >
          {timeAgo(notice.created_at)}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────── main page ─ */
type Filter = "all" | "school" | "section" | "pinned";

export default function StudentNoticeBoardPage() {
  const { data: notices, loading } = useApi<Notice[]>("/notices/student");
  const { data: me } = useApi<any>("/auth/me");

  const [filter, setFilter]       = useState<Filter>("all");
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<Notice | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const schoolName = me?.school_name || "";

  const pinned   = useMemo(() => notices?.filter(n => n.is_pinned) ?? [],         [notices]);
  const filtered = useMemo(() => {
    if (!notices) return [];
    return notices.filter((n) => {
      if (filter === "school"  && n.target_type !== null)          return false;
      if (filter === "section" && n.target_type !== "section")     return false;
      if (filter === "pinned"  && !n.is_pinned)                    return false;
      if (search && !n.title.toLowerCase().includes(search.toLowerCase()) &&
                    !n.content.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [notices, filter, search]);

  const totalSchool  = notices?.filter(n => !n.target_type).length          ?? 0;
  const totalSection = notices?.filter(n => n.target_type === "section").length ?? 0;

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all",     label: "All",     count: notices?.length ?? 0 },
    { key: "school",  label: "School",  count: totalSchool           },
    { key: "section", label: "Section", count: totalSection          },
    { key: "pinned",  label: "Pinned",  count: pinned.length         },
  ];

  return (
    <>
      <style>{`
        .snb-page {
          min-height: 100vh;
          background: #f6f8fa;
          font-family: 'Nunito','Inter',sans-serif;
          padding-bottom: 100px;
        }

        /* ── Sticky header ── */
        .snb-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #fff;
          border-bottom: 1.5px solid #f1f5f9;
        }

        .snb-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px 12px;
          gap: 12px;
        }

        .snb-back {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #475569;
          font-size: 14px;
          cursor: pointer;
          flex-shrink: 0;
          text-decoration: none;
        }

        .snb-title-block { flex: 1; min-width: 0; }
        .snb-title {
          font-size: 18px;
          font-weight: 900;
          color: #0f172a;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .snb-subtitle {
          font-size: 12px;
          font-weight: 700;
          color: #94a3b8;
          margin: 2px 0 0;
        }

        .snb-search-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #475569;
          font-size: 14px;
          cursor: pointer;
          flex-shrink: 0;
        }

        /* ── Search bar ── */
        .snb-search-bar {
          padding: 0 18px 12px;
          display: none;
        }
        .snb-search-bar.open { display: block; }

        .snb-search-inner {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 0 14px;
          height: 44px;
        }
        .snb-search-inner i { color: #94a3b8; font-size: 14px; }
        .snb-search-inner input {
          flex: 1;
          border: none;
          background: transparent;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          outline: none;
        }
        .snb-search-clear {
          border: none;
          background: none;
          cursor: pointer;
          color: #94a3b8;
          font-size: 14px;
          padding: 0;
          display: flex;
        }

        /* ── Filter tabs ── */
        .snb-filters {
          display: flex;
          gap: 8px;
          padding: 0 18px 12px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .snb-filters::-webkit-scrollbar { display: none; }

        .snb-filter-tab {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 14px;
          border-radius: 99px;
          font-size: 13px;
          font-weight: 800;
          border: 1.5px solid #e2e8f0;
          background: #fff;
          color: #64748b;
          cursor: pointer;
          font-family: 'Nunito','Inter',sans-serif;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .snb-filter-tab.active {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }
        .snb-filter-count {
          font-size: 11px;
          font-weight: 900;
          padding: 1px 6px;
          border-radius: 99px;
          background: rgba(255,255,255,0.2);
          color: inherit;
        }
        .snb-filter-tab:not(.active) .snb-filter-count {
          background: #f1f5f9;
          color: #64748b;
        }

        /* ── Content ── */
        .snb-content {
          padding: 16px 16px 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ── Pinned banner ── */
        .snb-pinned-section {
          background: linear-gradient(135deg,#fffbeb,#fef3c7);
          border: 1.5px solid #fcd34d;
          border-radius: 16px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .snb-pinned-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 900;
          color: #92400e;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .snb-pinned-label i { color: #f59e0b; }

        /* ── Stats row ── */
        .snb-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .snb-stat {
          background: #fff;
          border-radius: 14px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .snb-stat-icon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          flex-shrink: 0;
        }
        .snb-stat-val  { font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1; }
        .snb-stat-lbl  { font-size: 11px; font-weight: 700; color: #94a3b8; margin-top: 3px; }

        /* ── Section label ── */
        .snb-section-label {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #94a3b8;
          padding: 0 2px;
        }

        /* ── Empty state ── */
        .snb-empty {
          background: #fff;
          border-radius: 16px;
          padding: 48px 24px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .snb-empty i {
          font-size: 40px;
          color: #e2e8f0;
          display: block;
          margin-bottom: 14px;
        }
        .snb-empty p {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #94a3b8;
        }

        /* ── Loading ── */
        .snb-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 60px 24px;
        }
        .snb-loading p {
          font-size: 14px;
          font-weight: 700;
          color: #94a3b8;
          margin: 0;
        }

        /* ── Responsive: Tablet / Desktop ── */
        @media (min-width: 640px) {
          .snb-content {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px 20px 0;
          }
          .snb-topbar  { padding: 18px 24px 14px; }
          .snb-filters { padding: 0 24px 14px;    }
          .snb-search-bar { padding: 0 24px 14px; }
        }

        @media (min-width: 1024px) {
          .snb-content {
            max-width: 900px;
            display: grid;
            grid-template-columns: 260px 1fr;
            gap: 16px;
            align-items: start;
          }
          .snb-sidebar-col { display: flex; flex-direction: column; gap: 12px; }
          .snb-notices-col { display: flex; flex-direction: column; gap: 12px; }
        }
      `}</style>

      <div className="snb-page">
        {/* ── Sticky header ── */}
        <header className="snb-header">
          <div className="snb-topbar">
            {/* Back */}
            <a href="/student/dashboard" className="snb-back">
              <i className="fa-solid fa-arrow-left" />
            </a>

            {/* Title */}
            <div className="snb-title-block">
              <h1 className="snb-title">Notice Board</h1>
              <p className="snb-subtitle">
                {schoolName || "Your School"}
              </p>
            </div>

            {/* Search toggle */}
            <button
              className="snb-search-btn"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Toggle search"
            >
              <i
                className={`fa-solid ${
                  searchOpen ? "fa-xmark" : "fa-magnifying-glass"
                }`}
              />
            </button>
          </div>

          {/* Expandable search bar */}
          <div className={`snb-search-bar${searchOpen ? " open" : ""}`}>
            <div className="snb-search-inner">
              <i className="fa-solid fa-magnifying-glass" />
              <input
                autoFocus={searchOpen}
                placeholder="Search notices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="snb-search-clear"
                  onClick={() => setSearch("")}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="snb-filters" role="tablist">
            {filters.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                className={`snb-filter-tab${filter === f.key ? " active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className="snb-filter-count">{f.count}</span>
              </button>
            ))}
          </div>
        </header>

        {/* ── Content ── */}
        <main className="snb-content">
          {loading ? (
            <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
              <Loader fullScreen={false} size="md" text="Loading notices…" />
            </div>
          ) : (
            <>
              {/* Stats (shown only on "all" tab, no search) */}
              {filter === "all" && !search && (
                <div className="snb-stats">
                  <div className="snb-stat">
                    <div
                      className="snb-stat-icon"
                      style={{ background: "#eff6ff", color: "#3b82f6" }}
                    >
                      <i className="fa-solid fa-school" />
                    </div>
                    <div>
                      <div className="snb-stat-val">{totalSchool}</div>
                      <div className="snb-stat-lbl">School notices</div>
                    </div>
                  </div>
                  <div className="snb-stat">
                    <div
                      className="snb-stat-icon"
                      style={{ background: "#f0fdf4", color: "#16a34a" }}
                    >
                      <i className="fa-solid fa-users" />
                    </div>
                    <div>
                      <div className="snb-stat-val">{totalSection}</div>
                      <div className="snb-stat-lbl">Section notices</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pinned strip (only on "all" tab) */}
              {filter === "all" && !search && pinned.length > 0 && (
                <div className="snb-pinned-section">
                  <div className="snb-pinned-label">
                    <i className="fa-solid fa-thumbtack" />
                    Pinned Announcements
                  </div>
                  {pinned.map((n) => (
                    <NoticeCard
                      key={n.id}
                      notice={n}
                      onClick={() => setSelected(n)}
                    />
                  ))}
                </div>
              )}

              {/* All notices */}
              {filtered.length === 0 ? (
                <div className="snb-empty">
                  <i className="fa-solid fa-bullhorn" />
                  <p>
                    {search
                      ? `No notices found for "${search}"`
                      : "No notices yet — check back soon!"}
                  </p>
                </div>
              ) : (
                <>
                  {(filter !== "all" || search) && (
                    <div className="snb-section-label">
                      {filtered.length} notice
                      {filtered.length !== 1 ? "s" : ""}
                    </div>
                  )}

                  {filter === "all" && !search && (
                    <div className="snb-section-label">
                      All Notices
                    </div>
                  )}

                  {filtered.map((n) => (
                    <NoticeCard
                      key={n.id}
                      notice={n}
                      onClick={() => setSelected(n)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Detail bottom sheet ── */}
      {selected && (
        <DetailSheet
          notice={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
