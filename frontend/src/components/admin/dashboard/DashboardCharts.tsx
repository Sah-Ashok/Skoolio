"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import styles from "@/app/(admin)/dashboard/dashboard.module.css";

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");
const s  = (n: string) => styles[n];

const fmtShort = (n: number) => {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
};

const PIE_COLORS = ["#25343f","#ff9b51","#14b8a6","#f43f5e","#3b82f6","#a855f7"];

interface Props { data: any }

export default function DashboardCharts({ data }: Props) {
  const feeMonthly:        any[] = data.feeMonthly        ?? [];
  const admissionsMonthly: any[] = data.admissionsMonthly ?? [];
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

  const noticeColors = ["#6366f1","#f97316","#22c55e","#ef4444","#14b8a6","#3b82f6"];

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
              <span>Collected</span>
              <strong>{fmtShort(totalCollected)}</strong>
            </div>
            <div className={s("metric-card")}>
              <span>Pending</span>
              <strong>{fmtShort(totalPending)}</strong>
            </div>
            <div className={s("metric-card")}>
              <span>Collection Rate</span>
              <strong>{collectionRate}%</strong>
            </div>
          </div>
          <div className={s("chart-body")}>
            <div className={s("chart-canvas")}>
              {feeMonthly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={feeMonthly}
                    barGap={7}
                    barCategoryGap="26%"
                    margin={{ top: 6, right: 12, left: -8, bottom: 0 }}
                  >
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#6b7b86", fontSize: 11 }} />
                    <YAxis
                      axisLine={false} tickLine={false}
                      tick={{ fill: "#6b7b86", fontSize: 11 }}
                      tickFormatter={(v) => `₹${v}K`}
                    />
                    <CartesianGrid vertical={false} stroke="#e6ecec" strokeDasharray="4 6" />
                    <Tooltip
                      cursor={{ fill: "rgba(255,155,81,0.08)" }}
                      contentStyle={{ borderRadius: 12, border: "1px solid #d7dfdf", boxShadow: "0 12px 30px rgba(37,52,63,0.12)" }}
                      formatter={(v: any, n: any) => [`₹${v}K`, n]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="collected" name="Collected" fill="#ff9b51" radius={[8,8,3,3]} maxBarSize={24} />
                    <Bar dataKey="pending"   name="Pending"   fill="#bfd0d7" radius={[8,8,3,3]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#bfd0d7", fontSize:13, fontWeight:700 }}>
                  No fee data yet
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
                <span>Largest</span>
                <strong>{largestCat ? `${largestCat.name} ${largestCat.value}%` : "—"}</strong>
              </div>
              <div className={s("metric-card")}>
                <span>Total Spend</span>
                <strong>{fmtShort(totalExpenses)}</strong>
              </div>
            </div>
            {expenseBreakdown.length > 0 ? (
              <>
                <div className={s("donut-wrap")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={54}
                        outerRadius={78}
                        paddingAngle={3}
                        cornerRadius={6}
                      >
                        {expenseBreakdown.map((e: any) => (
                          <Cell fill={e.color} key={e.name} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #d7dfdf", boxShadow: "0 12px 30px rgba(37,52,63,0.12)" }}
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
              <div style={{ padding:"32px 0", textAlign:"center", color:"#bfd0d7", fontSize:13, fontWeight:700 }}>
                No expense data this month
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
              <span>New This Month</span>
              <strong>{newThisMonth}</strong>
            </div>
            <div className={s("metric-card")}>
              <span>Best Month</span>
              <strong>{bestMonth?.month ?? "—"}</strong>
            </div>
            <div className={s("metric-card")}>
              <span>Avg Monthly</span>
              <strong>{avgMonthly}</strong>
            </div>
          </div>
          <div className={s("chart-body")}>
            <div className={s("chart-canvas")}>
              {admissionsMonthly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={admissionsMonthly} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="admFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#14b8a6" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#6b7b86", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7b86", fontSize: 11 }} allowDecimals={false} />
                    <CartesianGrid vertical={false} stroke="#e6ecec" strokeDasharray="4 6" />
                    <Tooltip
                      cursor={{ stroke: "#ff9b51", strokeWidth: 1, strokeDasharray: "4 4" }}
                      contentStyle={{ borderRadius: 12, border: "1px solid #d7dfdf", boxShadow: "0 12px 30px rgba(37,52,63,0.12)" }}
                      formatter={(v: any) => [v, "New admissions"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="admissions"
                      stroke="#14b8a6"
                      strokeWidth={3}
                      dot={{ r: 3, strokeWidth: 2, fill: "#ffffff" }}
                      activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
                      fill="url(#admFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#bfd0d7", fontSize:13, fontWeight:700 }}>
                  No admission data yet
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
                  <div className={s("n-dot")} style={{ background: noticeColors[i % noticeColors.length] }} />
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
