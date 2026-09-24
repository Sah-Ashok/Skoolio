"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./salary.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import DateInput from "@/components/shared/DateInput";
import { useDateFormat } from "@/lib/useDateFormat";
import { adToBS, bsToISO, BS_MONTH_NAMES } from "@/lib/bs-ad";
import { apiRequest } from "@/lib/api";

import { useCurrency, CurrencyAmount } from "@/lib/useCurrency";

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

/** Convert displayed (month-name, year) back to AD month integer + AD year. */
function displayToAD(
  monthName: string,
  yearStr: string,
  isBS: boolean,
  monthNames: string[]
): { adMonth: number; adYear: number } {
  const displayMonthIdx = monthNames.indexOf(monthName); // 0-based
  if (!isBS) return { adMonth: displayMonthIdx + 1, adYear: parseInt(yearStr) };

  const bsYear  = parseInt(yearStr);
  const bsMonth = displayMonthIdx + 1;
  const adISO   = bsToISO({ year: bsYear, month: bsMonth, day: 15 });
  const [ay, am] = adISO.split("-").map(Number);
  return { adMonth: am, adYear: ay };
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PaySalaryPage() {
  const { fmt }       = useCurrency();
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const dispatch      = useAppDispatch();
  const user          = useAppSelector((state) => state.auth.user);
  const salaryUrl     = user?.role === 'finance' ? '/finance/salary' : '/salary';
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
  const { data: payrollPolicy }                         = useApi<any>("/payroll-policy");
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

  // Track whether tax/PF has been auto-filled so we don't override manual edits
  const [taxPFAutoFilled, setTaxPFAutoFilled] = useState(false);

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

  // Auto-fill basic salary + tax/PF when teacher is selected (or changes)
  useEffect(() => {
    if (!selectedFaculty) return;

    // Auto-fill basic salary from teacher's monthly_salary
    if (selectedFaculty.monthly_salary) {
      setBasicSalary(String(selectedFaculty.monthly_salary));
    } else {
      setBasicSalary("");
    }

    // Auto-fill tax/PF from payroll policy defaults based on this teacher's salary
    const basic = parseFloat(selectedFaculty.monthly_salary || "0");
    if (payrollPolicy && basic > 0) {
      if (payrollPolicy.default_tax_percent > 0) {
        setTaxAmount(String(Math.round((basic * payrollPolicy.default_tax_percent) / 100)));
      } else {
        setTaxAmount("0");
      }
      if (payrollPolicy.default_pf_percent > 0) {
        setProvidentFund(String(Math.round((basic * payrollPolicy.default_pf_percent) / 100)));
      } else {
        setProvidentFund("0");
      }
      setTaxPFAutoFilled(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFacultyId, selectedFaculty?.monthly_salary, payrollPolicy]);

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
      const json = await apiRequest<any>(
        `/teachers/salary/${selectedFacultyId}/attendance?year=${adYear}&month=${adMonth}`
      );
      // Backend returns: { success, data: { summary, records, teacher } }
      const summary = json.data?.summary ?? json.summary;
      if (summary) {
        setPresentDays(String(summary.present_days  ?? ""));
        setAbsentDays(String(summary.absent_days    ?? ""));
        setHalfDays(String(summary.half_days        ?? ""));
        setLeaveDays(String(summary.leave_days      ?? ""));
        const total = Number(summary.total_records  ?? 0);
        if (total > 0) setWorkingDays(String(total));
        setAttLoaded(true);
      } else {
        // No records found for this month — clear fields but don't error
        setPresentDays(""); setAbsentDays(""); setHalfDays(""); setLeaveDays(""); setWorkingDays("");
        dispatch(showToast({ type: "error", title: "No Data", message: `No attendance records found for ${selectedMonth} ${selectedYear}` }));
      }
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Could not load attendance data" }));
    } finally {
      setAttLoading(false);
    }
  }, [selectedFacultyId, adYear, adMonth, selectedMonth, selectedYear, dispatch]);

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

  // Policy-driven rules
  const paidLeaveQuota   = payrollPolicy?.paid_leave_days_per_month ?? 0;
  const halfDayPayPct    = (payrollPolicy?.half_day_pay_percent ?? 50) / 100;
  const leave            = parseFloat(leaveDays || "0");

  // Attendance deductions
  const unpaidLeaveDays  = Math.max(0, leave - paidLeaveQuota);
  const halfDayDeduction = perDaySalary * (1 - halfDayPayPct) * half;
  const absentDeduction  = perDaySalary * absent;
  const leaveDeduction   = perDaySalary * unpaidLeaveDays;

  const attendanceDeduction = absentDeduction + halfDayDeduction + leaveDeduction;
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
    if (!basicSalary || parseFloat(basicSalary) <= 0) {
      dispatch(showToast({ type: "error", title: "Salary Required", message: "Enter the faculty's basic salary to proceed." }));
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
        // Attendance deductions stored as separate columns (not bundled into other_deduction)
        tax_amount:        tax,
        provident_fund:    pf,
        other_deduction:   other,
        deduction_remarks: deductionRemarks || undefined,
        working_days:      working || undefined,
        present_days:      effectivePresentDays || undefined,
        absent_days:       absent || undefined,
        half_days:         half   || undefined,
        leave_days:        leave  || undefined,
        per_day_salary:    perDaySalary || undefined,
        payment_date:      paymentDate,
        payment_method:    paymentMode,
        remarks,
      });
      dispatch(showToast({ type: "success", title: "Paid!", message: "Salary recorded successfully" }));
      router.push(salaryUrl);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Payment failed" }));
    }
  };

  // ── No-salary warning ──
  const noSalaryConfigured = selectedFaculty && !selectedFaculty.monthly_salary;

  return (
    <div className={s("page")}>
      <main className={s("content")}>
        <section className={s("head")}>
          <div>
            <h1>Pay Salary</h1>
            <p>Select faculty and month, load attendance, then process payment.</p>
          </div>
          <Link className={cx(s("btn"), s("btnOutline"))} href={salaryUrl}>
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

              {/* Warning if faculty has no salary configured */}
              {noSalaryConfigured && (
                <div style={{
                  margin: "0 18px 14px",
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  color: "#c2410c",
                  fontSize: 13,
                  fontWeight: 700,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}>
                  <i className="fa-solid fa-triangle-exclamation" />
                  <span>
                    <strong>{selectedFaculty?.full_name}</strong> has no monthly salary set.
                    Please <Link href={`/teachers/${selectedFaculty?.id}/edit`} style={{ color: "#c2410c", textDecoration: "underline" }}>update their profile</Link> to set a salary, or enter it manually below.
                  </span>
                </div>
              )}
            </article>

            {/* ── Step 2: Attendance ──────────────────────────────────── */}
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h3><i className="fa-solid fa-calendar-check" /> Step 2 — Attendance Summary</h3>
                  <p>Load from attendance records or enter manually. Deductions are calculated automatically.</p>
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

              {/* Payroll policy banner */}
              {payrollPolicy && (
                <div className={s("attBanner")} style={{ background: "#fff7ed", borderColor: "#fed7aa", color: "#c2410c" }}>
                  <i className="fa-solid fa-circle-info" />
                  <span>
                    Payroll policy: Paid leave quota: <strong>{paidLeaveQuota} day{paidLeaveQuota !== 1 ? "s" : ""}/month</strong>
                    &nbsp;· Half-day pay: <strong>{payrollPolicy.half_day_pay_percent}%</strong>
                    {payrollPolicy.default_tax_percent > 0 && <>&nbsp;· Tax: <strong>{payrollPolicy.default_tax_percent}%</strong></>}
                    {payrollPolicy.default_pf_percent  > 0 && <>&nbsp;· PF: <strong>{payrollPolicy.default_pf_percent}%</strong></>}
                    &nbsp;· Absent days deducted at full per-day rate.
                  </span>
                </div>
              )}

              {attLoaded && (
                <div className={s("attBanner")}>
                  <i className="fa-solid fa-circle-check" />
                  Attendance loaded for {selectedMonth} {selectedYear} — review and adjust if needed.
                </div>
              )}

              <div className={s("formGrid")}>
                <Field label="Working Days (total this month)" type="number" value={workingDays} onChange={setWorkingDays} placeholder="e.g. 26" />
                <div />{/* spacer */}
                <Field label="Present Days" type="number" value={presentDays} onChange={setPresentDays} placeholder="e.g. 24" />
                <Field label="Absent Days (full deduction each)" type="number" value={absentDays} onChange={setAbsentDays} placeholder="e.g. 1" />
                <Field
                  label={`Half Days (${100 - Math.round((payrollPolicy?.half_day_pay_percent ?? 50))}% deducted each)`}
                  type="number" value={halfDays} onChange={setHalfDays} placeholder="e.g. 0"
                />
                <Field
                  label={paidLeaveQuota > 0
                    ? `Leave Days (${paidLeaveQuota} paid/mo, rest deducted)`
                    : "Leave Days (all deducted — no paid quota)"}
                  type="number" value={leaveDays} onChange={setLeaveDays} placeholder="e.g. 0"
                />
              </div>

              {/* Attendance deduction note */}
              {working > 0 && (
                <div className={s("calcNote")}>
                  <i className="fa-solid fa-calculator" />
                  Per-day = <CurrencyAmount amount={perDaySalary} />&nbsp;
                  {paidLeaveQuota > 0 && (
                    <span style={{ color: "#16a34a" }}>
                      · Paid leave quota: {paidLeaveQuota} day{paidLeaveQuota !== 1 ? "s" : ""}/mo&nbsp;
                    </span>
                  )}
                  {(absent > 0 || half > 0 || unpaidLeaveDays > 0) && (
                    <>
                      | Attendance deductions:&nbsp;
                      {absent > 0 && <span className={s("redText")}>{absent}×absent (-<CurrencyAmount amount={absentDeduction} />) </span>}
                      {half > 0 && <span style={{ color: "#c46a14" }}>{half}×half-day (-<CurrencyAmount amount={halfDayDeduction} />) </span>}
                      {unpaidLeaveDays > 0 && <span className={s("redText")}>{unpaidLeaveDays} unpaid leave (-<CurrencyAmount amount={leaveDeduction} />) </span>}
                      = <strong className={s("redText")}>-<CurrencyAmount amount={attendanceDeduction} /></strong>
                    </>
                  )}
                </div>
              )}
            </article>

            {/* ── Step 3: Payment Details ─────────────────────────────── */}
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h3><i className="fa-solid fa-money-check" /> Step 3 — Salary &amp; Deductions</h3>
                  <p>Enter salary components, deductions, and payment info.</p>
                </div>
              </div>
              <div className={s("formGrid")}>
                <div className={s("full")} style={{ padding: "0 0 4px" }}>
                  {!basicSalary && selectedFacultyId && (
                    <div style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: noSalaryConfigured ? "#fff7ed" : "#eff6ff",
                      border: `1px solid ${noSalaryConfigured ? "#fed7aa" : "#bfdbfe"}`,
                      color: noSalaryConfigured ? "#c2410c" : "#1d4ed8",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 4,
                    }}>
                      <i className={`fa-solid ${noSalaryConfigured ? "fa-triangle-exclamation" : "fa-circle-info"}`} />
                      {noSalaryConfigured
                        ? "No monthly salary configured for this faculty. Enter it manually below."
                        : "Enter the basic salary for this payment period."}
                    </div>
                  )}
                </div>

                <Field
                  label="Basic Salary *"
                  type="number"
                  value={basicSalary}
                  onChange={setBasicSalary}
                  placeholder="e.g. 30000"
                />
                <Field label="Bonus / Allowance" type="number" value={bonus} onChange={setBonus} placeholder="0" />

                <div className={s("full")} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", marginBottom: 10 }}>
                    <i className="fa-solid fa-circle-minus" style={{ color: "#b42318", marginRight: 6 }} />
                    Manual Deductions
                    {taxPFAutoFilled && payrollPolicy && (
                      <span style={{ marginLeft: 10, fontSize: 11, color: "#16a34a", fontWeight: 700 }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: 4 }} />
                        Tax &amp; PF pre-filled from payroll policy — adjust if needed
                      </span>
                    )}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <Field
                      label={payrollPolicy?.default_tax_percent > 0
                        ? `Tax / TDS (default ${payrollPolicy.default_tax_percent}%)`
                        : "Tax / TDS"}
                      type="number"
                      value={taxAmount}
                      onChange={(v) => { setTaxAmount(v); setTaxPFAutoFilled(false); }}
                      placeholder="0"
                    />
                    <Field
                      label={payrollPolicy?.default_pf_percent > 0
                        ? `Provident Fund (default ${payrollPolicy.default_pf_percent}%)`
                        : "Provident Fund (PF)"}
                      type="number"
                      value={providentFund}
                      onChange={(v) => { setProvidentFund(v); setTaxPFAutoFilled(false); }}
                      placeholder="0"
                    />
                    <Field label="Other Deduction" type="number" value={otherDeduction} onChange={setOtherDeduction} placeholder="0" />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Field label="Deduction Remarks" value={deductionRemarks} onChange={setDeductionRemarks} placeholder="e.g. Loan repayment, advance recovery…" />
                  </div>
                </div>

                <label className={s("field")}>
                  <span>Payment Date *</span>
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
            <h2>Salary Breakdown</h2>

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
                  <b>Configured Salary</b>
                  <strong style={{ color: selectedFaculty.monthly_salary ? "#12805c" : "#b42318", fontSize: 12 }}>
                    {selectedFaculty.monthly_salary
                      ? <><CurrencyAmount amount={selectedFaculty.monthly_salary} />/mo</>
                      : "Not configured"}
                  </strong>
                </span>
              )}
            </div>

            <div className={s("calcBreakdown")}>
              {/* Earnings */}
              <div className={s("calcRow")}>
                <span>Basic Salary</span>
                <strong><CurrencyAmount amount={basic} /></strong>
              </div>
              {bonusAmt > 0 && (
                <div className={s("calcRow")}>
                  <span>Bonus / Allowance</span>
                  <strong style={{ color: "#16a34a" }}>+<CurrencyAmount amount={bonusAmt} /></strong>
                </div>
              )}

              <div className={s("calcDivider")} />

              {/* Attendance-based deductions */}
              {working > 0 && absent > 0 && (
                <div className={s("calcRow")}>
                  <span style={{ color: "#b42318" }}>
                    Absent ({absent} day{absent !== 1 ? "s" : ""})<br />
                    <small><CurrencyAmount amount={perDaySalary} />/day × {absent}</small>
                  </span>
                  <strong style={{ color: "#b42318" }}>-<CurrencyAmount amount={absentDeduction} /></strong>
                </div>
              )}
              {working > 0 && half > 0 && (
                <div className={s("calcRow")}>
                  <span style={{ color: "#c46a14" }}>
                    Half-day ({half} day{half !== 1 ? "s" : ""})<br />
                    <small>{100 - Math.round((payrollPolicy?.half_day_pay_percent ?? 50))}% deducted per half-day</small>
                  </span>
                  <strong style={{ color: "#c46a14" }}>-<CurrencyAmount amount={halfDayDeduction} /></strong>
                </div>
              )}
              {unpaidLeaveDays > 0 && (
                <div className={s("calcRow")}>
                  <span style={{ color: "#b42318" }}>
                    Unpaid leave ({unpaidLeaveDays} day{unpaidLeaveDays !== 1 ? "s" : ""})<br />
                    <small>{leave} taken, {paidLeaveQuota} paid quota</small>
                  </span>
                  <strong style={{ color: "#b42318" }}>-<CurrencyAmount amount={leaveDeduction} /></strong>
                </div>
              )}
              {leave > 0 && unpaidLeaveDays === 0 && (
                <div className={s("calcRow")}>
                  <span style={{ color: "#16a34a" }}>
                    Leave ({leave} day{leave !== 1 ? "s" : ""} — fully paid)<br />
                    <small>Within {paidLeaveQuota}-day paid quota</small>
                  </span>
                  <strong style={{ color: "#16a34a" }}><CurrencyAmount amount={0} /></strong>
                </div>
              )}

              {/* Manual deductions */}
              {tax > 0 && (
                <div className={s("calcRow")}>
                  <span style={{ color: "#b42318" }}>Tax / TDS</span>
                  <strong style={{ color: "#b42318" }}>-<CurrencyAmount amount={tax} /></strong>
                </div>
              )}
              {pf > 0 && (
                <div className={s("calcRow")}>
                  <span style={{ color: "#b42318" }}>Provident Fund</span>
                  <strong style={{ color: "#b42318" }}>-<CurrencyAmount amount={pf} /></strong>
                </div>
              )}
              {other > 0 && (
                <div className={s("calcRow")}>
                  <span style={{ color: "#b42318" }}>Other Deduction</span>
                  <strong style={{ color: "#b42318" }}>-<CurrencyAmount amount={other} /></strong>
                </div>
              )}

              {totalDeduction > 0 && (
                <>
                  <div className={s("calcDivider")} />
                  <div className={s("calcRow")}>
                    <span style={{ color: "#b42318", fontWeight: 900 }}>Total Deductions</span>
                    <strong style={{ color: "#b42318" }}>-<CurrencyAmount amount={totalDeduction} /></strong>
                  </div>
                </>
              )}

              <div className={s("calcDivider")} />

              <div className={cx(s("calcRow"), s("calcNetRow"))}>
                <span>Net Pay</span>
                <strong style={{ color: "#16a34a", fontSize: 20 }}>
                  <CurrencyAmount amount={netPay} />
                </strong>
              </div>
            </div>

            {/* Attendance summary mini */}
            {working > 0 && (
              <div className={s("attMini")}>
                <span><i className="fa-solid fa-calendar-days" /> {working} working days</span>
                <span><i className="fa-solid fa-circle-check" style={{ color: "#12805c" }} /> {Math.round(effectivePresentDays * 10) / 10} present</span>
                {absent > 0 && <span><i className="fa-solid fa-circle-xmark" style={{ color: "#b42318" }} /> {absent} absent</span>}
                {half > 0   && <span><i className="fa-solid fa-circle-half-stroke" style={{ color: "#c46a14" }} /> {half} half-day</span>}
                {leave > 0  && (
                  <span>
                    <i className="fa-solid fa-calendar-minus" style={{ color: unpaidLeaveDays > 0 ? "#b42318" : "#16a34a" }} />
                    {leave} leave ({unpaidLeaveDays > 0 ? `${unpaidLeaveDays} unpaid` : "all paid"})
                  </span>
                )}
              </div>
            )}

            <button
              className={cx(s("btn"), s("btnPrimary"), s("wideBtn"))}
              type="button"
              onClick={handlePayment}
              disabled={paying || !basicSalary || parseFloat(basicSalary) <= 0}
              style={{ marginTop: 16, opacity: (!basicSalary || parseFloat(basicSalary) <= 0) ? 0.6 : 1 }}
            >
              {paying ? <Spinner size={16} /> : <><i className="fa-solid fa-check" /> Process Payment</>}
            </button>

            {!basicSalary && selectedFacultyId && (
              <p style={{ marginTop: 8, fontSize: 11, color: "#b42318", fontWeight: 700, textAlign: "center" }}>
                Enter basic salary above to enable payment
              </p>
            )}
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
