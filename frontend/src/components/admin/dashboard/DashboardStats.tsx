"use client";

import styles from "@/app/(admin)/dashboard/dashboard.module.css";

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");
const s  = (className: string) => styles[className];

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);

const fmtShort = (n: number) => {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
};

interface Props { data: any }

export default function DashboardStats({ data }: Props) {
  const collectionRate = data.collectionRate ?? 0;
  const netBalanceSign = data.netBalance >= 0 ? "+" : "";

  const heroCards = [
    {
      icon: "fa-user-graduate",
      label: "Total Students",
      value: (data.totalStudents ?? 0).toLocaleString("en-IN"),
      helper: `+${data.newThisMonth ?? 0} new this month`,
      tone: "c1",
    },
    {
      icon: "fa-chalkboard-user",
      label: "Teachers / Faculty",
      value: data.totalTeachers ?? 0,
      helper: `${data.activeTeachers ?? 0} active`,
      tone: "c2",
    },
    {
      icon: "fa-circle-dollar-to-slot",
      label: "Fee Collected",
      value: fmtShort(data.totalCollected ?? 0),
      helper: `${collectionRate}% collection rate`,
      tone: "c3",
    },
    {
      icon: "fa-scale-balanced",
      label: "Net Balance",
      value: fmtShort(Math.abs(data.netBalance ?? 0)),
      helper: `${netBalanceSign}${fmtINR(data.netBalance ?? 0)} after expenses`,
      tone: "c4",
    },
  ];

  const secondaryCards = [
    {
      tone: "red",
      icon: "fa-clock-rotate-left",
      label: "Pending Fees",
      value: fmtShort(data.totalPending ?? 0),
      helper: `${data.pendingStudents ?? 0} students pending`,
      trend: "trend-down",
    },
    {
      tone: "purple",
      icon: "fa-receipt",
      label: "Monthly Expenses",
      value: fmtShort(data.totalExpenses ?? 0),
      helper: `${data.expenseCount ?? 0} transactions`,
      trend: "trend-down",
    },
    {
      tone: "teal",
      icon: "fa-money-bill-wave",
      label: "Salaries Paid",
      value: fmtShort(data.salaryPaidAmt ?? 0),
      helper: `${data.salaryPaidCount ?? 0} of ${data.salaryTotal ?? 0} staff`,
      trend: "trend-up",
    },
    {
      tone: "slate",
      icon: "fa-school",
      label: "Classes / Sections",
      value: data.totalClasses ?? 0,
      helper: `${data.totalSections ?? 0} sections total`,
      trend: undefined,
    },
  ];

  const quickActions = [
    ["/students", "fa-user-plus",          "Add Student",  "Enroll new student"    ],
    ["/teachers", "fa-user-tie",           "Add Teacher",  "Register faculty"      ],
    ["/fees",     "fa-hand-holding-dollar","Collect Fee",  "Record payment"        ],
    ["/expenses", "fa-file-invoice",       "Add Expense",  "Log campus expense"    ],
  ] as const;

  return (
    <>
      {/* ── Hero stat cards ── */}
      <section className={s("hero-cards")}>
        {heroCards.map((card) => (
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

      {/* ── Secondary cards ── */}
      <section className={s("sec-cards")}>
        {secondaryCards.map((card) => (
          <article className={s("sec-card")} key={card.label}>
            <div className={cx(s("sc-icon"), s(card.tone))}>
              <i className={`fa-solid ${card.icon}`} />
            </div>
            <div className={s("sc-info")}>
              <p>{card.label}</p>
              <h4>{card.value}</h4>
              <small className={card.trend ? s(card.trend) : undefined}>
                {card.helper}
              </small>
            </div>
          </article>
        ))}
      </section>

      {/* ── Quick actions ── */}
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
