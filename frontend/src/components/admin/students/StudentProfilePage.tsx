"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./students.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency }  from "@/lib/useCurrency";
import { useAppDispatch } from "@/store/hooks";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");
const pctColor = (p: number) => p >= 85 ? "#16a34a" : p >= 70 ? "#d97706" : "#dc2626";

/* ─── STAT BOX ───────────────────────────────────────────────────────────── */
function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={s("sp-stat")}>
      <span className={s("sp-stat-label")}>{label}</span>
      <strong className={s("sp-stat-val")}>{value}</strong>
      {sub && <span className={s("sp-stat-sub")}>{sub}</span>}
    </div>
  );
}

/* ─── DETAIL ROW ─────────────────────────────────────────────────────────── */
function DRow({ label, value, cap }: { label: string; value: string; cap?: boolean }) {
  return (
    <div className={s("sp-drow")}>
      <span>{label}</span>
      <strong style={{ textTransform: cap ? "capitalize" : "none" }}>{value || "—"}</strong>
    </div>
  );
}

/* ─── SECTION HEADER ─────────────────────────────────────────────────────── */
function SecHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className={s("sp-sechead")}>
      <div>
        <h3 className={s("sp-sectitle")}>{title}</h3>
        {sub && <p className={s("sp-secsub")}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ─── SERVICE ROW ────────────────────────────────────────────────────────── */
function SvcRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className={s("sp-svcrow")}>
      <i className={`${icon} ${s("sp-svcicon")}`} />
      <div>
        <span className={s("sp-svclabel")}>{label}</span>
        <strong className={s("sp-svcval")}>{value || "—"}</strong>
      </div>
    </div>
  );
}

/* ─── FEE ROW ────────────────────────────────────────────────────────────── */
function FeeRow({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: string }) {
  return (
    <div className={s("sp-feerow")}>
      <span style={{ color: muted ? "#94a3b8" : "#64748b" }}>{label}</span>
      <strong style={{ color: accent || "#1e293b" }}>{value}</strong>
    </div>
  );
}

