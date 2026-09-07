"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import styles from "./fees.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { SkeletonStatRow, SkeletonChart, SkeletonTable } from "@/components/shared/Skeleton";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency } from "@/lib/useCurrency";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function FeesPage() {
  const { formatDate, formatFeeName } = useDateFormat();
  const { fmt: formatCurrency } = useCurrency();
  const { academicYearId } = useAcademicYear();
  const { data: collections, loading } = useApi<any[]>(
    academicYearId ? `/fees/collections?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );
  const { data: paymentRequests } = useApi<any[]>("/online-payments/pending");

  const totalCollected = useMemo(() => {
    return collections
      ?.reduce((sum, c) => sum + parseFloat(c.paid_amount || "0"), 0) || 0;
  }, [collections]);

  const totalPending = useMemo(() => {
    return collections
      ?.filter(c => c.status !== "paid" && c.status !== "waived")
      .reduce((sum, c) => sum + parseFloat(c.remaining_amount || "0"), 0) || 0;
  }, [collections]);

  const totalWaived = useMemo(() => {
    return collections
      ?.reduce((sum, c) => {
        const disc = parseFloat(c.discount_amount || "0");
        const isWaivedStatus = c.status === "waived";
        const waivedRem = isWaivedStatus ? Math.max(0, parseFloat(c.net_amount || c.total_amount || "0") - parseFloat(c.paid_amount || "0")) : 0;
        return sum + disc + waivedRem;
      }, 0) || 0;
  }, [collections]);

  const pendingStudentsCount = useMemo(() => {
    const set = new Set();
    collections?.filter(c => c.status !== "paid" && c.status !== "waived").forEach(c => set.add(c.student_id));
    return set.size;
  }, [collections]);

  // Current Month collections
  const currentMonthIdx = new Date().getMonth();
  const thisMonthCollected = useMemo(() => {
    return collections
      ?.filter(c => {
        const dStr = c.paid_at || c.updated_at || c.created_at;
        if (!dStr) return false;
        const d = new Date(dStr);
        return d.getMonth() === currentMonthIdx;
      })
      .reduce((sum, c) => sum + parseFloat(c.paid_amount || "0"), 0) || 0;
  }, [collections, currentMonthIdx]);

  const totalNetPayable = Math.max(1, totalCollected + totalPending);
  const collectionRate = Math.min(100, Math.round((totalCollected / totalNetPayable) * 100));

  // Monthly 6-month data mapping
  const monthlyData = useMemo(() => {
    const monthlyMap: Record<number, { collected: number; pending: number }> = {};
    (collections || []).forEach(c => {
      const month = new Date(c.due_date).getMonth();
      if (!monthlyMap[month]) monthlyMap[month] = { collected: 0, pending: 0 };
      monthlyMap[month].collected += parseFloat(c.paid_amount || "0");
      if (c.status !== "paid" && c.status !== "waived") monthlyMap[month].pending += parseFloat(c.remaining_amount || "0");
    });

    return Object.entries(monthlyMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .slice(-6)
      .map(([month, v]) => {
        const maxVal = Math.max(v.collected, v.pending, 1);
        return {
          month: MONTH_NAMES[Number(month)],
          collectedFormatted: formatCurrency(v.collected),
          pendingFormatted: formatCurrency(v.pending),
          collectedPct: Math.round((v.collected / maxVal) * 100),
          pendingPct: Math.round((v.pending / maxVal) * 100),
        };
      });
  }, [collections]);

  const pendingList = useMemo(() => {
    return collections?.filter(c => c.status !== "paid" && c.status !== "waived").slice(0, 5) || [];
  }, [collections]);

  const feeStatusData = useMemo(() => {
    const paidCount = collections?.filter(c => c.status === "paid").length || 0;
    const partialCount = collections?.filter(c => c.status === "partial").length || 0;
    const unpaidCount = collections?.filter(c => c.status === "unpaid").length || 0;
    const waivedCount = collections?.filter(c => c.status === "waived").length || 0;
    return [
      { name: "Paid",    value: paidCount,    color: "#10B981" },
      { name: "Partial", value: partialCount, color: "#F59E0B" },
      { name: "Unpaid",  value: unpaidCount,  color: "#EF4444" },
      { name: "Waived",  value: waivedCount,  color: "#3B82F6" },
    ];
  }, [collections]);

  const totalFeeRecords = collections?.length || 0;

  return (
    <div className={s("feesPage")}>
      <main className={s("pageContent")}>

        {/* ── Page Header ── */}
        <section className={s("pageHead")}>
          <div className={s("headLeft")}>
            <div className={s("headIcon")}>
              <i className="fa-solid fa-file-invoice-dollar" />
            </div>
            <div>
              <h1>Fee Management</h1>
              <p>Track collections, student dues, monthly billing, and fee structures.</p>
            </div>
          </div>
          <div className={s("headActions")}>
            <Link className={cx(s("btn"), s("btnOutline"))} href="/fees/structures">
              <i className="fa-solid fa-layer-group" /> Fee Structures
            </Link>
            <Link className={cx(s("btn"), s("btnOutline"))} href="/fees/monthly-billing">
              <i className="fa-solid fa-calendar-plus" /> Monthly Billing
            </Link>
            <Link className={cx(s("btn"), s("btnOutline"))} href="/fees/records">
              <i className="fa-solid fa-table-list" /> All Records
            </Link>
            <Link className={cx(s("btn"), s("btnPrimary"))} href="/fees/collect">
              <i className="fa-solid fa-hand-holding-dollar" /> Collect Fee
            </Link>
          </div>
        </section>

        {/* ── Compact 4 Stat Cards (~75px) ── */}
        {loading && !collections ? (
          <SkeletonStatRow count={4} />
        ) : (
          <section className={s("heroCards")}>
            <article className={cx(s("heroCard"), s("c1"))}>
              <div className={s("hcInfo")}>
                <span className={s("hcLabel")}>Total Collected</span>
                <strong className={s("hcValue")}>{formatCurrency(totalCollected)}</strong>
                <span className={s("hcSub")}>Active academic session</span>
              </div>
              <div className={s("hcIcon")}><i className="fa-solid fa-wallet" /></div>
            </article>

            <article className={cx(s("heroCard"), s("c2"))}>
              <div className={s("hcInfo")}>
                <span className={s("hcLabel")}>Total Outstanding Dues</span>
                <strong className={s("hcValue")}>{formatCurrency(totalPending)}</strong>
                <span className={s("hcSub")}>{pendingStudentsCount} students with dues</span>
              </div>
              <div className={s("hcIcon")}><i className="fa-solid fa-clock-rotate-left" /></div>
            </article>

            <article className={cx(s("heroCard"), s("c3"))}>
              <div className={s("hcInfo")}>
                <span className={s("hcLabel")}>This Month's Collections</span>
                <strong className={s("hcValue")}>{formatCurrency(thisMonthCollected)}</strong>
                <span className={s("hcSub")}>{MONTH_NAMES[currentMonthIdx]} revenue</span>
              </div>
              <div className={s("hcIcon")}><i className="fa-solid fa-calendar-check" /></div>
            </article>

            <article className={cx(s("heroCard"), s("c4"))}>
              <div className={s("hcInfo")}>
                <span className={s("hcLabel")}>Collection Rate</span>
                <strong className={s("hcValue")}>{collectionRate}%</strong>
                <span className={s("hcSub")}>{collectionRate >= 75 ? "Healthy recovery" : "Needs attention"}</span>
              </div>
              <div className={s("hcIcon")}><i className="fa-solid fa-chart-line" /></div>
            </article>
          </section>
        )}

        {/* ── Sub-Bar Quick Navigation Strip ── */}
        <section className={s("subBar")}>
          <div className={s("subBarLeft")}>
            <i className="fa-solid fa-bolt" />
            <span>Quick Financial Hub</span>
          </div>
          <div className={s("subBarLinks")}>
            <Link className={s("subLink")} href="/fees/bank-accounts">
              <i className="fa-solid fa-building-columns" /> Bank Accounts & QR
            </Link>
            <Link className={s("subLink")} href="/fees/payment-requests">
              <i className="fa-solid fa-receipt" /> Online Requests
              {paymentRequests && paymentRequests.length > 0 && (
                <span style={{ background: "#ea580c", color: "#fff", fontSize: 10, fontWeight: 900, padding: "1px 6px", borderRadius: 10 }}>
                  {paymentRequests.length}
                </span>
              )}
            </Link>
            <Link className={s("subLink")} href="/fees/monthly-billing">
              <i className="fa-solid fa-calendar-days" /> Generate Monthly Bills
            </Link>
            <Link className={s("subLink")} href="/fees/structures/add">
              <i className="fa-solid fa-plus" /> New Fee Structure
            </Link>
          </div>
        </section>

        {/* ── Charts Grid (2 Columns) ── */}
        {loading && !collections ? (
          <section className={s("chartRow")}>
            <SkeletonChart height={340} />
            <SkeletonChart height={340} />
          </section>
        ) : (
          <section className={s("chartRow")}>
          {/* Monthly Collection Trend */}
          <article className={s("chartCard")}>
            <div className={s("chartHead")}>
              <div>
                <h3><i className="fa-solid fa-chart-simple" />Monthly Collection Trend</h3>
                <p>Collected vs pending dues per month</p>
              </div>
            </div>
            <div className={s("chartBody")}>
              <div className={s("chartMetrics")}>
                <div className={s("chartMetricBox")}>
                  <span>Total Collected</span>
                  <strong>{formatCurrency(totalCollected)}</strong>
                </div>
                <div className={s("chartMetricBox")}>
                  <span>Total Pending</span>
                  <strong style={{ color: "#ea580c" }}>{formatCurrency(totalPending)}</strong>
                </div>
                <div className={s("chartMetricBox")}>
                  <span>Recovery Rate</span>
                  <strong style={{ color: "#059669" }}>{collectionRate}%</strong>
                </div>
              </div>

              <div className={s("barChartWrap")}>
                {monthlyData.length > 0 ? (
                  monthlyData.map((item) => (
                    <div className={s("barGroup")} key={item.month}>
                      <div className={s("barStack")}>
                        <span 
                          className={cx(s("barCol"), s("barCollected"))} 
                          style={{ height: `${Math.max(item.collectedPct, 6)}%` }} 
                          title={`Collected: ${item.collectedFormatted}`}
                        />
                        <span 
                          className={cx(s("barCol"), s("barPending"))} 
                          style={{ height: `${Math.max(item.pendingPct, 6)}%` }} 
                          title={`Pending: ${item.pendingFormatted}`}
                        />
                      </div>
                      <span className={s("barMonth")}>{item.month}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "3rem 0" }}>
                    No monthly fee records available yet.
                  </div>
                )}
              </div>

              <div className={s("chartLegend")}>
                <span className={s("legendItem")}>
                  <i className={s("legendDot")} style={{ background: "#10B981" }} /> Collected
                </span>
                <span className={s("legendItem")}>
                  <i className={s("legendDot")} style={{ background: "#F87171" }} /> Pending
                </span>
              </div>
            </div>
          </article>

          {/* Fee Status Breakdown */}
          <article className={s("chartCard")}>
            <div className={s("chartHead")}>
              <div>
                <h3><i className="fa-solid fa-chart-pie" />Fee Status Breakdown</h3>
                <p>Overall fee distribution</p>
              </div>
            </div>
            <div className={s("statusBox")}>
              <div className={s("donutWrap")}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={feeStatusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={74}
                      paddingAngle={3}
                      cornerRadius={5}
                    >
                      {feeStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0];
                          return (
                            <div style={{
                              background: "#0f172a",
                              color: "#fff",
                              padding: "5px 10px",
                              borderRadius: 8,
                              fontSize: 11.5,
                              fontWeight: 800,
                              boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              pointerEvents: "none",
                              zIndex: 100,
                            }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: data.payload.color }} />
                              <span>{data.name}: <strong>{data.value}</strong></span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className={s("donutCenter")}>
                  <strong>{totalFeeRecords}</strong>
                  <span>Records</span>
                </div>
              </div>

              <div className={s("statusList")}>
                {feeStatusData.map((item) => (
                  <div className={s("statusRow")} key={item.name}>
                    <div className={s("statusRowLeft")}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: item.color }} />
                      <span>{item.name} Invoices</span>
                    </div>
                    <span className={s("statusRowRight")}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>
      )}

        {/* ── Pending Payments Table ── */}
        <article className={s("card")}>
          <div className={s("cardHead")}>
            <div>
              <h3><i className="fa-solid fa-clock" />Recent Pending Payments</h3>
              <p>Top outstanding student invoices requiring collection</p>
            </div>
            <Link className={cx(s("btn"), s("btnOutline"), s("btnSm"))} href="/fees/records">
              View All Records <i className="fa-solid fa-arrow-right" />
            </Link>
          </div>

          <div className={s("tableWrap")}>
            {loading && !collections ? (
              <SkeletonTable rows={5} columns={7} />
            ) : pendingList.length > 0 ? (
              <table className={s("table")}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Fee Name</th>
                    <th>Category</th>
                    <th>Due Date</th>
                    <th>Amount Due</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingList.map((item) => {
                    const studentName = item.full_name || item.student_name || "Student";
                    const initials = studentName
                      .split(" ")
                      .map((w: string) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className={s("studentCell")}>
                            <div className={s("studentAvatar")}>{initials}</div>
                            <div>
                              <span className={s("studentName")}>{studentName}</span>
                              <span className={s("studentCode")}>
                                {item.admission_number ? `Adm: ${item.admission_number}` : item.class_name ? `Class ${item.class_name}` : "—"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={s("feeTitle")}>{formatFeeName(item.fee_name || item.fee_structure_name || "Fee")}</span>
                        </td>
                        <td>
                          <span className={s("categoryTag")}>
                            {item.fee_type || "Academic"}
                          </span>
                        </td>
                        <td>
                          <span className={s("dateCell")}>
                            {formatDate(item.due_date?.slice(0, 10))}
                          </span>
                        </td>
                        <td>
                          <span className={s("amountCell")}>
                            {formatCurrency(parseFloat(item.remaining_amount || item.total_amount || 0))}
                          </span>
                        </td>
                        <td>
                          <span className={cx(s("badge"), item.status === "partial" ? s("badgeYellow") : s("badgeRed"))}>
                            {item.status || "Unpaid"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link 
                            className={cx(s("btn"), s("btnSoft"), s("btnSm"))} 
                            href={`/fees/collect?student_id=${item.student_id}&collection_id=${item.id}`}
                          >
                            <i className="fa-solid fa-hand-holding-dollar" /> Collect
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className={s("emptyState")}>
                <div className={s("emptyIcon")}>
                  <i className="fa-solid fa-circle-check" />
                </div>
                <p>All fees are up to date! No pending dues found.</p>
              </div>
            )}
          </div>
        </article>
      </main>
    </div>
  );
}
