"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Topbar from "@/components/shared/Topbar";
import styles from "./fees.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function FeesPage() {
  const { formatDate } = useDateFormat();
  const { academicYearId } = useAcademicYear();
  const { data: collections, loading } = useApi<any[]>(
    academicYearId ? `/fees/collections?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );

  const totalCollected = collections
    ?.filter(c => c.status === "paid" || c.status === "partial")
    .reduce((sum, c) => sum + parseFloat(c.paid_amount || "0"), 0) || 0;

  const totalPending = collections
    ?.filter(c => c.status !== "paid" && c.status !== "waived")
    .reduce((sum, c) => sum + parseFloat(c.remaining_amount || "0"), 0) || 0;

  const overdueCount = collections?.filter(c =>
    c.status !== "paid" && c.status !== "waived" &&
    new Date(c.due_date) < new Date()
  ).length || 0;

  const totalAssigned = collections?.reduce((sum, c) => sum + parseFloat(c.total_amount), 0) || 1;
  const collectionRate = Math.round((totalCollected / totalAssigned) * 100);

  const monthlyMap: Record<number, { collected: number; pending: number }> = {};
  (collections || []).forEach(c => {
    const month = new Date(c.due_date).getMonth();
    if (!monthlyMap[month]) monthlyMap[month] = { collected: 0, pending: 0 };
    monthlyMap[month].collected += parseFloat(c.paid_amount || "0");
    if (c.status !== "paid") monthlyMap[month].pending += parseFloat(c.remaining_amount || "0");
  });
  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .slice(-6)
    .map(([month, v]) => {
      const maxVal = Math.max(v.collected, v.pending, 1);
      return [
        MONTH_NAMES[Number(month)],
        formatINR(v.collected),
        formatINR(v.pending),
        Math.round((v.collected / maxVal) * 100),
        Math.round((v.pending / maxVal) * 100),
      ];
    });

  const stats = [
    ["fa-circle-check", "Total Collected", formatINR(totalCollected), "This academic year", "c1"],
    ["fa-clock",        "Total Pending",   formatINR(totalPending),   "Overall",            "c2"],
    ["fa-triangle-exclamation", "Overdue > 30 Days", overdueCount.toString(), "Students", "c3"],
    ["fa-percent",      "Collection Rate", `${collectionRate}%`,      "Current Year",       "c4"],
  ];

  const pendingList = collections?.filter(c => c.status !== "paid").slice(0, 5) || [];

  const feeStatusData = [
    { name: "Paid",    value: collections?.filter(c => c.status === "paid").length    || 0, color: "#12805c" },
    { name: "Partial", value: collections?.filter(c => c.status === "partial").length || 0, color: "#d8941f" },
    { name: "Unpaid",  value: collections?.filter(c => c.status === "unpaid").length  || 0, color: "#e15b64" },
  ];

  return (
    <div className={s("fees-page")}>
      <Topbar title="Fee Management" subtitle="Track collections, pending fees, and payment history" />
      <main className={s("page-content")}>

        <section className={s("page-head")}>
          <div>
            <h1>Fee Overview</h1>
            <p>Fee collection summary and recent records</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/fees/structures">
              <i className="fa-solid fa-list" /> Fee Structures
            </Link>
            <Link className={cx(s("btn"), s("btn-soft"))} href="/fees/records">
              <i className="fa-solid fa-table-list" /> All Records
            </Link>
            <Link className={cx(s("btn"), s("btn-primary"))} href="/fees/collect">
              <i className="fa-solid fa-hand-holding-dollar" /> Collect Fee
            </Link>
          </div>
        </section>

        {/* ── Stat cards ── */}
        <section className={s("hero-cards")}>
          {stats.map(([icon, label, value, sub, tone]) => (
            <article className={cx(s("hero-card"), s(tone))} key={label}>
              <div className={s("hc-icon")}><i className={`fa-solid ${icon}`} /></div>
              <div className={s("hc-label")}>{label}</div>
              <div className={s("hc-value")}>{value}</div>
              <div className={s("hc-sub")}>{sub}</div>
            </article>
          ))}
        </section>

        {/* ── Quick actions ── */}
        <section className={s("quick-actions")}>
          <QuickAction href="/fees/collect"          icon="fa-hand-holding-dollar" title="Collect Fee"      text="Record new payment"     />
          <QuickAction href="/fees/monthly-billing"  icon="fa-calendar-plus"       title="Monthly Billing"  text="Generate & track bills"  />
          <QuickAction href="/fees/structures"       icon="fa-list-check"          title="Fee Structures"   text="Manage fee plans"        />
          <QuickAction href="/fees/structures/add"   icon="fa-plus"                title="Add Structure"    text="New fee template"        />
          <QuickAction href="/fees/records"          icon="fa-table-list"          title="All Records"      text="View all payments"       />
        </section>

        {/* ── Monthly Billing callout ── */}
        <section className={s("card")} style={{ borderLeft: "4px solid #FF9B51" }}>
          <div className={s("card-head")} style={{ alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: "#fff7ed", color: "#FF9B51",
                display: "grid", placeItems: "center", fontSize: 20,
              }}>
                <i className="fa-solid fa-calendar-plus" />
              </div>
              <div>
                <strong style={{ fontSize: 15, fontWeight: 900, color: "#25343F", display: "block" }}>
                  Monthly Billing
                </strong>
                <p style={{ margin: "3px 0 0", fontSize: 13, color: "#64748b" }}>
                  Generate bills for all enrolled students and track who has paid, partially paid, or not yet paid — per month.
                </p>
              </div>
            </div>
            <Link className={cx(s("btn"), s("btn-primary"))} href="/fees/monthly-billing">
              <i className="fa-solid fa-arrow-right" /> Open Monthly Billing
            </Link>
          </div>
        </section>

        {/* ── Charts ── */}
        <section className={s("chart-row")}>
          <article className={s("chart-card")}>
            <div className={s("chart-head")}>
              <div><h3>Monthly Collection</h3><p>Collected vs pending per month</p></div>
            </div>
            <div className={s("chart-body")}>
              <div className={s("chart-metrics")}>
                <div><span>Collected</span><strong>{formatINR(totalCollected)}</strong></div>
                <div><span>Pending</span><strong>{formatINR(totalPending)}</strong></div>
                <div><span>Rate</span><strong>{collectionRate}%</strong></div>
              </div>
              <div className={s("bar-chart")}>
                {monthlyData.map(([month, collected, pendingAmount, collectedHeight, pendingHeight]) => {
                  const collectedPct = Math.min(Number(collectedHeight), 100);
                  const pendingPct   = Math.min(Number(pendingHeight),   100);
                  return (
                    <div className={s("bar-group")} key={month}>
                      <div className={s("bar-values")}>
                        <span>Collected {collected}</span>
                        <span>Pending {pendingAmount}</span>
                      </div>
                      <div className={s("bar-stack")}>
                        <span style={{ height: `${collectedPct}%` }} />
                        <em    style={{ height: `${pendingPct}%`   }} />
                      </div>
                      <p>{month}</p>
                    </div>
                  );
                })}
              </div>
              <div className={s("chart-legend")}>
                <span><i className={s("legend-green")} /> Collected</span>
                <span><i className={s("legend-red")}   /> Pending</span>
              </div>
            </div>
          </article>

          <article className={s("chart-card")}>
            <div className={s("chart-head")}>
              <div><h3>Fee Status Breakdown</h3><p>Overall overview</p></div>
            </div>
            <div className={s("status-box")}>
              <div className={s("donut-wrap")}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={feeStatusData} dataKey="value" nameKey="name"
                      innerRadius={54} outerRadius={78} paddingAngle={3} cornerRadius={6}
                    >
                      {feeStatusData.map(entry => <Cell fill={entry.color} key={entry.name} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #d7dfdf", boxShadow: "0 12px 30px rgba(31,45,54,0.12)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={s("donut-center")}>
                  <strong>{collections?.length || 0}</strong>
                  <span>Records</span>
                </div>
              </div>
              <div className={s("status-list")}>
                <div><span className={s("dot-green")}  /><p>{feeStatusData[0].value}</p><strong>Paid</strong></div>
                <div><span className={s("dot-yellow")} /><p>{feeStatusData[1].value}</p><strong>Partial</strong></div>
                <div><span className={s("dot-red")}    /><p>{feeStatusData[2].value}</p><strong>Unpaid</strong></div>
              </div>
            </div>
          </article>
        </section>

        {/* ── Recent pending payments ── */}
        <section className={s("data-row")}>
          <article className={s("card")} style={{ flex: 1 }}>
            <div className={s("card-head")}>
              <div>
                <h3><i className="fa-solid fa-clock" /> Pending Payments</h3>
                <p>Recent unpaid records</p>
              </div>
              <div className={s("table-actions")}>
                <Link className={cx(s("btn"), s("btn-soft"), s("btn-sm"))} href="/fees/records">View All</Link>
              </div>
            </div>
            {loading
              ? <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
              : (
                <div className={s("table-wrap")}>
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th><th>Fee Name</th><th>Type</th>
                        <th>Due Date</th><th>Amount Due</th><th>Status</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingList.map((col: any) => (
                        <tr key={col.id}>
                          <td>
                            <strong>{col.full_name || `Student #${col.student_id}`}</strong>
                            <br /><small style={{ color: "#6a7882" }}>{col.admission_number || ""}</small>
                          </td>
                          <td>{col.fee_name || `Fee #${col.id}`}</td>
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                              background: col.fee_type === "transport" ? "#fff1df" : col.fee_type === "hostel" ? "#f3e8ff" : "#e8edff",
                              color:      col.fee_type === "transport" ? "#c46a14" : col.fee_type === "hostel" ? "#7c3aed"  : "#3b5bdb",
                            }}>
                              {(col.fee_type || "academic").toUpperCase()}
                            </span>
                          </td>
                          <td className={new Date(col.due_date) < new Date() ? s("danger-text") : s("warning-text")}>
                            {formatDate(col.due_date?.slice(0, 10))}
                          </td>
                          <td><strong>{formatINR(parseFloat(col.remaining_amount || "0"))}</strong></td>
                          <td><Badge status={col.status} /></td>
                          <td>
                            <Link className={cx(s("btn"), s("btn-primary"), s("btn-sm"))}
                              href={`/fees/collect?student_id=${col.student_id}`}>
                              Collect
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {pendingList.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>No pending fees.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
          </article>
        </section>

      </main>
    </div>
  );
}

function QuickAction({ href, icon, title, text }: { href: string; icon: string; title: string; text: string }) {
  return (
    <Link className={s("qa-card")} href={href}>
      <div className={s("qa-ico")}><i className={`fa-solid ${icon}`} /></div>
      <div><p>{title}</p><span>{text}</span></div>
    </Link>
  );
}

function Badge({ status }: { status: string }) {
  const tone =
    status === "overdue" || status === "unpaid"     ? "badge-red"    :
    status === "pending" || status === "partial" || status === "cheque" ? "badge-yellow" :
    status === "online"  ? "badge-blue"  : "badge-green";
  return <span className={cx(s("badge"), s(tone))} style={{ textTransform: "capitalize" }}>{status}</span>;
}
