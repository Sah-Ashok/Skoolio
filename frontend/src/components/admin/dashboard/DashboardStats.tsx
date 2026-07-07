"use client";

import styles from "@/app/(admin)/dashboard/dashboard.module.css";

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");
const s = (className: string) => styles[className];

const statCards = [
  {
    icon: "fa-user-graduate",
    label: "Total Students",
    value: "1,284",
    helper: "+12 new this month",
    tone: "c1",
  },
  {
    icon: "fa-chalkboard-user",
    label: "Teachers / Faculty",
    value: "48",
    helper: "44 salary paid",
    tone: "c2",
  },
  {
    icon: "fa-circle-dollar-to-slot",
    label: "Fee Collected",
    value: "₹4.2L",
    helper: "70% collection rate",
    tone: "c3",
  },
  {
    icon: "fa-scale-balanced",
    label: "Net Balance",
    value: "₹1.0L",
    helper: "After all expenses",
    tone: "c4",
  },
];

const secondaryCards = [
  ["red", "fa-clock-rotate-left", "Pending Fees", "₹1.8L", "143 students", "trend-down"],
  ["purple", "fa-receipt", "Total Expenses", "₹92K", "This month", "trend-down"],
  ["teal", "fa-money-bill-wave", "Salaries Paid", "₹3.1L", "44 of 48 staff", "trend-up"],
  ["slate", "fa-school", "Total Classes / Courses", "24", "12 grades | 2 sections", undefined],
];

const quickActions = [
  ["/students", "fa-user-plus", "Add Student", "Enroll new student"],
  ["/teachers", "fa-user-tie", "Add Teacher", "Register teacher or faculty"],
  ["/fees", "fa-hand-holding-dollar", "Collect Fee", "Record payment"],
  ["/expenses", "fa-file-invoice", "Add Expense", "Log campus expense"],
];

export default function DashboardStats() {
  return (
    <>
      <section className={s("hero-cards")}>
        {statCards.map((card) => (
          <article className={cx(s("hero-card"), s(card.tone))} key={card.label}>
            <div className={s("hc-icon")}>
              <i className={`fa-solid ${card.icon}`} />
            </div>
            <div className={s("hc-label")}>{card.label}</div>
            <div className={s("hc-value")}>{card.value}</div>
            <div className={s("hc-sub")}>{card.helper}</div>
          </article>
        ))}
      </section>

      <section className={s("sec-cards")}>
        {secondaryCards.map(([tone, icon, label, value, helper, trend]) => (
          <article className={s("sec-card")} key={label}>
            <div className={cx(s("sc-icon"), s(tone ?? ""))}>
              <i className={`fa-solid ${icon}`} />
            </div>
            <div className={s("sc-info")}>
              <p>{label}</p>
              <h4>{value}</h4>
              <small className={trend ? s(trend) : undefined}>{helper}</small>
            </div>
          </article>
        ))}
      </section>

      <section className={s("quick-row")}>
        {quickActions.map(([href, icon, title, subtitle]) => (
          <a className={s("qa-btn")} href={href} key={title}>
            <div className={s("qa-ico")}>
              <i className={`fa-solid ${icon}`} />
            </div>
            <div className={s("qa-text")}>
              <p>{title}</p>
              <span>{subtitle}</span>
            </div>
          </a>
        ))}
      </section>
    </>
  );
}
