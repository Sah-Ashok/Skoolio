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
import { useAppSelector } from "@/store/hooks";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning",   icon: "fa-sun"       };
  if (h < 17) return { text: "Good afternoon", icon: "fa-cloud-sun" };
  return              { text: "Good evening",   icon: "fa-moon"      };
}

interface FeesPageProps {
  mode?: 'admin' | 'finance';
  basePath?: string;
  showHeroGreeting?: boolean;
}

export default function FeesPage({ mode, basePath, showHeroGreeting }: FeesPageProps = {}) {
  const user = useAppSelector((state) => state.auth.user);
  const { data: me } = useApi<any>(showHeroGreeting ? "/auth/me" : null);
  const currentMode = mode || (user?.role === 'finance' ? 'finance' : 'admin');
  const isFinance = currentMode === 'finance';
  const prefix = basePath || (isFinance ? '/finance/fees' : '/fees');

  const { formatDate, formatFeeName } = useDateFormat();
  const { fmt: formatCurrency } = useCurrency();
  const { activeYear, academicYearId } = useAcademicYear();
  const { data: rawCollections, loading } = useApi<any>(
    academicYearId ? `/fees/collections?academic_year_id=${academicYearId}&limit=200` : "",
    [academicYearId]
  );
  const { data: countData } = useApi<{ count: number }>("/online-payments/requests/pending-count");
  const pendingRequestsCount = countData?.count ?? 0;

  const schoolName = me?.school_name || user?.school_name || "";
  const personName = me?.full_name || user?.full_name || "Finance Manager";
  const greeting = getGreeting();

  const collections: any[] = useMemo(() => {
    if (!rawCollections) return [];
    if (Array.isArray(rawCollections)) return rawCollections;
    return rawCollections.data ?? [];
  }, [rawCollections]);

  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  // Single-pass computation for all dashboard statistics (P2 optimization)
  const {
    totalCollected,
    totalPending,
    totalWaived,
    pendingStudentsCount,
    thisMonthCollected,
    monthlyData,
    pendingList,
    feeStatusData,
  } = useMemo(() => {
    let collected = 0;
    let pending = 0;
    let waived = 0;
    let thisMonth = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let waivedCount = 0;
    const pendingStudentsSet = new Set<number>();
    const pendingRows: any[] = [];
    const monthlyMap: Record<number, { collected: number; pending: number }> = {};

    for (let i = 0; i < collections.length; i++) {
      const c = collections[i];
      const paidAmt = parseFloat(c.paid_amount || "0");
      const remAmt = parseFloat(c.remaining_amount || "0");
      const netAmt = parseFloat(c.net_amount || c.total_amount || "0");
      const discAmt = parseFloat(c.discount_amount || "0");
      const isPaid = c.status === "paid";
      const isWaived = c.status === "waived";

      collected += paidAmt;

      if (!isPaid && !isWaived) {
        pending += remAmt;
        if (c.student_id) pendingStudentsSet.add(c.student_id);
        if (pendingRows.length < 5) pendingRows.push(c);
      }

      if (isWaived) {
        waived += discAmt + Math.max(0, netAmt - paidAmt);
        waivedCount++;
      } else {
        waived += discAmt;
        if (isPaid) paidCount++;
        else if (c.status === "partial") partialCount++;
        else unpaidCount++;
      }

      // This month collected (accurately computed from payment dates)
      if (Array.isArray(c.payments) && c.payments.length > 0) {
        for (let pIdx = 0; pIdx < c.payments.length; pIdx++) {
          const p = c.payments[pIdx];
          if (p?.payment_date) {
            const pDate = new Date(p.payment_date);
            if (pDate.getMonth() === currentMonthIdx && pDate.getFullYear() === currentYear) {
              thisMonth += parseFloat(p.paid_amount || "0");
            }
          }
        }
      } else if (paidAmt > 0 && c.created_at) {
        const d = new Date(c.created_at);
        if (d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear) {
          thisMonth += paidAmt;
        }
      }

      // Monthly breakdown
      if (c.due_date) {
        const mIdx = new Date(c.due_date).getMonth();
        if (!monthlyMap[mIdx]) monthlyMap[mIdx] = { collected: 0, pending: 0 };
        monthlyMap[mIdx].collected += paidAmt;
        if (!isPaid && !isWaived) {
          monthlyMap[mIdx].pending += remAmt;
        }
      }
    }

    const monthlyFormatted = Object.entries(monthlyMap)
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

    const sc = rawCollections?.status_counts;
    const computedFeeStatusData = sc && (sc.paid > 0 || sc.unpaid > 0 || sc.waived > 0)
      ? [
          { name: "Paid",    value: sc.paid ?? 0,      color: "#10B981" },
          { name: "Unpaid",  value: sc.unpaid ?? 0,    color: "#EF4444" },
          { name: "Waived",  value: sc.waived ?? 0,    color: "#3B82F6" },
        ]
      : [
          { name: "Paid",    value: paidCount,    color: "#10B981" },
          { name: "Partial", value: partialCount, color: "#F59E0B" },
          { name: "Unpaid",  value: unpaidCount,  color: "#EF4444" },
          { name: "Waived",  value: waivedCount,  color: "#3B82F6" },
        ];

    return {
      totalCollected: rawCollections?.total_collected != null ? Number(rawCollections.total_collected) : collected,
      totalPending: rawCollections?.total_pending != null ? Number(rawCollections.total_pending) : pending,
      totalWaived: waived,
      pendingStudentsCount: pendingStudentsSet.size,
      thisMonthCollected: thisMonth,
      monthlyData: monthlyFormatted,
      pendingList: pendingRows,
      feeStatusData: computedFeeStatusData,
    };
  }, [collections, rawCollections, formatCurrency]);

  const totalFeeRecords = rawCollections?.total ?? collections.length;
  const totalBilled = totalCollected + totalPending;
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  return (
    <div className={s("feesPage")}>
      <main className={s("pageContent")}>

        {/* ── Top Hero Greeting (Finance Dashboard) ── */}
        {showHeroGreeting && (
          <section style={{
            background: "#ffffff",
            borderRadius: 16,
            padding: "24px 28px",
            border: "1px solid #e2e8f0",
            marginBottom: 20,
            boxShadow: "0 2px 10px rgba(15, 23, 42, 0.03)",
          }}>
            {schoolName && (
              <div style={{
                fontSize: "clamp(24px, 4vw, 34px)",
                fontWeight: 900,
                color: "#FF9B51",
                lineHeight: 1.15,
                marginBottom: 6,
                letterSpacing: "-0.02em",
              }}>
                {schoolName}
              </div>
            )}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "clamp(20px, 3vw, 26px)",
              color: "#64748b",
              fontWeight: 700,
              margin: "6px 0",
            }}>
              <img
                src={greeting.icon === "fa-sun" ? "/icons/GoodMorning.svg" : greeting.icon === "fa-cloud-sun" ? "/icons/Afternoon.svg" : "/icons/GoodEvening.svg"}
                alt={greeting.text}
                width={52}
                height={52}
                style={{ objectFit: "contain" }}
              />
              <span>{greeting.text},</span>
            </div>
            <div style={{
              fontSize: "clamp(22px, 3.2vw, 30px)",
              fontWeight: 900,
              color: "#1e293b",
              marginBottom: 12,
            }}>
              {personName}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 999,
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#065f46",
                fontSize: 12,
                fontWeight: 800,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                Active Finance Manager
              </span>
              {activeYear?.year_name && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  borderRadius: 999,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#475569",
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  <i className="fa-regular fa-calendar" /> {activeYear.year_name}
                </span>
              )}
            </div>
          </section>
        )}

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
            {isFinance ? (
              <>
                <Link className={cx(s("btn"), s("btnOutline"))} href={`${prefix}/structures`}>
                  <i className="fa-solid fa-layer-group" /> Fee Structures
                </Link>
                <Link className={cx(s("btn"), s("btnOutline"))} href={`${prefix}/records`}>
                  <i className="fa-solid fa-table-list" /> All Records
                </Link>
                <Link className={cx(s("btn"), s("btnPrimary"))} href={`${prefix}/collect`}>
                  <i className="fa-solid fa-hand-holding-dollar" /> Collect Fee
                </Link>
              </>
            ) : (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 16px",
                borderRadius: "999px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "#1d4ed8",
                fontSize: "12.5px",
                fontWeight: "700",
              }}>
                <i className="fa-solid fa-chart-pie" /> Fee Status &amp; Dues Overview
              </span>
            )}
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

        {/* ── Sub-Bar Quick Navigation Strip (Finance only) ── */}
        {isFinance && (
          <section className={s("subBar")}>
            <div className={s("subBarLeft")}>
              <i className="fa-solid fa-bolt" />
              <span>Quick Financial Hub</span>
            </div>
            <div className={s("subBarLinks")}>
              <Link className={s("subLink")} href={`${prefix}/bank-accounts`}>
                <i className="fa-solid fa-building-columns" /> Bank Accounts &amp; QR
              </Link>
              <Link className={s("subLink")} href={`${prefix}/payment-requests`}>
                <i className="fa-solid fa-receipt" /> Online Requests
                {pendingRequestsCount > 0 && (
                  <span style={{ background: "#ea580c", color: "#fff", fontSize: 10, fontWeight: 900, padding: "1px 6px", borderRadius: 10 }}>
                    {pendingRequestsCount}
                  </span>
                )}
              </Link>
              <Link className={s("subLink")} href={`${prefix}/structures/add`}>
                <i className="fa-solid fa-plus" /> New Fee Structure
              </Link>
            </div>
          </section>
        )}

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
            <Link className={cx(s("btn"), s("btnOutline"), s("btnSm"))} href={isFinance ? `${prefix}/records` : '/fees/records'}>
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
                    {isFinance && <th style={{ textAlign: "right" }}>Action</th>}
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
                        {isFinance && (
                          <td style={{ textAlign: "right" }}>
                            <Link 
                              className={cx(s("btn"), s("btnSoft"), s("btnSm"))} 
                              href={`${prefix}/collect?student_id=${item.student_id}&collection_id=${item.id}`}
                            >
                              <i className="fa-solid fa-hand-holding-dollar" /> Collect
                            </Link>
                          </td>
                        )}
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
