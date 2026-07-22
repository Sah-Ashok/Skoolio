"use client";

import Link from "next/link";
import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./expenses.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { useDateFormat } from "@/lib/useDateFormat";

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

export default function ExpensesPage() {
  const dispatch = useAppDispatch();
  const { formatDate } = useDateFormat();
  const { data: activeYear } = useApi<any>('/academic-years/active');
  const { data: expenses, loading, refetch } = useApi<any[]>(activeYear ? `/expenses?academic_year_id=${activeYear.id}` : '');
  const { data: categories } = useApi<any[]>('/expenses/categories');
  const { data: summary } = useApi<any>(activeYear ? `/expenses/summary?academic_year_id=${activeYear.id}` : '');
  const { execute: deleteExpense } = useMutation('/expenses', 'DELETE');

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const filteredExpenses = expenses?.filter(ex => {
    if (filterCategory !== "All" && ex.category_name !== filterCategory) return false;
    if (searchTerm && !ex.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }) || [];

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      try {
        await deleteExpense(undefined, `/expenses/${id}`);
        dispatch(showToast({ type: 'success', title: 'Deleted', message: 'Expense deleted successfully' }));
        refetch();
      } catch (err: any) {
        dispatch(showToast({ type: 'error', title: 'Error', message: err.message || 'Failed to delete expense' }));
      }
    }
  };

  const totalAmount = expenses?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

  return (
    <div className={s("page")}>
      <Topbar title="Expenses" subtitle="Track school spending, approvals, vendors, and category budgets" />
      <main className={s("content")}>
        <section className={s("head")}>
          <div>
            <h1>Expense Management</h1>
            <p>Review operational expenses and payment status.</p>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btnPrimary"))} href="/expenses/add">
              <i className="fa-solid fa-plus" /> Add Expense
            </Link>
          </div>
        </section>

        <section className={s("stats")}>
          <article className={cx(s("stat"), s("green"))}>
            <div><i className="fa-solid fa-wallet" /></div>
            <span>Total Expenses</span>
            <strong>₹{totalAmount.toLocaleString("en-IN")}</strong>
            <small>This Year</small>
          </article>
          <article className={cx(s("stat"), s("orange"))}>
            <div><i className="fa-solid fa-receipt" /></div>
            <span>Total Records</span>
            <strong>{expenses?.length || 0}</strong>
            <small>This Year</small>
          </article>
          <article className={cx(s("stat"), s("blue"))}>
            <div><i className="fa-solid fa-building-columns" /></div>
            <span>Categories</span>
            <strong>{categories?.length || 0}</strong>
            <small>Active</small>
          </article>
          <article className={cx(s("stat"), s("red"))}>
            <div><i className="fa-solid fa-chart-line" /></div>
            <span>Avg / Exp</span>
            <strong>₹{expenses?.length ? Math.round(totalAmount / expenses.length).toLocaleString("en-IN") : 0}</strong>
            <small>Amount</small>
          </article>
        </section>

        <section className={s("toolbar")}>
          <label className={s("search")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input 
              placeholder="Search expense..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="All">All Categories</option>
            {categories?.map((cat) => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
          </select>
        </section>

        <section className={s("grid")}>
          <article className={s("card")} style={{flex: 1}}>
            <div className={s("cardHead")}>
              <div><h3><i className="fa-solid fa-chart-simple" /> Category Summary</h3><p>Current year overview</p></div>
            </div>
            <div className={s("categoryList")}>
              {summary?.by_category?.map((item: any) => (
                <div className={s("categoryItem")} key={item.category_name}>
                  <div><strong>{item.category_name}</strong></div>
                  <b>₹{Number(item.total_amount).toLocaleString("en-IN")}</b>
                  <i><em style={{ width: `100%`, background: 'var(--primary)' }} /></i>
                </div>
              ))}
              {(!summary?.by_category || summary.by_category.length === 0) && (
                <div style={{padding: '2rem', textAlign: 'center'}}>No category summary available</div>
              )}
            </div>
          </article>

          <article className={s("card")} style={{flex: 2}}>
            <div className={s("cardHead")}>
              <div><h3><i className="fa-solid fa-table-list" /> Recent Expenses</h3><p>Latest expense records</p></div>
            </div>
            <div className={s("tableWrap")}>
              {loading ? <div style={{padding: '3rem', textAlign: 'center'}}><Spinner size={32} /></div> : (
                <table>
                  <thead>
                    <tr><th>Receipt No.</th><th>Expense</th><th>Category</th><th>Amount</th><th>Date</th><th>Vendor</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((ex) => (
                      <tr key={ex.id}>
                        <td className={s("voucher")}>{ex.receipt_number || `EXP-${ex.id}`}</td>
                        <td><strong>{ex.title}</strong></td>
                        <td>{ex.category_name}</td>
                        <td><strong>₹{Number(ex.amount).toLocaleString("en-IN")}</strong></td>
                        <td>{formatDate(ex.expense_date?.slice(0,10))}</td>
                        <td>{ex.vendor_name || '-'}</td>
                        <td>
                          <button className={cx(s("btn"), s("btnSoft"), s("btnSm"))} style={{color: '#dc2626'}} onClick={() => handleDelete(ex.id)}>
                            <i className="fa-solid fa-trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredExpenses.length === 0 && (
                      <tr><td colSpan={7} style={{textAlign: 'center', padding: '2rem'}}>No expenses found.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
