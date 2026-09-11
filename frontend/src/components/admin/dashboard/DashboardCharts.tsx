"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import styles from "@/app/(admin)/dashboard/dashboard.module.css";
import { useCurrency } from "@/lib/useCurrency";
import type { DashboardData } from "@/types/dashboard.types";

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");
const s  = (n: string) => styles[n];

const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"];
const NOTICE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

interface Props { data: DashboardData }

export default function DashboardCharts({ data }: Props) {
  const { symbol: currSymbol, fmt, fmtShort: currencyShort } = useCurrency();
  const sym = data?.currencySymbol || currSymbol || "रू";

  const fmtShort = (n: number) => currencyShort(n, sym);
  const fmtFull  = (n: number) => fmt(n, sym);

  const feeMonthly        = data.feeMonthly        ?? [];
  const admissionsMonthly = data.admissionsMonthly ?? [];
  const expenseBreakdown:  any[] = (data.expenseBreakdown ?? []).map(
    (e: any, i: number) => ({ ...e, color: PIE_COLORS[i % PIE_COLORS.length] })
  );
  const notices: any[] = data.notices ?? [];

  const totalCollected   = data.totalCollected   ?? 0;
  const totalPending     = data.totalPending     ?? 0;
  const collectionRate   = data.collectionRate   ?? 0;
  const totalExpenses    = data.totalExpenses    ?? 0;

  // Admissions chart metrics
  const admNums      = admissionsMonthly.map((r: any) => r.admissions as number);
  const newThisMonth = admNums[admNums.length - 1] ?? 0;
  const bestMonth    = admissionsMonthly.length
    ? admissionsMonthly.reduce((a: any, b: any) => b.admissions > a.admissions ? b : a, admissionsMonthly[0])
    : null;
  const avgMonthly   = admNums.length
    ? Math.round(admNums.reduce((a, b) => a + b, 0) / admNums.length)
    : 0;

  // Largest expense category
  const largestCat = expenseBreakdown[0] ?? null;

  return (
    <>
      {/* ── Fee + Expense row ── */}
      <section className={s("chart-row")}>

        {/* Fee bar chart */}
        <article className={s("chart-card")}>
          <div className={s("chart-head")}>
            <div>
              <h3><i className="fa-solid fa-chart-column" /> Fee Collection Overview</h3>
              <p>Monthly collected vs pending — last 6 months</p>
            </div>
          </div>
          <div className={s("chart-metrics")}>
            <div className={s("metric-card")}>
              <span>COLLECTED</span>
              <strong>{fmtShort(totalCollected)}</strong>
            </div>
            <div className={s("metric-card")}>
              <span>PENDING</span>
              <strong style={{ color: "#d97706" }}>{fmtShort(totalPending)}</strong>
            </div>
            <div className={s("metric-card")}>
              <span>COLLECTION RATE</span>
              <strong style={{ color: "#059669" }}>{collectionRate}%</strong>
            </div>
          </div>
          <div className={s("chart-body")}>
            <div className={s("chart-canvas")}>
              {feeMonthly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                  <BarChart
                    data={feeMonthly}
                    barGap={6}
                    barCategoryGap="28%"
                    margin={{ top: 8, right: 24, left: -10, bottom: 0 }}
                  >
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }} interval={0} />
                    <YAxis
                      axisLine={false} tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                      tickFormatter={(v) => fmtShort(v)}
                    />
                    <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                    <Tooltip
                      cursor={{ fill: "rgba(37,99,235,0.04)" }}
                      contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)", background: "#ffffff", fontSize: 12 }}
                      formatter={(v: any, n: any) => [fmtFull(Number(v)), n]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 10 }} />
                    <Bar dataKey="collected" name="Collected" fill="#2563eb" radius={[6,6,0,0]} maxBarSize={22} />
                    <Bar dataKey="pending"   name="Pending"   fill="#f59e0b" radius={[6,6,0,0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#94a3b8", fontSize:13, fontWeight:700 }}>
                  No fee data available yet
                </div>
              )}
            </div>
          </div>
        </article>

        {/* Expense donut */}
        <article className={s("chart-card")}>
          <div className={s("chart-head")}>
            <div>
              <h3><i className="fa-solid fa-chart-pie" /> Expense Breakdown</h3>
              <p>By category — this month</p>
            </div>
          </div>
          <div className={cx(s("chart-body"), s("expense-breakdown"))}>
            <div className={s("chart-metrics")}>
              <div className={s("metric-card")}>
                <span>LARGEST</span>
                <strong>{largestCat ? `${largestCat.name} (${largestCat.value}%)` : "None"}</strong>
              </div>
              <div className={s("metric-card")}>
                <span>TOTAL SPEND</span>
                <strong>{fmtShort(totalExpenses)}</strong>
              </div>
            </div>
            {expenseBreakdown.length > 0 ? (
              <>
                <div className={s("donut-wrap")}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={160} minHeight={160}>
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={80}
                        paddingAngle={3}
                        cornerRadius={5}
                      >
                        {expenseBreakdown.map((e: any) => (
                          <Cell fill={e.color} key={e.name} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)", background: "#ffffff", fontSize: 12 }}
                        formatter={(v: any, n: any) => [`${v}%`, n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={s("donut-center")}>
                    <strong>{fmtShort(totalExpenses)}</strong>
                    <span>Total</span>
                  </div>
                </div>
                <div className={s("legend-grid")}>
                  {expenseBreakdown.map((item: any) => (
                    <div className={s("legend-item")} key={item.name}>
                      <span style={{ background: item.color }} />
                      {item.name} {item.value}%
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding:"44px 0", textAlign:"center", color:"#94a3b8", fontSize:13, fontWeight:600 }}>
                <i className="fa-solid fa-receipt" style={{ fontSize: 28, display: "block", marginBottom: 10, color: "#cbd5e1" }} />
                No expenses recorded this month
              </div>
            )}
          </div>
        </article>
      </section>

      {/* ── Admissions + Notices row ── */}
      <section className={s("bottom-row")}>

        {/* Admissions area chart */}
        <article className={s("chart-card")}>
          <div className={s("chart-head")}>
            <div>
              <h3><i className="fa-solid fa-chart-line" /> Student Enrollment Growth</h3>
              <p>Monthly new admissions — last 6 months</p>
            </div>
          </div>
          <div className={s("chart-metrics")}>
            <div className={s("metric-card")}>
              <span>NEW THIS MONTH</span>
              <strong>{newThisMonth}</strong>
            </div>
            <div className={s("metric-card")}>
              <span>BEST MONTH</span>
              <strong style={{ color: "#2563eb" }}>{bestMonth?.month ?? "—"}</strong>
            </div>
            <div className={s("metric-card")}>
              <span>AVG MONTHLY</span>
              <strong>{avgMonthly}</strong>
            </div>
          </div>
          <div className={s("chart-body")}>
            <div className={s("chart-canvas")}>
              {admissionsMonthly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                  <AreaChart data={admissionsMonthly} margin={{ top: 10, right: 24, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="admFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.20} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }} interval={0} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }} allowDecimals={false} />
                    <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                    <Tooltip
                      cursor={{ stroke: "#2563eb", strokeWidth: 1, strokeDasharray: "3 3" }}
                      contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)", background: "#ffffff", fontSize: 12 }}
                      formatter={(v: any) => [v, "New Admissions"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="admissions"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 2, fill: "#ffffff", stroke: "#2563eb" }}
                      activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2, fill: "#2563eb" }}
                      fill="url(#admFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#94a3b8", fontSize:13, fontWeight:700 }}>
                  No admission data available yet
                </div>
              )}
            </div>
          </div>
        </article>

        {/* Notice board */}
        <article className={s("tbl-card")}>
          <div className={s("tbl-head")}>
            <h3><i className="fa-solid fa-bullhorn" /> Notice Board</h3>
            <a className={cx(s("btn"), s("btn-primary"), s("btn-sm"))} href="/notices">
              View All
            </a>
          </div>
          <div className={s("notice-list")}>
            {notices.length === 0 ? (
              <div style={{ padding:"28px 20px", textAlign:"center", color:"#bfd0d7", fontSize:13, fontWeight:700 }}>
                No active notices
              </div>
            ) : notices.map((n: any, i: number) => (
              <div className={s("notice-item")} key={n.id}>
                <div className={s("n-dot-wrap")}>
                  <div className={s("n-dot")} style={{ background: NOTICE_COLORS[i % NOTICE_COLORS.length] }} />
                </div>
                <div>
                  <h4>
                    {n.is_pinned && (
                      <i className="fa-solid fa-thumbtack" style={{ fontSize:10, color:"#f59e0b", marginRight:5 }} />
                    )}
                    {n.title}
                  </h4>
                  <p>{n.content.length > 90 ? n.content.slice(0, 90) + "…" : n.content}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
