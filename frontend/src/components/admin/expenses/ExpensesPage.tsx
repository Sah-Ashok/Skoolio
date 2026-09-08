"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import styles from "./expenses.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { Skeleton, SkeletonStatRow, SkeletonTable } from "@/components/shared/Skeleton";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { useDateFormat } from "@/lib/useDateFormat";
import ConfirmModal from "@/components/shared/ConfirmModal";

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const CATEGORY_PALETTE = [
  { fill: "#FF9B51", bg: "#FFF7ED", text: "#EA580C" },
  { fill: "#3B82F6", bg: "#EFF6FF", text: "#1D4ED8" },
  { fill: "#10B981", bg: "#ECFDF5", text: "#047857" },
  { fill: "#8B5CF6", bg: "#F5F3FF", text: "#6D28D9" },
  { fill: "#EC4899", bg: "#FDF2F8", text: "#BE185D" },
  { fill: "#F59E0B", bg: "#FEF3C7", text: "#B45309" },
  { fill: "#06B6D4", bg: "#ECFEFF", text: "#0E7490" },
  { fill: "#64748B", bg: "#F1F5F9", text: "#334155" },
];

function getCategoryColor(index: number) {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}

interface ExpensesPageProps {
  readOnly?: boolean;
  addUrl?: string;
}

