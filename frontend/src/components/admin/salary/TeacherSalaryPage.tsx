"use client";

import { useState, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "@/components/admin/salary/salary.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const s  = (name: string) => styles[name] || name;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const fmt = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);

const statusStyle: Record<string, { bg: string; color: string }> = {
  paid:      { bg: "#e2f6ee", color: "#12805c" },
  pending:   { bg: "#fff1df", color: "#a85f12" },
  cancelled: { bg: "#fde7e7", color: "#b42318" },
};

const methodLabel: Record<string, string> = {
  cash:          "Cash",
  bank_transfer: "Bank Transfer",
  cheque:        "Cheque",
};

type Salary = {
  id: number;
  basic_salary: number;
  bonus: number;
  deduction: number;
  net_salary: number;
  month: number;
  year: number;
  payment_date: string | null;
  payment_method: string | null;
  status: "paid" | "pending" | "cancelled";
  remarks: string | null;
  academic_year_id: number;
};

// ── Salary Slip modal ─────────────────────────────────────────────────────────
function SalarySlipModal({ salary, onClose }: { salary: Salary; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 90, padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
          boxShadow: "0 24px 64px rgba(15,23,42,0.22)", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e1e8eb" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#ff9b51", textTransform: "uppercase", letterSpacing: 1 }}>
                Salary Slip
              </p>
              <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 900 }}>
                {MONTHS[salary.month - 1]} {salary.year}
              </h2>
            </div>
            <span
              style={{
                padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 900,
                background: statusStyle[salary.status]?.bg ?? "#e5ebee",
                color: statusStyle[salary.status]?.color ?? "#6a7882",
              }}
            >
              {salary.status.charAt(0).toUpperCase() + salary.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Breakdown rows */}
        <div style={{ padding: "18px 24px" }}>
          {/* Earnings */}
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 1 }}>
            Earnings
          </p>
          {[
            { label: "Basic Salary",  value: salary.basic_salary, color: "#1f2d36" },
            { label: "Bonus / Allow", value: salary.bonus,        color: "#12805c" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #f0f4f6" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#6a7882" }}>{label}</span>
              <strong style={{ fontSize: 13, fontWeight: 900, color }}>{fmt(value)}</strong>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: "#1f2d36" }}>Gross Earnings</span>
            <strong style={{ fontSize: 14, fontWeight: 900, color: "#3b5bdb" }}>
              {fmt(Number(salary.basic_salary) + Number(salary.bonus))}
            </strong>
          </div>

          {/* Deductions */}
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 1 }}>
            Deductions
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #f0f4f6" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#6a7882" }}>Total Deduction</span>
            <strong style={{ fontSize: 13, fontWeight: 900, color: "#b42318" }}>– {fmt(salary.deduction)}</strong>
          </div>

          {/* Net */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", marginTop: 14, borderRadius: 10, background: "#f6fdf9", border: "1px solid #bee8d6" }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#12805c" }}>Net Salary</span>
            <strong style={{ fontSize: 18, fontWeight: 900, color: "#12805c" }}>{fmt(salary.net_salary)}</strong>
          </div>

          {/* Payment info */}
          {salary.status === "paid" && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Payment Date",   value: salary.payment_date ? new Date(salary.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
                { label: "Payment Method", value: salary.payment_method ? methodLabel[salary.payment_method] ?? salary.payment_method : "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: "12px", border: "1px solid #dce5e9", borderRadius: 9, background: "#f8fbfc" }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#6a7882" }}>{label}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 900, color: "#1f2d36" }}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Remarks */}
          {salary.remarks && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 9, background: "#fff8f2", border: "1px solid #fdd5b0" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#c46a14" }}>Admin Remarks</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#1f2d36", fontWeight: 700 }}>{salary.remarks}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #e1e8eb", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              minHeight: 38, padding: "8px 20px", border: "1px solid #c6d0d7",
              borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 900,
              color: "#1f2d36", cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherSalaryPage() {
  const { data: salaries, loading } = useApi<Salary[]>("/teachers/me/salary");
  const [selected, setSelected] = useState<Salary | null>(null);

  const sorted = useMemo(
    () => [...(salaries ?? [])].sort((a, b) => b.year - a.year || b.month - a.month),
    [salaries]
  );

  // Summary stats
  const totalPaid      = sorted.filter(s => s.status === "paid").reduce((acc, s) => acc + Number(s.net_salary), 0);
  const totalDeducted  = sorted.reduce((acc, s) => acc + Number(s.deduction), 0);
  const pendingCount   = sorted.filter(s => s.status === "pending").length;
  const latestNet      = sorted[0]?.net_salary ?? 0;

  return (
    <div className={s("page")}>
      <Topbar title="My Salary" subtitle="View your monthly salary, deductions and payment history" />

      <main className={s("content")}>
        {/* Header */}
        <section className={s("head")}>
          <div>
            <h1>My Salary</h1>
            <p>Your full payment history — tap any month to see the detailed slip.</p>
          </div>
        </section>

        {/* Stats */}
        <section className={s("stats")}>
          {[
            { label: "Total Received",    value: fmt(totalPaid),     sub: "All paid months",       cls: "green" },
            { label: "Latest Net Salary", value: fmt(latestNet),     sub: sorted[0] ? `${MONTHS[sorted[0].month - 1]} ${sorted[0].year}` : "—", cls: "blue" },
            { label: "Total Deductions",  value: fmt(totalDeducted), sub: "Across all records",    cls: "red" },
            { label: "Pending Months",    value: pendingCount,       sub: "Payment not received yet", cls: "orange" },
          ].map(({ label, value, sub, cls }) => (
            <article key={label} className={cx(s("stat"), s(cls))}>
              <div><i className="fa-solid fa-circle-dot" /></div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{sub}</small>
            </article>
          ))}
        </section>

        {/* Salary records table */}
        <article className={s("card")}>
          <div className={s("cardHead")}>
            <div>
              <h3><i className="fa-solid fa-table-list" /> Salary History</h3>
              <p>All months, sorted most recent first. Click a row to view the full slip.</p>
            </div>
          </div>

          <div className={s("tableWrap")}>
            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#6a7882" }}>
                <i className="fa-solid fa-file-invoice-dollar" style={{ fontSize: 32, marginBottom: 12, display: "block", color: "#d4dde2" }} />
                <p style={{ fontWeight: 900, margin: 0 }}>No salary records yet</p>
                <p style={{ fontSize: 12, marginTop: 4, fontWeight: 700 }}>Your admin hasn't added any salary entries for you.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Basic Salary</th>
                    <th>Bonus</th>
                    <th>Deduction</th>
                    <th>Net Salary</th>
                    <th>Status</th>
                    <th>Payment Date</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((sal) => (
                    <tr
                      key={sal.id}
                      onClick={() => setSelected(sal)}
                      style={{ cursor: "pointer" }}
                      className={selected?.id === sal.id ? s("selectedRow") : undefined}
                    >
                      <td>
                        <strong style={{ fontSize: 13, fontWeight: 900 }}>
                          {MONTHS[sal.month - 1]} {sal.year}
                        </strong>
                      </td>
                      <td>{fmt(sal.basic_salary)}</td>
                      <td>
                        {Number(sal.bonus) > 0
                          ? <span style={{ color: "#12805c", fontWeight: 900 }}>+{fmt(sal.bonus)}</span>
                          : <span style={{ color: "#aab5bb" }}>—</span>
                        }
                      </td>
                      <td>
                        {Number(sal.deduction) > 0
                          ? <span style={{ color: "#b42318", fontWeight: 900 }}>–{fmt(sal.deduction)}</span>
                          : <span style={{ color: "#aab5bb" }}>—</span>
                        }
                      </td>
                      <td>
                        <strong style={{ fontSize: 14, fontWeight: 900, color: "#12805c" }}>
                          {fmt(sal.net_salary)}
                        </strong>
                      </td>
                      <td>
                        <span
                          className={s("badge")}
                          style={{
                            background: statusStyle[sal.status]?.bg ?? "#e5ebee",
                            color:      statusStyle[sal.status]?.color ?? "#6a7882",
                          }}
                        >
                          {sal.status.charAt(0).toUpperCase() + sal.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {sal.payment_date
                          ? new Date(sal.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : <span style={{ color: "#aab5bb" }}>—</span>
                        }
                      </td>
                      <td>
                        {sal.payment_method
                          ? methodLabel[sal.payment_method] ?? sal.payment_method
                          : <span style={{ color: "#aab5bb" }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>

        {/* Deduction note */}
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#6a7882", fontWeight: 700, padding: "0 2px" }}>
          <i className="fa-solid fa-circle-info" style={{ marginRight: 6, color: "#c46a14" }} />
          Deductions include tax, insurance, or any other charges set by your school admin. Contact admin for a detailed breakdown.
        </p>
      </main>

      {selected && (
        <SalarySlipModal salary={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
