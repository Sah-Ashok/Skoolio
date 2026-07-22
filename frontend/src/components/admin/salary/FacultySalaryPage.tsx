"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./salary.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { adToBS, BS_MONTH_NAMES } from "@/lib/bs-ad";

const s  = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const AD_MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | string | null | undefined) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);
}

/** Convert a DB AD month+year to a display month label respecting calendar system. */
function monthLabel(month: number, year: number, isBS: boolean): string {
  if (!isBS) return `${AD_MONTH_NAMES[month - 1]} ${year}`;
  // Use day-15 rule (same as useDateFormat) to get the BS month for this AD month
  const iso = `${year}-${String(month).padStart(2, "0")}-15`;
  const [y, m, d] = iso.split("-").map(Number);
  const bs = adToBS(new Date(y, m - 1, d));
  return `${BS_MONTH_NAMES[bs.month - 1]} ${bs.year}`;
}

/** How many months have elapsed since the teacher's join_date up to today.
 *  Used to calculate "expected salary months". */
function monthsSinceJoin(joinDateStr: string | null | undefined): number {
  if (!joinDateStr) return 0;
  const join = new Date(joinDateStr);
  const now  = new Date();
  const diff =
    (now.getFullYear() - join.getFullYear()) * 12 +
    (now.getMonth() - join.getMonth());
  return Math.max(0, diff);
}

// ── component ────────────────────────────────────────────────────────────────