/* ─── ATTENDANCE DONUT ───────────────────────────────────────────────────── */
function AttDonut({ present, absent, late, leave, pct }: {
  present: number; absent: number; late: number; leave: number; pct: number;
}) {
  const total = present + absent + late + leave || 1;
  const slices = [
    { val: present, color: "#16a34a" },
    { val: absent,  color: "#dc2626" },
    { val: late,    color: "#d97706" },
    { val: leave,   color: "#94a3b8" },
  ];
  const r = 48, cx2 = 60, cy2 = 60, circ = 2 * Math.PI * r;
  let off = 0;
  const arcs = slices.map(sl => {
    const dash = (sl.val / total) * circ;
    const arc  = { dash, off, color: sl.color };
    off += dash;
    return arc;
  });
  const col = pctColor(pct);
  return (
    <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx={cx2} cy={cy2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {arcs.map((a, i) => a.dash > 0 && (
          <circle key={i} cx={cx2} cy={cy2} r={r} fill="none" stroke={a.color} strokeWidth="14"
            strokeDasharray={`${a.dash} ${circ - a.dash}`}
            strokeDashoffset={-a.off + circ / 4}
            style={{ transition: "stroke-dasharray 0.5s" }}
          />
        ))}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <strong style={{ fontSize: 17, fontWeight: 900, color: col, lineHeight: 1 }}>{pct}%</strong>
        <span style={{ fontSize: 9, color: "#6a7882", fontWeight: 800, marginTop: 3, letterSpacing: "0.05em" }}>RATE</span>
      </div>
    </div>
  );
}

/* ─── LEGEND DOT ─────────────────────────────────────────────────────────── */
function LegDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "#6a7882", fontWeight: 700 }}>{label}</span>
      </span>
      <strong style={{ fontSize: 13, color: "#1e293b", fontWeight: 900 }}>{value}</strong>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function StudentProfilePage() {
  const { formatDate } = useDateFormat();
  const { fmt }        = useCurrency();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const id = searchParams?.get("id");

  const { data: activeYear }              = useApi<any>("/academic-years/active");
  const { data: student, loading }        = useApi<any>(id ? `/students/${id}` : "");
  const { data: enrollments }             = useApi<any[]>(id ? `/students/${id}/enrollments` : "");

  // Fee collections — refetchable
  const [fees,       setFees]       = useState<any[]>([]);
  const [loadingFees,setLoadingFees]= useState(true);

  // Services
  const [transport,  setTransport]  = useState<any>(null);
  const [hostel,     setHostel]     = useState<any>(null);
  const [loadingSvc, setLoadingSvc] = useState(true);

  // Attendance
  const [attTab,     setAttTab]     = useState<"this" | "last" | "year">("this");
  const [attYear,    setAttYear]    = useState<any>(null);
  const [calThis,    setCalThis]    = useState<any[]>([]);
  const [calLast,    setCalLast]    = useState<any[]>([]);
  const [loadingAtt, setLoadingAtt] = useState(true);

  // Payment history — refetchable
  const [payments,    setPayments]    = useState<any[]>([]);
  const [loadingPay,  setLoadingPay]  = useState(true);

  /* ── Dates ── */
  const pad = (n: number) => String(n).padStart(2, "0");
  const now      = new Date();
  const thisYear = now.getFullYear();
  const thisMo   = now.getMonth() + 1;
  const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastYear = lastDate.getFullYear();
  const lastMo   = lastDate.getMonth() + 1;
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  /* ── Fetch fees ── */
  const fetchFees = useCallback(() => {
    if (!id || !activeYear?.id) return;
    setLoadingFees(true);
    apiRequest<{ data: any[] }>(`/fees/collections/student/${id}?academic_year_id=${activeYear.id}`)
      .then(r => setFees((r as any)?.data || []))
      .catch(() => setFees([]))
      .finally(() => setLoadingFees(false));
  }, [id, activeYear?.id]);

  /* ── Fetch payments ── */
  const fetchPayments = useCallback(() => {
    if (!id) return;
    setLoadingPay(true);
    apiRequest<{ data: any[] }>(`/fees/payments/student/${id}`)
      .then(r => setPayments((r as any)?.data || []))
      .catch(() => setPayments([]))
      .finally(() => setLoadingPay(false));
  }, [id]);

  useEffect(() => { fetchFees(); },    [fetchFees]);
  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  /* ── Fetch transport + hostel ── */
  useEffect(() => {
    if (!id || !activeYear?.id) return;
    setLoadingSvc(true);
    Promise.allSettled([
      apiRequest(`/transport/students/${id}?academic_year_id=${activeYear.id}`),
      apiRequest(`/hostel/students/${id}?academic_year_id=${activeYear.id}`),
    ]).then(([t, h]) => {
      setTransport(t.status === "fulfilled" ? (t.value as any)?.data : null);
      setHostel(   h.status === "fulfilled" ? (h.value as any)?.data : null);
    }).finally(() => setLoadingSvc(false));
  }, [id, activeYear?.id]);

  /* ── Fetch attendance ── */
  useEffect(() => {
    if (!id || !activeYear?.id) return;
    setLoadingAtt(true);
    Promise.allSettled([
      apiRequest(`/attendance/student/${id}/summary?academic_year_id=${activeYear.id}`),
      apiRequest(`/attendance/student/${id}/monthly?year=${thisYear}&month=${thisMo}&academic_year_id=${activeYear.id}`),
      apiRequest(`/attendance/student/${id}/monthly?year=${lastYear}&month=${lastMo}&academic_year_id=${activeYear.id}`),
    ]).then(([summary, calT, calL]) => {
      setAttYear(summary.status === "fulfilled" ? (summary.value as any)?.data : null);
      setCalThis(calT.status === "fulfilled"    ? ((calT.value as any)?.data || []) : []);
      setCalLast(calL.status === "fulfilled"    ? ((calL.value as any)?.data || []) : []);
    }).finally(() => setLoadingAtt(false));
  }, [id, activeYear?.id]);

  /* ── Guards ── */
  if (!id)      return <div className={s("sp-empty")}>No student selected.</div>;
  if (loading)  return <div className={s("sp-loading")}><Spinner size={32} color="#ff9b51" /></div>;
  if (!student) return <div className={s("sp-empty")}>Student not found.</div>;

  /* ── Attendance compute ── */
  const summarise = (records: any[]) => {
    const present = records.filter(r => r.status === "present").length;
    const absent  = records.filter(r => r.status === "absent").length;
    const late    = records.filter(r => r.status === "late").length;
    const leave   = records.filter(r => r.status === "leave").length;
    const marked  = records.length;
    const pct     = marked > 0 ? Math.round(((present + late) / marked) * 100) : 0;
    return { present, absent, late, leave, marked, pct };
  };
  const summThis = summarise(calThis);
  const summLast = summarise(calLast);
  const yearPresent = Number(attYear?.total_present ?? 0);
  const yearAbsent  = Number(attYear?.total_absent  ?? 0);
  const yearLate    = Number(attYear?.total_late    ?? 0);
  const yearLeave   = Number(attYear?.total_leave   ?? 0);
  const yearMarked  = Number(attYear?.total_marked  ?? 0);
  const yearPct     = yearMarked > 0 ? Math.round(((yearPresent + yearLate) / yearMarked) * 100) : 0;
  const attMap = {
    this: { ...summThis, working: summThis.marked },
    last: { ...summLast, working: summLast.marked },
    year: { present: yearPresent, absent: yearAbsent, late: yearLate, leave: yearLeave, marked: yearMarked, pct: yearPct, working: yearMarked },
  };
  const cur = attMap[attTab];

  /* ── Fee compute ── */
  const billedTotal  = fees.reduce((a, f) => a + parseFloat(f.net_amount || f.total_amount || 0), 0);
  const billedPaid   = fees.reduce((a, f) => a + parseFloat(f.paid_amount || 0), 0);
  const transportAnn = transport ? parseFloat(transport.monthly_fee || 0) * 12 : 0;
  const hostelAnn    = hostel    ? parseFloat(hostel.monthly_fee    || 0) * 12 : 0;
  const grandTotal   = billedTotal;
  const grandPaid    = billedPaid;
  const grandPending = Math.max(0, fees.reduce((a, f) => a + parseFloat(f.remaining_amount || 0), 0));
  const paidPct      = grandTotal > 0 ? (grandPaid / grandTotal) * 100 : 0;
  const unpaidFees   = fees.filter((f: any) => parseFloat(f.remaining_amount || 0) > 0.009);

  const enr      = enrollments?.[0];
  const initials = (student.full_name || "").split(" ").map((p: string) => p[0]).join("").substring(0, 2).toUpperCase();
  const TAB_LABELS = { this: `${MONTH_NAMES[thisMo - 1]} ${thisYear}`, last: `${MONTH_NAMES[lastMo - 1]} ${lastYear}`, year: "Full Year" };

  return (
    <div className={s("students-page")}>
      <Topbar title="Student Profile" subtitle="Student records and details" />

      <main className={s("page-content")}>

        {/* PAGE HEAD */}
        <section className={s("page-head")}>
          <div>
            <h1>Student Profile</h1>
            <p>{student.admission_number}</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/students">
              <i className="fa-solid fa-arrow-left" /> Back
            </Link>
            <Link className={cx(s("btn"), s("btn-primary"))} href={`/students/${id}/edit`}>
              <i className="fa-solid fa-pen-to-square" /> Edit
            </Link>
          </div>
        </section>

        {/* HERO BANNER */}
        <section className={s("sp-hero")}>
          <div className={s("sp-hero-left")}>
            {student.photo
              ? <img src={student.photo} alt="" className={s("sp-avatar-img")} />
              : <div className={s("sp-avatar")}>{initials}</div>
            }
            <div className={s("sp-hero-info")}>
              <p className={s("sp-kicker")}>
                <span className={cx(s("sp-dot"), student.status === "active" ? s("sp-dot-green") : s("sp-dot-yellow"))} />
                {student.status} student
              </p>
              <h2 className={s("sp-name")}>{student.full_name}</h2>
              <p className={s("sp-sub")}>
                {enr ? `Class ${enr.class_name || enr.class_id} · Section ${enr.section_name || enr.section_id} · ` : ""}
                Admitted {student.admission_date ? formatDate(student.admission_date.slice(0, 10)) : "—"}
              </p>
              <div className={s("sp-tags")}>
                {grandPending > 0
                  ? <span className={cx(s("badge"), s("badge-red"))}>Fee Due ₹{fmt(grandPending)}</span>
                  : <span className={cx(s("badge"), s("badge-green"))}>Fee Cleared</span>
                }
                {!loadingSvc && transport && <span className={cx(s("badge"), s("badge-blue"))}><i className="fa-solid fa-bus" /> {transport.route_name}</span>}
                {!loadingSvc && hostel    && <span className={cx(s("badge"), s("badge-yellow"))}><i className="fa-solid fa-building" /> {hostel.hostel_name}</span>}
              </div>
            </div>
          </div>
          <div className={s("sp-hero-stats")}>
            <StatBox label="Attendance (Year)" value={`${yearPct}%`}          sub={`${yearPresent} / ${yearMarked} days`} />
            <StatBox label="Fee Paid"          value={fmt(grandPaid)}          sub={`of ${fmt(grandTotal)}`} />
            <StatBox label="Enrollments"       value={String(enrollments?.length || 0)} sub="academic years" />
          </div>
        </section>

        {/* MAIN GRID */}
        <div className={s("sp-grid")}>

          {/* ── LEFT ── */}
          <div className={s("sp-col")}>

            {/* Personal info */}
            <section className={s("card")}>
              <SecHead title="Personal Information" sub="Identity, contact and guardian" />
              <div className={s("sp-dlist")}>
                <DRow label="Date of Birth"     value={student.date_of_birth ? formatDate(student.date_of_birth.slice(0, 10)) : ""} />
                <DRow label="Gender"            value={student.gender}       cap />
                <DRow label="Blood Group"       value={student.blood_group} />
                <DRow label="Email"             value={student.email} />
                <DRow label="Phone"             value={student.phone} />
                <DRow label="Address"           value={[student.city, student.state, student.country].filter(Boolean).join(", ")} />
                <DRow label="Guardian Name"     value={student.guardian_name} />
                <DRow label="Guardian Relation" value={student.guardian_relation} cap />
                <DRow label="Guardian Phone"    value={student.guardian_phone} />
                <DRow label="Admission Date"    value={student.admission_date ? formatDate(student.admission_date.slice(0, 10)) : ""} />
              </div>
              {student.scholarship_type && (
                <div className={s("sp-schol")}>
                  <div className={s("sp-schol-head")}>
                    <i className="fa-solid fa-graduation-cap" />
                    <strong>Scholarship — {student.scholarship_percent}% discount</strong>
                  </div>
                  <p className={s("sp-schol-type")}>{(student.scholarship_type || "").replace(/_/g, " ")}</p>
                  {student.scholarship_remarks && <p className={s("sp-schol-rem")}>{student.scholarship_remarks}</p>}
                </div>
              )}
            </section>

            {/* ─────────── ATTENDANCE ─────────── */}
            <section className={s("card")}>
              <SecHead
                title="Attendance"
                sub={TAB_LABELS[attTab]}
                right={
                  loadingAtt ? <Spinner size={16} color="#ff9b51" /> : (
                    <span style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 900,
                      background: cur.pct >= 85 ? "#dcfce7" : cur.pct >= 70 ? "#fef3c7" : "#fee2e2",
                      color:      cur.pct >= 85 ? "#15803d" : cur.pct >= 70 ? "#b45309" : "#dc2626",
                    }}>{cur.pct}% rate</span>
                  )
                }
              />

              {/* Tabs */}
              <div style={{ display: "flex", gap: 6, padding: "12px 18px", borderBottom: "1px solid #f1f5f9" }}>
                {(["this", "last", "year"] as const).map(tab => (
                  <button key={tab} onClick={() => setAttTab(tab)} style={{
                    padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 900, cursor: "pointer",
                    border:      `1.5px solid ${attTab === tab ? "#ff9b51" : "#e1e8eb"}`,
                    background:  attTab === tab ? "#fff4eb" : "#f8fbfc",
                    color:       attTab === tab ? "#c46a14" : "#6a7882",
                    transition: "all 0.15s",
                  }}>
                    {tab === "this" ? "This Month" : tab === "last" ? "Last Month" : "Full Year"}
                  </button>
                ))}
              </div>

              {loadingAtt ? (
                <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={24} color="#ff9b51" /></div>
              ) : (
                <div style={{ padding: "20px 18px 18px" }}>
                  {/* Donut + stats side by side */}
                  <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                    <AttDonut present={cur.present} absent={cur.absent} late={cur.late} leave={cur.leave} pct={cur.pct} />

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                      <LegDot color="#1e293b" label="Working days" value={cur.working} />
                      <LegDot color="#16a34a" label="Present"      value={cur.present} />
                      <LegDot color="#dc2626" label="Absent"       value={cur.absent} />
                      <LegDot color="#d97706" label="Late"         value={cur.late} />
                      <LegDot color="#4338ca" label="Leave"        value={cur.leave} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 11, color: "#6a7882", fontWeight: 700 }}>Attendance rate</span>
                      <span style={{ fontSize: 11, fontWeight: 900, color: pctColor(cur.pct) }}>{cur.pct}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${cur.pct}%`, background: pctColor(cur.pct), borderRadius: 999, transition: "width 0.5s ease" }} />
                    </div>
                  </div>

                  {/* Full year bar mini chart */}
                  {attTab === "year" && yearMarked > 0 && (
                    <div style={{ marginTop: 20, display: "flex", alignItems: "flex-end", gap: 8, height: 64 }}>
                      {[
                        { val: yearPresent, color: "#16a34a", label: "Present" },
                        { val: yearAbsent,  color: "#dc2626", label: "Absent"  },
                        { val: yearLate,    color: "#d97706", label: "Late"    },
                        { val: yearLeave,   color: "#4338ca", label: "Leave"   },
                      ].map(({ val, color, label }) => {
                        const maxV = Math.max(yearPresent, yearAbsent, yearLate, yearLeave, 1);
                        const h = Math.max((val / maxV) * 48, val > 0 ? 4 : 0);
                        return (
                          <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 900, color }}>{val}</span>
                            <div style={{ width: "100%", height: h, background: color, borderRadius: "4px 4px 0 0", transition: "height 0.4s" }} />
                            <span style={{ fontSize: 9, color: "#6a7882", fontWeight: 800 }}>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ─────────── FEE PAYMENT HISTORY ─────────── */}
            <section className={s("card")}>
              <SecHead
                title="Fee Payment History"
                sub="All recorded payments"
                right={<span style={{ fontSize: 12, fontWeight: 900, color: "#6a7882" }}>{payments.length} records</span>}
              />
              {loadingPay ? (
                <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={24} color="#ff9b51" /></div>
              ) : payments.length === 0 ? (
                <div style={{ padding: "2.5rem 18px", textAlign: "center" }}>
                  <i className="fa-solid fa-receipt" style={{ fontSize: 28, color: "#e2e8f0", display: "block", marginBottom: 10 }} />
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>No payments recorded yet.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 460 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #f1f5f9", background: "#f8fbfc" }}>
                        {["Receipt #","Date","Fee Name","Amount","Method"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p: any, i: number) => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 ? "#fafcfd" : "#fff" }}>
                          <td style={{ padding: "11px 14px", fontWeight: 900, color: "#c46a14", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{p.receipt_number || `#${p.id}`}</td>
                          <td style={{ padding: "11px 14px", color: "#6a7882", fontWeight: 700, whiteSpace: "nowrap" }}>{p.payment_date ? formatDate(p.payment_date.slice(0, 10)) : "—"}</td>
                          <td style={{ padding: "11px 14px", color: "#1e293b", fontWeight: 700 }}>{p.fee_name || "—"}</td>
                          <td style={{ padding: "11px 14px", fontWeight: 900, color: "#12805c", whiteSpace: "nowrap" }}>₹{fmt(parseFloat(p.paid_amount || p.amount || 0))}</td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 900, textTransform: "capitalize", background: "#f1f5f9", color: "#475569" }}>
                              {(p.payment_method || "—").replace(/_/g, " ")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #f1f5f9", background: "#f8fbfc" }}>
                        <td colSpan={3} style={{ padding: "10px 14px", fontSize: 12, fontWeight: 900, color: "#6a7882" }}>Total Paid</td>
                        <td style={{ padding: "10px 14px", fontWeight: 900, color: "#12805c", fontSize: 14 }}>
                          ₹{fmt(payments.reduce((acc, p) => acc + parseFloat(p.paid_amount || p.amount || 0), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <aside className={s("sp-side")}>

            {/* ─── COLLECT FEE ─── */}
            <section className={s("card")}>
              <SecHead
                title="Billing Account"
                sub="Current-year invoice snapshot"
                right={
                  unpaidFees.length > 0
                    ? <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 900, background: "#fee2e2", color: "#dc2626" }}>{unpaidFees.length} due</span>
                    : <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 900, background: "#dcfce7", color: "#15803d" }}>All Clear</span>
                }
              />

              {loadingFees ? (
                <div style={{ padding: "1.5rem", textAlign: "center" }}><Spinner size={20} color="#ff9b51" /></div>
              ) : unpaidFees.length === 0 ? (
                <div style={{ padding: "1.5rem 18px" }}>
                  <div style={{ padding: "14px 16px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 10 }}>
                    <i className="fa-solid fa-circle-check" style={{ color: "#16a34a", fontSize: 18 }} />
                    <div>
                      <strong style={{ fontSize: 13, color: "#15803d", display: "block" }}>All fees paid</strong>
                      <span style={{ fontSize: 11, color: "#6a7882" }}>No outstanding dues for this student.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "6px 0 14px" }}>
                  {unpaidFees.map((fee: any) => {
                    const total       = parseFloat(fee.total_amount || 0);
                    const paid        = parseFloat(fee.paid_amount  || 0);
                    const outstanding = total - paid;
                    const pct         = total > 0 ? (paid / total) * 100 : 0;
                    const isPartial   = paid > 0 && outstanding > 0;
                    return (
                      <div key={fee.id} style={{ margin: "0 14px 10px", padding: "14px", borderRadius: 10, border: "1.5px solid #fee2e2", background: "#fff" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: 13, fontWeight: 900, color: "#1e293b", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {fee.fee_name}
                            </strong>
                            <span style={{ fontSize: 11, color: "#6a7882", fontWeight: 700 }}>
                              Due: {fee.due_date ? formatDate(fee.due_date.slice(0, 10)) : "—"}
                            </span>
                          </div>
                          <span style={{
                            flexShrink: 0, padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 900,
                            background: isPartial ? "#fef3c7" : "#fee2e2",
                            color:      isPartial ? "#b45309"  : "#dc2626",
                          }}>
                            {isPartial ? "Partial" : "Unpaid"}
                          </span>
                        </div>

                        {/* Amount breakdown */}
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: "#6a7882", fontWeight: 700 }}>Total</span>
                          <strong style={{ fontSize: 12, color: "#1e293b" }}>₹{fmt(total)}</strong>
                        </div>
                        {isPartial && (
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: "#6a7882", fontWeight: 700 }}>Paid</span>
                            <strong style={{ fontSize: 12, color: "#16a34a" }}>₹{fmt(paid)}</strong>
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontSize: 11, color: "#6a7882", fontWeight: 700 }}>Outstanding</span>
                          <strong style={{ fontSize: 13, color: "#dc2626", fontWeight: 900 }}>₹{fmt(outstanding)}</strong>
                        </div>

                        {/* Progress */}
                        {isPartial && (
                          <div style={{ height: 5, borderRadius: 999, background: "#f1f5f9", overflow: "hidden", marginBottom: 10 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "#f59e0b", borderRadius: 999 }} />
                          </div>
                        )}

                        <Link
                          href={`/fees/collect?student_id=${id}`}
                          style={{
                            width: "100%", height: 38, border: "none", borderRadius: 8,
                            background: "#ff9b51", color: "#fff", fontSize: 12, fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none",
                          }}
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square" /> Open Billing to collect ₹{fmt(outstanding)}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ─── FEE SUMMARY ─── */}
            <section className={s("card")}>
              <SecHead
                title="Fee Summary"
                sub="Only issued invoices"
                right={<span className={cx(s("badge"), grandPending > 0 ? s("badge-red") : s("badge-green"))}>{grandPending > 0 ? "Pending" : "Cleared"}</span>}
              />
              <div className={s("sp-feebody")}>
                <FeeRow label="Issued invoices" value={`₹${fmt(billedTotal)}`} />
                <div className={s("sp-fee-divider")} />
                <FeeRow label="Grand Total"   value={`₹${fmt(grandTotal)}`} />
                <FeeRow label="Paid"          value={`₹${fmt(grandPaid)}`}    accent="#16a34a" />
                <FeeRow label="Outstanding"   value={`₹${fmt(grandPending)}`} accent={grandPending > 0 ? "#dc2626" : "#16a34a"} />
                <div className={s("sp-fee-progress-wrap")}>
                  <div className={s("sp-fee-progress-track")}>
                    <div className={s("sp-fee-progress-fill")} style={{ width: `${paidPct.toFixed(1)}%` }} />
                  </div>
                  <span className={s("sp-fee-pct")}>{paidPct.toFixed(0)}% paid</span>
                </div>
              </div>
            </section>

            {/* ─── TRANSPORT ─── */}
            <section className={s("card")}>
              <SecHead title="Transport" sub="Current year"
                right={loadingSvc ? undefined : transport ? <span className={cx(s("badge"), s("badge-green"))}>Assigned</span> : <span className={cx(s("badge"))}>Not Assigned</span>}
              />
              {loadingSvc ? <div className={s("sp-svcload")}><Spinner size={18} color="#94a3b8" /></div>
                : transport ? (
                  <div className={s("sp-svcbody")}>
                    <SvcRow icon="fa-solid fa-route"   label="Route"   value={transport.route_name} />
                    <SvcRow icon="fa-solid fa-bus"     label="Vehicle" value={transport.vehicle_number} />
                    <SvcRow icon="fa-solid fa-map-pin" label="Stop"    value={transport.stop_name} />
                    <SvcRow icon="fa-regular fa-clock" label="Pick-up" value={transport.pickup_time} />
                    <SvcRow icon="fa-regular fa-clock" label="Drop"    value={transport.drop_time} />
                    {transport.driver_name && <SvcRow icon="fa-solid fa-id-badge" label="Driver" value={`${transport.driver_name}${transport.driver_phone ? " · " + transport.driver_phone : ""}`} />}
                    <div className={s("sp-fee-divider")} />
                    <FeeRow label="Monthly fee" value={`₹${fmt(parseFloat(transport.monthly_fee || 0))}`} />
                    <FeeRow label="Annual fee"  value={`₹${fmt(transportAnn)}`} accent="#1e293b" />
                  </div>
                ) : <p className={s("sp-svcempty")}>Not assigned for this academic year.</p>}
            </section>

            {/* ─── HOSTEL ─── */}
            <section className={s("card")}>
              <SecHead title="Hostel" sub="Current year"
                right={loadingSvc ? undefined : hostel ? <span className={cx(s("badge"), s("badge-green"))}>Assigned</span> : <span className={cx(s("badge"))}>Not Assigned</span>}
              />
              {loadingSvc ? <div className={s("sp-svcload")}><Spinner size={18} color="#94a3b8" /></div>
                : hostel ? (
                  <div className={s("sp-svcbody")}>
                    <SvcRow icon="fa-solid fa-building"   label="Hostel"    value={hostel.hostel_name} />
                    <SvcRow icon="fa-solid fa-venus-mars" label="Type"      value={(hostel.hostel_type || "").replace(/_/g, " ")} />
                    <SvcRow icon="fa-solid fa-door-open"  label="Room"      value={`Room ${hostel.room_number} · Floor ${hostel.floor}`} />
                    <SvcRow icon="fa-solid fa-bed"        label="Room Type" value={(hostel.room_type || "").replace(/_/g, " ")} />
                    <SvcRow icon="fa-solid fa-users"      label="Capacity"  value={hostel.capacity ? `${hostel.capacity} beds` : "—"} />
                    {hostel.warden_name && <SvcRow icon="fa-solid fa-user-shield" label="Warden" value={`${hostel.warden_name}${hostel.warden_phone ? " · " + hostel.warden_phone : ""}`} />}
                    <div className={s("sp-fee-divider")} />
                    <FeeRow label="Monthly fee" value={`₹${fmt(parseFloat(hostel.monthly_fee || 0))}`} />
                    <FeeRow label="Annual fee"  value={`₹${fmt(hostelAnn)}`} accent="#1e293b" />
                  </div>
                ) : <p className={s("sp-svcempty")}>Not assigned for this academic year.</p>}
            </section>

            {/* ─── ENROLLMENT HISTORY ─── */}
            <section className={s("card")}>
              <SecHead title="Enrollment History" sub="Academic years" />
              <div className={s("sp-enrlist")}>
                {enrollments?.length ? enrollments.map((en: any) => (
                  <div key={en.id} className={s("sp-enrrow")}>
                    <i className="fa-solid fa-circle-dot" />
                    <span>{en.academic_year_name || "Year"} — Class {en.class_name || en.class_id}, Sec {en.section_name || en.section_id}</span>
                  </div>
                )) : <p className={s("sp-svcempty")}>No enrollments found.</p>}
              </div>
            </section>

          </aside>
        </div>
      </main>
    </div>
  );
}
