"use client";

import Link from "next/link";
import styles from "@/app/(admin)/dashboard/dashboard.module.css";
import { useCurrency } from "@/lib/useCurrency";
import type { DashboardData } from "@/types/dashboard.types";

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");
const s  = (className: string) => styles[className];

interface Props { data: DashboardData }

export default function DashboardStats({ data }: Props) {
  const { symbol: currSymbol, fmt, fmtShort: currencyShort } = useCurrency();
  const sym = data?.currencySymbol || currSymbol || "रू";

  const fmtShort = (n: number) => currencyShort(n, sym);
  const fmtFull  = (n: number) => fmt(n, sym);

  const collectionRate = data.collectionRate ?? 0;
  const netBalanceSign = (data.netBalance ?? 0) >= 0 ? "+" : "";

  const heroCards = [
    {
      icon: "fa-user-graduate",
      label: "Total Students",
      value: (data.totalStudents ?? 0).toLocaleString("en-IN"),
      helper: `+${data.newThisMonth ?? 0} this month`,
      tone: "blue",
      tag: "Enrolled",
    },
    {
      icon: "fa-chalkboard-user",
      label: "Teachers / Faculty",
      value: data.totalTeachers ?? 0,
      helper: `${data.activeTeachers ?? 0} active`,
      tone: "emerald",
      tag: "Faculty",
    },
    {
      icon: "fa-circle-dollar-to-slot",
      label: "Fee Collected",
      value: fmtShort(data.totalCollected ?? 0),
      helper: `${collectionRate}% collected`,
      tone: "amber",
      tag: `${collectionRate}% rate`,
    },
    {
      icon: "fa-scale-balanced",
      label: "Net Balance",
      value: fmtShort(Math.abs(data.netBalance ?? 0)),
      helper: `${netBalanceSign}${fmtFull(data.netBalance ?? 0)}`,
      tone: "indigo",
      tag: data.netBalance >= 0 ? "Surplus" : "Deficit",
    },
  ];

  const secondaryCards = [
    {
      tone: "rose",
      icon: "fa-clock-rotate-left",
      label: "Pending Fees",
      value: fmtShort(data.totalPending ?? 0),
      helper: data.pendingBills && data.pendingBills !== data.pendingStudents
        ? `${data.pendingStudents ?? 0} students pending (${data.pendingBills} bills)`
        : `${data.pendingStudents ?? 0} students pending`,
      trend: "trend-down",
    },
    {
      tone: "violet",
      icon: "fa-receipt",
      label: "Monthly Expenses",
      value: fmtShort(data.totalExpenses ?? 0),
      helper: `${data.expenseCount ?? 0} transactions`,
      trend: undefined,
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
      label: "Classes & Sections",
      value: data.totalClasses ?? 0,
      helper: `${data.totalSections ?? 0} active sections`,
      trend: undefined,
    },
  ];

  const quickActions = [
    ["/students", "fa-user-plus",           "Add Student",  "Enroll new student"    ],
    ["/teachers", "fa-user-tie",            "Add Teacher",  "Register faculty"      ],
    ["/fees",     "fa-hand-holding-dollar", "Collect Fee",  "Record payment"        ],
    ["/expenses", "fa-file-invoice",        "Add Expense",  "Log campus expense"    ],
  ] as const;

  return (
    <>
      {/* ── Executive Hero Metric Cards ── */}
      <section className={s("hero-cards")}>
        {heroCards.map((card) => (
          <article className={s("hero-card")} key={card.label}>
            <div className={s("hc-top")}>
              <span className={s("hc-label")}>{card.label}</span>
              <span className={cx(s("hc-icon"), s(card.tone))}>
                <i className={`fa-solid ${card.icon}`} />
              </span>
            </div>
            <div className={s("hc-value")}>{card.value}</div>
            <div className={s("hc-sub")}>
              <span className={cx(s("pill-tag"), s(`pill-${card.tone}`))}>
                {card.tag}
              </span>
              <span className={s("hc-helper")}>{card.helper}</span>
            </div>
          </article>
        ))}
      </section>

      {/* ── Secondary Metric Cards ── */}
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

      {/* ── Quick Actions ── */}
      <section className={s("quick-row")}>
        {quickActions.map(([href, icon, title, subtitle]) => (
          <Link className={s("qa-btn")} href={href} key={title}>
            <div className={s("qa-ico")}>
              <i className={`fa-solid ${icon}`} />
            </div>
            <div className={s("qa-text")}>
              <p>{title}</p>
              <span>{subtitle}</span>
            </div>
            <i className={`fa-solid fa-chevron-right ${s("qa-arrow")}`} />
          </Link>
        ))}
      </section>
    </>
  );
}
