"use client";

import { useState, useEffect } from "react";
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
import { adToBS, BS_MONTH_NAMES } from "@/lib/bs-ad";

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const AD_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/** Generate a range of years centred on now, for AD or BS */
function buildYearOptions(isBS: boolean): string[] {
  const now   = new Date();
  const baseY = isBS ? adToBS(now).year : now.getFullYear();
  // Show 3 years back and 1 ahead so admins can catch up on past payments
  return Array.from({ length: 5 }, (_, i) => String(baseY - 3 + i));
}

export default function PaySalaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const preselectedFaculty = searchParams?.get('faculty');
  const { isBS } = useDateFormat();

  // Calendar-aware labels
  const monthNames = isBS ? BS_MONTH_NAMES : AD_MONTHS;
  const yearOptions = buildYearOptions(isBS);

  // Default to current month/year in the school's calendar
  const nowBS = adToBS(new Date());
  const defaultMonth = isBS ? BS_MONTH_NAMES[nowBS.month - 1] : AD_MONTHS[new Date().getMonth()];
  const defaultYear  = isBS ? String(nowBS.year) : String(new Date().getFullYear());

  const { data: facultyList, loading: facultyLoading } = useApi<any[]>('/teachers');
  const { data: activeYear } = useApi<any>('/academic-years/active');
  const { execute: paySalary, loading: paying } = useMutation('/teachers/salary', 'POST');

  const [selectedFacultyId, setSelectedFacultyId] = useState<string>(preselectedFaculty || "");
  const [selectedYear,  setSelectedYear]  = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  // month number 1–12 based on the displayed calendar (BS or AD)
  const selectedMonthNumber = monthNames.indexOf(selectedMonth) + 1;

  const [basicSalary,      setBasicSalary]      = useState("");
  const [bonus,            setBonus]            = useState("0");
  const [taxAmount,        setTaxAmount]        = useState("0");
  const [providentFund,    setProvidentFund]    = useState("0");
  const [otherDeduction,   setOtherDeduction]   = useState("0");
  const [deductionRemarks, setDeductionRemarks] = useState("");
  const [paymentMode,      setPaymentMode]      = useState("Bank Transfer");
  const [paymentDate,      setPaymentDate]      = useState("");
  const [remarks,          setRemarks]          = useState("");

  const totalDeduction = parseFloat(taxAmount||'0') + parseFloat(providentFund||'0') + parseFloat(otherDeduction||'0');

  useEffect(() => {
    if (preselectedFaculty && !selectedFacultyId) {
      setSelectedFacultyId(preselectedFaculty);
    }
  }, [preselectedFaculty, selectedFacultyId]);

  const selectedFaculty = facultyList?.find(f => f.id.toString() === selectedFacultyId);

  // Auto-fill basic salary from teacher's monthly_salary when faculty is selected
  useEffect(() => {
    if (selectedFaculty?.monthly_salary) {
      setBasicSalary(String(selectedFaculty.monthly_salary));
    }
  }, [selectedFacultyId, selectedFaculty?.monthly_salary]);

  const netPay = parseFloat(basicSalary || '0') + parseFloat(bonus || '0') - totalDeduction;

  const handlePayment = async () => {
    if (!selectedFacultyId || !activeYear?.id || !basicSalary || !paymentDate) {
      dispatch(showToast({ type: "error", title: "Error", message: "Please fill all required fields" }));
      return;
    }

    try {
      await paySalary({
        academic_year_id:  activeYear.id,
        teacher_id:        parseInt(selectedFacultyId),
        basic_salary:      parseFloat(basicSalary),
        month:             selectedMonthNumber,
        year:              parseInt(selectedYear),
        status:            "paid",
        bonus:             parseFloat(bonus),
        tax_amount:        parseFloat(taxAmount),
        provident_fund:    parseFloat(providentFund),
        other_deduction:   parseFloat(otherDeduction),
        deduction_remarks: deductionRemarks || undefined,
        payment_date:      paymentDate,
        payment_method:    paymentMode.toLowerCase().replace(' ', '_'),
        remarks,
      });
      dispatch(showToast({ type: "success", title: "Success", message: "Salary paid successfully" }));
      router.push('/salary');
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Payment failed" }));
    }
  };

  return (
    <div className={s("page")}>
      <Topbar title="Pay Faculty Salary" subtitle="Select faculty, month and process payment" />

      <main className={s("content")}>
        <section className={s("head")}>
          <div>
            <h1>Pay Salary</h1>
            <p>Record salary payment.</p>
          </div>
          <Link className={cx(s("btn"), s("btnOutline"))} href="/salary">
            <i className="fa-solid fa-arrow-left" /> Back to Salary
          </Link>
        </section>

        <section className={s("processLayout")}>
          <div className={s("formStack")}>
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div><h3><i className="fa-solid fa-money-check" /> Payment Details</h3><p>Record salary payment.</p></div>
              </div>
              <div className={s("formGrid")}>
                <Field 
                  label="Select Faculty" 
                  value={selectedFacultyId} 
                  onChange={setSelectedFacultyId} 
                  select 
                  options={facultyList?.map(f => ({ label: `${f.full_name} (ID: ${f.id})`, value: f.id.toString() })) || []} 
                  disabled={facultyLoading}
                />
                <Field label="Payment Year"  value={selectedYear}  onChange={setSelectedYear}  select options={yearOptions.map(y => ({ label: y, value: y }))} />
                <Field label="Payment Month" value={selectedMonth} onChange={setSelectedMonth} select options={monthNames.map(m => ({ label: m, value: m }))} />
                <Field label="Basic Salary" type="number" value={basicSalary} onChange={setBasicSalary} placeholder="e.g. 30000" />
                <Field label="Bonus / Allowance" type="number" value={bonus} onChange={setBonus} />
                <div className={s("full")} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", marginBottom: 10 }}>
                    <i className="fa-solid fa-circle-minus" style={{ color: "#b42318", marginRight: 6 }} />
                    Deductions Breakdown
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
                <Field label="Payment Mode" value={paymentMode} onChange={setPaymentMode} select options={["Bank Transfer", "Cash", "Cheque"].map(m => ({label: m, value: m}))} />
                <Field label="Remarks" textarea className={s("full")} placeholder="Salary payment note" value={remarks} onChange={setRemarks} />
              </div>
            </article>
          </div>

          <aside className={s("summaryCard")}>
            <div className={s("summaryIcon")}><i className="fa-solid fa-receipt" /></div>
            <h2>Payment Summary</h2>
            <div className={s("summaryRows")}>
              <span><b>Faculty</b><strong>{selectedFaculty ? selectedFaculty.full_name : "Not Selected"}</strong></span>
              <span><b>Month</b><strong>{selectedMonth} {selectedYear}</strong></span>
              <span><b>Basic</b><strong>₹{basicSalary || 0}</strong></span>
              <span><b>Bonus</b><strong style={{ color: "#16a34a" }}>+₹{bonus || 0}</strong></span>
              <hr style={{ margin: '10px 0', borderColor: '#eee' }} />
              <p style={{ fontSize: 11, fontWeight: 900, color: "#6a7882", margin: "4px 0" }}>Deductions</p>
              <span><b>Tax / TDS</b><strong style={{ color: "#b42318" }}>-₹{taxAmount || 0}</strong></span>
              <span><b>Provident Fund</b><strong style={{ color: "#b42318" }}>-₹{providentFund || 0}</strong></span>
              <span><b>Other</b><strong style={{ color: "#b42318" }}>-₹{otherDeduction || 0}</strong></span>
              <span><b>Total Deduction</b><strong style={{ color: "#b42318" }}>-₹{totalDeduction.toFixed(0)}</strong></span>
              <hr style={{ margin: '10px 0', borderColor: '#eee' }} />
              <span><b style={{ fontSize: '18px' }}>Net Pay</b><strong style={{ fontSize: '18px', color: '#16a34a' }}>₹{netPay.toFixed(0)}</strong></span>
            </div>
            <button className={cx(s("btn"), s("btnPrimary"), s("wideBtn"))} type="button" onClick={handlePayment} disabled={paying}>
              {paying ? <Spinner size={16} /> : <><i className="fa-solid fa-check" /> Process Payment</>}
            </button>
          </aside>
        </section>
      </main>
    </div>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
  textarea,
  className,
  select,
  options,
  value,
  onChange,
  disabled
}: {
  label: string;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
  className?: string;
  select?: boolean;
  options?: {label: string, value: string}[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cx(s("field"), className)}>
      <span>{label}</span>
      {select ? (
        <select value={value} onChange={(event) => onChange?.(event.target.value)} disabled={disabled}>
          <option value="">Select...</option>
          {options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : textarea ? (
        <textarea placeholder={placeholder} value={value} onChange={(event) => onChange?.(event.target.value)} disabled={disabled} />
      ) : (
        <input type={type} placeholder={placeholder} value={value} onChange={(event) => onChange?.(event.target.value)} disabled={disabled} />
      )}
    </label>
  );
}
