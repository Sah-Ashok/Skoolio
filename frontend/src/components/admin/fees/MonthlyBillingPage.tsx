"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./fees.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";
import { useDateFormat } from "@/lib/useDateFormat";
import { adToBS, bsToISO, BS_MONTH_NAMES } from "@/lib/bs-ad";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const formatINR = (n: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Number(n || 0));

const STATUS_BADGE: Record<string, string> = {
  paid:    "badge-green",
  partial: "badge-yellow",
  unpaid:  "badge-red",
  waived:  "badge-blue",
};

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  academic:  { label: "Academic",  cls: "badge-blue"   },
  transport: { label: "Transport", cls: "badge-yellow" },
  hostel:    { label: "Hostel",    cls: "badge-purple" },
};

// ── Per-student grouped row ───────────────────────────────────────────────────
// We group all fee_collections for a student in a given month into one row,
// showing total billed, paid, remaining, and a "fully paid / partial / pending" flag.

type StudentSummary = {
  student_id:       number;
  full_name:        string;
  admission_number: string;
  class_name:       string;
  section_name:     string;
  bills:            any[];
  total_amount:     number;
  paid_amount:      number;
  remaining_amount: number;
  overallStatus:    "paid" | "partial" | "unpaid";
};

function groupByStudent(bills: any[]): StudentSummary[] {
  const map = new Map<number, StudentSummary>();
  for (const bill of bills) {
    if (!map.has(bill.student_id)) {
      map.set(bill.student_id, {
        student_id:       bill.student_id,
        full_name:        bill.full_name,
        admission_number: bill.admission_number,
        class_name:       bill.class_name || "—",
        section_name:     bill.section_name || "",
        bills:            [],
        total_amount:     0,
        paid_amount:      0,
        remaining_amount: 0,
        overallStatus:    "unpaid",
      });
    }
    const entry = map.get(bill.student_id)!;
    entry.bills.push(bill);
    entry.total_amount     += Number(bill.total_amount     || 0);
    entry.paid_amount      += Number(bill.paid_amount      || 0);
    entry.remaining_amount += Number(bill.remaining_amount || 0);
  }
  // Derive overall status
  for (const entry of map.values()) {
    if (entry.remaining_amount <= 0) {
      entry.overallStatus = "paid";
    } else if (entry.paid_amount > 0) {
      entry.overallStatus = "partial";
    } else {
      entry.overallStatus = "unpaid";
    }
  }
  return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export default function MonthlyBillingPage() {
  const dispatch = useAppDispatch();
  const { isBS, formatDate } = useDateFormat();
  const { activeYear, academicYearId } = useAcademicYear();

  // billingMonth always stored as AD "YYYY-MM"
  const [billingMonth, setBillingMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generating, setGenerating] = useState<string | false>(false);
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);
  const [statusFilter, setStatusFilter]     = useState<"all" | "paid" | "partial" | "unpaid">("all");
  const [search, setSearch]                 = useState("");

  // BS month options
  const bsMonthOptions = useMemo(() => {
    if (!isBS) return [];
    const startAD = activeYear?.start_date
      ? new Date(activeYear.start_date + "T00:00:00")
      : (() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d; })();
    const endAD = activeYear?.end_date
      ? new Date(activeYear.end_date + "T00:00:00")
      : (() => { const d = new Date(); d.setMonth(d.getMonth() + 9); return d; })();
    const startBS = adToBS(startAD);
    const endBS   = adToBS(endAD);
    const opts: { label: string; adValue: string }[] = [];
    let y = startBS.year, m = startBS.month;
    while (y < endBS.year || (y === endBS.year && m <= endBS.month)) {
      const adDate = new Date(bsToISO({ year: y, month: m, day: 15 }) + "T00:00:00");
      const adValue = `${adDate.getFullYear()}-${String(adDate.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ label: `${BS_MONTH_NAMES[m - 1]} ${y}`, adValue });
      if (m === 12) { y++; m = 1; } else m++;
    }
    return opts;
  }, [isBS, activeYear]);

  const billingMonthLabel = useMemo(() => {
    if (!isBS) {
      // Format as "Month YYYY" from YYYY-MM
      const [y, mo] = billingMonth.split("-");
      const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${names[Number(mo) - 1]} ${y}`;
    }
    return bsMonthOptions.find(o => o.adValue === billingMonth)?.label ?? billingMonth;
  }, [isBS, billingMonth, bsMonthOptions]);

  const { data: monthlyStatus, loading, refetch } = useApi<any[]>(
    academicYearId && billingMonth
      ? `/fees/monthly/status?academic_year_id=${academicYearId}&billing_month=${billingMonth}`
      : "",
    [academicYearId, billingMonth]
  );

  const allBills = monthlyStatus || [];
  const studentSummaries = useMemo(() => groupByStudent(allBills), [allBills]);

  // Filter
  const filtered = useMemo(() => {
    return studentSummaries.filter(st => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        st.full_name.toLowerCase().includes(q) ||
        st.admission_number.toLowerCase().includes(q) ||
        st.class_name.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || st.overallStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [studentSummaries, search, statusFilter]);

  // Summary stats
  const totalStudents    = studentSummaries.length;
  const paidCount        = studentSummaries.filter(s => s.overallStatus === "paid").length;
  const partialCount     = studentSummaries.filter(s => s.overallStatus === "partial").length;
  const unpaidCount      = studentSummaries.filter(s => s.overallStatus === "unpaid").length;
  const totalBilled      = studentSummaries.reduce((s, x) => s + x.total_amount,     0);
  const totalCollected   = studentSummaries.reduce((s, x) => s + x.paid_amount,      0);
  const totalOutstanding = studentSummaries.reduce((s, x) => s + x.remaining_amount, 0);

  const handleGenerate = async (type: "academic" | "transport" | "hostel") => {
    if (!academicYearId || !billingMonth) return;
    setGenerating(type);
    const ENDPOINTS: Record<string, string> = {
      academic:  "/fees/monthly/generate",
      transport: "/fees/transport/generate",
      hostel:    "/fees/hostel/generate",
    };
    const LABELS: Record<string, string> = {
      academic: "Academic", transport: "Transport", hostel: "Hostel",
    };
    try {
      const res = await apiRequest<{ data: any }>(ENDPOINTS[type], {
        method: "POST",
        body: JSON.stringify({ academic_year_id: academicYearId, billing_month: billingMonth }),
      });
      const { created, skipped, errors } = res.data ?? res;
      if (errors?.length) {
        dispatch(showToast({ type: "error", title: "Partial", message: `${LABELS[type]}: ${created} created, ${errors.length} errors` }));
      } else {
        dispatch(showToast({ type: "success", title: `${LABELS[type]} Bills Generated`, message: `${created} new, ${skipped} already existed` }));
      }
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || `Could not generate ${type} bills` }));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={s("fees-page")}>
      <Topbar title="Monthly Billing" subtitle="Track which students have paid, partially paid, or not yet paid for the selected month" />
      <main className={s("page-content")}>

        {/* Header */}
        <section className={s("page-head")}>
          <div>
            <h1>Monthly Billing Status</h1>
            <p>Select a month to see each student's payment status</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/fees">
              <i className="fa-solid fa-arrow-left" /> Overview
            </Link>
            <Link className={cx(s("btn"), s("btn-soft"))} href="/fees/records">
              <i className="fa-solid fa-table-list" /> All Records
            </Link>
          </div>
        </section>

        {/* Generate Bills Panel */}
        <section className={s("card")} style={{ marginBottom: 0 }}>
          <div className={s("card-head")}>
            <div>
              <h3>
                <i className="fa-solid fa-calendar-plus" style={{ color: "#ff9b51", marginRight: 8 }} />
                Generate Bills for {billingMonthLabel}
              </h3>
              <p>
                Create fee collections for all enrolled students for this month.
                Idempotent — safe to run multiple times.
              </p>
            </div>
          </div>
          <div style={{ padding: "14px 18px", display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", borderBottom: "1px solid #f0f4f5" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 900 }}>Billing Month</label>
              {isBS ? (
                <select
                  value={billingMonth}
                  onChange={e => setBillingMonth(e.target.value)}
                  style={{ minHeight: 40, padding: "0 12px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 13, fontWeight: 800, outline: "none", background: "#fff", cursor: "pointer", minWidth: 180 }}
                >
                  {bsMonthOptions.map(opt => (
                    <option key={opt.adValue} value={opt.adValue}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="month"
                  value={billingMonth}
                  onChange={e => setBillingMonth(e.target.value)}
                  style={{ minHeight: 40, padding: "0 12px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 13, fontWeight: 800, outline: "none" }}
                />
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className={cx(s("btn"), s("btn-primary"))}
                onClick={() => handleGenerate("academic")}
                disabled={!!generating || !academicYearId}
              >
                {generating === "academic"
                  ? <><Spinner size={15} color="#fff" /> Generating…</>
                  : <><i className="fa-solid fa-graduation-cap" /> Academic Fees</>}
              </button>
              <button
                className={cx(s("btn"), s("btn-soft"))}
                onClick={() => handleGenerate("transport")}
                disabled={!!generating || !academicYearId}
              >
                {generating === "transport"
                  ? <><Spinner size={15} /> Generating…</>
                  : <><i className="fa-solid fa-bus" /> Transport Fees</>}
              </button>
              <button
                className={cx(s("btn"), s("btn-soft"))}
                onClick={() => handleGenerate("hostel")}
                disabled={!!generating || !academicYearId}
              >
                {generating === "hostel"
                  ? <><Spinner size={15} /> Generating…</>
                  : <><i className="fa-solid fa-building" /> Hostel Fees</>}
              </button>
            </div>
          </div>
        </section>

        {/* Summary Cards */}
        <section className={s("summary-cards")} style={{ marginTop: 16 }}>
          {[
            ["fa-users",                "Total Students",  totalStudents,                  "Billed this month", "blue"  ],
            ["fa-circle-check",         "Fully Paid",      paidCount,                      "All dues cleared",  "green" ],
            ["fa-circle-half-stroke",   "Partial",         partialCount,                   "Partially paid",    "orange"],
            ["fa-circle-xmark",         "Not Paid",        unpaidCount,                    "No payment yet",    "rose"  ],
            ["fa-indian-rupee-sign",    "Total Billed",    formatINR(totalBilled),         billingMonthLabel,   "blue"  ],
            ["fa-hand-holding-dollar",  "Collected",       formatINR(totalCollected),      "Received",          "green" ],
            ["fa-clock",                "Outstanding",     formatINR(totalOutstanding),    "Still due",         "rose"  ],
          ].map(([icon, label, value, sub, tone]) => (
            <article className={s("structure-stat-card")} key={label as string}>
              <div className={cx(s("structure-stat-icon"), s(tone as string))}>
                <i className={`fa-solid ${icon as string}`} />
              </div>
              <div>
                <p>{label as string}</p>
                <strong>{value}</strong>
                <small>{sub as string}</small>
              </div>
            </article>
          ))}
        </section>

        {/* Filters */}
        <section className={cx(s("card"), s("records-toolbar"))}>
          <label className={s("search-field")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="search"
              placeholder="Search by name, admission no, class…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <select
            className={s("filter-field")}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Students</option>
            <option value="paid">Fully Paid</option>
            <option value="partial">Partially Paid</option>
            <option value="unpaid">Not Paid</option>
          </select>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6a7882", alignSelf: "center" }}>
            {filtered.length} student{filtered.length !== 1 ? "s" : ""}
          </span>
        </section>

        {/* Student Table */}
        <section className={s("card")}>
          <div className={s("card-head")}>
            <div>
              <h3>
                <i className="fa-solid fa-users-viewfinder" style={{ marginRight: 6 }} />
                Students — {billingMonthLabel}
              </h3>
              <p>Click a row to expand individual fee bills for that student</p>
            </div>
          </div>

          <div className={s("table-wrap")}>
            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center" }}>
                <Spinner size={32} color="#FF9B51" />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#6a7882" }}>
                <i className="fa-solid fa-inbox" style={{ fontSize: 26, display: "block", marginBottom: 8, opacity: 0.25 }} />
                {allBills.length === 0
                  ? "No bills generated for this month yet. Use the Generate buttons above."
                  : "No students match the current filter."}
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 28 }} />
                    <th>Student</th>
                    <th>Class / Section</th>
                    <th>Bills</th>
                    <th>Total Billed</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(st => {
                    const isExpanded = expandedStudent === st.student_id;
                    const rowBg =
                      st.overallStatus === "paid"    ? "#f0fdf4" :
                      st.overallStatus === "partial" ? "#fffbeb" :
                      "#fff5f5";

                    return [
                      // ── Main student row ──
                      <tr
                        key={`student-${st.student_id}`}
                        style={{ background: rowBg, cursor: "pointer" }}
                        onClick={() => setExpandedStudent(isExpanded ? null : st.student_id)}
                      >
                        <td style={{ textAlign: "center", color: "#6a7882" }}>
                          <i className={`fa-solid fa-chevron-${isExpanded ? "down" : "right"}`} style={{ fontSize: 11 }} />
                        </td>
                        <td>
                          <strong style={{ display: "block" }}>{st.full_name}</strong>
                          <small style={{ color: "#6a7882" }}>{st.admission_number}</small>
                        </td>
                        <td>
                          {[st.class_name, st.section_name].filter(Boolean).join(" / ")}
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#6a7882" }}>
                            {st.bills.length} fee{st.bills.length !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td><strong>{formatINR(st.total_amount)}</strong></td>
                        <td style={{ color: "#12805c", fontWeight: 700 }}>{formatINR(st.paid_amount)}</td>
                        <td>
                          <strong style={{ color: st.remaining_amount > 0 ? "#b42318" : "#12805c" }}>
                            {formatINR(st.remaining_amount)}
                          </strong>
                        </td>
                        <td>
                          <span className={cx(s("badge"), s(STATUS_BADGE[st.overallStatus] || "badge-gray"))} style={{ textTransform: "capitalize" }}>
                            {st.overallStatus === "paid" ? "Fully Paid" : st.overallStatus === "partial" ? "Partial" : "Not Paid"}
                          </span>
                        </td>
                        <td>
                          {st.overallStatus !== "paid" && (
                            <Link
                              className={cx(s("btn"), s("btn-primary"), s("btn-sm"))}
                              href={`/fees/collect?student_id=${st.student_id}`}
                              onClick={e => e.stopPropagation()}
                            >
                              Collect
                            </Link>
                          )}
                        </td>
                      </tr>,

                      // ── Expanded detail rows ──
                      ...(isExpanded ? st.bills.map((bill: any) => (
                        <tr key={`bill-${bill.collection_id}`} style={{ background: "#f8fafc", borderLeft: "3px solid #FF9B51" }}>
                          <td />
                          <td colSpan={2} style={{ paddingLeft: 24, fontSize: 12, color: "#1f2d36", fontWeight: 700 }}>
                            {bill.fee_name}
                            <span
                              className={cx(s("badge"), s(TYPE_BADGE[bill.fee_type || "academic"]?.cls || "badge-blue"))}
                              style={{ marginLeft: 8, fontSize: 10 }}
                            >
                              {TYPE_BADGE[bill.fee_type || "academic"]?.label}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: "#6a7882", fontWeight: 700 }}>
                            Due: {formatDate(String(bill.due_date).slice(0, 10))}
                          </td>
                          <td style={{ fontSize: 12 }}><strong>{formatINR(bill.total_amount)}</strong></td>
                          <td style={{ fontSize: 12, color: "#12805c", fontWeight: 700 }}>{formatINR(bill.paid_amount)}</td>
                          <td style={{ fontSize: 12 }}>
                            <strong style={{ color: Number(bill.remaining_amount) > 0 ? "#b42318" : "#12805c" }}>
                              {formatINR(bill.remaining_amount)}
                            </strong>
                          </td>
                          <td>
                            <span className={cx(s("badge"), s(STATUS_BADGE[bill.status] || "badge-gray"))} style={{ textTransform: "capitalize", fontSize: 10 }}>
                              {bill.status}
                            </span>
                          </td>
                          <td />
                        </tr>
                      )) : []),
                    ];
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
