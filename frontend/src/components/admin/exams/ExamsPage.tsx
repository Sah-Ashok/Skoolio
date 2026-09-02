"use client";

import { useState } from "react";
import Link from "next/link";
import s from "./exams.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";
import { showToast } from "@/store/toastSlice";

function getExamStatus(exam: any): "upcoming" | "active" | "completed" {
  const now   = new Date();
  const start = new Date(exam.start_date);
  const end   = new Date(exam.end_date);
  if (start > now) return "upcoming";
  if (end   < now) return "completed";
  return "active";
}

const STATUS_META = {
  upcoming:  { label: "Upcoming",  icon: "fa-clock",        cls: s.badgeBlue   },
  active:    { label: "Active",    icon: "fa-circle-play",  cls: s.badgeGreen  },
  completed: { label: "Completed", icon: "fa-check-double", cls: s.badgeGray   },
} as const;

const TYPE_LABELS: Record<string, string> = {
  unit_test: "Unit Test",
  mid_term:  "Mid Term",
  final:     "Final",
  practice:  "Practice",
};

const FILTER_TABS = ["all", "upcoming", "active", "completed"] as const;
type Filter = typeof FILTER_TABS[number];

export default function ExamsPage() {
  const dispatch = useAppDispatch();
  const { formatDate } = useDateFormat();
  const { activeYear, academicYearId } = useAcademicYear();
  const { data: exams, loading, refetch } = useApi<any[]>(
    academicYearId ? `/exams?academic_year_id=${academicYearId}` : ""
  );
  const { execute: deleteExam } = useMutation("/exams", "DELETE");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const list = exams ?? [];
  const counts = {
    upcoming:  list.filter(e => getExamStatus(e) === "upcoming").length,
    active:    list.filter(e => getExamStatus(e) === "active").length,
    completed: list.filter(e => getExamStatus(e) === "completed").length,
  };

  const filtered = list.filter(ex => {
    const matchName   = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filter === "all" || getExamStatus(ex) === filter;
    return matchName && matchStatus;
  });

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteExam(undefined, `/exams/${id}`);
      dispatch(showToast({ type: "success", title: "Deleted", message: `"${name}" removed.` }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message ?? "Failed to delete." }));
    }
  };

  return (
    <div className={s.page}>
      <div className={s.content}>

        {/* ── Page header ── */}
        <div className={s.pageHeader}>
          <div className={s.pageHeaderText}>
            <p className={s.pageEyebrow}>Academic Year · {activeYear?.year_name ?? "…"}</p>
            <h1 className={s.pageTitle}>Examinations</h1>
            <p className={s.pageSubtitle}>Create and manage exams, schedules & marks</p>
          </div>
          <Link className={s.btnPrimary} href="/exams/add">
            <i className="fa-solid fa-plus" />
            Create Exam
          </Link>
        </div>

        {/* ── Stat cards ── */}
        <div className={s.statsRow}>
          <StatCard
            color="blue"
            icon="fa-file-lines"
            label="Total Exams"
            value={list.length}
            sub="This year"
          />
          <StatCard
            color="orange"
            icon="fa-clock"
            label="Upcoming"
            value={counts.upcoming}
            sub="Scheduled ahead"
          />
          <StatCard
            color="green"
            icon="fa-circle-play"
            label="Active"
            value={counts.active}
            sub="Running now"
          />
          <StatCard
            color="slate"
            icon="fa-check-double"
            label="Completed"
            value={counts.completed}
            sub="Past exams"
          />
        </div>

        {/* ── Toolbar ── */}
        <div className={s.toolbar}>
          <label className={s.searchBox}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="search"
              placeholder="Search exam name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <div className={s.filterTabs}>
            {FILTER_TABS.map(f => (
              <button
                key={f}
                className={filter === f ? s.tabActive : s.tab}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : STATUS_META[f].label}
                {f !== "all" && (
                  <span className={s.tabCount}>{counts[f]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table card ── */}
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <span className={s.cardTitle}>Exam List</span>
              <span className={s.cardMeta}>{filtered.length} exam{filtered.length !== 1 ? "s" : ""} found</span>
            </div>
          </div>

          {loading ? (
            <div className={s.centerWrap}><Spinner size={28} color="#FF9B51" /></div>
          ) : filtered.length === 0 ? (
            <div className={s.emptyState}>
              <div className={s.emptyIcon}>
                <i className="fa-solid fa-file-circle-xmark" />
              </div>
              <p className={s.emptyTitle}>No exams found</p>
              <p className={s.emptyMsg}>
                {search ? "Try a different search or clear filters." : "Create your first exam to get started."}
              </p>
              {!search && (
                <Link className={s.btnPrimary} href="/exams/add" style={{ marginTop: 4 }}>
                  <i className="fa-solid fa-plus" /> Create Exam
                </Link>
              )}
            </div>
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Type</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ex => {
                    const status = getExamStatus(ex);
                    const meta   = STATUS_META[status];
                    return (
                      <tr key={ex.id}>
                        <td>
                          <div className={s.examCell}>
                            <div className={s.examDot} data-status={status} />
                            <div>
                              <div className={s.examName}>{ex.name}</div>
                              <div className={s.examId}>ID #{ex.id}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={s.typePill}>
                            {TYPE_LABELS[ex.exam_type] ?? ex.exam_type}
                          </span>
                        </td>
                        <td className={s.dateCell}>
                          {formatDate(ex.start_date)}
                        </td>
                        <td className={s.dateCell}>
                          {formatDate(ex.end_date)}
                        </td>
                        <td>
                          <span className={`${s.badge} ${meta.cls}`}>
                            <i className={`fa-solid ${meta.icon}`} />
                            {meta.label}
                          </span>
                        </td>
                        <td>
                          <div className={s.rowActions}>
                            <Link className={s.actionBtn} href={`/exams/${ex.id}/schedule`} title="Schedule">
                              <i className="fa-solid fa-calendar-days" />
                              <span>Schedule</span>
                            </Link>
                            <Link className={s.actionBtn} href={`/exams/${ex.id}/results`} title="Results">
                              <i className="fa-solid fa-chart-bar" />
                              <span>Results</span>
                            </Link>
                            <button
                              className={s.deleteBtn}
                              onClick={() => handleDelete(ex.id, ex.name)}
                              title="Delete"
                            >
                              <i className="fa-solid fa-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function StatCard({
  color, icon, label, value, sub
}: { color: string; icon: string; label: string; value: number; sub: string }) {
  return (
    <div className={`${s.statCard} ${s[`stat_${color}`]}`}>
      <div className={s.statIconWrap}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div className={s.statBody}>
        <span className={s.statLabel}>{label}</span>
        <strong className={s.statValue}>{value}</strong>
        <span className={s.statSub}>{sub}</span>
      </div>
    </div>
  );
}
