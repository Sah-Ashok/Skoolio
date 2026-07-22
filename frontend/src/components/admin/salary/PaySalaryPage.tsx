"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./salary.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import DateInput from "@/components/shared/DateInput";
import { useDateFormat } from "@/lib/useDateFormat";
import { adToBS, bsToISO, BS_MONTH_NAMES } from "@/lib/bs-ad";

const s  = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const AD_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── helpers ──────────────────────────────────────────────────────────────────

function buildYearOptions(isBS: boolean): string[] {
  const now   = new Date();
  const baseY = isBS ? adToBS(now).year : now.getFullYear();
  return Array.from({ length: 5 }, (_, i) => String(baseY - 3 + i));
}

/** Convert displayed (month-name, year) back to AD month integer + AD year.
 *  For BS schools the API always gets AD values, so we convert BS → AD using mid-month. */
function displayToAD(
  monthName: string,
  yearStr: string,
  isBS: boolean,
  monthNames: string[]
): { adMonth: number; adYear: number } {
  const displayMonthIdx = monthNames.indexOf(monthName); // 0-based
  if (!isBS) return { adMonth: displayMonthIdx + 1, adYear: parseInt(yearStr) };

  // BS month/year → convert 15th of that BS month to AD
  const bsYear  = parseInt(yearStr);
  const bsMonth = displayMonthIdx + 1;
  const adISO   = bsToISO({ year: bsYear, month: bsMonth, day: 15 });
  const [ay, am] = adISO.split("-").map(Number);
  return { adMonth: am, adYear: ay };
}

