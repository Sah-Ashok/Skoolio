"use client";

import { useState } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./exams.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

function getExamStatus(exam: any): "upcoming" | "active" | "completed" {
  const now   = new Date();
  const start = new Date(exam.start_date);
  const end   = new Date(exam.end_date);
  if (start > now) return "upcoming";
  if (end   < now) return "completed";
  return "active";
}

function StatusBadge({ exam }: { exam: any }) {
  const status = getExamStatus(exam);
  const map = {
    upcoming:  { cls: "badgeBlue",   label: "Upcoming",  icon: "fa-clock" },
    active:    { cls: "badgeGreen",  label: "Active",    icon: "fa-circle-play" },
    completed: { cls: "badgeGray",   label: "Completed", icon: "fa-check-double" },
  };
  const { cls, label, icon } = map[status];
  return (
    <span className={cx(s("badge"), s(cls))}>
      <i className={`fa-solid ${icon}`} style={{ fontSize: 9 }} /> {label}
    </span>
  );
}

function ExamTypePill({ type }: { type: string }) {
  const labels: Record<string, string> = {
    unit_test: "Unit Test", mid_term: "Mid Term",
    final: "Final", practice: "Practice",
  };
  return <span className={s("typePill")}>{labels[type] ?? type}</span>;
}

export default function ExamsPage() {
  const dispatch = useAppDispatch();
  const { data: activeYear } = useApi<any>("/academic-years/active");
  const {
    data: exams,
    loading,
    refetch,
  } = useApi<any[]>(activeYear ? `/exams?academic_year_id=${activeYear.id}` : "");
  const { execute: deleteExam } = useMutation("/exams", "DELETE");

  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState<"all" | "upcoming" | "active" | "completed">("all");

  const filtered = (exams ?? []).filter((ex) => {
    const matchName   = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filter === "all" || getExamStatus(ex) === filter;
    return matchName && matchStatus;
  });

  const upcomingCount  = exams?.filter((e) => getExamStatus(e) === "upcoming").length  ?? 0;
  const activeCount    = exams?.filter((e) => getExamStatus(e) === "active").length    ?? 0;
  const completedCount = exams?.filter((e) => getExamStatus(e) === "completed").length ?? 0;

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteExam(undefined, `/exams/${id}`);
      dispatch(showToast({ type: "success", title: "Deleted", message: `"${name}" has been removed.` }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message ?? "Failed to delete exam." }));
    }
  };

  return (
    <div className={s("page")}>
      <Topbar title="Examinations" subtitle="Manage exams, schedules & marks" />

      <main className={s("content")}>
        {/* ── Header ── */}
        <div className={s("head")}>
          <div>
            <h1>Exams — {activeYear?.year_name ?? "..."}</h1>
            <p>Create and manage examinations for the current academic year</p>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btnPrimary"))} href="/exams/add">
              <i className="fa-solid fa-plus" /> Create Exam
            </Link>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className={s("stats")}>
          <article className={cx(s("stat"), s("blue"))}>
            <div className={s("statIcon")}><i className="fa-solid fa-file-lines" /></div>
            <span className={s("statLabel")}>Total Exams</span>
            <strong className={s("statValue")}>{exams?.length ?? 0}</strong>
            <small className={s("statSub")}>This year</small>
          </article>
          <article className={cx(s("stat"), s("orange"))}>
            <div className={s("statIcon")}><i className="fa-solid fa-clock" /></div>
            <span className={s("statLabel")}>Upcoming</span>
            <strong className={s("statValue")}>{upcomingCount}</strong>
            <small className={s("statSub")}>Scheduled ahead</small>
          </article>
          <article className={cx(s("stat"), s("green"))}>
            <div className={s("statIcon")}><i className="fa-solid fa-circle-play" /></div>
            <span className={s("statLabel")}>Active</span>
            <strong className={s("statValue")}>{activeCount}</strong>
            <small className={s("statSub")}>Running now</small>
          </article>
          <article className={cx(s("stat"), s("red"))}>
            <div className={s("statIcon")}><i className="fa-solid fa-check-double" /></div>
            <span className={s("statLabel")}>Completed</span>
            <strong className={s("statValue")}>{completedCount}</strong>
            <small className={s("statSub")}>Past exams</small>
          </article>
        </div>

        {/* ── Toolbar ── */}
        <div className={s("toolbar")}>
          <label className={s("search")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="search"
              placeholder="Search exam name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {(["all", "upcoming", "active", "completed"] as const).map((f) => (
            <button
              key={f}
              className={cx(s("btn"), filter === f ? s("btnPrimary") : s("btnOutline"), s("btnSm"))}
              onClick={() => setFilter(f)}
              style={{ textTransform: "capitalize" }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── Table card ── */}
        <div className={s("card")}>
          <div className={s("cardHead")}>
            <div>
              <h2>Exam List</h2>
              <p>{filtered.length} exam{filtered.length !== 1 ? "s" : ""} found</p>
            </div>
          </div>

          <div className={s("tableWrap")}>
            {loading ? (
              <div className={s("loadingWrap")}><Spinner size={32} color="#FF9B51" /></div>
            ) : filtered.length === 0 ? (
              <div className={s("emptyState")}>
                <div className={s("emptyIcon")}><i className="fa-solid fa-file-circle-xmark" /></div>
                <h3>No exams found</h3>
                <p>{search ? "Try a different search term or clear filters." : "Create your first exam to get started."}</p>
                <Link className={cx(s("btn"), s("btnPrimary"))} href="/exams/add" style={{ marginTop: 8 }}>
                  <i className="fa-solid fa-plus" /> Create Exam
                </Link>
              </div>
            ) : (
              <table className={s("table")}>
                <thead>
                  <tr>
                    <th>Exam Name</th>
                    <th>Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ex) => (
                    <tr key={ex.id}>
                      <td>
                        <div className={s("examName")}>
                          <div className={s("examIcon")}>
                            <i className="fa-solid fa-scroll" />
                          </div>
                          <div>
                            <div className={s("examLabel")}>{ex.name}</div>
                            <div className={s("examSub")}>ID #{ex.id}</div>
                          </div>
                        </div>
                      </td>
                      <td><ExamTypePill type={ex.exam_type} /></td>
                      <td style={{ fontWeight: 600 }}>
                        {new Date(ex.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {new Date(ex.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td><StatusBadge exam={ex} /></td>
                      <td>
                        <div className={s("actions")}>
                          <Link className={cx(s("btn"), s("btnSoft"), s("btnSm"))} href={`/exams/${ex.id}/schedule`}>
                            <i className="fa-solid fa-calendar-days" /> Schedule
                          </Link>
                          <Link className={cx(s("btn"), s("btnOutline"), s("btnSm"))} href={`/exams/${ex.id}/results`}>
                            <i className="fa-solid fa-chart-bar" /> Results
                          </Link>
                          <button
                            className={cx(s("btn"), s("btnDanger"), s("btnSm"))}
                            onClick={() => handleDelete(ex.id, ex.name)}
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
