"use client";

import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./expenses.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import DateInput from "@/components/shared/DateInput";

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

export default function AddExpensePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { data: activeYear } = useApi<any>('/academic-years/active');
  const { data: categoriesData, refetch: refetchCategories } = useApi<any[]>('/expenses/categories');
  const { execute: createExpense, loading: saving } = useMutation('/expenses', 'POST');
  const { execute: createCategory, loading: creatingCat } = useMutation('/expenses/categories', 'POST');

  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [title, setTitle] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [vendorName, setVendorName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (categoriesData && categoriesData.length > 0 && !categoryId) {
      setCategoryId(categoriesData[0].id.toString());
    }
  }, [categoriesData, categoryId]);

  const addCategory = async () => {
    const value = newCategory.trim();
    if (!value) return;
    try {
      await createCategory({ name: value, description: "" });
      dispatch(showToast({ type: 'success', title: 'Category added', message: 'Category added successfully' }));
      setNewCategory("");
      refetchCategories();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Error', message: err.message || 'Failed to add category' }));
    }
  };

  const handleSave = async () => {
    if (!activeYear || !categoryId || !title || !amount) {
      return dispatch(showToast({ type: 'error', title: 'Error', message: 'Please fill required fields' }));
    }

    try {
      await createExpense({
        academic_year_id: activeYear.id,
        category_id: parseInt(categoryId),
        title,
        description: description || undefined,
        amount: parseFloat(amount),
        expense_date: expenseDate,
        payment_method: paymentMode,
        receipt_number: receiptNumber || undefined,
        vendor_name: vendorName || undefined,
      });
      
      dispatch(showToast({ type: 'success', title: 'Success', message: 'Expense recorded successfully' }));
      router.push('/expenses');
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Error', message: err.message || 'Failed to record expense' }));
    }
  };

  const needsReference = paymentMode !== "cash";

  return (
    <div className={s("page")}>
      <Topbar title="Add Expense" subtitle="Record school operating expenses and payment details" />
      <main className={s("content")}>
        <section className={s("head")}>
          <div>
            <h1>Add Expense</h1>
            <p>Create a voucher for campus, office, utility, event, or vendor spending.</p>
          </div>
          <Link className={cx(s("btn"), s("btnOutline"))} href="/expenses">
            <i className="fa-solid fa-arrow-left" /> Back to Expenses
          </Link>
        </section>

        <section className={s("formLayout")}>
          <div className={s("formStack")}>
            <FormCard icon="fa-receipt" title="Expense Details" step="01">
              <div className={s("formGrid")}>
                <Field label="Expense Title" required><input placeholder="Example: Electricity Bill" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
                <Field label="Receipt No. (optional)"><input placeholder="EXP-2025-042" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} /></Field>
                <Field label="Category" required>
                  <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    {categoriesData?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Amount" required><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" placeholder="0" /></Field>
                <Field label="Expense Date" required><DateInput value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} /></Field>
              </div>
              <div className={s("inlineCreate")}>
                <div><strong>Add category</strong><span>Create school-specific expense categories.</span></div>
                <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Category name" disabled={creatingCat} />
                <button className={cx(s("btn"), s("btnSoft"))} onClick={addCategory} type="button" disabled={creatingCat}>
                  {creatingCat ? <Spinner size={16} /> : <><i className="fa-solid fa-plus" /> Add</>}
                </button>
              </div>
            </FormCard>

            <FormCard icon="fa-credit-card" title="Payment Details" step="02">
              <div className={s("formGrid")}>
                <Field label="Payment Mode" required>
                  <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="online">Online</option>
                    <option value="cheque">Cheque</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </Field>
                <Field label="Paid To (Vendor)"><input placeholder="Vendor / receiver name" value={vendorName} onChange={(e) => setVendorName(e.target.value)} /></Field>
                <Field label="Notes" full><textarea placeholder="Add payment note or purchase detail" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
              </div>
            </FormCard>
          </div>

          <aside className={s("sidePanel")}>
            <div className={s("summaryBox")}>
              <div className={s("summaryIcon")}><i className="fa-solid fa-wallet" /></div>
              <h3>Expense Summary</h3>
              <div className={s("summaryRows")}>
                <span><b>Category</b><strong>{categoriesData?.find(c => c.id.toString() === categoryId)?.name || '...'}</strong></span>
                <span><b>Payment</b><strong style={{textTransform: 'capitalize'}}>{paymentMode.replace('_', ' ')}</strong></span>
                <span><b>Amount</b><strong>₹{Number(amount || 0).toLocaleString("en-IN")}</strong></span>
              </div>
            </div>
            <div className={s("saveBox")}>
              <button className={cx(s("btn"), s("btnPrimary"))} type="button" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size={16} /> : <><i className="fa-solid fa-floppy-disk" /> Save Expense</>}
              </button>
              <Link className={cx(s("btn"), s("btnOutline"))} href="/expenses">Cancel</Link>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function FormCard({ icon, title, step, children }: { icon: string; title: string; step: string; children: ReactNode }) {
  return (
    <article className={s("formCard")}>
      <div className={s("formCardHead")}>
        <h2><i className={`fa-solid ${icon}`} /> {title}</h2>
        <span>{step}</span>
      </div>
      <div className={s("formCardBody")}>{children}</div>
    </article>
  );
}

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: ReactNode }) {
  return (
    <label className={cx(s("field"), full && s("full"))}>
      <span>{label}{required ? <b style={{color: '#dc2626'}}>*</b> : null}</span>
      {children}
    </label>
  );
}
