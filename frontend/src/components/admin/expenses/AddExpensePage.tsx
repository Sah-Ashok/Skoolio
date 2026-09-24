"use client";

import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import styles from "./expenses.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import DateInput from "@/components/shared/DateInput";
import { useCurrency, CurrencyAmount, CurrencySymbol } from "@/lib/useCurrency";

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

export default function AddExpensePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { fmt } = useCurrency();
  const user = useAppSelector((state) => state.auth.user);
  const backUrl = user?.role === 'finance' ? '/finance/expenses' : '/expenses';
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
      return dispatch(showToast({ type: 'error', title: 'Error', message: 'Please fill required fields (Title, Category, Amount)' }));
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
      router.push(backUrl);
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Error', message: err.message || 'Failed to record expense' }));
    }
  };

  const selectedCategoryName = categoriesData?.find(c => c.id.toString() === categoryId)?.name || 'Select Category';

  return (
    <div className={s("page")}>
      <main className={s("content")}>
        {/* ── Page Header ── */}
        <section className={s("head")}>
          <div className={s("headLeft")}>
            <div className={s("headIcon")}>
              <i className="fa-solid fa-file-circle-plus" />
            </div>
            <div>
              <h1>Add Expense</h1>
              <p>Record an institutional voucher for utilities, purchases, events, or vendor payments.</p>
            </div>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btnOutline"))} href={backUrl}>
              <i className="fa-solid fa-arrow-left" /> Back to Expenses
            </Link>
          </div>
        </section>

        {/* ── Form Layout ── */}
        <section className={s("formLayout")}>
          <div className={s("formStack")}>
            {/* Step 1: Expense Details */}
            <FormCard icon="fa-receipt" title="Expense Details" step="01">
              <div className={s("formGrid")}>
                <Field label="Expense Title" required>
                  <input 
                    placeholder="Example: Electricity Bill / Science Lab Equipment" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                  />
                </Field>

                <Field label="Receipt / Voucher No. (optional)">
                  <input 
                    placeholder="VCH-2025-042" 
                    value={receiptNumber} 
                    onChange={(e) => setReceiptNumber(e.target.value)} 
                  />
                </Field>

                <Field label="Category" required>
                  <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    {categoriesData?.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label={<>Amount (<CurrencySymbol />)</>} required>
                  <input 
                    value={amount} 
                    onChange={(event) => setAmount(event.target.value)} 
                    type="number" 
                    placeholder="0.00" 
                    min="0"
                    step="any"
                  />
                </Field>

                <Field label="Expense Date" required>
                  <DateInput value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
                </Field>
              </div>

              {/* Quick Add Category Bar */}
              <div className={s("inlineCreate")}>
                <div className={s("inlineCreateText")}>
                  <strong>Need a new category?</strong>
                  <span>Create school-specific expense categories instantly.</span>
                </div>
                <input 
                  className={s("inlineCreateInput")}
                  value={newCategory} 
                  onChange={(event) => setNewCategory(event.target.value)} 
                  placeholder="e.g. Sports Equipment" 
                  disabled={creatingCat} 
                />
                <button 
                  className={cx(s("btn"), s("btnSoft"))} 
                  onClick={addCategory} 
                  type="button" 
                  disabled={creatingCat || !newCategory.trim()}
                >
                  {creatingCat ? <Spinner size={14} /> : <><i className="fa-solid fa-plus" /> Add Category</>}
                </button>
              </div>
            </FormCard>

            {/* Step 2: Payment & Vendor Details */}
            <FormCard icon="fa-credit-card" title="Payment & Vendor Details" step="02">
              <div className={s("formGrid")}>
                <Field label="Payment Mode" required>
                  <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="online">Online / UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </Field>

                <Field label="Paid To (Vendor / Beneficiary)">
                  <input 
                    placeholder="e.g. Nepal Electricity Authority / Sharma Stationary" 
                    value={vendorName} 
                    onChange={(e) => setVendorName(e.target.value)} 
                  />
                </Field>

                <Field label="Notes / Description" full>
                  <textarea 
                    placeholder="Add payment notes, bill numbers, items purchased, or approval details..." 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                  />
                </Field>
              </div>
            </FormCard>
          </div>

          {/* ── Summary & Actions Sidebar ── */}
          <aside className={s("sidePanel")}>
            <div className={s("summaryBox")}>
              <div className={s("summaryTop")}>
                <div className={s("summaryIcon")}>
                  <i className="fa-solid fa-wallet" />
                </div>
                <div>
                  <h3>Voucher Summary</h3>
                  <p>Live preview of record</p>
                </div>
              </div>

              <div className={s("summaryRows")}>
                <div className={s("summaryRow")}>
                  <b>Category</b>
                  <strong>{selectedCategoryName}</strong>
                </div>
                <div className={s("summaryRow")}>
                  <b>Payment Mode</b>
                  <strong style={{ textTransform: 'capitalize' }}>{paymentMode.replace('_', ' ')}</strong>
                </div>
                <div className={s("summaryRow")}>
                  <b>Vendor</b>
                  <strong>{vendorName || '—'}</strong>
                </div>
                <div className={s("summaryTotalRow")}>
                  <b>Total Amount</b>
                  <strong><CurrencyAmount amount={amount} /></strong>
                </div>
              </div>
            </div>

            <div className={s("saveBox")}>
              <button 
                className={cx(s("btn"), s("btnPrimary"))} 
                type="button" 
                onClick={handleSave} 
                disabled={saving}
              >
                {saving ? (
                  <Spinner size={16} color="#fff" />
                ) : (
                  <><i className="fa-solid fa-floppy-disk" /> Save Expense Voucher</>
                )}
              </button>
              <Link className={cx(s("btn"), s("btnOutline"))} href={backUrl}>
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
    <article className={s("formCard")}>
      <div className={s("formCardHead")}>
        <h2>
          <i className={`fa-solid ${icon}`} />
          {title}
        </h2>
        <span>{step}</span>
      </div>
      <div className={s("formCardBody")}>{children}</div>
    </article>
  );
}

function Field({ label, required, full, children }: { label: ReactNode; required?: boolean; full?: boolean; children: ReactNode }) {
  return (
    <label className={cx(s("field"), full && s("full"))}>
      <span>
        {label}
        {required ? <b style={{ color: '#dc2626', marginLeft: 3 }}>*</b> : null}
      </span>
      {children}
    </label>
  );
}
