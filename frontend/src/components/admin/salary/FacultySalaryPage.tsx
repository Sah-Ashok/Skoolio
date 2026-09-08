"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./salary.module.css";
import { useApi } from "@/lib/useApi";
import Loader, { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { adToBS, BS_MONTH_NAMES } from "@/lib/bs-ad";
import { useAppSelector } from "@/store/hooks";

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

function monthLabel(month: number, year: number, isBS: boolean): string {
  if (!isBS) return `${AD_MONTH_NAMES[month - 1]} ${year}`;
  const iso = `${year}-${String(month).padStart(2, "0")}-15`;
  const [y, m, d] = iso.split("-").map(Number);
  const bs = adToBS(new Date(y, m - 1, d));
  return `${BS_MONTH_NAMES[bs.month - 1]} ${bs.year}`;
}

// ── component ────────────────────────────────────────────────────────────────

export default function FacultySalaryPage() {
  const user = useAppSelector((state) => state.auth.user);
  const isFinance = user?.role === 'finance';
  const payUrl = isFinance ? '/finance/salary/pay' : '/salary/pay';

  const { data: summary, loading } = useApi<any[]>("/teachers/salary/summary");
  const { data: payrollPolicy }    = useApi<any>("/payroll-policy");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "uptodate" | "no_salary">("all");
  const { isBS, formatDate } = useDateFormat();

  const list = useMemo(() => {
    if (!summary) return [];
    return summary.filter((t) => {
      const matchSearch =
        t.full_name.toLowerCase().includes(search.toLowerCase()) ||
        String(t.teacher_id).includes(search);
      if (!matchSearch) return false;
      if (filter === "pending")   return Number(t.total_pending) > 0;
      if (filter === "uptodate")  return Number(t.total_pending) === 0 && Number(t.monthly_salary) > 0;
      if (filter === "no_salary") return !t.monthly_salary || Number(t.monthly_salary) === 0;
      return true;
    });
  }, [summary, search, filter]);

  // Aggregate stats
  const totalTeachers = summary?.length ?? 0;
  const totalPending  = summary?.reduce((acc, t) => acc + Number(t.total_pending ?? 0), 0) ?? 0;
  const totalPaidAll  = summary?.reduce((acc, t) => acc + Number(t.total_paid ?? 0), 0) ?? 0;
  const withPending   = summary?.filter((t) => Number(t.total_pending) > 0).length ?? 0;
  const noSalary      = summary?.filter((t) => !t.monthly_salary || Number(t.monthly_salary) === 0).length ?? 0;

  return (
    <div className={s("page")}>
      <main className={s("content")}>
        <section className={s("head")}>
          <div>
            <h1>Payroll &amp; Salary</h1>
            <p>View payment status for teaching faculty and non-teaching staff, and process monthly payroll.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {!isFinance && (
              <Link className={cx(s("btn"), s("btnOutline"))} href="/settings?tab=payroll">
                <i className="fa-solid fa-gear" /> Payroll Policy
              </Link>
            )}
            <Link className={cx(s("btn"), s("btnPrimary"))} href={payUrl}>
              <i className="fa-solid fa-money-check-dollar" /> Pay Salary
            </Link>
          </div>
        </section>

        {/* ── Tabs (Teaching vs Non-Teaching) ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Link
            href="/salary"
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              background: "#3b5bdb",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              boxShadow: "0 2px 6px rgba(59,91,219,0.25)",
            }}
          >
            <i className="fa-solid fa-chalkboard-user" /> Teaching Faculty
          </Link>
          <Link
            href="/staff/salary"
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              background: "#fff",
              color: "#4a5a65",
              fontWeight: 800,
              fontSize: 13,
              textDecoration: "none",
              border: "1px solid #c6d0d7",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <i className="fa-solid fa-user-tie" /> Non-Teaching Staff
          </Link>
        </div>

        {/* ── Payroll policy info bar ─────────────────────────────────── */}
        {payrollPolicy && (
          <div style={{
            marginBottom: 14,
            padding: "10px 16px",
            borderRadius: 10,
            background: "#fff",
            border: "1px solid #d4dde2",
            boxShadow: "0 2px 12px rgba(31,45,54,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
            fontSize: 12,
            fontWeight: 800,
            color: "#4a5a65",
          }}>
            <span><i className="fa-solid fa-circle-info" style={{ color: "#ff9b51", marginRight: 6 }} />Payroll Policy Active</span>
            <span>
              <i className="fa-solid fa-calendar-xmark" style={{ color: "#b42318", marginRight: 5 }} />
              Paid leave: <strong>{payrollPolicy.paid_leave_days_per_month} day{payrollPolicy.paid_leave_days_per_month !== 1 ? "s" : ""}/month</strong>
            </span>
            <span>
              <i className="fa-solid fa-circle-half-stroke" style={{ color: "#c46a14", marginRight: 5 }} />
              Half-day pay: <strong>{payrollPolicy.half_day_pay_percent}%</strong>
            </span>
            {payrollPolicy.default_tax_percent > 0 && (
              <span>
                <i className="fa-solid fa-percent" style={{ color: "#3b5bdb", marginRight: 5 }} />
                Default Tax: <strong>{payrollPolicy.default_tax_percent}%</strong>
              </span>
            )}
            {payrollPolicy.default_pf_percent > 0 && (
              <span>
                <i className="fa-solid fa-percent" style={{ color: "#3b5bdb", marginRight: 5 }} />
                Default PF: <strong>{payrollPolicy.default_pf_percent}%</strong>
              </span>
            )}
            <Link
              href="/settings?tab=payroll"
              style={{ marginLeft: "auto", fontSize: 11, color: "#ff9b51", fontWeight: 900, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              <i className="fa-solid fa-pen-to-square" /> Edit Policy
            </Link>
          </div>
        )}

        {/* ── Stats row ───────────────────────────────────────────────── */}
        <section className={s("stats")}>
          <div className={cx(s("stat"), s("blue"))}>
            <div className={s("statHead")}>
              <span>Total Faculty</span>
              <div><i className="fa-solid fa-users" /></div>
            </div>
            <div className={s("statBody")}>
              <strong>{totalTeachers}</strong>
              <small>Active teachers</small>
            </div>
          </div>
          <div className={cx(s("stat"), s("red"))}>
            <div className={s("statHead")}>
              <span>Pending Payments</span>
              <div><i className="fa-solid fa-triangle-exclamation" /></div>
            </div>
            <div className={s("statBody")}>
              <strong>{withPending}</strong>
              <small>Teachers with dues</small>
            </div>
          </div>
          <div className={cx(s("stat"), s("orange"))}>
            <div className={s("statHead")}>
              <span>Total Pending</span>
              <div><i className="fa-solid fa-clock" /></div>
            </div>
            <div className={s("statBody")}>
              <strong style={{ fontSize: 18 }}>{formatCurrency(totalPending)}</strong>
              <small>Outstanding salary</small>
            </div>
          </div>
          <div className={cx(s("stat"), s("green"))}>
            <div className={s("statHead")}>
              <span>Total Paid</span>
              <div><i className="fa-solid fa-circle-check" /></div>
            </div>
            <div className={s("statBody")}>
              <strong style={{ fontSize: 18 }}>{formatCurrency(totalPaidAll)}</strong>
              <small>All time disbursed</small>
            </div>
          </div>
        </section>

        {/* ── No salary warning ──────────────────────────────────────── */}
        {noSalary > 0 && (
          <div style={{
            marginBottom: 14,
            padding: "12px 16px",
            borderRadius: 10,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#c2410c",
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ flexShrink: 0 }} />
            <span>
              <strong>{noSalary} faculty member{noSalary !== 1 ? "s have" : " has"} no monthly salary configured.</strong>
              {" "}Salary cannot be auto-calculated for them. Go to their profile → Professional tab to set a salary, or enter it manually when paying.
            </span>
          </div>
        )}

        {/* ── Filter toolbar ──────────────────────────────────── */}
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
            {([
              { key: "all",       label: "All Teachers"    },
              { key: "pending",   label: "Has Pending"     },
              { key: "uptodate",  label: "Up to Date"      },
              { key: "no_salary", label: `No Salary (${noSalary})` },
            ] as const).map((f) => (
              <button
                key={f.key}
                className={cx(s("filterBtn"), filter === f.key && s("filterBtnActive"))}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
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
              <Loader fullScreen={false} size="md" text="Loading faculty salary status…" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: "center" }}>#</th>
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
                  {list.map((t, idx) => {
                    const pending       = Number(t.total_pending ?? 0);
                    const lastPeriod    = t.last_paid_period;
                    const lastYear      = lastPeriod ? Math.floor(lastPeriod / 100) : null;
                    const lastMonth     = lastPeriod ? lastPeriod % 100 : null;
                    const pendingMonths = Number(t.pending_months ?? 0);
                    const hasSalary     = t.monthly_salary && Number(t.monthly_salary) > 0;

                    return (
                      <tr key={t.teacher_id} className={pending > 0 ? s("rowPending") : ""}>
                        <td style={{ textAlign: "center", color: "#6a7882", fontWeight: 800, fontSize: 12 }}>
                          {idx + 1}
                        </td>
                        <td>
                          <div className={s("facultyCell")}>
                            <div>
                              <strong>{t.full_name}</strong>
                              <small>ID #{t.teacher_id}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {hasSalary ? (
                            <>
                              <strong>{formatCurrency(t.monthly_salary)}</strong>
                              <small style={{ display: "block", color: "#6a7882", fontSize: 11, marginTop: 2 }}>/month</small>
                            </>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ color: "#b42318", fontSize: 12, fontWeight: 800 }}>Not set</span>
                              <Link
                                href={`/teachers/${t.teacher_id}/edit`}
                                style={{ fontSize: 11, color: "#ff9b51", fontWeight: 900, textDecoration: "none" }}
                              >
                                <i className="fa-solid fa-pen" style={{ marginRight: 3 }} />Set
                              </Link>
                            </div>
                          )}
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
                            <span style={{ color: "#b42318", fontSize: 12, fontWeight: 800 }}>Never paid</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, fontWeight: 800, color: "#6a7882" }}>
                          {formatDate(t.join_date)}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Link
                              className={cx(s("btn"), s("btnPrimary"), s("btnSm"))}
                              href={`${payUrl}?faculty=${t.teacher_id}`}
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
