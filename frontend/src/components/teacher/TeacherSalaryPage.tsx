"use client";

import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import Loader, { Spinner } from "@/components/shared/Loader";
import { useAppSelector } from "@/store/hooks";
import { useCurrency } from "@/lib/useCurrency";
import { useDateFormat } from "@/lib/useDateFormat";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS: Record<string, { bg: string; color: string; icon: string }> = {
  paid:      { bg: "#e2f6ee", color: "#12805c", icon: "fa-circle-check"  },
  pending:   { bg: "#fff1df", color: "#c46a14", icon: "fa-clock"         },
  cancelled: { bg: "#fde7e7", color: "#b42318", icon: "fa-circle-xmark"  },
};

export default function TeacherSalaryPage() {
  const { user }                                    = useAppSelector((s) => s.auth);
  const { fmt }                                     = useCurrency();
  const { formatDate }                              = useDateFormat();
  const { data: salaries, loading }                 = useApi<any[]>("/teachers/me/salary");

  const totalEarned = (salaries ?? [])
    .filter((s) => s.status === "paid")
    .reduce((acc, s) => acc + Number(s.net_salary || 0), 0);

  const pendingCount = (salaries ?? []).filter((s) => s.status === "pending").length;

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
      <Topbar title="My Salary" subtitle="Your monthly salary slips and deduction breakdown" />

      <main style={{ padding: "24px 28px 48px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Page head */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>My Salary</h1>
          <p style={{ color: "#6a7882", fontSize: 13, fontWeight: 700, marginTop: 4 }}>
            {user?.school_name ?? "Your School"} — salary history and deduction details
          </p>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {[
            { label: "Total Records",  value: salaries?.length ?? 0, color: "#1f2d36", bg: "#f8fafc", icon: "fa-receipt"        },
            { label: "Total Earned",   value: fmt(totalEarned),      color: "#12805c", bg: "#e2f6ee", icon: "fa-money-bill-wave" },
            { label: "Pending Months", value: pendingCount,           color: "#c46a14", bg: "#fff1df", icon: "fa-clock"          },
          ].map((c) => (
            <div key={c.label} style={{ padding: "18px 20px", borderRadius: 12, background: c.bg, border: "1px solid rgba(191,201,209,0.5)", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 8px rgba(31,45,54,.04)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: c.color, fontSize: 18, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
                <i className={`fa-solid ${c.icon}`} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 900, color: "#6a7882", margin: 0 }}>{c.label}</p>
                <strong style={{ fontSize: 20, fontWeight: 900, color: c.color }}>{c.value}</strong>
              </div>
            </div>
          ))}
        </div>

        {/* Salary slips */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", overflow: "hidden", boxShadow: "0 2px 8px rgba(31,45,54,.05)" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8eef0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Salary Slips</h2>
            <p style={{ fontSize: 12, color: "#6a7882", fontWeight: 700, marginTop: 3 }}>
              Click any record to see full earnings and deduction breakdown
            </p>
          </div>

          {loading ? (
            <Loader fullScreen={false} size="md" text="Loading salary records…" />
          ) : !salaries?.length ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#6a7882" }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: 32, display: "block", marginBottom: 12, opacity: 0.35 }} />
              <p style={{ fontWeight: 700, fontSize: 14 }}>No salary records found yet.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Your school admin will record salary payments here.</p>
            </div>
          ) : (
            <div>
              {salaries.map((rec) => {
                const st             = STATUS[rec.status] ?? STATUS.pending;
                const month          = MONTHS[(rec.month || 1) - 1];
                const hasDedBreakdown = Number(rec.tax_amount) > 0 || Number(rec.provident_fund) > 0 || Number(rec.other_deduction) > 0;
                const netSalary      = rec.net_salary ?? (Number(rec.basic_salary) + Number(rec.bonus || 0) - Number(rec.deduction || 0));

                return (
                  <details key={rec.id} style={{ borderBottom: "1px solid #f0f4f5" }}>
                    <summary style={{
                      listStyle: "none", cursor: "pointer",
                      display: "grid",
                      gridTemplateColumns: "140px 1fr 130px 130px 140px 36px",
                      alignItems: "center",
                      padding: "16px 20px",
                    }}>
                      {/* Month / Year */}
                      <div>
                        <strong style={{ fontSize: 14, fontWeight: 900, display: "block" }}>
                          {month} {rec.year}
                        </strong>
                        <span style={{ fontSize: 11, color: "#6a7882", fontWeight: 700 }}>
                          {rec.payment_date
                            ? `Paid ${formatDate(rec.payment_date)}`
                            : "Not paid yet"}
                        </span>
                      </div>

                      {/* Earnings overview */}
                      <div style={{ display: "flex", gap: 24 }}>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 900, color: "#6a7882", margin: 0 }}>BASIC</p>
                          <strong style={{ fontSize: 14 }}>{fmt(rec.basic_salary)}</strong>
                        </div>
                        {Number(rec.bonus) > 0 && (
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 900, color: "#6a7882", margin: 0 }}>BONUS</p>
                            <strong style={{ fontSize: 14, color: "#12805c" }}>+{fmt(rec.bonus)}</strong>
                          </div>
                        )}
                        {Number(rec.deduction) > 0 && (
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 900, color: "#6a7882", margin: 0 }}>DEDUCTION</p>
                            <strong style={{ fontSize: 14, color: "#b42318" }}>-{fmt(rec.deduction)}</strong>
                          </div>
                        )}
                      </div>

                      {/* Net salary */}
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 10, fontWeight: 900, color: "#6a7882", margin: 0 }}>NET SALARY</p>
                        <strong style={{ fontSize: 16, fontWeight: 900, color: "#12805c" }}>{fmt(netSalary)}</strong>
                      </div>

                      {/* Payment method */}
                      <div style={{ textAlign: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "capitalize" }}>
                          {rec.payment_method?.replace(/_/g, " ") || "—"}
                        </span>
                      </div>

                      {/* Status badge */}
                      <div style={{ textAlign: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 900, padding: "4px 12px", borderRadius: 999, background: st.bg, color: st.color, textTransform: "capitalize", whiteSpace: "nowrap" }}>
                          <i className={`fa-solid ${st.icon}`} style={{ marginRight: 5 }} />
                          {rec.status}
                        </span>
                      </div>

                      {/* Chevron */}
                      <div style={{ textAlign: "center", color: "#94a3b8" }}>
                        <i className="fa-solid fa-chevron-down" style={{ fontSize: 12 }} />
                      </div>
                    </summary>

                    {/* ── Expanded detail ── */}
                    <div style={{ padding: "0 20px 20px", background: "#fafbff", borderTop: "1px solid #eef2f3" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>

                        {/* Earnings card */}
                        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8eef0", overflow: "hidden" }}>
                          <div style={{ padding: "12px 16px", background: "#e2f6ee", borderBottom: "1px solid #bee8d6" }}>
                            <strong style={{ fontSize: 13, fontWeight: 900, color: "#12805c" }}>
                              <i className="fa-solid fa-arrow-up" style={{ marginRight: 6 }} />Earnings
                            </strong>
                          </div>
                          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                            {[
                              ["Basic Salary",       fmt(rec.basic_salary)],
                              ["Bonus / Allowance",  fmt(rec.bonus || 0)  ],
                            ].map(([label, val]) => (
                              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                <span style={{ color: "#6a7882", fontWeight: 700 }}>{label}</span>
                                <strong>{val}</strong>
                              </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, borderTop: "1px solid #eee", paddingTop: 8, marginTop: 4 }}>
                              <span style={{ fontWeight: 900 }}>Gross</span>
                              <strong style={{ color: "#12805c" }}>{fmt(Number(rec.basic_salary) + Number(rec.bonus || 0))}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Deductions card */}
                        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8eef0", overflow: "hidden" }}>
                          <div style={{ padding: "12px 16px", background: "#fde7e7", borderBottom: "1px solid #fca5a5" }}>
                            <strong style={{ fontSize: 13, fontWeight: 900, color: "#b42318" }}>
                              <i className="fa-solid fa-arrow-down" style={{ marginRight: 6 }} />Deductions
                            </strong>
                          </div>
                          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                            {hasDedBreakdown ? (
                              <>
                                {[
                                  ["Tax / TDS",       fmt(rec.tax_amount      || 0)],
                                  ["Provident Fund",  fmt(rec.provident_fund  || 0)],
                                  ["Other Deduction", fmt(rec.other_deduction || 0)],
                                ].map(([label, val]) => (
                                  <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                    <span style={{ color: "#6a7882", fontWeight: 700 }}>{label}</span>
                                    <strong style={{ color: "#b42318" }}>{val}</strong>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                <span style={{ color: "#6a7882", fontWeight: 700 }}>Total Deduction</span>
                                <strong style={{ color: "#b42318" }}>{fmt(rec.deduction || 0)}</strong>
                              </div>
                            )}
                            {rec.deduction_remarks && (
                              <p style={{ fontSize: 11, color: "#6a7882", fontWeight: 700, background: "#f8fafc", padding: "6px 10px", borderRadius: 6, marginTop: 4 }}>
                                <i className="fa-solid fa-note-sticky" style={{ marginRight: 5 }} />
                                {rec.deduction_remarks}
                              </p>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, borderTop: "1px solid #eee", paddingTop: 8, marginTop: 4 }}>
                              <span style={{ fontWeight: 900 }}>Total Deducted</span>
                              <strong style={{ color: "#b42318" }}>-{fmt(rec.deduction || 0)}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Net pay banner */}
                      <div style={{ marginTop: 14, padding: "16px 20px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", margin: 0 }}>NET SALARY PAYABLE</p>
                          <strong style={{ fontSize: 24, fontWeight: 900, color: "#12805c" }}>{fmt(netSalary)}</strong>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 11, fontWeight: 900, color: "#6a7882", margin: 0 }}>Payment Method</p>
                          <strong style={{ textTransform: "capitalize", fontSize: 13 }}>
                            {rec.payment_method?.replace(/_/g, " ") || "Not specified"}
                          </strong>
                          {rec.payment_date && (
                            <p style={{ fontSize: 11, color: "#6a7882", fontWeight: 700, marginTop: 3 }}>
                              {formatDate(rec.payment_date)}
                            </p>
                          )}
                        </div>
                      </div>

                      {rec.remarks && (
                        <p style={{ fontSize: 12, color: "#6a7882", fontWeight: 700, marginTop: 10, padding: "8px 12px", background: "#f8fafc", borderRadius: 7, border: "1px solid #e8eef0" }}>
                          <i className="fa-solid fa-comment" style={{ marginRight: 6 }} />{rec.remarks}
                        </p>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
