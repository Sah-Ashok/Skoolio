"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./fees.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";
import DateInput from "@/components/shared/DateInput";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");
const fmt    = (n: number | string) => "Rs. " + Number(n || 0).toLocaleString("en-IN");
const getInitials = (name: string) =>
  (name || "?").split(" ").map((p: string) => p[0]).join("").substring(0, 2).toUpperCase();

const TYPE_COLOR: Record<string, string> = { academic: "#3b5bdb", transport: "#c46a14", hostel: "#7c3aed" };
const TYPE_BG:    Record<string, string> = { academic: "#e8edff", transport: "#fff1df", hostel: "#f3e8ff" };

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "badge-green", partial: "badge-yellow", unpaid: "badge-red", waived: "badge-blue",
  };
  return (
    <span className={cx(s("badge"), s(map[status] ?? "badge-red"))} style={{ textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = type || "academic";
  return (
    <span style={{
      fontSize: 10, fontWeight: 900, padding: "2px 8px", borderRadius: 999,
      background: TYPE_BG[t] || TYPE_BG.academic, color: TYPE_COLOR[t] || TYPE_COLOR.academic,
      textTransform: "uppercase", letterSpacing: 0.3,
    }}>
      {t}
    </span>
  );
}

const INP: React.CSSProperties = {
  minHeight: 42, padding: "0 12px", border: "1.5px solid #c6d0d7",
  borderRadius: 8, fontSize: 13, fontWeight: 700, outline: "none",
  width: "100%", background: "#fff", color: "#1a202c", boxSizing: "border-box",
};

export default function CollectFeePage() {
  const dispatch       = useAppDispatch();
  const searchParams   = useSearchParams();
  const initialId      = searchParams.get("student_id");
  const { academicYearId } = useAcademicYear();
  const { formatDate } = useDateFormat();

  const [query,           setQuery]           = useState("");
  const [searchResults,   setSearchResults]   = useState<any[]>([]);
  const [searching,       setSearching]       = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: preloaded } = useApi<any>(initialId ? `/students/${initialId}` : "");
  useEffect(() => {
    if (preloaded && !selectedStudent) {
      setSelectedStudent(preloaded);
      setQuery(preloaded.full_name || "");
    }
  }, [preloaded]);

  useEffect(() => {
    if (selectedStudent) return;
    if (query.length < 2) { setSearchResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res: any = await apiRequest(`/students/search?q=${encodeURIComponent(query)}`);
        setSearchResults(res?.data ?? res ?? []);
      } catch { setSearchResults([]); }
      finally   { setSearching(false); }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selectedStudent]);

  const selectStudent = (st: any) => {
    setSelectedStudent(st); setQuery(st.full_name); setSearchResults([]); resetPayment();
  };
  const clearStudent = () => {
    setSelectedStudent(null); setQuery(""); setSearchResults([]); resetPayment();
  };

  const { data: billingPolicy } = useApi<any>("/fee-billing-policy");
  const graceDays: number = (billingPolicy?.data ?? billingPolicy)?.overdue_grace_days ?? 0;
  const isOverdueFn = (dueDate: string, status: string): boolean => {
    if (status === "paid" || status === "waived") return false;
    const due = new Date(dueDate);
    due.setDate(due.getDate() + graceDays);
    return due < new Date();
  };

  const [typeFilter, setTypeFilter] = useState("all");
  const { data: rawCollections, refetch: refetchCollections } = useApi<any[]>(
    selectedStudent && academicYearId
      ? `/fees/collections/student/${selectedStudent.id}?academic_year_id=${academicYearId}`
      : "",
    [selectedStudent?.id, academicYearId]
  );

  // ── Sort by due_date ASC → sequential payment order is always respected ──
  const sortedAll = [...(rawCollections || [])].sort((a: any, b: any) =>
    String(a.due_date || "").localeCompare(String(b.due_date || ""))
  );

  // ── Sequential payment lock ──────────────────────────────────────────────────
  // For recurring monthly academic fees (same fee_structure_id), the OLDEST unpaid
  // bill must be paid/waived before the next one is payable.
  // transport/hostel (no fee_structure_id) are exempt — pay any month in any order.
  const lockedIds = new Set<number>();
  const lockedByStructure = new Map<number, string>(); // structure_id → oldest unpaid fee_name
  const seenUnpaidStructure = new Map<number, string>(); // structure_id → oldest unpaid fee_name
  for (const c of sortedAll) {
    if (!c.fee_structure_id) continue;
    if (c.status === "paid" || c.status === "waived") continue;
    const sid = Number(c.fee_structure_id);
    if (!seenUnpaidStructure.has(sid)) {
      seenUnpaidStructure.set(sid, c.fee_name || "earlier bill"); // this is the oldest — NOT locked
    } else {
      lockedIds.add(c.id);
      lockedByStructure.set(c.id, seenUnpaidStructure.get(sid)!);
    }
  }

  const allCollections  = sortedAll;
  const pendingCollections = allCollections.filter((c: any) => {
    const isPending = c.status !== "paid" && c.status !== "waived";
    const matchType = typeFilter === "all" || (c.fee_type || "academic") === typeFilter;
    return isPending && matchType;
  });
  const paidCollections = allCollections.filter((c: any) => c.status === "paid" || c.status === "waived");

  const totalDue  = allCollections.reduce((a: number, c: any) => a + parseFloat(c.remaining_amount || "0"), 0);
  const totalPaid = allCollections.reduce((a: number, c: any) => a + parseFloat(c.paid_amount      || "0"), 0);
  const overdueCt = allCollections.filter((c: any) => isOverdueFn(c.due_date, c.status)).length;
  const paidPct = (totalDue + totalPaid) > 0 ? (totalPaid / (totalDue + totalPaid)) * 100 : 0;

  // Locked bills cannot be selected
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAmounts, setBulkAmounts] = useState<Record<number, string>>({});

  const toggleSelect = (id: number, remaining: string) => {
    if (lockedIds.has(id)) return; // cannot select locked bill
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else { next.add(id); setBulkAmounts(a => ({ ...a, [id]: String(parseFloat(remaining || "0")) })); }
      return next;
    });
  };
  const toggleAll = () => {
    const payable = pendingCollections.filter((c: any) => !lockedIds.has(c.id));
    if (selectedIds.size === payable.length) { setSelectedIds(new Set()); }
    else {
      const next = new Set<number>(); const amounts: Record<number, string> = {};
      payable.forEach((c: any) => { next.add(c.id); amounts[c.id] = String(parseFloat(c.remaining_amount || "0")); });
      setSelectedIds(next); setBulkAmounts(amounts);
    }
  };

  const selectedCollections = pendingCollections.filter((c: any) => selectedIds.has(c.id));
  const bulkTotal = selectedCollections.reduce(
    (a: number, c: any) => a + parseFloat(bulkAmounts[c.id] || c.remaining_amount || "0"), 0
  );

  const [paymentDate, setPaymentDate]   = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode]   = useState("cash");
  const [referenceNo, setReferenceNo]   = useState("");
  const [remarks,     setRemarks]       = useState("");
  const [lastReceipts, setLastReceipts] = useState<Array<{ payment_id: number; receipt_number: string }>>([]);
  const [isPaying,    setIsPaying]      = useState(false);
  const needsRef = ["online", "bank_transfer", "cheque"].includes(paymentMode);

  const resetPayment = () => {
    setSelectedIds(new Set()); setBulkAmounts({});
    setReferenceNo(""); setRemarks(""); setLastReceipts([]);
  };

  const handleBulkPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (selectedIds.size === 0) return dispatch(showToast({ type: "error", title: "Nothing selected", message: "Select at least one fee." }));
    if (needsRef && !referenceNo.trim()) return dispatch(showToast({ type: "error", title: "Reference required", message: "Enter transaction/cheque number." }));

    setIsPaying(true);
    const receipts: Array<{ payment_id: number; receipt_number: string }> = [];
    let ok = 0, fail = 0;

    for (const col of selectedCollections) {
      const amount = parseFloat(bulkAmounts[col.id] || col.remaining_amount || "0");
      if (amount <= 0) { fail++; continue; }
      try {
        const res: any = await apiRequest("/fees/payments", {
          method: "POST",
          body: JSON.stringify({
            collection_id:  col.id,
            student_id:     selectedStudent.id,
            paid_amount:    amount,
            payment_date:   paymentDate,
            payment_method: paymentMode,
            transaction_id: referenceNo || undefined,
            remarks:        remarks     || undefined,
          }),
        });
        if (res?.payment?.id) receipts.push({ payment_id: res.payment.id, receipt_number: res.receipt_number || res.payment?.receipt_number });
        else if (res?.id)    receipts.push({ payment_id: res.id, receipt_number: res.receipt_number });
        ok++;
      } catch (err: any) {
        fail++;
        dispatch(showToast({ type: "error", title: `Failed: ${col.fee_name}`, message: err.message || "Payment error" }));
      }
    }

    if (ok > 0) {
      setLastReceipts(receipts);
      dispatch(showToast({ type: "success", title: `${ok} payment${ok > 1 ? "s" : ""} recorded`, message: fail > 0 ? `${fail} failed.` : "All processed." }));
      refetchCollections(); setSelectedIds(new Set()); setBulkAmounts({});
      setReferenceNo(""); setRemarks("");
    }
    setIsPaying(false);
  };

  const [showMisc,     setShowMisc]     = useState(false);
  const [miscFeeName,  setMiscFeeName]  = useState("");
  const [miscAmount,   setMiscAmount]   = useState("");
  const [miscDueDate,  setMiscDueDate]  = useState(new Date().toISOString().split("T")[0]);
  const [miscDiscount, setMiscDiscount] = useState("");
  const [addingMisc,   setAddingMisc]   = useState(false);

  const handleAddMiscFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !academicYearId) return;
    if (!miscFeeName.trim()) return dispatch(showToast({ type: "error", title: "Error", message: "Fee name required" }));
    if (!miscAmount || Number(miscAmount) <= 0) return dispatch(showToast({ type: "error", title: "Error", message: "Valid amount required" }));
    setAddingMisc(true);
    try {
      await apiRequest("/fees/collections/misc", {
        method: "POST",
        body: JSON.stringify({
          student_id: selectedStudent.id, academic_year_id: academicYearId,
          fee_name: miscFeeName.trim(), due_date: miscDueDate,
          total_amount: Number(miscAmount),
          discount_amount: miscDiscount ? Number(miscDiscount) : undefined,
        }),
      });
      dispatch(showToast({ type: "success", title: "Fee Added", message: `"${miscFeeName}" added.` }));
      refetchCollections(); setMiscFeeName(""); setMiscAmount(""); setMiscDiscount(""); setShowMisc(false);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not add fee." }));
    } finally { setAddingMisc(false); }
  };

  const [waiveTarget, setWaiveTarget]  = useState<any | null>(null);
  const [waiveReason, setWaiveReason]  = useState("");
  const [waiving,     setWaiving]      = useState(false);

  const handleWaive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiveTarget) return;
    setWaiving(true);
    try {
      await apiRequest(`/fees/collections/${waiveTarget.id}/waive`, {
        method: "POST",
        body: JSON.stringify({ reason: waiveReason || "Waived by admin" }),
      });
      dispatch(showToast({ type: "success", title: "Fee Waived", message: `"${waiveTarget.fee_name}" has been waived.` }));
      refetchCollections(); setWaiveTarget(null); setWaiveReason("");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not waive fee." }));
    } finally { setWaiving(false); }
  };

  const [fineTarget, setFineTarget] = useState<any | null>(null);
  const [fineAmount, setFineAmount] = useState("");
  const [fineReason, setFineReason] = useState("");
  const [addingFine, setAddingFine] = useState(false);

  const handleAddFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fineTarget) return;
    if (!fineAmount || Number(fineAmount) <= 0) return dispatch(showToast({ type: "error", title: "Error", message: "Valid fine amount required." }));
    setAddingFine(true);
    try {
      await apiRequest(`/fees/collections/${fineTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fine_amount: Number(fineAmount), fine_reason: fineReason || "Late payment fine" }),
      });
      dispatch(showToast({ type: "success", title: "Fine Applied", message: `Rs. ${fineAmount} added to ${fineTarget.fee_name}.` }));
      refetchCollections(); setFineTarget(null); setFineAmount(""); setFineReason("");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not apply fine." }));
    } finally { setAddingFine(false); }
  };

  return (
    <div className={s("fees-page")}>
      <Topbar title="Collect Fee" subtitle="Search a student, select pending fees, and record payment" />
      <main className={s("page-content")}>

        <section className={s("page-head")}>
          <div>
            <h1>Collect Fee</h1>
            <p>Find a student → tick pending fees → process payment.</p>
          </div>
          <div className={s("head-actions")}>
            {selectedStudent && (
              <Link className={cx(s("btn"), s("btn-outline"))} href={`/students/profile?id=${selectedStudent.id}`}>
                <i className="fa-solid fa-user" /> Profile
              </Link>
            )}
            {selectedStudent && (
              <Link className={cx(s("btn"), s("btn-outline"))} href={`/fees/history?student_id=${selectedStudent.id}`}>
                <i className="fa-solid fa-clock-rotate-left" /> Fee History
              </Link>
            )}
            <Link className={cx(s("btn"), s("btn-outline"))} href="/fees/records">
              <i className="fa-solid fa-table-list" /> All Records
            </Link>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/fees">
              <i className="fa-solid fa-chart-pie" /> Overview
            </Link>
          </div>
        </section>

        {lastReceipts.length > 0 && (
          <div className={s("cf-success-banner")}>
            <div className={s("cf-success-left")}>
              <i className="fa-solid fa-circle-check" />
              <div>
                <strong>{lastReceipts.length} payment{lastReceipts.length > 1 ? "s" : ""} recorded</strong>
                <span>Receipts: {lastReceipts.map(r => r.receipt_number).filter(Boolean).join(", ")}</span>
              </div>
            </div>
            <div className={s("cf-success-right")}>
              {lastReceipts.slice(0, 3).map(r => (
                <a key={r.payment_id} href={`/fees/receipt/${r.payment_id}`} target="_blank" rel="noreferrer" className={s("cf-receipt-link")}>
                  <i className="fa-solid fa-print" /> {r.receipt_number || "Print"}
                </a>
              ))}
              <button className={s("cf-dismiss")} onClick={() => setLastReceipts([])}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          </div>
        )}

        {/* Sequential payment info banner */}
        {selectedStudent && lockedIds.size > 0 && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "10px 16px", borderRadius: 10, margin: "0 0 4px",
            background: "#fefce8", border: "1px solid #fde68a",
            fontSize: 13, color: "#92400e", fontWeight: 600,
          }}>
            <i className="fa-solid fa-lock" style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
              <strong>Sequential payment required</strong> — {lockedIds.size} bill{lockedIds.size !== 1 ? "s are" : " is"} locked
              because an earlier bill for the same fee is still unpaid.
              Pay or waive the oldest due bill first to unlock the next one.
            </span>
          </div>
        )}

        <div className={s("cf-layout")}>

          {/* COL 1 — Student panel */}
          <aside className={s("cf-left")}>
            <div className={s("cf-card")}>
              <div className={s("cf-card-head")}>
                <div className={s("cf-card-icon")} style={{ background: "#e8edff", color: "#3b5bdb" }}>
                  <i className="fa-solid fa-user-graduate" />
                </div>
                <div>
                  <strong>Find Student</strong>
                  <span>Search by name or admission no.</span>
                </div>
              </div>

              <div className={s("cf-search-wrap")}>
                <div className={s("cf-search-box")}>
                  <i className="fa-solid fa-magnifying-glass" />
                  <input
                    type="search"
                    placeholder="Name or admission number…"
                    value={query}
                    onChange={e => { setQuery(e.target.value); if (selectedStudent) clearStudent(); }}
                  />
                  {searching && <Spinner size={14} />}
                  {(query || selectedStudent) && (
                    <button onClick={clearStudent} className={s("cf-clear-btn")} title="Clear">
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div className={s("cf-dropdown")}>
                    {searchResults.map((st: any) => (
                      <button key={st.id} className={s("cf-dropdown-item")} onClick={() => selectStudent(st)}>
                        <span className={s("cf-mini-avatar")}>{getInitials(st.full_name)}</span>
                        <div>
                          <strong>{st.full_name}</strong>
                          <small>{st.admission_number}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {query.length >= 2 && !searching && !searchResults.length && !selectedStudent && (
                  <p className={s("cf-no-results")}>No students found.</p>
                )}
              </div>

              {selectedStudent && (
                <div className={s("cf-student-card")}>
                  <div className={s("cf-student-avatar")}>{getInitials(selectedStudent.full_name)}</div>
                  <div className={s("cf-student-info")}>
                    <strong>{selectedStudent.full_name}</strong>
                    <span>{selectedStudent.admission_number}</span>
                    {selectedStudent.class_name && (
                      <small>Class {selectedStudent.class_name}{selectedStudent.section_name ? ` · Sec ${selectedStudent.section_name}` : ""}</small>
                    )}
                  </div>
                  <button className={s("cf-change-btn")} onClick={clearStudent}>Change</button>
                </div>
              )}

              {selectedStudent?.scholarship_percent && Number(selectedStudent.scholarship_percent) > 0 && (
                <div className={s("cf-scholarship")}>
                  <i className="fa-solid fa-graduation-cap" />
                  <span>{selectedStudent.scholarship_type?.replace(/_/g, " ") || "Scholarship"} — {selectedStudent.scholarship_percent}% discount</span>
                </div>
              )}
            </div>

            {selectedStudent && allCollections.length > 0 && (
              <div className={s("cf-totals")}>
                <div className={s("cf-total-item")} style={{ "--t-color": "#b42318", "--t-bg": "#fde7e7" } as any}>
                  <span>Due</span>
                  <strong>{fmt(totalDue)}</strong>
                </div>
                <div className={s("cf-total-item")} style={{ "--t-color": "#12805c", "--t-bg": "#e2f6ee" } as any}>
                  <span>Paid</span>
                  <strong>{fmt(totalPaid)}</strong>
                </div>
                <div className={s("cf-total-item")} style={{ "--t-color": "#c46a14", "--t-bg": "#fff1df" } as any}>
                  <span>Overdue</span>
                  <strong>{overdueCt} bill{overdueCt !== 1 ? "s" : ""}</strong>
                </div>
                <div className={s("cf-progress-wrap")}>
                  <div className={s("cf-progress-track")}>
                    <div className={s("cf-progress-fill")} style={{ width: `${paidPct.toFixed(1)}%` }} />
                  </div>
                  <span>{paidPct.toFixed(0)}% paid</span>
                </div>
              </div>
            )}

            {selectedStudent && (
              <div className={s("cf-card")}>
                <button className={s("cf-misc-toggle")} onClick={() => setShowMisc(v => !v)}>
                  <span className={s("cf-misc-icon")}><i className={`fa-solid fa-${showMisc ? "minus" : "plus"}`} /></span>
                  <div>
                    <strong>Add One-Time / Misc Fee</strong>
                    <small>Dress, Books, Exam fee…</small>
                  </div>
                  <i className={`fa-solid fa-chevron-${showMisc ? "up" : "down"}`} style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 11 }} />
                </button>

                {showMisc && (
                  <form onSubmit={handleAddMiscFee} className={s("cf-misc-form")}>
                    <div className={s("cf-misc-grid")}>
                      <label className={s("cf-field")}>
                        <span>Fee Name <b style={{ color: "#b42318" }}>*</b></span>
                        <input value={miscFeeName} onChange={e => setMiscFeeName(e.target.value)} placeholder="e.g. School Dress" required style={INP} />
                      </label>
                      <label className={s("cf-field")}>
                        <span>Amount <b style={{ color: "#b42318" }}>*</b></span>
                        <input value={miscAmount} onChange={e => setMiscAmount(e.target.value)} type="number" min="1" required placeholder="0" style={INP} />
                      </label>
                      <label className={s("cf-field")}>
                        <span>Due Date</span>
                        <DateInput value={miscDueDate} onChange={e => setMiscDueDate(e.target.value)} style={{ width: "100%" }} />
                      </label>
                      <label className={s("cf-field")}>
                        <span>Discount (optional)</span>
                        <input value={miscDiscount} onChange={e => setMiscDiscount(e.target.value)} type="number" min="0" placeholder="0" style={INP} />
                      </label>
                    </div>
                    <button type="submit" disabled={addingMisc} className={s("cf-misc-submit")}>
                      {addingMisc ? <><Spinner size={14} color="#fff" /> Adding…</> : <><i className="fa-solid fa-plus" /> Add Fee</>}
                    </button>
                  </form>
                )}
              </div>
            )}
          </aside>

          {/* COL 2 — Fee table */}
          <div className={s("cf-center")}>

            {!selectedStudent ? (
              <div className={s("cf-empty-state")}>
                <i className="fa-solid fa-user-magnifying-glass" />
                <strong>No student selected</strong>
                <p>Search for a student on the left to view their fees.</p>
              </div>
            ) : (
              <>
                <div className={s("cf-card")}>
                  <div className={s("cf-card-head")}>
                    <div className={s("cf-card-icon")} style={{ background: "#fff1df", color: "#c46a14" }}>
                      <i className="fa-solid fa-file-invoice-dollar" />
                    </div>
                    <div>
                      <strong>Pending Fees</strong>
                      <span>Bills are ordered oldest → newest. Pay in order.</span>
                    </div>
                    <select
                      className={s("cf-type-filter")}
                      value={typeFilter}
                      onChange={e => { setTypeFilter(e.target.value); setSelectedIds(new Set()); }}
                    >
                      <option value="all">All Types</option>
                      <option value="academic">Academic</option>
                      <option value="transport">Transport</option>
                      <option value="hostel">Hostel</option>
                    </select>
                  </div>

                  <div className={s("table-wrap")}>
                    <table className={s("cf-table")}>
                      <thead>
                        <tr>
                          <th style={{ width: 44, textAlign: "center" }}>
                            <input type="checkbox"
                              checked={pendingCollections.filter((c: any) => !lockedIds.has(c.id)).length > 0
                                && selectedIds.size === pendingCollections.filter((c: any) => !lockedIds.has(c.id)).length}
                              onChange={toggleAll}
                              className={s("cf-checkbox")}
                            />
                          </th>
                          <th>Fee Name</th>
                          <th>Type</th>
                          <th>Total</th>
                          <th>Paid</th>
                          <th>Due Amt</th>
                          <th>Due Date</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingCollections.length === 0 && (
                          <tr>
                            <td colSpan={9} className={s("cf-table-empty")}>
                              <i className="fa-solid fa-circle-check" />
                              No pending fees{typeFilter !== "all" ? " in this category" : ""}
                            </td>
                          </tr>
                        )}
                        {pendingCollections.map((c: any) => {
                          const isOverdue  = isOverdueFn(c.due_date, c.status);
                          const isSelected = selectedIds.has(c.id);
                          const isLocked   = lockedIds.has(c.id);
                          const lockedMsg  = isLocked ? lockedByStructure.get(c.id) : null;
                          return (
                            <tr key={c.id}
                              className={cx(
                                s("cf-tr"),
                                isSelected && s("cf-tr-selected"),
                                isOverdue && !isSelected && !isLocked && s("cf-tr-overdue"),
                              )}
                              onClick={() => !isLocked && toggleSelect(c.id, c.remaining_amount)}
                              style={isLocked ? { opacity: 0.6, cursor: "not-allowed", background: "#f8fafc" } : {}}
                              title={isLocked ? `Pay or waive "${lockedMsg}" before this bill.` : undefined}
                            >
                              <td style={{ textAlign: "center" }}>
                                {isLocked ? (
                                  <span style={{ color: "#94a3b8", fontSize: 13 }} title={`Pay "${lockedMsg}" first`}>
                                    <i className="fa-solid fa-lock" />
                                  </span>
                                ) : (
                                  <input type="checkbox" checked={isSelected}
                                    onChange={() => toggleSelect(c.id, c.remaining_amount)}
                                    onClick={ev => ev.stopPropagation()} className={s("cf-checkbox")} />
                                )}
                              </td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <span className={s("cf-fee-name")}>{c.fee_name}</span>
                                  {isOverdue && !isLocked && <span className={s("cf-overdue-tag")}>OVERDUE</span>}
                                  {isLocked && (
                                    <span style={{ fontSize: 10.5, color: "#b45309", fontWeight: 700 }}>
                                      <i className="fa-solid fa-lock" style={{ marginRight: 3, fontSize: 9 }} />
                                      Pay &quot;{lockedMsg}&quot; first
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td><TypeBadge type={c.fee_type} /></td>
                              <td className={s("cf-amt")}>{fmt(c.total_amount)}</td>
                              <td className={s("cf-amt-paid")}>{fmt(c.paid_amount || 0)}</td>
                              <td className={s("cf-amt-due")}>{fmt(c.remaining_amount || 0)}</td>
                              <td className={cx(s("cf-date"), isOverdue && !isLocked && s("cf-date-overdue"))}>
                                {formatDate(c.due_date?.split("T")[0])}
                              </td>
                              <td><StatusBadge status={c.status} /></td>
                              <td style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {isOverdue && !isLocked && (
                                  <button
                                    className={s("cf-fine-btn")}
                                    onClick={ev => { ev.stopPropagation(); setFineTarget(c); setFineAmount(""); setFineReason(""); }}
                                  >
                                    <i className="fa-solid fa-bolt" /> Fine
                                  </button>
                                )}
                                <button
                                  className={s("cf-fine-btn")}
                                  style={{ background: "#eff6ff", color: "#1d4ed8", borderColor: "#93c5fd" }}
                                  onClick={ev => { ev.stopPropagation(); setWaiveTarget(c); setWaiveReason(""); }}
                                  title={isLocked ? `Waive "${lockedMsg}" or this bill` : "Waive this fee"}
                                >
                                  <i className="fa-solid fa-hand-holding-heart" /> Waive
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {paidCollections.length > 0 && (
                    <details className={s("cf-paid-details")}>
                      <summary className={s("cf-paid-summary")}>
                        <i className="fa-solid fa-chevron-right" style={{ fontSize: 10 }} />
                        Show paid / waived fees ({paidCollections.length})
                      </summary>
                      <div className={s("table-wrap")}>
                        <table className={s("cf-table")}>
                          <tbody>
                            {paidCollections.map((c: any) => (
                              <tr key={c.id} className={s("cf-tr-paid")}>
                                <td style={{ width: 44 }}></td>
                                <td><span className={s("cf-fee-name")}>{c.fee_name}</span></td>
                                <td><TypeBadge type={c.fee_type} /></td>
                                <td className={s("cf-amt")}>{fmt(c.total_amount)}</td>
                                <td className={s("cf-amt-paid")}>{fmt(c.paid_amount || 0)}</td>
                                <td>{fmt(c.remaining_amount || 0)}</td>
                                <td className={s("cf-date")}>{formatDate(c.due_date?.split("T")[0])}</td>
                                <td><StatusBadge status={c.status} /></td>
                                <td>
                                  {(c.status === "paid" || c.status === "waived") && (
                                    <Link href={`/fees/history?student_id=${selectedStudent?.id}`} className={s("cf-receipts-link")}>
                                      <i className="fa-solid fa-clock-rotate-left" /> History
                                    </Link>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </div>

                {selectedIds.size === 0 && pendingCollections.filter((c: any) => !lockedIds.has(c.id)).length > 0 && (
                  <div className={s("cf-hint")}>
                    <i className="fa-solid fa-hand-pointer" />
                    Click rows or the header checkbox to select fees for payment.
                  </div>
                )}
              </>
            )}
          </div>

          {/* COL 3 — Payment sidebar */}
          {selectedStudent && selectedIds.size > 0 && (
            <aside className={s("cf-right")}>
              <form onSubmit={handleBulkPayment} className={s("cf-pay-card")}>
                <div className={s("cf-pay-head")}>
                  <div className={s("cf-card-icon")} style={{ background: "#3b5bdb", color: "#fff" }}>
                    <i className="fa-solid fa-credit-card" />
                  </div>
                  <div>
                    <strong>Pay {selectedIds.size} fee{selectedIds.size > 1 ? "s" : ""}</strong>
                    <span>Review amounts and confirm</span>
                  </div>
                  <button type="button" className={s("cf-clear-sel")} onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </button>
                </div>

                <div className={s("cf-pay-items")}>
                  {selectedCollections.map((c: any) => (
                    <div key={c.id} className={s("cf-pay-item")}>
                      <TypeBadge type={c.fee_type} />
                      <span className={s("cf-pay-item-name")}>{c.fee_name}</span>
                      <small>max {fmt(c.remaining_amount)}</small>
                      <input
                        type="number"
                        value={bulkAmounts[c.id] ?? c.remaining_amount}
                        onChange={ev => setBulkAmounts(a => ({ ...a, [c.id]: ev.target.value }))}
                        min="0.01" max={parseFloat(c.remaining_amount || "0")} step="0.01" required
                        onClick={ev => ev.stopPropagation()}
                        className={s("cf-pay-amount-input")}
                      />
                    </div>
                  ))}
                </div>

                <div className={s("cf-pay-fields")}>
                  <label className={s("cf-field")}>
                    <span>Payment Date <b style={{ color: "#b42318" }}>*</b></span>
                    <DateInput value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required style={{ width: "100%" }} />
                  </label>
                  <label className={s("cf-field")}>
                    <span>Payment Mode</span>
                    <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={INP}>
                      <option value="cash">Cash</option>
                      <option value="online">Online (eSewa / Khalti)</option>
                      <option value="cheque">Cheque</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </label>
                  {needsRef && (
                    <label className={s("cf-field")}>
                      <span>Transaction / Cheque No. <b style={{ color: "#b42318" }}>*</b></span>
                      <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="Reference number" required style={INP} />
                    </label>
                  )}
                  <label className={s("cf-field")}>
                    <span>Remarks (optional)</span>
                    <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional note…" style={INP} />
                  </label>
                </div>

                <div className={s("cf-pay-footer")}>
                  <div>
                    <span>TOTAL PAYING</span>
                    <strong>{fmt(bulkTotal)}</strong>
                  </div>
                  <button type="submit" disabled={isPaying} className={s("cf-pay-submit")}>
                    {isPaying
                      ? <><Spinner size={16} color="#fff" /> Processing…</>
                      : <><i className="fa-solid fa-check" /> Process Payment{selectedIds.size > 1 ? "s" : ""}</>
                    }
                  </button>
                </div>
              </form>
            </aside>
          )}
        </div>
      </main>

      {/* Waive modal */}
      {waiveTarget && (
        <div className={s("cf-modal-overlay")} onClick={() => setWaiveTarget(null)}>
          <div className={s("cf-modal")} onClick={e => e.stopPropagation()}>
            <div className={s("cf-modal-head")}>
              <div>
                <h3>Waive Fee</h3>
                <p>{waiveTarget.fee_name} · {fmt(waiveTarget.remaining_amount)} remaining</p>
              </div>
              <button onClick={() => setWaiveTarget(null)} className={s("cf-modal-close")}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <form onSubmit={handleWaive} className={s("cf-modal-body")}>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
                Waiving sets the remaining balance to zero. This unlocks the next bill in the series.
              </p>
              <label className={s("cf-field")}>
                <span>Reason (optional)</span>
                <input value={waiveReason} onChange={e => setWaiveReason(e.target.value)} placeholder="e.g. Financial hardship, scholarship adjustment…" style={INP} />
              </label>
              <div className={s("cf-modal-actions")}>
                <button type="submit" disabled={waiving} className={s("cf-fine-submit")} style={{ background: "#1d4ed8" }}>
                  {waiving ? <><Spinner size={14} color="#fff" /> Waiving…</> : <><i className="fa-solid fa-hand-holding-heart" /> Confirm Waive</>}
                </button>
                <button type="button" onClick={() => setWaiveTarget(null)} className={s("cf-modal-cancel")}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fine modal */}
      {fineTarget && (
        <div className={s("cf-modal-overlay")} onClick={() => setFineTarget(null)}>
          <div className={s("cf-modal")} onClick={e => e.stopPropagation()}>
            <div className={s("cf-modal-head")}>
              <div>
                <h3>Add Fine</h3>
                <p>{fineTarget.fee_name}</p>
              </div>
              <button onClick={() => setFineTarget(null)} className={s("cf-modal-close")}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <form onSubmit={handleAddFine} className={s("cf-modal-body")}>
              <label className={s("cf-field")}>
                <span>Fine Amount <b style={{ color: "#b42318" }}>*</b></span>
                <input value={fineAmount} onChange={e => setFineAmount(e.target.value)} type="number" min="0.01" step="0.01" required placeholder="0.00" style={INP} />
              </label>
              <label className={s("cf-field")}>
                <span>Reason</span>
                <input value={fineReason} onChange={e => setFineReason(e.target.value)} placeholder="Late payment fine" style={INP} />
              </label>
              <div className={s("cf-modal-actions")}>
                <button type="submit" disabled={addingFine} className={s("cf-fine-submit")}>
                  {addingFine ? <><Spinner size={14} color="#fff" /> Applying…</> : <><i className="fa-solid fa-bolt" /> Apply Fine</>}
                </button>
                <button type="button" onClick={() => setFineTarget(null)} className={s("cf-modal-cancel")}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