function fmt(n: number | string | undefined | null) {
  return Number(n || 0).toLocaleString("en-IN");
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PaySalaryPage() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const dispatch      = useAppDispatch();
  const { isBS, formatDate } = useDateFormat();

  const monthNames  = isBS ? BS_MONTH_NAMES : AD_MONTHS;
  const yearOptions = buildYearOptions(isBS);

  // Default to current month/year in the school's calendar
  const nowBS        = adToBS(new Date());
  const defaultMonth = isBS ? BS_MONTH_NAMES[nowBS.month - 1] : AD_MONTHS[new Date().getMonth()];
  const defaultYear  = isBS ? String(nowBS.year) : String(new Date().getFullYear());

  // ── API ──
  const { data: facultyList, loading: facultyLoading } = useApi<any[]>("/teachers");
  const { data: activeYear }                            = useApi<any>("/academic-years/active");
  const { execute: paySalary, loading: paying }         = useMutation("/teachers/salary", "POST");

  // ── Form state ──
  const preselected = searchParams?.get("faculty") ?? "";
  const [selectedFacultyId, setSelectedFacultyId] = useState(preselected);
  const [selectedYear,  setSelectedYear]  = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const [basicSalary,      setBasicSalary]      = useState("");
  const [bonus,            setBonus]            = useState("0");
  const [taxAmount,        setTaxAmount]        = useState("0");
  const [providentFund,    setProvidentFund]    = useState("0");
  const [otherDeduction,   setOtherDeduction]   = useState("0");
  const [deductionRemarks, setDeductionRemarks] = useState("");
  const [paymentMode,      setPaymentMode]      = useState("bank_transfer");
  const [paymentDate,      setPaymentDate]      = useState("");
  const [remarks,          setRemarks]          = useState("");

  // Attendance-based fields (loaded from API, editable)
  const [workingDays,  setWorkingDays]  = useState("");
  const [presentDays,  setPresentDays]  = useState("");
  const [absentDays,   setAbsentDays]   = useState("");
  const [halfDays,     setHalfDays]     = useState("");
  const [leaveDays,    setLeaveDays]    = useState("");

  // ── Attendance fetch ──
  const [attLoading, setAttLoading] = useState(false);
  const [attLoaded,  setAttLoaded]  = useState(false);

  const { adMonth, adYear } = displayToAD(selectedMonth, selectedYear, isBS, monthNames);

  const selectedFaculty = facultyList?.find((f: any) => f.id.toString() === selectedFacultyId);

  // Auto-fill basic salary when teacher selected
  useEffect(() => {
    if (selectedFaculty?.monthly_salary) setBasicSalary(String(selectedFaculty.monthly_salary));
  }, [selectedFacultyId, selectedFaculty?.monthly_salary]);

  // Reset attendance when month/faculty changes
  useEffect(() => {
    setAttLoaded(false);
    setPresentDays(""); setAbsentDays(""); setHalfDays(""); setLeaveDays(""); setWorkingDays("");
  }, [selectedFacultyId, selectedMonth, selectedYear]);

  // Fetch attendance summary
  const fetchAttendance = useCallback(async () => {
    if (!selectedFacultyId || !adYear || !adMonth) return;
    setAttLoading(true);
    try {
      const res = await fetch(
        `/api/teachers/salary/${selectedFacultyId}/attendance?year=${adYear}&month=${adMonth}`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (json.success && json.data?.summary) {
        const s = json.data.summary;
        setPresentDays(String(s.present_days ?? ""));
        setAbsentDays(String(s.absent_days ?? ""));
        setHalfDays(String(s.half_days ?? ""));
        setLeaveDays(String(s.leave_days ?? ""));
        // Working days = total records in attendance (or manual entry)
        const total = Number(s.total_records ?? 0);
        if (total > 0) setWorkingDays(String(total));
        setAttLoaded(true);
      }
    } catch {
      dispatch(showToast({ type: "error", title: "Error", message: "Could not load attendance data" }));
    } finally {
      setAttLoading(false);
    }
  }, [selectedFacultyId, adYear, adMonth, dispatch]);

  // ── Salary calculation ──
  const basic        = parseFloat(basicSalary || "0");
  const bonusAmt     = parseFloat(bonus       || "0");
  const tax          = parseFloat(taxAmount   || "0");
  const pf           = parseFloat(providentFund || "0");
  const other        = parseFloat(otherDeduction || "0");
  const working      = parseFloat(workingDays  || "0");
  const present      = parseFloat(presentDays  || "0");
  const absent       = parseFloat(absentDays   || "0");
  const half         = parseFloat(halfDays     || "0");

  const perDaySalary = working > 0 ? basic / working : 0;

  // Attendance-based deduction: absent days at full rate, half-days at 0.5
  const attendanceDeduction = perDaySalary * (absent + half * 0.5);
  const totalManualDeduct   = tax + pf + other;
  const totalDeduction      = totalManualDeduct + attendanceDeduction;
  const netPay              = Math.max(0, basic + bonusAmt - totalDeduction);

  const effectivePresentDays = working > 0
    ? working - absent - half * 0.5
    : present;

  // ── Submit ──
  const handlePayment = async () => {
    if (!selectedFacultyId || !activeYear?.id || !basicSalary || !paymentDate) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Please fill all required fields (faculty, basic salary, payment date)" }));
      return;
    }
    try {
      await paySalary({
        academic_year_id:  activeYear.id,
        teacher_id:        parseInt(selectedFacultyId),
        basic_salary:      basic,
        month:             adMonth,
        year:              adYear,
        status:            "paid",
        bonus:             bonusAmt,
        tax_amount:        tax,
        provident_fund:    pf,
        other_deduction:   other + attendanceDeduction, // total non-tax deduction
        deduction_remarks: deductionRemarks || undefined,
        working_days:      working || undefined,
        present_days:      effectivePresentDays || undefined,
        absent_days:       absent || undefined,
        half_days:         half   || undefined,
        leave_days:        parseFloat(leaveDays || "0") || undefined,
        per_day_salary:    perDaySalary || undefined,
        payment_date:      paymentDate,
        payment_method:    paymentMode,
        remarks,
      });
      dispatch(showToast({ type: "success", title: "Paid!", message: "Salary recorded successfully" }));
      router.push("/salary");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Payment failed" }));
    }
  };

  return (
    <div className={s("page")}>
      <Topbar title="Pay Faculty Salary" subtitle="Calculate and process salary with attendance deductions" />

      <main className={s("content")}>
        <section className={s("head")}>
          <div>
            <h1>Pay Salary</h1>
            <p>Select faculty and month, load attendance, then process payment.</p>
          </div>
          <Link className={cx(s("btn"), s("btnOutline"))} href="/salary">
            <i className="fa-solid fa-arrow-left" /> Back to Salary
          </Link>
        </section>

        <section className={s("processLayout")}>
          <div className={s("formStack")}>

            {/* ── Step 1: Faculty + Month ─────────────────────────────── */}
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h3><i className="fa-solid fa-user-tie" /> Step 1 — Select Faculty &amp; Period</h3>
                  <p>Choose who to pay and for which month.</p>
                </div>
              </div>
              <div className={s("formGrid")}>
                <Field
                  label="Faculty Member"
                  select
                  value={selectedFacultyId}
                  onChange={setSelectedFacultyId}
                  options={facultyList?.map((f: any) => ({ label: `${f.full_name} (ID: ${f.id})`, value: String(f.id) })) || []}
                  disabled={facultyLoading}
                  className={s("full")}
                />
                <Field
                  label="Payment Year"
                  select
                  value={selectedYear}
                  onChange={setSelectedYear}
                  options={yearOptions.map((y) => ({ label: y, value: y }))}
                />
                <Field
                  label="Payment Month"
                  select
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  options={monthNames.map((m) => ({ label: m, value: m }))}
                />
              </div>
            </article>

            {/* ── Step 2: Attendance ──────────────────────────────────── */}
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h3><i className="fa-solid fa-calendar-check" /> Step 2 — Attendance Summary</h3>
                  <p>Load from attendance records or enter manually. Absent days are auto-deducted from salary.</p>
                </div>
                <button
                  className={cx(s("btn"), s("btnSoft"), s("btnSm"))}
                  onClick={fetchAttendance}
                  disabled={!selectedFacultyId || attLoading}
                >
                  {attLoading
                    ? <Spinner size={14} />
                    : <><i className="fa-solid fa-rotate" /> Load Attendance</>
                  }
                </button>
              </div>

              {attLoaded && (
                <div className={s("attBanner")}>
                  <i className="fa-solid fa-circle-check" />
                  Attendance loaded for {selectedMonth} {selectedYear} — review and adjust if needed.
                </div>
              )}

              <div className={s("formGrid")}>
                <Field label="Working Days (total)" type="number" value={workingDays} onChange={setWorkingDays} placeholder="e.g. 26" />
                <div /> {/* spacer */}
                <Field label="Present Days" type="number" value={presentDays} onChange={setPresentDays} placeholder="e.g. 24" />
                <Field label="Absent Days (deducted)" type="number" value={absentDays} onChange={setAbsentDays} placeholder="e.g. 1" />
                <Field label="Half Days (0.5× each)" type="number" value={halfDays} onChange={setHalfDays} placeholder="e.g. 0" />
                <Field label="Leave Days (approved, not deducted)" type="number" value={leaveDays} onChange={setLeaveDays} placeholder="e.g. 0" />
              </div>

              {working > 0 && (
                <div className={s("calcNote")}>
                  <i className="fa-solid fa-calculator" />
                  Per-day salary = {fmt(basic)} ÷ {working} days =&nbsp;
                  <strong>₹{perDaySalary.toFixed(2)}</strong>
                  {(absent > 0 || half > 0) && (
                    <>
                      &nbsp;| Attendance deduction =&nbsp;
                      <strong className={s("redText")}>
                        ₹{attendanceDeduction.toFixed(2)}
                      </strong>
                      &nbsp;({absent > 0 ? `${absent} absent` : ""}
                      {absent > 0 && half > 0 ? ", " : ""}
                      {half > 0 ? `${half} half-day` : ""})
                    </>
                  )}
                </div>
              )}
            </article>

            {/* ── Step 3: Payment Details ─────────────────────────────── */}
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h3><i className="fa-solid fa-money-check" /> Step 3 — Payment Details</h3>
                  <p>Enter salary components, deductions and payment info.</p>
                </div>
              </div>
              <div className={s("formGrid")}>
                <Field label="Basic Salary" type="number" value={basicSalary} onChange={setBasicSalary} placeholder="e.g. 30000" />
                <Field label="Bonus / Allowance" type="number" value={bonus} onChange={setBonus} placeholder="0" />

                <div className={s("full")} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", marginBottom: 10 }}>
                    <i className="fa-solid fa-circle-minus" style={{ color: "#b42318", marginRight: 6 }} />
                    Manual Deductions (in addition to attendance deduction)
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <Field label="Tax / TDS" type="number" value={taxAmount} onChange={setTaxAmount} placeholder="0" />
                    <Field label="Provident Fund (PF)" type="number" value={providentFund} onChange={setProvidentFund} placeholder="0" />
                    <Field label="Other Deduction" type="number" value={otherDeduction} onChange={setOtherDeduction} placeholder="0" />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Field label="Deduction Remarks" value={deductionRemarks} onChange={setDeductionRemarks} placeholder="e.g. Loan repayment, advance recovery…" />
                  </div>
                </div>

                <label className={s("field")}>
                  <span>Payment Date</span>
                  <DateInput value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </label>
                <Field
                  label="Payment Method"
                  select
                  value={paymentMode}
                  onChange={setPaymentMode}
                  options={[
                    { label: "Bank Transfer", value: "bank_transfer" },
                    { label: "Cash",          value: "cash"          },
                    { label: "Cheque",        value: "cheque"        },
                  ]}
                />
                <Field label="Remarks" textarea className={s("full")} placeholder="Optional note for this payment" value={remarks} onChange={setRemarks} />
              </div>
            </article>
          </div>

          {/* ── Summary Sidebar ──────────────────────────────────────── */}
          <aside className={s("summaryCard")}>
            <div className={s("summaryIcon")}><i className="fa-solid fa-receipt" /></div>
            <h2>Salary Calculation</h2>

            <div className={s("summaryRows")}>
              <span>
                <b>Faculty</b>
                <strong>{selectedFaculty?.full_name ?? "Not selected"}</strong>
              </span>
              <span>
                <b>Period</b>
                <strong>{selectedMonth} {selectedYear}</strong>
              </span>
              {selectedFaculty && (
                <span>
                  <b>Joined</b>
                  <strong style={{ fontSize: 12 }}>{formatDate(selectedFaculty.join_date)}</strong>
                </span>
              )}
            </div>

            <div className={s("calcBreakdown")}>
              <div className={s("calcRow")}>
                <span>Basic Salary</span>
                <strong>₹{fmt(basic)}</strong>
              </div>
              <div className={s("calcRow")}>
                <span>Bonus / Allowance</span>
                <strong style={{ color: "#16a34a" }}>+₹{fmt(bonusAmt)}</strong>
              </div>

              <div className={s("calcDivider")} />

              {working > 0 && absent + half > 0 && (
                <div className={s("calcRow")}>
                  <span style={{ color: "#b42318" }}>
                    Absent deduction<br />
                    <small>({absent}×₹{perDaySalary.toFixed(0)} + {half}×₹{(perDaySalary*0.5).toFixed(0)})</small>
                  </span>
                  <strong style={{ color: "#b42318" }}>-₹{fmt(attendanceDeduction.toFixed(0))}</strong>
                </div>
              )}
              <div className={s("calcRow")}>
                <span style={{ color: "#b42318" }}>Tax / TDS</span>
                <strong style={{ color: "#b42318" }}>-₹{fmt(tax)}</strong>
              </div>
              <div className={s("calcRow")}>
                <span style={{ color: "#b42318" }}>Provident Fund</span>
                <strong style={{ color: "#b42318" }}>-₹{fmt(pf)}</strong>
              </div>
              <div className={s("calcRow")}>
                <span style={{ color: "#b42318" }}>Other Deduction</span>
                <strong style={{ color: "#b42318" }}>-₹{fmt(other)}</strong>
              </div>

              <div className={s("calcDivider")} />

              <div className={cx(s("calcRow"), s("calcNetRow"))}>
                <span>Net Pay</span>
                <strong style={{ color: "#16a34a", fontSize: 20 }}>
                  ₹{fmt(netPay.toFixed(0))}
                </strong>
              </div>
            </div>

            {working > 0 && (
              <div className={s("attMini")}>
                <span><i className="fa-solid fa-calendar-days" /> {working} working days</span>
                <span><i className="fa-solid fa-circle-check" style={{ color: "#12805c" }} /> {present || effectivePresentDays} present</span>
                {absent > 0 && <span><i className="fa-solid fa-circle-xmark" style={{ color: "#b42318" }} /> {absent} absent</span>}
                {half > 0   && <span><i className="fa-solid fa-circle-half-stroke" style={{ color: "#c46a14" }} /> {half} half-day</span>}
              </div>
            )}

            <button
              className={cx(s("btn"), s("btnPrimary"), s("wideBtn"))}
              type="button"
              onClick={handlePayment}
              disabled={paying}
              style={{ marginTop: 16 }}
            >
              {paying ? <Spinner size={16} /> : <><i className="fa-solid fa-check" /> Process Payment</>}
            </button>
          </aside>
        </section>
      </main>
    </div>
  );
}

// ── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label, type = "text", placeholder, textarea, className,
  select, options, value, onChange, disabled,
}: {
  label: string; type?: string; placeholder?: string; textarea?: boolean;
  className?: string; select?: boolean; options?: { label: string; value: string }[];
  value?: string; onChange?: (v: string) => void; disabled?: boolean;
}) {
  const s  = (name: string) => styles[name] || name;
  const cx = (...cls: Array<string | false | undefined>) => cls.filter(Boolean).join(" ");
  return (
    <label className={cx(s("field"), className)}>
      <span>{label}</span>
      {select ? (
        <select value={value} onChange={(e) => onChange?.(e.target.value)} disabled={disabled}>
          <option value="">Select…</option>
          {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : textarea ? (
        <textarea placeholder={placeholder} value={value} onChange={(e) => onChange?.(e.target.value)} disabled={disabled} />
      ) : (
        <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange?.(e.target.value)} disabled={disabled} />
      )}
    </label>
  );
}
