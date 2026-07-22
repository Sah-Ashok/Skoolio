"use client";

import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./fees.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

type FeeHead = {
  id: number;
  name: string;
  cycle: string;
  amount: string;
  billing_start_rule: string;
  scholarship_applies: boolean;
};

const initialFeeHeads: FeeHead[] = [
  { id: 1, name: "Tuition Fee", cycle: "monthly", amount: "2000", billing_start_rule: "next_month", scholarship_applies: true }
];

export default function AddFeeStructurePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { activeYear, academicYearId } = useAcademicYear();
  const { data: classes } = useApi<any[]>(academicYearId ? `/classes?academic_year_id=${academicYearId}` : '', [academicYearId]);
  const { execute: saveStructure, loading: saving } = useMutation('/fees/structures', 'POST');

  const [classId, setClassId] = useState("");
  const [feeHeads, setFeeHeads] = useState(initialFeeHeads);

  useEffect(() => {
    if (classes && classes.length > 0 && !classId) {
      setClassId(classes[0].id.toString());
    }
  }, [classes, classId]);

  const estimatedTotal = feeHeads.reduce((total, head) => {
    const amt = Number(head.amount || 0);
    // If it's skip_two_months, it's 10 months. If next_month, it's typically 12 for the whole year (or 11 depending on admission, but 12 is standard).
    // Let's use standard estimation.
    let multiplier = head.cycle === "monthly" ? 12 : head.cycle === "quarterly" ? 4 : head.cycle === "half_yearly" ? 2 : 1;
    if (head.cycle === "monthly" && head.billing_start_rule === "skip_two_months") multiplier = 10;
    return total + (amt * multiplier);
  }, 0);

  const updateFeeHead = (id: number, key: keyof FeeHead, value: string) => {
    setFeeHeads((heads) => heads.map((head) => head.id === id ? { ...head, [key]: value } : head));
  };

  const addFeeHead = () => {
    setFeeHeads((heads) => [
      ...heads,
      { id: Date.now(), name: "", cycle: "monthly", amount: "", billing_start_rule: "next_month", scholarship_applies: true },
    ]);
  };

  const addStoreItem = () => {
    setFeeHeads((heads) => [
      ...heads,
      { id: Date.now(), name: "Store Item", cycle: "one_time", amount: "", billing_start_rule: "next_month", scholarship_applies: false },
    ]);
  };

  const removeFeeHead = (id: number) => {
    setFeeHeads((heads) => heads.length === 1 ? heads : heads.filter((head) => head.id !== id));
  };

  const handleSave = async () => {
    if (!activeYear || !academicYearId || !classId) return dispatch(showToast({ type: 'error', title: 'Error', message: 'Missing academic year or class' }));
    
    let hasError = false;
    for (const head of feeHeads) {
      if (!head.name || !head.amount || Number(head.amount) <= 0) {
        hasError = true;
        break;
      }
    }
    if (hasError) return dispatch(showToast({ type: 'error', title: 'Error', message: 'Please fill all fee head details properly' }));

    try {
      // Loop and save each
      for (const head of feeHeads) {
        await saveStructure({
          academic_year_id: academicYearId,
          class_id: parseInt(classId),
          fee_name: head.name,
          amount: parseFloat(head.amount),
          frequency: head.cycle,
          due_date_type: 'fixed_day',
          due_day: 10,
          billing_start_rule: head.billing_start_rule,
          scholarship_applies: head.scholarship_applies,
        });
      }
      
      dispatch(showToast({ type: 'success', title: 'Success', message: 'Fee structures saved successfully' }));
      router.push('/fees/structures?saved=1');
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Error', message: err.message || 'Failed to save' }));
    }
  };

  return (
    <div className={s("fees-page")}>
      <Topbar title="Add Fee Structure" subtitle="Create class-wise fee plans for the academic year" />
      <main className={s("page-content")}>
        <section className={cx(s("page-head"), s("structure-head"))}>
          <div>
            <h1>Create Fee Structure</h1>
            <p>Academic Year {activeYear?.year_name}</p>
          </div>
          <Link className={cx(s("btn"), s("btn-outline"))} href="/fees/structures">
            <i className="fa-solid fa-arrow-left" /> Back
          </Link>
        </section>

        <section className={s("structure-layout")}>
          <div className={s("structure-main")}>
            <FormCard icon="fa-school" title="Structure Details" step="01">
              <div className={s("form-grid")}>
                <Field label="Academic Year">
                  <input value={activeYear?.year_name || 'Loading...'} readOnly disabled />
                </Field>
                <Field label="Class" required>
                  <select value={classId} onChange={(e) => setClassId(e.target.value)}>
                    {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              </div>
            </FormCard>

            <FormCard icon="fa-list-check" title="Fee Heads" step="02">
              <div className={s("fee-head-list")}>
                {feeHeads.map((head) => (
                  <div className={s("fee-head-row")} key={head.id}>
                    <input
                      onChange={(e) => updateFeeHead(head.id, "name", e.target.value)}
                      placeholder="Fee head name (e.g. Tuition)"
                      value={head.name}
                    />
                    <select value={head.cycle} onChange={(e) => updateFeeHead(head.id, "cycle", e.target.value)}>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="half_yearly">Half Yearly</option>
                      <option value="yearly">Yearly</option>
                      <option value="one_time">One Time</option>
                    </select>
                    {head.cycle === 'monthly' && (
                      <select value={head.billing_start_rule} onChange={(e) => updateFeeHead(head.id, "billing_start_rule", e.target.value)}>
                        <option value="next_month">Next Month (Default)</option>
                        <option value="skip_two_months">Skip 2 Months</option>
                        <option value="academic_year">From Academic Year</option>
                      </select>
                    )}
                    <input
                      type="number"
                      onChange={(e) => updateFeeHead(head.id, "amount", e.target.value)}
                      placeholder="Amount"
                      value={head.amount}
                    />
                    <label title="Choose whether a student's scholarship discount applies to this fee head." style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", color: "#425466" }}>
                      <input
                        type="checkbox"
                        checked={head.scholarship_applies}
                        onChange={(e) => setFeeHeads(heads => heads.map(item => item.id === head.id ? { ...item, scholarship_applies: e.target.checked } : item))}
                      />
                      Scholarship applies
                    </label>
                    <button className={cx(s("btn"), s("btn-danger"), s("btn-sm"), s("icon-btn"))} onClick={() => removeFeeHead(head.id)} type="button">
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button className={cx(s("btn"), s("btn-soft"), s("add-line-btn"))} onClick={addFeeHead} type="button">
                  <i className="fa-solid fa-plus" /> Add Fee Head
                </button>
                <button className={cx(s("btn"), s("btn-outline"), s("add-line-btn"))} onClick={addStoreItem} type="button">
                  <i className="fa-solid fa-cart-shopping" /> Miscellaneous / Store Item
                </button>
              </div>
            </FormCard>
          </div>

          <aside className={s("structure-side")}>
            <div className={s("summary-card")}>
              <div className={s("summary-icon")}><i className="fa-solid fa-file-invoice-dollar" /></div>
              <h3>Plan Summary</h3>
              <div className={s("summary-lines")}>
                <span><b>Class</b><strong>{classes?.find(c => c.id.toString() === classId)?.name || '...'}</strong></span>
                <span><b>Academic Year</b><strong>{activeYear?.year_name || '...'}</strong></span>
                <span><b>Due Date</b><strong>10th of cycle</strong></span>
                <span><b>Estimated Annual Total</b><strong>₹{estimatedTotal.toLocaleString("en-IN")} / student</strong></span>
              </div>
            </div>

            <div className={s("save-panel")}>
              <button className={cx(s("btn"), s("btn-primary"))} type="button" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size={16} /> : <><i className="fa-solid fa-floppy-disk" /> Save Structure</>}
              </button>
              <Link className={cx(s("btn"), s("btn-outline"))} href="/fees/structures">
                Cancel
              </Link>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function FormCard({ icon, title, step, children }: { icon: string; title: string; step: string; children: ReactNode }) {
  return (
    <article className={s("form-card")}>
      <div className={s("form-card-head")}>
        <h2><i className={`fa-solid ${icon}`} /> {title}</h2>
        <span>{step}</span>
      </div>
      <div className={s("form-card-body")}>{children}</div>
    </article>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className={s("field")}>
      <span>{label}{required ? <b style={{color:'red'}}>*</b> : null}</span>
      {children}
    </label>
  );
}
