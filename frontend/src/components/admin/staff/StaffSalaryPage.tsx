"use client";

import { useState, useMemo, useEffect } from "react";
import Topbar from "@/components/shared/Topbar";
import { Spinner } from "@/components/shared/Loader";
import { useApi, useMutation } from "@/lib/useApi";
import styles from "./staff.module.css";
import DateInput from "@/components/shared/DateInput";
import { apiRequest } from "@/lib/api";

const s  = (n: string) => styles[n] || n;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const fmt = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(Number(n) || 0);

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Staff = { id: number; full_name: string; role_name?: string };

type SalaryPayment = {
  id: number;
  staff_id: number;
  full_name?: string;
  role_name?: string;
  salary_month: string;
  salary_month_str?: string;
  gross_amount: number;
  total_deductions: number;
  net_amount: number;
  status: "paid" | "pending" | "cancelled";
  payment_method?: string;
  paid_on?: string;
  paid_on_str?: string;
  remarks?: string;
  working_days?:   number;
  present_days?:   number;
  absent_days?:    number;
  half_days?:      number;
  leave_days?:     number;
  per_day_salary?: number;
};

type AttPreview = {
  basic_salary:     number;
  working_days:     number;
  present_days:     number;
  absent_days:      number;
  half_days:        number;
  leave_days:       number;
  per_day_salary:   number;
  absent_deduction: number;
  gross_amount:     number;
  net_salary:       number;
  has_attendance:   boolean;
  salary_set:       boolean;
};

type Deduction = { deduction_type: string; amount: number; note?: string };

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid:      { bg: "#e2f6ee", color: "#12805c" },
  pending:   { bg: "#fff1df", color: "#a85f12" },
  cancelled: { bg: "#fde7e7", color: "#b42318" },
};

const DEDUCTION_TYPES = ["absent","advance","tax","provident_fund","other"];

