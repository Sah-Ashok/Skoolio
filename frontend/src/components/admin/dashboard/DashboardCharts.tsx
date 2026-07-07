"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "@/app/(admin)/dashboard/dashboard.module.css";

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");
const s = (className: string) => styles[className];
const formatMoneyTooltip = (value: unknown, name: unknown) => [`₹${Number(value ?? 0)}K`, String(name ?? "")];
const formatPercentTooltip = (value: unknown, name: unknown) => [`${Number(value ?? 0)}%`, String(name ?? "")];
const formatAdmissionsTooltip = (value: unknown) => [String(value ?? 0), "New admissions"];

const feeCollectionData = [
  { month: "Jan", collected: 380, pending: 80 },
  { month: "Feb", collected: 420, pending: 60 },
  { month: "Mar", collected: 390, pending: 100 },
  { month: "Apr", collected: 450, pending: 70 },
  { month: "May", collected: 410, pending: 90 },
  { month: "Jun", collected: 420, pending: 180 },
];

const expenseBreakdownData = [
  { name: "Salary", value: 55, color: "#25343f" },
  { name: "Utilities", value: 15, color: "#ff9b51" },
  { name: "Supplies", value: 12, color: "#14b8a6" },
  { name: "Maint.", value: 10, color: "#f43f5e" },
  { name: "Other", value: 8, color: "#3b82f6" },
];

const enrollmentData = [
  { month: "Jan", admissions: 24 },
  { month: "Feb", admissions: 38 },
  { month: "Mar", admissions: 29 },
  { month: "Apr", admissions: 45 },
  { month: "May", admissions: 52 },
  { month: "Jun", admissions: 12 },
];

const notices = [
  ["#6366f1", "Annual Sports Day - June 20", "All students must participate. PT teachers to coordinate."],
  ["#f97316", "Fee Due Reminder", "Last date for June fee payment is June 15."],
  ["#22c55e", "Mid-Term Exam Schedule", "Exams start July 1. Timetable shared with teachers."],
  ["#ef4444", "Staff Meeting - June 12", "Mandatory for all teaching staff. 4:00 PM in hall."],
];

export default function DashboardCharts() {
  return (
    <>
      <section className={s("chart-row")}>
        <article className={s("chart-card")}>
          <div className={s("chart-head")}>
            <div>
              <h3>
                <i className="fa-solid fa-chart-column" /> Fee Collection Overview
              </h3>
              <p>Monthly collected vs pending - 2025</p>
            </div>
            <select className={s("chart-select")} defaultValue="2025">
              <option>2025</option>
              <option>2024</option>
            </select>
          </div>
          <div className={s("chart-metrics")}>
            <div className={s("metric-card")}>
              <span>Collected</span>
              <strong>₹4.2L</strong>
            </div>
            <div className={s("metric-card")}>
              <span>Pending</span>
              <strong>₹1.8L</strong>
            </div>
            <div className={s("metric-card")}>
              <span>Collection Rate</span>
              <strong>70%</strong>
            </div>
          </div>
          <div className={s("chart-body")}>
            <div className={s("chart-canvas")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feeCollectionData} barGap={7} barCategoryGap="26%" margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#6b7b86", fontSize: 11 }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7b86", fontSize: 11 }}
                    tickFormatter={(value) => `₹${value}K`}
                  />
                  <CartesianGrid vertical={false} stroke="#e6ecec" strokeDasharray="4 6" />
                  <Tooltip
                    cursor={{ fill: "rgba(255,155,81,0.08)" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #d7dfdf", boxShadow: "0 12px 30px rgba(37,52,63,0.12)" }}
                    formatter={formatMoneyTooltip}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="collected" name="Collected" fill="#ff9b51" radius={[8, 8, 3, 3]} maxBarSize={24} />
                  <Bar dataKey="pending" name="Pending" fill="#bfd0d7" radius={[8, 8, 3, 3]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </article>

        <article className={s("chart-card")}>
          <div className={s("chart-head")}>
            <div>
              <h3>
                <i className="fa-solid fa-chart-pie" /> Expense Breakdown
              </h3>
              <p>By category - June 2025</p>
            </div>
          </div>
          <div className={cx(s("chart-body"), s("expense-breakdown"))}>
            <div className={s("chart-metrics")}>
              <div className={s("metric-card")}>
                <span>Largest</span>
                <strong>Salary 55%</strong>
              </div>
              <div className={s("metric-card")}>
                <span>Total Spend</span>
                <strong>₹92K</strong>
              </div>
            </div>
            <div className={s("donut-wrap")}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdownData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={78}
                    paddingAngle={3}
                    cornerRadius={6}
                  >
                    {expenseBreakdownData.map((entry) => (
                      <Cell fill={entry.color} key={entry.name} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #d7dfdf", boxShadow: "0 12px 30px rgba(37,52,63,0.12)" }}
                    formatter={formatPercentTooltip}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className={s("donut-center")}>
                <strong>₹92K</strong>
                <span>Total</span>
              </div>
            </div>
            <div className={s("legend-grid")}>
              {expenseBreakdownData.map((item) => (
                <div className={s("legend-item")} key={item.name}>
                  <span style={{ background: item.color }} />
                  {item.name} {item.value}%
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className={s("bottom-row")}>
        <article className={s("chart-card")}>
          <div className={s("chart-head")}>
            <div>
              <h3>
                <i className="fa-solid fa-chart-line" /> Student Enrollment Growth
              </h3>
              <p>Monthly new admissions - 2025</p>
            </div>
          </div>
          <div className={s("chart-metrics")}>
            <div className={s("metric-card")}>
              <span>New This Month</span>
              <strong>12</strong>
            </div>
            <div className={s("metric-card")}>
              <span>Best Month</span>
              <strong>May</strong>
            </div>
            <div className={s("metric-card")}>
              <span>Avg Monthly</span>
              <strong>33</strong>
            </div>
          </div>
          <div className={s("chart-body")}>
            <div className={s("chart-canvas")}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={enrollmentData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="admissionsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#6b7b86", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7b86", fontSize: 11 }} />
                  <CartesianGrid vertical={false} stroke="#e6ecec" strokeDasharray="4 6" />
                  <Tooltip
                    cursor={{ stroke: "#ff9b51", strokeWidth: 1, strokeDasharray: "4 4" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #d7dfdf", boxShadow: "0 12px 30px rgba(37,52,63,0.12)" }}
                    formatter={formatAdmissionsTooltip}
                  />
                  <Area
                    type="monotone"
                    dataKey="admissions"
                    stroke="#14b8a6"
                    strokeWidth={3}
                    dot={{ r: 3, strokeWidth: 2, fill: "#ffffff" }}
                    activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
                    fill="url(#admissionsFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </article>

        <article className={s("tbl-card")}>
          <div className={s("tbl-head")}>
            <h3>
              <i className="fa-solid fa-bullhorn" /> Notice Board
            </h3>
            <a className={cx(s("btn"), s("btn-primary"), s("btn-sm"))}>Add</a>
          </div>
          <div className={s("notice-list")}>
            {notices.map(([color, title, text]) => (
              <div className={s("notice-item")} key={title}>
                <div className={s("n-dot-wrap")}>
                  <div className={s("n-dot")} style={{ background: color }} />
                </div>
                <div>
                  <h4>{title}</h4>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
