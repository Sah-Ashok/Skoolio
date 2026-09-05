"use client";

import styles from "@/app/(admin)/dashboard/dashboard.module.css";
import { useCurrency } from "@/lib/useCurrency";

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");
const s  = (n: string) => styles[n];

const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

interface Props { data: any }

export default function DashboardTables({ data }: Props) {
  const { symbol: currSymbol } = useCurrency();
  const sym = data?.currencySymbol || currSymbol || "रू";

  const fmtCurrency = (n: number) =>
    `${sym}${Number(n || 0).toLocaleString("en-IN")}`;

  const fmtShort = (n: number) => {
    if (n >= 100_000) return `${sym}${(n / 100_000).toFixed(1)}L`;
    if (n >= 1_000)   return `${sym}${(n / 1_000).toFixed(1)}K`;
    return `${sym}${Number(n || 0).toLocaleString("en-IN")}`;
  };

  const recentStudents: any[] = data.recentStudents ?? [];
  const recentExpenses: any[] = data.recentExpenses ?? [];
  const recentSalaries: any[] = data.recentSalaries ?? [];

  const totalAssigned    = data.totalAssigned    ?? 0;
  const totalCollected   = data.totalCollected   ?? 0;
  const totalPending     = data.totalPending     ?? 0;
  const overdueAmount    = data.overdueAmount    ?? 0;
  const collectionRate   = data.collectionRate   ?? 0;
  const overdueRate      = totalAssigned > 0
    ? Math.round((overdueAmount / totalAssigned) * 100) : 0;

  const salaryPaidCount  = data.salaryPaidCount  ?? 0;
  const salaryTotal      = data.salaryTotal      ?? 0;
  const salaryPaidAmt    = data.salaryPaidAmt    ?? 0;
  const salaryPct        = salaryTotal > 0
    ? Math.round((salaryPaidCount / salaryTotal) * 100) : 0;

  return (
    <>
      {/* ── Recent Students + Fee Overview ── */}
      <section className={s("data-row")}>

        {/* Recent students table */}
        <article className={s("tbl-card")}>
          <div className={s("tbl-head")}>
            <h3><i className="fa-solid fa-user-graduate" /> Recent Students</h3>
            <a href="/students" className={cx(s("btn"), s("btn-ghost"), s("btn-sm"))}>
              View All
            </a>
          </div>
          {recentStudents.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center", color:"#bfd0d7", fontSize:13, fontWeight:700 }}>
              No students enrolled yet
            </div>
          ) : (
            <table className={s("table")}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class / Section</th>
                  <th>Roll</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recentStudents.map((st: any) => (
                  <tr key={st.id}>
                    <td>
                      <div className={s("av-row")}>
                        <div className={s("av")}>{initials(st.full_name)}</div>
                        <div>
                          <div className={s("name")}>{st.full_name}</div>
                          <div className={s("sub")}>{st.email || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {st.class_name
                        ? `${st.class_name}${st.section_name ? ` – ${st.section_name}` : ""}`
                        : "—"}
                    </td>
                    <td>{st.roll_number || "—"}</td>
                    <td>
                      <span className={cx(s("badge"), st.status === "active" ? s("b-green") : s("b-yellow"))}>
                        {st.status}
                      </span>
                    </td>
                    <td>
                      <a href={`/students/${st.id}`} className={cx(s("btn"), s("btn-ghost"), s("btn-sm"))}>
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        {/* Fee overview panel */}
        <article className={s("fee-panel")}>
          <div className={s("fee-panel-head")}>
            <h3><i className="fa-solid fa-circle-dollar-to-slot" /> Fee Overview</h3>
            <span className={cx(s("badge"), s("b-indigo"))}>
              {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </span>
          </div>
          <div className={s("fee-body")}>
            {[
              ["Total Assigned", fmtCurrency(totalAssigned),  undefined],
              ["Collected",      fmtCurrency(totalCollected), "text-success"],
              ["Pending",        fmtCurrency(totalPending),   "text-danger"],
              ["Overdue (>30d)", fmtCurrency(overdueAmount),  "text-warning"],
            ].map(([label, value, tone]) => (
              <div className={s("fee-item")} key={label}>
                <div className={s("fee-lbl")}>{label}</div>
                <div className={cx(s("fee-val"), tone ? s(tone) : undefined)}>{value}</div>
              </div>
            ))}

            {/* Collection rate bar */}
            <div className={s("prog-wrap")}>
              <div className={s("prog-label")}>
                <span>Collection Rate</span>
                <span>{collectionRate}%</span>
              </div>
              <div className={s("prog-bar")}>
                <div className={s("prog-fill")} style={{ width: `${collectionRate}%` }} />
              </div>
            </div>

            {/* Overdue rate bar */}
            <div className={s("prog-wrap")}>
              <div className={s("prog-label")}>
                <span>Overdue Rate</span>
                <span className={s("text-danger")}>{overdueRate}%</span>
              </div>
              <div className={s("prog-bar")}>
                <div className={cx(s("prog-fill"), s("danger-fill"))} style={{ width: `${overdueRate}%` }} />
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* ── Recent Expenses + Salary Status ── */}
      <section className={s("data-row")}>

        {/* Recent expenses table */}
        <article className={s("tbl-card")}>
          <div className={s("tbl-head")}>
            <h3><i className="fa-solid fa-wallet" /> Recent Expenses</h3>
            <a href="/expenses" className={cx(s("btn"), s("btn-ghost"), s("btn-sm"))}>
              View All
            </a>
          </div>
          {recentExpenses.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center", color:"#bfd0d7", fontSize:13, fontWeight:700 }}>
              No expenses recorded this month
            </div>
          ) : (
            <table className={s("table")}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((ex: any) => (
                  <tr key={ex.id}>
                    <td className={s("strong-cell")}>{ex.title}</td>
                    <td>
                      <span className={cx(s("badge"), s("b-orange"))}>
                        {ex.category_name || "Other"}
                      </span>
                    </td>
                    <td className={s("strong-cell")}>{fmtCurrency(Number(ex.amount))}</td>
                    <td className={s("muted-cell")}>{fmtDate(ex.expense_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        {/* Salary status panel */}
        <article className={s("fee-panel")}>
          <div className={s("fee-panel-head")}>
            <h3><i className="fa-solid fa-money-bill-wave" /> Salary Status</h3>
            <span className={cx(s("badge"), s("b-teal"))}>
              {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </span>
          </div>
          <div className={s("fee-body")}>
            {recentSalaries.length === 0 ? (
              <div style={{ padding:"20px 0", textAlign:"center", color:"#bfd0d7", fontSize:13, fontWeight:700 }}>
                No salary records this month
              </div>
            ) : (
              <ul className={s("sal-list")}>
                {recentSalaries.map((sal: any) => (
                  <li className={s("sal-item")} key={sal.id}>
                    <div className={s("av-row")}>
                      <div className={s("av")}>{initials(sal.full_name)}</div>
                      <div>
                        <div className={s("name")}>{sal.full_name}</div>
                        <div className={s("sub")}>{fmtCurrency(Number(sal.net_salary))}</div>
                      </div>
                    </div>
                    <span className={cx(s("badge"), sal.status === "paid" ? s("b-green") : s("b-red"))}>
                      {sal.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Salary disbursement bar */}
            <div className={s("prog-wrap")}>
              <div className={s("prog-label")}>
                <span>Salary Disbursed</span>
                <span>{salaryPaidCount} / {salaryTotal || "—"}</span>
              </div>
              <div className={s("prog-bar")}>
                <div className={cx(s("prog-fill"), s("salary-fill"))} style={{ width: `${salaryPct}%` }} />
              </div>
            </div>

            {/* Paid amount summary */}
            <div className={s("fee-item")} style={{ marginTop: 8 }}>
              <div className={s("fee-lbl")}>Total Paid Out</div>
              <div className={cx(s("fee-val"), s("text-success"))}>{fmtShort(salaryPaidAmt)}</div>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