export default function FacultySalaryPage() {
  const { data: summary, loading } = useApi<any[]>("/teachers/salary/summary");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "uptodate">("all");
  const { isBS, formatDate } = useDateFormat();

  const list = useMemo(() => {
    if (!summary) return [];
    return summary.filter((t) => {
      const matchSearch =
        t.full_name.toLowerCase().includes(search.toLowerCase()) ||
        String(t.teacher_id).includes(search);
      if (!matchSearch) return false;
      if (filter === "pending") return Number(t.total_pending) > 0;
      if (filter === "uptodate") return Number(t.total_pending) === 0;
      return true;
    });
  }, [summary, search, filter]);

  // Aggregate stats
  const totalTeachers    = summary?.length ?? 0;
  const totalPending     = summary?.reduce((acc, t) => acc + Number(t.total_pending ?? 0), 0) ?? 0;
  const totalPaidAll     = summary?.reduce((acc, t) => acc + Number(t.total_paid ?? 0), 0) ?? 0;
  const withPending      = summary?.filter((t) => Number(t.total_pending) > 0).length ?? 0;

  return (
    <div className={s("page")}>
      <Topbar title="Faculty Salary" subtitle="Manage monthly payroll and salary payment status" />

      <main className={s("content")}>
        <section className={s("head")}>
          <div>
            <h1>Faculty Salary</h1>
            <p>View payment status for all faculty members and process monthly payroll.</p>
          </div>
          <Link className={cx(s("btn"), s("btnPrimary"))} href="/salary/pay">
            <i className="fa-solid fa-money-check-dollar" /> Pay Salary
          </Link>
        </section>

        {/* ── Stats row ───────────────────────────────────────────────── */}
        <section className={s("stats")}>
          <div className={cx(s("stat"), s("blue"))}>
            <div><i className="fa-solid fa-users" /></div>
            <span>Total Faculty</span>
            <strong>{totalTeachers}</strong>
            <small>Active teachers</small>
          </div>
          <div className={cx(s("stat"), s("red"))}>
            <div><i className="fa-solid fa-triangle-exclamation" /></div>
            <span>Pending Payments</span>
            <strong>{withPending}</strong>
            <small>Teachers with dues</small>
          </div>
          <div className={cx(s("stat"), s("orange"))}>
            <div><i className="fa-solid fa-clock" /></div>
            <span>Total Pending</span>
            <strong style={{ fontSize: 18 }}>{formatCurrency(totalPending)}</strong>
            <small>Outstanding salary</small>
          </div>
          <div className={cx(s("stat"), s("green"))}>
            <div><i className="fa-solid fa-circle-check" /></div>
            <span>Total Paid</span>
            <strong style={{ fontSize: 18 }}>{formatCurrency(totalPaidAll)}</strong>
            <small>All time disbursed</small>
          </div>
        </section>

        {/* ── Filter toolbar ──────────────────────────────────────────── */}
        <section className={s("salaryToolbar")}>
          <label className={s("search")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              placeholder="Search by name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className={s("filterBtns")}>
            {(["all", "pending", "uptodate"] as const).map((f) => (
              <button
                key={f}
                className={cx(s("filterBtn"), filter === f && s("filterBtnActive"))}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All Teachers" : f === "pending" ? "Has Pending" : "Up to Date"}
              </button>
            ))}
          </div>
        </section>

        {/* ── Table ───────────────────────────────────────────────────── */}
        <article className={s("card")}>
          <div className={s("cardHead")}>
            <div>
              <h3><i className="fa-solid fa-table-list" /> Faculty Salary Status</h3>
              <p>{list.length} of {totalTeachers} teachers shown</p>
            </div>
          </div>

          <div className={s("tableWrap")}>
            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center" }}>
                <Spinner size={32} color="#FF9B51" />
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Faculty</th>
                    <th>Monthly Salary</th>
                    <th>Months Paid</th>
                    <th>Total Paid</th>
                    <th>Pending Months</th>
                    <th>Total Pending</th>
                    <th>Last Paid Month</th>
                    <th>Join Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => {
                    const pending     = Number(t.total_pending ?? 0);
                    const lastPeriod  = t.last_paid_period; // YYYYMM integer
                    const lastYear    = lastPeriod ? Math.floor(lastPeriod / 100) : null;
                    const lastMonth   = lastPeriod ? lastPeriod % 100 : null;
                    const pendingMonths = Number(t.pending_months ?? 0);

                    return (
                      <tr key={t.teacher_id} className={pending > 0 ? s("rowPending") : ""}>
                        <td>
                          <div className={s("facultyCell")}>
                            <span>
                              {t.full_name
                                .split(" ")
                                .map((p: string) => p[0])
                                .join("")
                                .substring(0, 2)
                                .toUpperCase()}
                            </span>
                            <div>
                              <strong>{t.full_name}</strong>
                              <small>ID #{t.teacher_id}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>{formatCurrency(t.monthly_salary)}</strong>
                          <small style={{ display: "block", color: "#6a7882", fontSize: 11, marginTop: 2 }}>
                            /month
                          </small>
                        </td>
                        <td>
                          <span className={cx(s("badge"), s("paid"))}>
                            {t.paid_months ?? 0} month{Number(t.paid_months) !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td>
                          <strong className={s("successText")}>
                            {formatCurrency(t.total_paid)}
                          </strong>
                        </td>
                        <td>
                          {pendingMonths > 0 ? (
                            <span className={cx(s("badge"), s("pending"))}>
                              {pendingMonths} month{pendingMonths !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className={cx(s("badge"), s("paid"))}>None</span>
                          )}
                        </td>
                        <td>
                          {pending > 0 ? (
                            <strong className={s("pendingAmount")}>
                              {formatCurrency(pending)}
                            </strong>
                          ) : (
                            <span style={{ color: "#12805c", fontWeight: 900 }}>—</span>
                          )}
                        </td>
                        <td>
                          {lastYear && lastMonth ? (
                            <span style={{ fontWeight: 800, fontSize: 13 }}>
                              {monthLabel(lastMonth, lastYear, isBS)}
                            </span>
                          ) : (
                            <span style={{ color: "#b42318", fontSize: 12, fontWeight: 800 }}>
                              Never paid
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, fontWeight: 800, color: "#6a7882" }}>
                          {formatDate(t.join_date)}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Link
                              className={cx(s("btn"), s("btnPrimary"), s("btnSm"))}
                              href={`/salary/pay?faculty=${t.teacher_id}`}
                            >
                              <i className="fa-solid fa-money-check" /> Pay
                            </Link>
                            <Link
                              className={cx(s("btn"), s("btnSoft"), s("btnSm"))}
                              href={`/teachers/${t.teacher_id}/salary`}
                            >
                              <i className="fa-solid fa-eye" /> History
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && !loading && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "#6a7882" }}>
                        {search || filter !== "all" ? "No teachers match your filter." : "No teachers found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </main>
    </div>
  );
}
