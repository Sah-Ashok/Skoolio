"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
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

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const formatINR = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function FeesPage() {
  const dispatch = useAppDispatch();
  const { isBS, formatDate } = useDateFormat();
  const { activeYear, academicYearId } = useAcademicYear();
  const { data: collections, loading, refetch: refetchCollections } = useApi<any[]>(academicYearId ? `/fees/collections?academic_year_id=${academicYearId}` : '', [academicYearId]);

  // billingMonth is always stored as AD "YYYY-MM" — the API expects AD
  const [billingMonth, setBillingMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generating, setGenerating] = useState<string | false>(false);
  const { data: monthlyStatus, loading: monthlyStatusLoading, refetch: refetchMonthlyStatus } = useApi<any[]>(
    academicYearId && billingMonth
      ? `/fees/monthly/status?academic_year_id=${academicYearId}&billing_month=${billingMonth}`
      : '',
    [academicYearId, billingMonth]
  );

  // ── BS month options for the billing month picker ─────────────────────────
  // Build options spanning the active academic year (or ±6 months of today)
  const bsMonthOptions = useMemo(() => {
    if (!isBS) return [];
    // Determine range: academic year start→end, or fallback 12 months around today
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
      // Get the AD month this BS month maps to (use day 15 rule)
      const adDate = new Date(bsToISO({ year: y, month: m, day: 15 }) + "T00:00:00");
      const adValue = `${adDate.getFullYear()}-${String(adDate.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ label: `${BS_MONTH_NAMES[m - 1]} ${y}`, adValue });
      if (m === 12) { y++; m = 1; } else m++;
    }
    return opts;
  }, [isBS, activeYear]);

  // Display label for the currently selected billing month
  const billingMonthLabel = useMemo(() => {
    if (!isBS) return null; // AD: native <input type="month"> shows its own label
    const found = bsMonthOptions.find(o => o.adValue === billingMonth);
    return found?.label ?? billingMonth;
  }, [isBS, billingMonth, bsMonthOptions]);

  const handleGenerateBills = async (type: 'academic' | 'transport' | 'hostel') => {
    if (!academicYearId || !billingMonth) return;
    setGenerating(type);
    const ENDPOINTS: Record<string, string> = {
      academic:  '/fees/monthly/generate',
      transport: '/fees/transport/generate',
      hostel:    '/fees/hostel/generate',
    };
    const LABELS: Record<string, string> = {
      academic:  'Academic',
      transport: 'Transport',
      hostel:    'Hostel',
    };
    try {
      const res = await apiRequest<{ data: any }>(ENDPOINTS[type], {
        method: 'POST',
        body: JSON.stringify({ academic_year_id: academicYearId, billing_month: billingMonth }),
      });
      const { created, skipped, errors } = res.data ?? res;
      if (errors?.length) {
        dispatch(showToast({ type: 'error', title: 'Partial Success', message: `${LABELS[type]}: ${created} created, ${skipped} skipped, ${errors.length} errors.` }));
      } else {
        dispatch(showToast({ type: 'success', title: `${LABELS[type]} Bills Generated`, message: `${created} new bills created, ${skipped} already existed.` }));
      }
      refetchCollections();
      refetchMonthlyStatus();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: err.message || `Could not generate ${LABELS[type].toLowerCase()} bills.` }));
    } finally {
      setGenerating(false);
    }
  };
  
  const totalCollected = collections?.filter(c => c.status === 'paid' || c.status === 'partial')
    .reduce((sum, c) => sum + parseFloat(c.paid_amount || '0'), 0) || 0;
    
  const totalPending = collections?.filter(c => c.status !== 'paid')
    .reduce((sum, c) => sum + (parseFloat(c.total_amount) - parseFloat(c.paid_amount || '0')), 0) || 0;
    
  const overdueCount = collections?.filter(c => c.status !== 'paid' && new Date(c.due_date) < new Date()).length || 0;
  
  const totalAssigned = collections?.reduce((sum, c) => sum + parseFloat(c.total_amount), 0) || 1;
  const collectionRate = Math.round((totalCollected / totalAssigned) * 100);

  // Real monthly data from collections
  const monthlyMap: Record<number, { collected: number; pending: number }> = {};
  (collections || []).forEach(c => {
    const month = new Date(c.due_date).getMonth();
    if (!monthlyMap[month]) monthlyMap[month] = { collected: 0, pending: 0 };
    monthlyMap[month].collected += parseFloat(c.paid_amount || '0');
    if (c.status !== 'paid') monthlyMap[month].pending += parseFloat(c.remaining_amount || '0');
  });
  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .slice(-6)
    .map(([month, v]) => {
      const maxVal = Math.max(v.collected, v.pending, 1);
      return [
        MONTH_NAMES[Number(month)],
        formatINR(v.collected),
        formatINR(v.pending),
        Math.round((v.collected / maxVal) * 100),
        Math.round((v.pending / maxVal) * 100),
      ];
    });

  const stats = [
    ["fa-circle-check", "Total Collected", formatINR(totalCollected), "This academic year", "c1"],
    ["fa-clock", "Total Pending", formatINR(totalPending), "Overall", "c2"],
    ["fa-triangle-exclamation", "Overdue > 30 Days", overdueCount.toString(), "Students", "c3"],
    ["fa-percent", "Collection Rate", `${collectionRate}%`, "Current Year", "c4"],
  ];

  const pendingList = collections?.filter(c => c.status !== 'paid').slice(0, 5) || [];

  // This report intentionally includes academic, transport, and hostel bills.
  // A paid-in-full student is excluded so staff can see exactly who still owes
  // an amount for the selected billing month.
  const monthlyPending = (monthlyStatus || []).filter((bill: any) => bill.status !== 'paid' && bill.status !== 'waived');
  const monthlyPendingAmount = monthlyPending.reduce((sum: number, bill: any) => sum + Number(bill.remaining_amount || 0), 0);

  const feeStatusData = [
    { name: "Paid", value: collections?.filter(c => c.status === 'paid').length || 0, color: "#12805c" },
    { name: "Partial", value: collections?.filter(c => c.status === 'partial').length || 0, color: "#d8941f" },
    { name: "Unpaid", value: collections?.filter(c => c.status === 'unpaid').length || 0, color: "#e15b64" },
  ];

  return (
    <div className={s("fees-page")}>
      <Topbar title="Fee Management" subtitle="Track collections, pending fees, and payment history" />
      <main className={s("page-content")}>
        <section className={s("page-head")}>
          <div>
            <h1>Fee Overview</h1>
            <p>Fee collection summary and recent records</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/fees/structures"><i className="fa-solid fa-list" /> Fee Structures</Link>
            <Link className={cx(s("btn"), s("btn-soft"))} href="/fees/records"><i className="fa-solid fa-table-list" /> All Records</Link>
            <Link className={cx(s("btn"), s("btn-primary"))} href="/fees/collect"><i className="fa-solid fa-hand-holding-dollar" /> Collect Fee</Link>
          </div>
        </section>

        <section className={s("hero-cards")}>
          {stats.map(([icon, label, value, sub, tone]) => (
            <article className={cx(s("hero-card"), s(tone))} key={label}>
              <div className={s("hc-icon")}><i className={`fa-solid ${icon}`} /></div>
              <div className={s("hc-label")}>{label}</div>
              <div className={s("hc-value")}>{value}</div>
              <div className={s("hc-sub")}>{sub}</div>
            </article>
          ))}
        </section>

        <section className={s("quick-actions")}>
          <QuickAction href="/fees/collect" icon="fa-hand-holding-dollar" title="Collect Fee" text="Record new payment" />
          <QuickAction href="/fees/structures" icon="fa-list-check" title="Fee Structures" text="Manage fee plans" />
          <QuickAction href="/fees/structures/add" icon="fa-plus" title="Add Structure" text="New fee template" />
          <QuickAction href="/fees/records" icon="fa-table-list" title="All Records" text="View all payments" />
        </section>

        {/* ── GENERATE BILLS PANEL ── */}
        <section className={s("card")} style={{ marginBottom: 0 }}>
          <div className={s("card-head")}>
            <div>
              <h3><i className="fa-solid fa-calendar-plus" style={{ color: "#ff9b51", marginRight: 8 }} />Generate Monthly Bills</h3>
              <p>Batch-create fee collections for all enrolled students. Applies scholarship discounts. Skips already-billed students — safe to run multiple times.</p>
            </div>
          </div>
          <div style={{ padding: "14px 18px", display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", borderBottom: "1px solid #f0f4f5" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 900 }}>Billing Month</label>
              {isBS ? (
                /* BS school: show a <select> with BS month names, value stores AD YYYY-MM */
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
                /* AD school: native month picker */
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
                onClick={() => handleGenerateBills('academic')}
                disabled={!!generating || !academicYearId}
              >
                {generating === 'academic'
                  ? <><Spinner size={15} color="#fff" /> Generating…</>
                  : <><i className="fa-solid fa-graduation-cap" /> Academic Fees</>}
              </button>
              <button
                className={cx(s("btn"), s("btn-soft"))}
                onClick={() => handleGenerateBills('transport')}
                disabled={!!generating || !academicYearId}
              >
                {generating === 'transport'
                  ? <><Spinner size={15} /> Generating…</>
                  : <><i className="fa-solid fa-bus" /> Transport Fees</>}
              </button>
              <button
                className={cx(s("btn"), s("btn-soft"))}
                onClick={() => handleGenerateBills('hostel')}
                disabled={!!generating || !academicYearId}
              >
                {generating === 'hostel'
                  ? <><Spinner size={15} /> Generating…</>
                  : <><i className="fa-solid fa-building" /> Hostel Fees</>}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#6a7882", fontWeight: 700, alignSelf: "center" }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />
              Idempotent — scholarship discounts auto-applied on academic bills.
            </p>
          </div>
        </section>

        <section className={s("card")} style={{ marginTop: 16 }}>
          <div className={s("card-head")}>
            <div>
              <h3><i className="fa-solid fa-users-viewfinder" />Pending Fees — {billingMonthLabel || billingMonth}</h3>
              <p>All unpaid or partially paid academic, transport, and hostel bills for the selected month.</p>
            </div>
            <strong style={{ color: "#b42318", fontSize: 13 }}>{monthlyPending.length} pending · {formatINR(monthlyPendingAmount)}</strong>
          </div>
          <div className={s("table-wrap")}>
            <table>
              <thead><tr><th>Student</th><th>Class / Section</th><th>Fee</th><th>Type</th><th>Due Date</th><th>Remaining</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {monthlyStatusLoading ? <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}><Spinner size={24} color="#FF9B51" /></td></tr>
                  : monthlyPending.map((bill: any) => (
                    <tr key={bill.collection_id}>
                      <td><strong>{bill.full_name}</strong><br /><small style={{ color: "#6a7882" }}>{bill.admission_number}</small></td>
                      <td>{[bill.class_name, bill.section_name].filter(Boolean).join(" / ") || "—"}</td>
                      <td>{bill.fee_name}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 800 }}>{String(bill.fee_type || "academic").toUpperCase()}</span></td>
                      <td>{formatDate(String(bill.due_date).slice(0, 10))}</td>
                      <td><strong>{formatINR(Number(bill.remaining_amount || 0))}</strong></td>
                      <td><Badge status={bill.status} /></td>
                      <td><Link className={cx(s("btn"), s("btn-primary"), s("btn-sm"))} href={`/fees/collect?student_id=${bill.student_id}`}>Collect</Link></td>
                    </tr>
                  ))}
                {!monthlyStatusLoading && monthlyPending.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>No pending fees for this month.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className={s("chart-row")}>
          <article className={s("chart-card")}>
            <div className={s("chart-head")}>
              <div><h3>Monthly Collection</h3><p>Collected vs pending per month</p></div>
            </div>
            <div className={s("chart-body")}>
              <div className={s("chart-metrics")}>
                <div><span>Collected</span><strong>{formatINR(totalCollected)}</strong></div>
                <div><span>Pending</span><strong>{formatINR(totalPending)}</strong></div>
                <div><span>Rate</span><strong>{collectionRate}%</strong></div>
              </div>
              <div className={s("bar-chart")}>
                {monthlyData.map(([month, collected, pendingAmount, collectedHeight, pendingHeight]) => {
                  const collectedPct = Math.min(Number(collectedHeight), 100);
                  const pendingPct = Math.min(Number(pendingHeight), 100);

                  return (
                    <div className={s("bar-group")} key={month}>
                      <div className={s("bar-values")}>
                        <span>Collected {collected}</span>
                        <span>Pending {pendingAmount}</span>
                      </div>
                      <div className={s("bar-stack")}>
                        <span style={{ height: `${collectedPct}%` }} />
                        <em style={{ height: `${pendingPct}%` }} />
                      </div>
                      <p>{month}</p>
                    </div>
                  );
                })}
              </div>
              <div className={s("chart-legend")}><span><i className={s("legend-green")} /> Collected</span><span><i className={s("legend-red")} /> Pending</span></div>
            </div>
          </article>

          <article className={s("chart-card")}>
            <div className={s("chart-head")}><div><h3>Fee Status Breakdown</h3><p>Overall overview</p></div></div>
            <div className={s("status-box")}>
              <div className={s("donut-wrap")}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={feeStatusData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={78} paddingAngle={3} cornerRadius={6}>
                      {feeStatusData.map((entry) => (
                        <Cell fill={entry.color} key={entry.name} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #d7dfdf", boxShadow: "0 12px 30px rgba(31,45,54,0.12)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={s("donut-center")}>
                  <strong>{collections?.length || 0}</strong>
                  <span>Records</span>
                </div>
              </div>
              <div className={s("status-list")}>
                <div><span className={s("dot-green")} /><p>{feeStatusData[0].value}</p><strong>Paid</strong></div>
                <div><span className={s("dot-yellow")} /><p>{feeStatusData[1].value}</p><strong>Partial</strong></div>
                <div><span className={s("dot-red")} /><p>{feeStatusData[2].value}</p><strong>Unpaid</strong></div>
              </div>
            </div>
          </article>
        </section>

        <section className={s("data-row")}>
          <article className={s("card")} style={{ flex: 1 }}>
            <div className={s("card-head")}>
              <div><h3><i className="fa-solid fa-clock" /> Pending Payments</h3><p>Recent unpaid records</p></div>
              <div className={s("table-actions")}><Link className={cx(s("btn"), s("btn-soft"), s("btn-sm"))} href="/fees/records">View All</Link></div>
            </div>
            {loading ? <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div> : (
              <div className={s("table-wrap")}>
                <table><thead><tr><th>Student</th><th>Fee Name</th><th>Type</th><th>Due Date</th><th>Amount Due</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>{pendingList.map((col: any) => (
                    <tr key={col.id}>
                      <td>
                        <div><strong>{col.full_name || `Student #${col.student_id}`}</strong><br/><small style={{color:'#6a7882'}}>{col.admission_number || ''}</small></div>
                      </td>
                      <td>{col.fee_name || `Fee #${col.id}`}</td>
                      <td><span style={{fontSize:'11px',fontWeight:800,padding:'2px 8px',borderRadius:'999px',background: col.fee_type === 'transport' ? '#fff1df' : col.fee_type === 'hostel' ? '#f3e8ff' : '#e8edff', color: col.fee_type === 'transport' ? '#c46a14' : col.fee_type === 'hostel' ? '#7c3aed' : '#3b5bdb'}}>{(col.fee_type || 'academic').toUpperCase()}</span></td>
                      <td className={new Date(col.due_date) < new Date() ? s("danger-text") : s("warning-text")}>{formatDate(col.due_date?.slice(0,10))}</td>
                      <td><strong>{formatINR(parseFloat(col.remaining_amount || '0'))}</strong></td>
                      <td><Badge status={col.status} /></td>
                      <td><Link className={cx(s("btn"), s("btn-primary"), s("btn-sm"))} href={`/fees/collect?student_id=${col.student_id}`}>Collect</Link></td>
                    </tr>
                  ))}
                  {pendingList.length === 0 && <tr><td colSpan={7} style={{textAlign:'center', padding:'2rem'}}>No pending fees.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}

function QuickAction({ href, icon, title, text }: { href: string; icon: string; title: string; text: string }) {
  return <Link className={s("qa-card")} href={href}><div className={s("qa-ico")}><i className={`fa-solid ${icon}`} /></div><div><p>{title}</p><span>{text}</span></div></Link>;
}

function Badge({ status }: { status: string }) {
  const tone = status === "overdue" || status === "unpaid" ? "badge-red" : status === "pending" || status === "partial" || status === "cheque" ? "badge-yellow" : status === "online" ? "badge-blue" : "badge-green";
  return <span className={cx(s("badge"), s(tone))} style={{textTransform: 'capitalize'}}>{status}</span>;
}