// ── Pay Salary Modal ──────────────────────────────────────────────────────────
function PaySalaryModal({ staff, onClose, onSaved }: { staff: Staff[]; onClose: () => void; onSaved: () => void }) {
  const now = new Date();
  const [form, setForm] = useState({
    staff_id:       "",
    salary_month:   `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    gross_amount:   "",
    payment_method: "cash",
    paid_on:        now.toISOString().split("T")[0],
    status:         "paid",
    remarks:        "",
  });
  const [deductions,  setDeductions]  = useState<Deduction[]>([]);
  const [preview,     setPreview]     = useState<AttPreview | null>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [err, setErr] = useState("");
  const { execute, loading } = useMutation("/staff/salary/payments", "POST");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fetch attendance preview whenever staff or month changes
  useEffect(() => {
    if (!form.staff_id || !form.salary_month) { setPreview(null); return; }
    setLoadingPrev(true);
    apiRequest<{ data: AttPreview }>(
      `/staff/salary/attendance-preview?staff_id=${form.staff_id}&month=${form.salary_month}`
    )
      .then(r => {
        const p = r.data;
        setPreview(p);
        // Auto-fill gross from basic salary if not already typed
        if (p.salary_set) {
          setForm(f => ({ ...f, gross_amount: String(p.basic_salary) }));
          // Auto-add absent deduction line if any absences
          if (p.absent_deduction > 0) {
            setDeductions([{
              deduction_type: "absent",
              amount: p.absent_deduction,
              note: `${p.absent_days} absent + ${p.half_days} half-day @ ${fmt(p.per_day_salary)}/day`,
            }]);
          } else {
            setDeductions([]);
          }
        }
      })
      .catch(() => setPreview(null))
      .finally(() => setLoadingPrev(false));
  }, [form.staff_id, form.salary_month]);

  const addDeduction = () =>
    setDeductions(d => [...d, { deduction_type: "absent", amount: 0, note: "" }]);

  const updateDeduction = (i: number, k: keyof Deduction, v: string | number) =>
    setDeductions(d => d.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const removeDeduction = (i: number) =>
    setDeductions(d => d.filter((_, idx) => idx !== i));

  const totalDeductions = deductions.reduce((a, d) => a + (Number(d.amount) || 0), 0);
  const netAmount       = (Number(form.gross_amount) || 0) - totalDeductions;

  const handleSubmit = async () => {
    if (!form.staff_id)     return setErr("Select a staff member.");
    if (!form.gross_amount) return setErr("Enter gross amount.");
    setErr("");
    try {
      await execute({
        ...form,
        staff_id:         Number(form.staff_id),
        gross_amount:     Number(form.gross_amount),
        total_deductions: totalDeductions,
        deductions:       deductions.map(d => ({ ...d, amount: Number(d.amount) })),
        // pass attendance snapshot so it's stored on the payment record
        ...(preview?.has_attendance ? {
          working_days:   preview.working_days,
          present_days:   preview.present_days,
          absent_days:    preview.absent_days,
          half_days:      preview.half_days,
          leave_days:     preview.leave_days,
          per_day_salary: preview.per_day_salary,
        } : {}),
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Failed to save payment.");
    }
  };

  return (
    <div className={s("overlay")} onClick={onClose}>
      <div className={s("modal")} style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className={s("modalHead")}>
          <div><h2>Pay Salary</h2><p>Attendance is auto-loaded for the selected month.</p></div>
          <button className={s("closeBtn")} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className={s("formGrid")}>
          {/* Staff + Month */}
          <div className={s("field")}>
            <label>Staff Member *</label>
            <select value={form.staff_id} onChange={e => set("staff_id", e.target.value)}>
              <option value="">Select staff…</option>
              {staff.map(m => <option key={m.id} value={m.id}>{m.full_name}{m.role_name ? ` (${m.role_name})` : ""}</option>)}
            </select>
          </div>

          <div className={s("field")}>
            <label>Salary Month *</label>
            <input type="month" value={form.salary_month} onChange={e => set("salary_month", e.target.value)} />
          </div>

          {/* Attendance preview card */}
          {form.staff_id && form.salary_month && (
            <div className={s("full")}>
              {loadingPrev ? (
                <div style={{ padding: "12px 0", display: "flex", alignItems: "center", gap: 8, color: "#6a7882", fontSize: 13 }}>
                  <Spinner size={14} color="#FF9B51" /> Loading attendance…
                </div>
              ) : preview ? (
                preview.has_attendance ? (
                  <div style={{ padding: "14px 16px", borderRadius: 10, background: "#f6fdf9", border: "1px solid #bee8d6", marginBottom: 4 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 900, color: "#12805c", textTransform: "uppercase", letterSpacing: 0.8 }}>
                      <i className="fa-solid fa-calendar-check" style={{ marginRight: 6 }} />
                      Attendance — {form.salary_month}
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                      {[
                        { label: "Working", value: preview.working_days,  color: "#1f2d36" },
                        { label: "Present", value: preview.present_days,  color: "#12805c" },
                        { label: "Absent",  value: preview.absent_days,   color: "#b42318" },
                        { label: "Half Day",value: preview.half_days,     color: "#c46a14" },
                        { label: "Leave",   value: preview.leave_days,    color: "#3b5bdb" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ textAlign: "center", padding: "8px 4px", borderRadius: 8, background: "#fff", border: "1px solid #dceee7" }}>
                          <strong style={{ fontSize: 18, fontWeight: 900, color, display: "block" }}>{value}</strong>
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#6a7882", textTransform: "uppercase" }}>{label}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: "#6a7882", fontWeight: 700 }}>
                      Per-day salary: <strong style={{ color: "#1f2d36" }}>{fmt(preview.per_day_salary)}</strong>
                      {preview.absent_deduction > 0 && (
                        <> &nbsp;·&nbsp; Absent deduction: <strong style={{ color: "#b42318" }}>− {fmt(preview.absent_deduction)}</strong></>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fff8f2", border: "1px solid #fdd5b0", fontSize: 12, fontWeight: 700, color: "#c46a14" }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />
                    No attendance recorded for this month — entering gross manually.
                    {!preview.salary_set && " Also no salary structure set for this staff."}
                  </div>
                )
              ) : null}
            </div>
          )}

          {/* Gross amount */}
          <div className={s("field")}>
            <label>Gross Amount (NPR) *</label>
            <input type="number" min="0" value={form.gross_amount} onChange={e => set("gross_amount", e.target.value)} placeholder="e.g. 12000" />
          </div>

          <div className={s("field")}>
            <label>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)}>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className={s("field")}>
            <label>Payment Method</label>
            <select value={form.payment_method} onChange={e => set("payment_method", e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div className={s("field")}>
            <label>Paid On</label>
            <DateInput value={form.paid_on} onChange={e => set("paid_on", e.target.value)} />
          </div>

          <div className={cx(s("field"), s("full"))}>
            <label>Remarks</label>
            <textarea value={form.remarks} onChange={e => set("remarks", e.target.value)} placeholder="Optional notes…" />
          </div>

          {/* Deductions */}
          <div className={s("full")}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <strong style={{ fontSize: 13, fontWeight: 900 }}>
                <i className="fa-solid fa-minus-circle" style={{ color: "#b42318", marginRight: 6 }} />
                Deductions
              </strong>
              <button className={cx(s("btn"), s("btnSoft"), s("btnSm"))} onClick={addDeduction}>
                <i className="fa-solid fa-plus" /> Add
              </button>
            </div>

            {deductions.length === 0 && (
              <p style={{ margin: 0, fontSize: 12, color: "#6a7882", fontWeight: 700 }}>
                No deductions. Absent deductions are auto-added from attendance.
              </p>
            )}

            {deductions.map((d, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px 1fr auto", gap: 8, marginBottom: 8, alignItems: "start" }}>
                <div className={s("field")}>
                  {i === 0 && <label>Type</label>}
                  <select value={d.deduction_type} onChange={e => updateDeduction(i, "deduction_type", e.target.value)}>
                    {DEDUCTION_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div className={s("field")}>
                  {i === 0 && <label>Amount</label>}
                  <input type="number" min="0" value={d.amount} onChange={e => updateDeduction(i, "amount", e.target.value)} placeholder="0" />
                </div>
                <div className={s("field")}>
                  {i === 0 && <label>Note</label>}
                  <input value={d.note ?? ""} onChange={e => updateDeduction(i, "note", e.target.value)} placeholder="Optional note…" />
                </div>
                <div style={{ paddingTop: i === 0 ? 22 : 0 }}>
                  <button className={cx(s("btn"), s("btnDanger"), s("btnSm"))} onClick={() => removeDeduction(i)}>
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            ))}

            {/* Net summary */}
            {form.gross_amount && (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 9, background: "#f6fdf9", border: "1px solid #bee8d6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: "#6a7882", fontWeight: 800 }}>Gross Amount</span>
                  <strong>{fmt(form.gross_amount)}</strong>
                </div>
                {totalDeductions > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: "#b42318", fontWeight: 800 }}>Total Deductions</span>
                    <strong style={{ color: "#b42318" }}>− {fmt(totalDeductions)}</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, borderTop: "1px solid #bee8d6", paddingTop: 8 }}>
                  <span style={{ color: "#12805c", fontWeight: 900 }}>Net Salary</span>
                  <strong style={{ color: "#12805c" }}>{fmt(netAmount)}</strong>
                </div>
              </div>
            )}
          </div>

          {err && (
            <p className={s("full")} style={{ margin: 0, color: "#b42318", fontSize: 13, fontWeight: 800 }}>
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }} />{err}
            </p>
          )}
        </div>

        <div className={s("modalFoot")}>
          <button className={cx(s("btn"), s("btnOutline"))} onClick={onClose}>Cancel</button>
          <button className={cx(s("btn"), s("btnPrimary"))} onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size={14} color="#fff" /> : <><i className="fa-solid fa-money-bill-wave" /> Record Payment</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Salary Slip Modal ─────────────────────────────────────────────────────────
function SalarySlipModal({ payment, onClose }: { payment: SalaryPayment; onClose: () => void }) {
  const { data: detail } = useApi<any>(`/staff/salary/payments/${payment.id}`);
  const d = detail ?? payment;

  const monthLabel = (() => {
    const raw = d.salary_month_str ?? (d.salary_month ?? "").slice(0, 7);
    const [y, m] = raw.split("-");
    return `${MONTHS[Number(m) - 1] ?? ""} ${y ?? ""}`;
  })();

  const hasAtt = d.working_days != null;

  return (
    <div className={s("overlay")} onClick={onClose}>
      <div className={s("modal")} style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className={s("modalHead")}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#ff9b51", textTransform: "uppercase", letterSpacing: 1 }}>Salary Slip</p>
            <h2>{d.full_name ?? "Staff"}</h2>
            <p>{monthLabel} · {d.role_name ?? ""}</p>
          </div>
          <span className={s("badge")} style={{ background: STATUS_STYLE[d.status]?.bg, color: STATUS_STYLE[d.status]?.color }}>
            {d.status}
          </span>
        </div>

        <div style={{ padding: "16px 22px" }}>

          {/* Attendance summary on the slip */}
          {hasAtt && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 1 }}>Attendance</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
                {[
                  { label: "Working", value: d.working_days,  color: "#1f2d36" },
                  { label: "Present", value: d.present_days,  color: "#12805c" },
                  { label: "Absent",  value: d.absent_days,   color: "#b42318" },
                  { label: "Half",    value: d.half_days,     color: "#c46a14" },
                  { label: "Leave",   value: d.leave_days,    color: "#3b5bdb" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: "center", padding: "7px 3px", borderRadius: 7, background: "#f7fbfc", border: "1px solid #dce5e9" }}>
                    <strong style={{ fontSize: 16, fontWeight: 900, color, display: "block" }}>{value ?? "—"}</strong>
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>{label}</span>
                  </div>
                ))}
              </div>
              {d.per_day_salary != null && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6a7882", fontWeight: 700 }}>
                  Per-day: <strong style={{ color: "#1f2d36" }}>{fmt(d.per_day_salary)}</strong>
                </p>
              )}
            </div>
          )}

          {/* Earnings */}
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 1 }}>Earnings</p>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #f0f4f6" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#6a7882" }}>Gross Amount</span>
            <strong style={{ fontSize: 13, color: "#1f2d36" }}>{fmt(d.gross_amount)}</strong>
          </div>

          {/* Deductions */}
          {d.total_deductions > 0 && (
            <>
              <p style={{ margin: "14px 0 8px", fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 1 }}>Deductions</p>
              {(d.deductions ?? []).map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f0f4f6" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#6a7882", textTransform: "capitalize" }}>
                    {item.deduction_type.replace("_", " ")}
                    {item.note && <small style={{ marginLeft: 6, fontWeight: 700, color: "#aab5bb" }}>({item.note})</small>}
                  </span>
                  <strong style={{ color: "#b42318", fontSize: 13 }}>− {fmt(item.amount)}</strong>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0" }}>
                <span style={{ fontSize: 13, fontWeight: 900 }}>Total Deductions</span>
                <strong style={{ color: "#b42318" }}>− {fmt(d.total_deductions)}</strong>
              </div>
            </>
          )}

          {/* Net */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", marginTop: 12, borderRadius: 9, background: "#f6fdf9", border: "1px solid #bee8d6" }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#12805c" }}>Net Salary</span>
            <strong style={{ fontSize: 18, fontWeight: 900, color: "#12805c" }}>{fmt(d.net_amount)}</strong>
          </div>

          {/* Payment info */}
          {d.status === "paid" && (
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Paid On", value: (d.paid_on_str ?? d.paid_on) ? new Date(d.paid_on_str ?? d.paid_on).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
                { label: "Method",  value: d.payment_method?.replace("_", " ") ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: 12, border: "1px solid #dce5e9", borderRadius: 9, background: "#f8fbfc" }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#6a7882" }}>{label}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 900, color: "#1f2d36", textTransform: "capitalize" }}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {d.remarks && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 9, background: "#fff8f2", border: "1px solid #fdd5b0" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#c46a14" }}>Remarks</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#1f2d36", fontWeight: 700 }}>{d.remarks}</p>
            </div>
          )}
        </div>

        <div className={s("modalFoot")}>
          <button className={cx(s("btn"), s("btnOutline"))} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Mark as Paid Modal ─────────────────────────────────────────────────────────
function MarkPaidModal({ payment, onClose, onSaved }: { payment: SalaryPayment; onClose: () => void; onSaved: () => void }) {
  const now = new Date();
  const [form, setForm] = useState({
    payment_method: "cash",
    paid_on: now.toISOString().split("T")[0],
    remarks: payment.remarks ?? "",
  });
  const [err, setErr] = useState("");
  const { execute, loading } = useMutation(`/staff/salary/payments/${payment.id}`, "PATCH");

  const handleSubmit = async () => {
    setErr("");
    try {
      await execute({ status: "paid", payment_method: form.payment_method, paid_on: form.paid_on, remarks: form.remarks || undefined });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Failed to mark as paid.");
    }
  };

  const monthStr = (() => {
    const raw = payment.salary_month_str ?? payment.salary_month?.slice(0, 7) ?? "";
    const [y, m] = raw.split("-");
    return `${MONTHS[Number(m) - 1] ?? ""} ${y ?? ""}`;
  })();

  return (
    <div className={s("overlay")} onClick={onClose}>
      <div className={s("modal")} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className={s("modalHead")}>
          <div>
            <h2>Mark as Paid</h2>
            <p>{payment.full_name} · {monthStr} · {fmt(payment.net_amount)}</p>
          </div>
          <button className={s("closeBtn")} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className={s("formGrid")}>
          <div className={s("field")}>
            <label>Payment Method</label>
            <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div className={s("field")}>
            <label>Paid On</label>
            <DateInput value={form.paid_on} onChange={e => setForm(f => ({ ...f, paid_on: e.target.value }))} />
          </div>
          <div className={cx(s("field"), s("full"))}>
            <label>Remarks</label>
            <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional notes…" />
          </div>
          {err && <p className={s("full")} style={{ margin: 0, color: "#b42318", fontSize: 13, fontWeight: 800 }}>{err}</p>}
        </div>
        <div className={s("modalFoot")}>
          <button className={cx(s("btn"), s("btnOutline"))} onClick={onClose}>Cancel</button>
          <button className={cx(s("btn"), s("btnPrimary"))} onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size={14} color="#fff" /> : <><i className="fa-solid fa-check" /> Confirm Payment</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function StaffSalaryPage() {
  const { data: staff }    = useApi<Staff[]>("/staff");
  const { data: allPay, loading, refetch: refetchAll } = useApi<SalaryPayment[]>("/staff/salary/payments");
  const { data: pending, refetch: refetchPending }     = useApi<SalaryPayment[]>("/staff/salary/payments/pending");

  const [tab,         setTab]         = useState<"all" | "pending">("all");
  const [modal,       setModal]       = useState<"pay" | null>(null);
  const [selected,    setSelected]    = useState<SalaryPayment | null>(null);
  const [markPaid,    setMarkPaid]    = useState<SalaryPayment | null>(null);
  const [filterMonth, setFilterMonth] = useState("");

  const refetch = () => { refetchAll(); refetchPending(); };

  const payments = tab === "pending" ? (pending ?? []) : (allPay ?? []);

  const filtered = useMemo(() => {
    if (!filterMonth) return payments;
    return payments.filter(p => {
      const monthKey = p.salary_month_str ?? (p.salary_month ?? "").slice(0, 7);
      return monthKey === filterMonth;
    });
  }, [payments, filterMonth]);

  const totalPaid     = (allPay ?? []).filter(p => p.status === "paid").reduce((a, p) => a + Number(p.net_amount), 0);
  const totalPending  = (pending ?? []).reduce((a, p) => a + Number(p.net_amount), 0);
  const totalDeducted = (allPay ?? []).reduce((a, p) => a + Number(p.total_deductions), 0);

  const monthLabel = (p: SalaryPayment) => {
    const raw = p.salary_month_str ?? p.salary_month?.slice(0, 7) ?? "";
    const [y, m] = raw.split("-");
    return `${MONTHS[Number(m) - 1] ?? ""} ${y ?? ""}`;
  };

  return (
    <div className={s("page")}>
      <Topbar title="Staff Salary" subtitle="Pay, track and review non-teaching staff salaries" />
      <main className={s("content")}>

        <section className={s("head")}>
          <div>
            <h1>Staff Salary</h1>
            <p>Attendance-based deductions auto-calculated. Click any row for the detailed slip.</p>
          </div>
          <div className={s("actions")}>
            <button className={cx(s("btn"), s("btnPrimary"))} onClick={() => setModal("pay")}>
              <i className="fa-solid fa-money-bill-wave" /> Pay Salary
            </button>
          </div>
        </section>

        <section className={s("stats")}>
          {[
            { label: "Total Paid",       value: fmt(totalPaid),     sub: "All paid months",             cls: "green",  icon: "fa-check-circle"        },
            { label: "Pending Amount",   value: fmt(totalPending),  sub: `${(pending ?? []).length} pending entries`, cls: "orange", icon: "fa-clock" },
            { label: "Total Deductions", value: fmt(totalDeducted), sub: "Across all payments",         cls: "red",    icon: "fa-minus-circle"        },
            { label: "Payments Made",    value: (allPay ?? []).filter(p => p.status === "paid").length, sub: "Paid entries", cls: "blue", icon: "fa-receipt" },
          ].map(({ label, value, sub, cls, icon }) => (
            <article key={label} className={cx(s("stat"), s(cls))}>
              <div><i className={`fa-solid ${icon}`} /></div>
              <span>{label}</span>
              <strong>{loading ? "—" : value}</strong>
              <small>{sub}</small>
            </article>
          ))}
        </section>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 0 }}>
          <div className={s("tabs")}>
            <button className={cx(s("tab"), tab === "all"     && s("tabActive"))} onClick={() => setTab("all")}>All Payments</button>
            <button className={cx(s("tab"), tab === "pending" && s("tabActive"))} onClick={() => setTab("pending")}>
              Pending <span style={{ marginLeft: 6, padding: "2px 8px", borderRadius: 99, background: "#fff1df", color: "#c46a14", fontSize: 11, fontWeight: 900 }}>{(pending ?? []).length}</span>
            </button>
          </div>
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            style={{ minHeight: 36, padding: "0 12px", border: "1px solid #c6d0d7", borderRadius: 8, background: "#fff", color: "#1f2d36", font: "inherit", fontSize: 13, fontWeight: 800, outline: "none" }}
          />
        </div>

        <div className={s("card")}>
          <div className={s("tableWrap")}>
            {loading ? (
              <div className={s("empty")}><Spinner size={28} color="#FF9B51" /></div>
            ) : filtered.length === 0 ? (
              <div className={s("empty")}>
                <i className="fa-solid fa-file-invoice-dollar" />
                <p>{tab === "pending" ? "No pending salaries" : "No payments recorded"}</p>
                <small>{tab === "all" ? 'Click "Pay Salary" to record the first payment.' : "All salaries are up to date."}</small>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Month</th>
                    <th>Attendance</th>
                    <th>Gross</th>
                    <th>Deductions</th>
                    <th>Net Salary</th>
                    <th>Status</th>
                    <th>Paid On</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} onClick={() => setSelected(p)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className={s("staffCell")}>
                          <div className={s("avatar")}>{(p.full_name ?? "?").slice(0, 2).toUpperCase()}</div>
                          <div>
                            <strong>{p.full_name ?? "—"}</strong>
                            <small>{p.role_name ?? ""}</small>
                          </div>
                        </div>
                      </td>
                      <td><strong style={{ fontWeight: 900 }}>{monthLabel(p)}</strong></td>
                      <td>
                        {p.working_days != null ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#6a7882" }}>
                            <span style={{ color: "#12805c", fontWeight: 900 }}>{p.present_days}P</span>
                            {" / "}
                            <span style={{ color: "#b42318" }}>{p.absent_days}A</span>
                            {p.half_days ? <> / <span style={{ color: "#c46a14" }}>{p.half_days}H</span></> : ""}
                            {" of "}{p.working_days}
                          </span>
                        ) : (
                          <span style={{ color: "#aab5bb", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>{fmt(p.gross_amount)}</td>
                      <td>
                        {Number(p.total_deductions) > 0
                          ? <span style={{ color: "#b42318", fontWeight: 900 }}>− {fmt(p.total_deductions)}</span>
                          : <span style={{ color: "#aab5bb" }}>—</span>
                        }
                      </td>
                      <td><strong style={{ color: "#12805c", fontSize: 14 }}>{fmt(p.net_amount)}</strong></td>
                      <td>
                        <span className={s("badge")} style={{ background: STATUS_STYLE[p.status]?.bg, color: STATUS_STYLE[p.status]?.color }}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        {(p.paid_on_str ?? p.paid_on)
                          ? new Date((p.paid_on_str ?? p.paid_on)!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : <span style={{ color: "#aab5bb" }}>—</span>
                        }
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {p.status === "pending" && (
                          <button
                            className={cx(s("btn"), s("btnSm"))}
                            style={{ background: "#e2f6ee", color: "#12805c", border: "1px solid #a7e1c8", whiteSpace: "nowrap" }}
                            onClick={() => setMarkPaid(p)}
                          >
                            <i className="fa-solid fa-check" /> Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {modal === "pay" && <PaySalaryModal staff={staff ?? []} onClose={() => setModal(null)} onSaved={() => refetch()} />}
      {selected  && <SalarySlipModal payment={selected}  onClose={() => setSelected(null)} />}
      {markPaid  && <MarkPaidModal   payment={markPaid}  onClose={() => setMarkPaid(null)} onSaved={() => { refetch(); setMarkPaid(null); }} />}
    </div>
  );
}
