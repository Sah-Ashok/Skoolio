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

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const years = ["2024", "2025", "2026"];

export default function PaySalaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const preselectedFaculty = searchParams?.get('faculty');

  const { data: facultyList, loading: facultyLoading } = useApi<any[]>('/teachers');
  const { data: activeYear } = useApi<any>('/academic-years/active');
  const { execute: paySalary, loading: paying } = useMutation('/teachers/salary', 'POST');

  const [selectedFacultyId, setSelectedFacultyId] = useState<string>(preselectedFaculty || "");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedMonth, setSelectedMonth] = useState("June");
  const selectedMonthNumber = months.indexOf(selectedMonth) + 1;
  const [basicSalary, setBasicSalary] = useState("");
  const [bonus, setBonus] = useState("0");
  const [deduction, setDeduction] = useState("0");
  const [paymentMode, setPaymentMode] = useState("Bank Transfer");
  const [paymentDate, setPaymentDate] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (preselectedFaculty && !selectedFacultyId) {
      setSelectedFacultyId(preselectedFaculty);
    }
  }, [preselectedFaculty, selectedFacultyId]);

  const selectedFaculty = facultyList?.find(f => f.id.toString() === selectedFacultyId);

  const netPay = parseFloat(basicSalary || '0') + parseFloat(bonus || '0') - parseFloat(deduction || '0');

  const handlePayment = async () => {
    if (!selectedFacultyId || !activeYear?.id || !basicSalary || !paymentDate) {
      dispatch(showToast({ type: "error", title: "Error", message: "Please fill all required fields" }));
      return;
    }

    try {
      const res = await paySalary({
        academic_year_id: activeYear.id,
        teacher_id: parseInt(selectedFacultyId),
        basic_salary: parseFloat(basicSalary),
        month: selectedMonthNumber,
        year: parseInt(selectedYear),
        status: "paid",
        bonus: parseFloat(bonus),
        deduction: parseFloat(deduction),
        payment_date: paymentDate,
        payment_method: paymentMode.toLowerCase().replace(' ', '_'),
        remarks
      });

      if (res) {
        dispatch(showToast({ type: "success", title: "Success", message: "Salary paid successfully" }));
        router.push('/salary');
      }
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
                <Field label="Payment Year" value={selectedYear} onChange={setSelectedYear} select options={years.map(y => ({label: y, value: y}))} />
                <Field label="Payment Month" value={selectedMonth} onChange={setSelectedMonth} select options={months.map(m => ({label: m, value: m}))} />
                <Field label="Basic Salary" type="number" value={basicSalary} onChange={setBasicSalary} placeholder="e.g. 30000" />
                <Field label="Bonus" type="number" value={bonus} onChange={setBonus} />
                <Field label="Deduction" type="number" value={deduction} onChange={setDeduction} />
                <Field label="Payment Date" type="date" value={paymentDate} onChange={setPaymentDate} />
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
              <span><b>Bonus</b><strong>+₹{bonus || 0}</strong></span>
              <span><b>Deduction</b><strong>-₹{deduction || 0}</strong></span>
              <hr style={{margin: '10px 0', borderColor: '#eee'}} />
              <span><b style={{fontSize: '18px'}}>Net Pay</b><strong style={{fontSize: '18px', color: '#16a34a'}}>₹{netPay}</strong></span>
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