export default function ExpensesPage({ readOnly, addUrl }: ExpensesPageProps = {}) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isReadOnly = readOnly ?? (user?.role === "admin");
  const recordExpenseUrl = addUrl || (user?.role === "finance" ? "/finance/expenses/add" : "/expenses/add");
  const { formatDate } = useDateFormat();
  
  const { data: activeYear } = useApi<any>('/academic-years/active');
  const { data: expenses, loading, refetch } = useApi<any[]>(
    activeYear ? `/expenses?academic_year_id=${activeYear.id}` : ''
  );
  const { data: categories } = useApi<any[]>('/expenses/categories');
  const { data: summary } = useApi<any>(
    activeYear ? `/expenses/summary?academic_year_id=${activeYear.id}` : ''
  );
  const { execute: deleteExpense } = useMutation('/expenses', 'DELETE');

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Reset page to 1 on filter or sort change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterCategory, sortBy, pageSize]);

  // Computed metrics
  const totalAmount = useMemo(() => {
    return expenses?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;
  }, [expenses]);

  const avgAmount = useMemo(() => {
    if (!expenses?.length) return 0;
    return Math.round(totalAmount / expenses.length);
  }, [expenses, totalAmount]);

  // Filter and sort
  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    
    let result = expenses.filter(ex => {
      if (filterCategory !== "All" && ex.category_name !== filterCategory) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = ex.title?.toLowerCase().includes(q);
        const matchVoucher = ex.receipt_number?.toLowerCase().includes(q);
        const matchVendor = ex.vendor_name?.toLowerCase().includes(q);
        const matchCategory = ex.category_name?.toLowerCase().includes(q);
        if (!matchTitle && !matchVoucher && !matchVendor && !matchCategory) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.expense_date || 0).getTime() - new Date(a.expense_date || 0).getTime();
      if (sortBy === "oldest") return new Date(a.expense_date || 0).getTime() - new Date(b.expense_date || 0).getTime();
      if (sortBy === "highest") return Number(b.amount || 0) - Number(a.amount || 0);
      if (sortBy === "lowest") return Number(a.amount || 0) - Number(b.amount || 0);
      return 0;
    });

    return result;
  }, [expenses, filterCategory, searchTerm, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filteredExpenses.length);
  const paginatedExpenses = filteredExpenses.slice(startIdx, endIdx);

  const [expenseToDelete, setExpenseToDelete] = useState<{ id: number; title: string } | null>(null);

  const handleDelete = (id: number, title: string) => {
    setExpenseToDelete({ id, title });
  };

  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await deleteExpense(undefined, `/expenses/${expenseToDelete.id}`);
      dispatch(showToast({ type: 'success', title: 'Deleted', message: 'Expense deleted successfully' }));
      refetch();
      setExpenseToDelete(null);
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Error', message: err.message || 'Failed to delete expense' }));
    }
  };

  return (
    <div className={s("page")}>
      <main className={s("content")}>
        {/* ── Page Header ── */}
        <section className={s("head")}>
          <div className={s("headLeft")}>
            <div className={s("headIcon")}>
              <i className="fa-solid fa-receipt" />
            </div>
            <div>
              <h1>Expense Management</h1>
              <p>Review and monitor institutional spending, vendor payments, and category budgets.</p>
            </div>
          </div>
          <div className={s("actions")}>
            {isReadOnly ? (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 16px",
                borderRadius: "999px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                color: "#475569",
                fontSize: "12.5px",
                fontWeight: "700",
              }}>
                <i className="fa-solid fa-shield-halved" style={{ color: "#64748b" }} /> Audit View (Read-Only)
              </span>
            ) : (
              <Link className={cx(s("btn"), s("btnPrimary"))} href={recordExpenseUrl}>
                <i className="fa-solid fa-plus" /> Record Expense
              </Link>
            )}
          </div>
        </section>

        {/* ── Metric Summary Cards ── */}
        {loading && !expenses ? (
          <div style={{ marginBottom: "1.5rem" }}>
            <SkeletonStatRow count={4} />
          </div>
        ) : (
          <section className={s("stats")}>
            <article className={s("statCard")}>
              <div className={s("statInfo")}>
                <span className={s("statLabel")}>Total Expenses</span>
                <strong className={s("statValue")}>₹{totalAmount.toLocaleString("en-IN")}</strong>
                <span className={s("statSub")}>Active academic session</span>
              </div>
              <div className={cx(s("statIconWrap"), s("iconGreen"))}>
                <i className="fa-solid fa-wallet" />
              </div>
            </article>

            <article className={s("statCard")}>
              <div className={s("statInfo")}>
                <span className={s("statLabel")}>Total Vouchers</span>
                <strong className={s("statValue")}>{expenses?.length || 0}</strong>
                <span className={s("statSub")}>Recorded entries</span>
              </div>
              <div className={cx(s("statIconWrap"), s("iconOrange"))}>
                <i className="fa-solid fa-file-invoice" />
              </div>
            </article>

            <article className={s("statCard")}>
              <div className={s("statInfo")}>
                <span className={s("statLabel")}>Active Categories</span>
                <strong className={s("statValue")}>{categories?.length || 0}</strong>
                <span className={s("statSub")}>Expense heads</span>
              </div>
              <div className={cx(s("statIconWrap"), s("iconBlue"))}>
                <i className="fa-solid fa-layer-group" />
              </div>
            </article>

            <article className={s("statCard")}>
              <div className={s("statInfo")}>
                <span className={s("statLabel")}>Average Spending</span>
                <strong className={s("statValue")}>₹{avgAmount.toLocaleString("en-IN")}</strong>
                <span className={s("statSub")}>Per voucher average</span>
              </div>
              <div className={cx(s("statIconWrap"), s("iconPurple"))}>
                <i className="fa-solid fa-chart-line" />
              </div>
            </article>
          </section>
        )}

        {/* ── Filter Toolbar ── */}
        <section className={s("toolbar")}>
          <div className={s("toolbarLeft")}>
            <div className={s("searchBox")}>
              <i className="fa-solid fa-magnifying-glass" />
              <input 
                placeholder="Search by title, receipt no., vendor..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  type="button" 
                  onClick={() => setSearchTerm("")}
                  style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>

            <select 
              className={s("filterSelect")} 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All">All Categories ({categories?.length || 0})</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>

            <select 
              className={s("filterSelect")} 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Amount</option>
              <option value="lowest">Lowest Amount</option>
            </select>
          </div>

          <div className={s("recordCountBadge")}>
            Showing {filteredExpenses.length} of {expenses?.length || 0} entries
          </div>
        </section>

        {/* ── Main Content Grid ── */}
        <section className={s("grid")}>
          {/* Left Column: Spending Breakdown */}
          <article className={s("card")}>
            <div className={s("cardHead")}>
              <div className={s("cardHeadTitle")}>
                <i className="fa-solid fa-chart-pie" />
                <h3>Category Breakdown</h3>
              </div>
              <p>By spending</p>
            </div>

            <div className={s("categoryList")}>
              {loading && !summary ? (
                <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <Skeleton width="45%" height={16} />
                      <Skeleton width="25%" height={16} />
                    </div>
                    <Skeleton width="100%" height={8} borderRadius={4} />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <Skeleton width="55%" height={16} />
                      <Skeleton width="20%" height={16} />
                    </div>
                    <Skeleton width="100%" height={8} borderRadius={4} />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <Skeleton width="35%" height={16} />
                      <Skeleton width="30%" height={16} />
                    </div>
                    <Skeleton width="100%" height={8} borderRadius={4} />
                  </div>
                </div>
              ) : summary?.by_category && summary.by_category.length > 0 ? (
                summary.by_category.map((item: any, idx: number) => {
                  const itemAmount = Number(item.total_amount || 0);
                  const percentage = totalAmount > 0 ? Math.round((itemAmount / totalAmount) * 100) : 0;
                  const color = getCategoryColor(idx);

                  return (
                    <div className={s("categoryItem")} key={item.category_name || idx}>
                      <div className={s("categoryTop")}>
                        <div className={s("categoryName")}>
                          <span className={s("categoryDot")} style={{ background: color.fill }} />
                          {item.category_name}
                        </div>
                        <span className={s("categoryAmount")}>₹{itemAmount.toLocaleString("en-IN")}</span>
                      </div>
                      <div className={s("progressBarBg")}>
                        <div 
                          className={s("progressBarFill")} 
                          style={{ 
                            width: `${Math.max(percentage, 3)}%`, 
                            background: color.fill 
                          }} 
                        />
                      </div>
                      <div className={s("categoryMeta")}>
                        <span>{item.count || 1} voucher{item.count !== 1 ? 's' : ''}</span>
                        <span style={{ fontWeight: 700, color: color.text }}>{percentage}% of total</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={s("emptyState")}>
                  <div className={s("emptyIcon")}>
                    <i className="fa-solid fa-chart-simple" />
                  </div>
                  <h4>No Category Data</h4>
                  <p>Category summary will appear here once expenses are recorded.</p>
                </div>
              )}
            </div>
          </article>

          {/* Right Column: Expense Table */}
          <article className={s("card")}>
            <div className={s("cardHead")}>
              <div className={s("cardHeadTitle")}>
                <i className="fa-solid fa-list-check" />
                <h3>Expense Records</h3>
              </div>
              <p>{filteredExpenses.length} total</p>
            </div>

            <div className={s("tableWrap")}>
              {loading && !expenses ? (
                <SkeletonTable rows={6} columns={7} />
              ) : paginatedExpenses.length > 0 ? (
                <>
                  <table className={s("table")}>
                    <thead>
                      <tr>
                        <th>Voucher #</th>
                        <th>Expense Title</th>
                        <th>Category</th>
                        <th>Vendor</th>
                        <th>Date</th>
                        <th>Amount</th>
                        {!isReadOnly && <th style={{ textAlign: "right" }}>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedExpenses.map((ex, i) => (
                        <tr key={ex.id || i}>
                          <td>
                            <span className={s("voucherBadge")}>
                              {ex.receipt_number || `VCH-${ex.id}`}
                            </span>
                          </td>
                          <td>
                            <span className={s("expenseTitle")}>{ex.title}</span>
                            {ex.description && (
                              <span className={s("expenseDesc")} title={ex.description}>
                                {ex.description}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={s("categoryTag")}>
                              <i className="fa-solid fa-tag" style={{ fontSize: 10, opacity: 0.6 }} />
                              {ex.category_name || "General"}
                            </span>
                          </td>
                          <td>
                            {ex.vendor_name ? (
                              <span className={s("vendorTag")}>
                                <i className="fa-solid fa-store" style={{ fontSize: 11, color: "#94a3b8" }} />
                                {ex.vendor_name}
                              </span>
                            ) : (
                              <span style={{ color: "#cbd5e1" }}>—</span>
                            )}
                          </td>
                          <td>
                            <span className={s("dateCell")}>
                              {formatDate(ex.expense_date?.slice(0, 10))}
                            </span>
                          </td>
                          <td>
                            <span className={s("amountCell")}>
                              ₹{Number(ex.amount || 0).toLocaleString("en-IN")}
                            </span>
                          </td>
                          {!isReadOnly && (
                            <td style={{ textAlign: "right" }}>
                              <button 
                                className={s("btnDangerSoft")} 
                                title="Delete expense"
                                onClick={() => handleDelete(ex.id, ex.title)}
                              >
                                <i className="fa-solid fa-trash" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* ── Pagination Footer ── */}
                  <div className={s("paginationWrap")}>
                    <div className={s("paginationInfo")}>
                      <span>
                        Showing <strong>{filteredExpenses.length === 0 ? 0 : startIdx + 1}–{endIdx}</strong> of <strong>{filteredExpenses.length}</strong> records
                      </span>
                      <select 
                        className={s("pageSizeSelect")} 
                        value={pageSize} 
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        title="Records per page"
                      >
                        <option value={5}>5 / page</option>
                        <option value={8}>8 / page</option>
                        <option value={15}>15 / page</option>
                        <option value={25}>25 / page</option>
                      </select>
                    </div>

                    <div className={s("paginationControls")}>
                      <button 
                        className={s("paginationBtn")} 
                        disabled={currentPage === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        title="Previous page"
                      >
                        <i className="fa-solid fa-chevron-left" />
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1];
                          const hasGap = prev && p - prev > 1;

                          return (
                            <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              {hasGap && <span style={{ color: "#94a3b8", fontSize: 12, padding: "0 2px" }}>…</span>}
                              <button
                                className={cx(s("paginationBtn"), p === currentPage && s("paginationBtnActive"))}
                                onClick={() => setPage(p)}
                              >
                                {p}
                              </button>
                            </span>
                          );
                        })}

                      <button 
                        className={s("paginationBtn")} 
                        disabled={currentPage === totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        title="Next page"
                      >
                        <i className="fa-solid fa-chevron-right" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className={s("emptyState")}>
                  <div className={s("emptyIcon")}>
                    <i className="fa-solid fa-receipt" />
                  </div>
                  <h4>No Expenses Found</h4>
                  <p>
                    {searchTerm || filterCategory !== "All" 
                      ? "No records match your search or filter criteria." 
                      : "No expenses recorded for this academic year yet."}
                  </p>
                  {!searchTerm && filterCategory === "All" && !isReadOnly && (
                    <Link className={cx(s("btn"), s("btnPrimary"))} href={recordExpenseUrl} style={{ marginTop: 8 }}>
                      <i className="fa-solid fa-plus" /> Add First Expense
                    </Link>
                  )}
                </div>
              )}
            </div>
          </article>
        </section>
      </main>

      {/* ── Delete Expense Confirmation Modal ── */}
      {!isReadOnly && (
        <ConfirmModal
          isOpen={!!expenseToDelete}
          onClose={() => setExpenseToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Expense"
          message={`Are you sure you want to delete expense "${expenseToDelete?.title}"? This action cannot be undone.`}
          confirmText="Delete Expense"
          cancelText="Cancel"
          confirmVariant="danger"
          icon="fa-trash-can"
        />
      )}
    </div>
  );
}
