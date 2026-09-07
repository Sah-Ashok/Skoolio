"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./students.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency }  from "@/lib/useCurrency";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import AttendanceOverviewCard from "@/components/shared/AttendanceOverviewCard";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

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

/* ─── DETAIL ROW WITH ICON ─────────────────────────────────────────────────── */
function DRow({ icon, label, value, cap }: { icon?: string; label: string; value: string; cap?: boolean }) {
  return (
    <div className={s("sp-drow")}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        {icon && <i className={`${icon}`} style={{ fontSize: 11, color: "#ff9b51" }} />}
        <span>{label}</span>
      </div>
      <strong style={{ textTransform: cap ? "capitalize" : "none" }}>{value || "—"}</strong>
    </div>
  );
}

/* ─── SECTION HEADER ─────────────────────────────────────────────────────── */
function SecHead({ title, sub, right, icon }: { title: string; sub?: string; right?: React.ReactNode; icon?: string }) {
  return (
    <div className={s("sp-sechead")}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon && (
          <span style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(255, 155, 81, 0.12)", color: "#ea580c",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, flexShrink: 0,
          }}>
            <i className={icon} />
          </span>
        )}
        <div>
          <h3 className={s("sp-sectitle")}>{title}</h3>
          {sub && <p className={s("sp-secsub")}>{sub}</p>}
        </div>
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
      <div style={{ flex: 1, minWidth: 0 }}>
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

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function StudentProfilePage() {
  const { formatDate }         = useDateFormat();
  const { fmt }                = useCurrency();
  const { activeYear }         = useAcademicYear();
  const searchParams           = useSearchParams();
  const id                     = searchParams?.get("id");

  const { data: student, loading } = useApi<any>(id ? `/students/${id}` : "");
  const { data: enrollments }      = useApi<any[]>(id ? `/students/${id}/enrollments` : "");

  // Fee collections — refetchable
  const [fees,        setFees]       = useState<any[]>([]);
  const [loadingFees, setLoadingFees] = useState(true);

  // Services
  const [transport,  setTransport]  = useState<any>(null);
  const [hostel,     setHostel]     = useState<any>(null);
  const [loadingSvc, setLoadingSvc] = useState(true);

  // Yearly attendance (for hero stat only)
  const [yearPct,     setYearPct]     = useState(0);
  const [yearPresent, setYearPresent] = useState(0);
  const [yearMarked,  setYearMarked]  = useState(0);

  // Photo error fallback to initials
  const [photoError,  setPhotoError]  = useState(false);
  useEffect(() => { setPhotoError(false); }, [id]);

  /* ── Fetch fees ── */
  const fetchFees = useCallback(() => {
    if (!id || !activeYear?.id) return;
    setLoadingFees(true);
    apiRequest<{ data: any[] }>(`/fees/collections/student/${id}?academic_year_id=${activeYear.id}`)
      .then(r => setFees((r as any)?.data || []))
      .catch(() => setFees([]))
      .finally(() => setLoadingFees(false));
  }, [id, activeYear?.id]);

  useEffect(() => { fetchFees(); }, [fetchFees]);

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

  /* ── Fetch yearly summary (hero stat only) ── */
  useEffect(() => {
    if (!id || !activeYear?.id) return;
    apiRequest(`/attendance/student/${id}/summary?academic_year_id=${activeYear.id}`)
      .then((r: any) => {
        const d = r?.data ?? r;
        const p = Number(d?.total_present ?? 0);
        const l = Number(d?.total_late    ?? 0);
        const w = Number(d?.total_working_days ?? d?.total_marked ?? 0);
        const pct = w > 0 ? Math.round(((p + l) / w) * 100) : 0;
        setYearPresent(p);
        setYearMarked(w);
        setYearPct(pct);
      })
      .catch(() => {});
  }, [id, activeYear?.id]);

  /* ── Guards ── */
  if (!id)      return <div className={s("sp-empty")}>No student selected.</div>;
  if (loading)  return <div className={s("sp-loading")} style={{ padding: "4rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading student profile…" /></div>;
  if (!student) return <div className={s("sp-empty")}>Student not found.</div>;

  /* ── Fee compute ── */
  const billedTotal  = fees.reduce((a, f) => a + parseFloat(f.net_amount || f.total_amount || 0), 0);
  const billedPaid   = fees.reduce((a, f) => a + parseFloat(f.paid_amount || 0), 0);
  const waivedCollections = fees.filter((f: any) => f.status === "waived");
  const billedWaived = waivedCollections.reduce((a: number, c: any) => {
    const net      = parseFloat(c.net_amount || c.total_amount || 0);
    const cashPaid = parseFloat(c.paid_amount || 0);
    return a + Math.max(0, net - cashPaid);
  }, 0);
  const netPayable   = Math.max(0, billedTotal - billedWaived);
  const grandTotal   = billedTotal;
  const grandPaid    = billedPaid;
  const grandPending = Math.max(0, fees.filter((f: any) => f.status !== "waived").reduce((a, f) => a + Math.max(0, parseFloat(f.remaining_amount ?? (parseFloat(f.net_amount || f.total_amount || 0) - parseFloat(f.paid_amount || 0)))), 0));
  const paidPct      = grandTotal > 0 ? Math.min(100, ((grandPaid + billedWaived) / grandTotal) * 100) : 0;
  const unpaidFees   = fees.filter((f: any) => f.status !== "waived" && parseFloat(f.remaining_amount || (parseFloat(f.net_amount || f.total_amount || 0) - parseFloat(f.paid_amount || 0))) > 0.009);

  const transportAnn = transport ? parseFloat(transport.monthly_fee || 0) * 12 : 0;
  const hostelAnn    = hostel    ? parseFloat(hostel.monthly_fee    || 0) * 12 : 0;

  const enr      = enrollments?.[0];
  const initials = (student.full_name || "").split(" ").map((p: string) => p[0]).join("").substring(0, 2).toUpperCase();

  /* ── Monthly URL builder for AttendanceOverviewCard ── */
  const attMonthlyUrl = (year: number, month: number): string =>
    id && activeYear?.id
      ? `/attendance/student/${id}/monthly?year=${year}&month=${month}&academic_year_id=${activeYear.id}`
      : "";

  return (
    <div className={s("students-page")}>
      <main className={s("page-content")}>

        {/* PAGE HEAD */}
        <section className={s("page-head")}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#ea580c", textTransform: "uppercase", letterSpacing: 0.8, display: "inline-block", marginBottom: 3 }}>
              Student Management · {student.admission_number || "Profile"}
            </span>
            <h1>Student Profile</h1>
            <p>View detailed records, academic enrollments, attendance, and fee history.</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/students">
              <i className="fa-solid fa-arrow-left" /> Back
            </Link>
            <Link
              className={cx(s("btn"), s("btn-outline"))}
              href={`/fees/history?student_id=${id}`}
            >
              <i className="fa-solid fa-clock-rotate-left" /> Fee History
            </Link>
            <Link
              className={cx(s("btn"), s("btn-outline"))}
              href={`/fees/collect?student_id=${id}`}
            >
              <i className="fa-solid fa-money-bill-wave" /> Collect Fee
            </Link>
            <Link className={cx(s("btn"), s("btn-primary"))} href={`/students/${id}/edit`}>
              <i className="fa-solid fa-pen-to-square" /> Edit Profile
            </Link>
          </div>
        </section>

        {/* HERO BANNER */}
        <section className={s("sp-hero")}>
          <div className={s("sp-hero-left")}>
            {student.photo && student.photo !== "null" && !photoError
              ? <img src={student.photo} alt="" className={s("sp-avatar-img")} onError={() => setPhotoError(true)} />
              : <div className={s("sp-avatar")}>{initials}</div>
            }
            <div className={s("sp-hero-info")}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <span className={cx(s("sp-dot"), student.status === "active" ? s("sp-dot-green") : s("sp-dot-yellow"))} />
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: student.status === "active" ? "#15803d" : "#b45309", letterSpacing: 0.5 }}>
                  {student.status} student
                </span>
                {student.admission_number && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", background: "#f1f5f9", padding: "1px 8px", borderRadius: 6 }}>
                    #{student.admission_number}
                  </span>
                )}
              </div>
              <h2 className={s("sp-name")}>{student.full_name}</h2>
              <p className={s("sp-sub")}>
                {enr ? `Class ${enr.class_name || enr.class_id} · Section ${enr.section_name || enr.section_id} · ` : ""}
                Admitted {student.admission_date ? formatDate(student.admission_date.slice(0, 10)) : "—"}
              </p>
              <div className={s("sp-tags")}>
                {grandPending > 0
                  ? <span className={cx(s("badge"), s("badge-red"))}><i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }} /> Fee Due {fmt(grandPending)}</span>
                  : <span className={cx(s("badge"), s("badge-green"))}><i className="fa-solid fa-circle-check" style={{ marginRight: 4 }} /> Fee Cleared</span>
                }
                {!loadingSvc && transport && (
                  <span className={cx(s("badge"), s("badge-blue"))}>
                    <i className="fa-solid fa-bus" style={{ marginRight: 4 }} /> {transport.route_name} · {transport.stop_name}
                  </span>
                )}
                {!loadingSvc && hostel && (
                  <span className={cx(s("badge"), s("badge-yellow"))}>
                    <i className="fa-solid fa-building" style={{ marginRight: 4 }} /> {hostel.hostel_name} · Room {hostel.room_number}
                  </span>
                )}
                {Number(student.scholarship_percent) > 0 && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                    background: "#f5f0ff", color: "#7c3aed", border: "1px solid #d9c7fb",
                  }}>
                    <i className="fa-solid fa-graduation-cap" /> {parseFloat(student.scholarship_percent)}% Scholarship
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={s("sp-hero-stats")}>
            <StatBox label="Attendance (Year)" value={`${yearPct}%`} sub={`${yearPresent} / ${yearMarked} days`} />
            <StatBox
              label="Fee Paid"
              value={fmt(grandPaid)}
              sub={`of ${fmt(grandTotal)}${billedWaived > 0 ? ` · ${fmt(billedWaived)} waived` : ""}`}
            />
            <StatBox label="Enrollments" value={String(enrollments?.length || 0)} sub="academic years" />
          </div>
        </section>

        {/* MAIN GRID */}
        <div className={s("sp-grid")}>

          {/* ── LEFT COLUMN ── */}
          <div className={s("sp-col")}>

            {/* Personal info */}
            <section className={s("card")}>
              <SecHead title="Personal Information" sub="Identity, contact, and guardian details" icon="fa-solid fa-id-card" />
              <div className={s("sp-dlist")}>
                <DRow icon="fa-solid fa-cake-candles"   label="Date of Birth"     value={student.date_of_birth ? formatDate(student.date_of_birth.slice(0, 10)) : ""} />
                <DRow icon="fa-solid fa-venus-mars"     label="Gender"            value={student.gender}       cap />
                <DRow icon="fa-solid fa-droplet"        label="Blood Group"       value={student.blood_group} />
                <DRow icon="fa-solid fa-envelope"       label="Email"             value={student.email} />
                <DRow icon="fa-solid fa-phone"          label="Phone"             value={student.phone} />
                <DRow icon="fa-solid fa-location-dot"   label="Address"           value={[student.city, student.state, student.country].filter(Boolean).join(", ")} />
                <DRow icon="fa-solid fa-user-shield"    label="Guardian Name"     value={student.guardian_name} />
                <DRow icon="fa-solid fa-people-roof"    label="Guardian Relation" value={student.guardian_relation} cap />
                <DRow icon="fa-solid fa-phone-volume"   label="Guardian Phone"    value={student.guardian_phone} />
                <DRow icon="fa-solid fa-calendar-check" label="Admission Date"    value={student.admission_date ? formatDate(student.admission_date.slice(0, 10)) : ""} />
              </div>

              {Number(student.scholarship_percent) > 0 && (
                <div style={{
                  margin: "14px 18px 18px", padding: "14px 16px", borderRadius: 12,
                  background: "#f0fdf4", border: "1.5px solid #bbf7d0",
                  display: "flex", alignItems: "flex-start", gap: 12,
                }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "#dcfce7", color: "#16a34a",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, flexShrink: 0,
                  }}>
                    <i className="fa-solid fa-graduation-cap" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 13, fontWeight: 900, color: "#166534", display: "block" }}>
                      Scholarship · {parseFloat(student.scholarship_percent)}% Discount
                    </strong>
                    <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: "#15803d", textTransform: "capitalize" }}>
                      {(student.scholarship_type || "Custom").replace(/_/g, " ")}
                    </p>
                    {student.scholarship_remarks && (
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#14532d", fontWeight: 600 }}>
                        {student.scholarship_remarks}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ─────────── ATTENDANCE — shared component ─────────── */}
            <section className={s("card")}>
              <SecHead
                title="Attendance Overview"
                sub={activeYear?.year_name ?? "Current Year"}
                icon="fa-solid fa-calendar-days"
              />
              <div style={{ padding: "16px 18px 20px" }}>
                <AttendanceOverviewCard
                  activeYear={activeYear}
                  summaryBaseUrl={id ? `/attendance/student/${id}/summary` : null}
                  monthlyUrl={attMonthlyUrl}
                />
              </div>
            </section>

            {/* ─────────── FEE HISTORY SHORTCUT ─────────── */}
            <section className={s("card")}>
              <SecHead
                title="Fee &amp; Payment Summary"
                sub="Academic year billing, payments, and discounts"
                icon="fa-solid fa-receipt"
                right={
                  <Link
                    href={`/fees/history?student_id=${id}`}
                    style={{
                      padding: "6px 14px", borderRadius: 8,
                      background: "#ff9b51", color: "#fff",
                      textDecoration: "none", fontSize: 12, fontWeight: 900,
                      display: "inline-flex", alignItems: "center", gap: 7,
                      boxShadow: "0 2px 6px rgba(255, 155, 81, 0.35)",
                    }}
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square" /> View Full History
                  </Link>
                }
              />
              <div style={{ padding: "18px 20px" }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: billedWaived > 0 ? "repeat(auto-fit, minmax(110px, 1fr))" : "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 12, marginBottom: 16,
                }}>
                  {/* Billed */}
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "#f0f4ff", border: "1.5px solid #c7d2fe",
                  }}>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#4338ca", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 }}>Billed</span>
                    <strong style={{ fontSize: 18, fontWeight: 900, color: "#3730a3" }}>{fmt(grandTotal)}</strong>
                  </div>
                  {/* Paid */}
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "#f0fdf4", border: "1.5px solid #bbf7d0",
                  }}>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#15803d", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 }}>Cash Paid</span>
                    <strong style={{ fontSize: 18, fontWeight: 900, color: "#166534" }}>{fmt(grandPaid)}</strong>
                  </div>
                  {/* Waived */}
                  {billedWaived > 0 && (
                    <div style={{
                      padding: "12px 14px", borderRadius: 10,
                      background: "#faf5ff", border: "1.5px solid #e9d5ff",
                    }}>
                      <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#7c3aed", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 }}>Waived</span>
                      <strong style={{ fontSize: 18, fontWeight: 900, color: "#6b21a8" }}>{fmt(billedWaived)}</strong>
                    </div>
                  )}
                  {/* Pending */}
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: grandPending > 0 ? "#fff1f2" : "#f0fdf4",
                    border: `1.5px solid ${grandPending > 0 ? "#fecdd3" : "#bbf7d0"}`,
                  }}>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: grandPending > 0 ? "#be123c" : "#15803d", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 }}>Pending</span>
                    <strong style={{ fontSize: 18, fontWeight: 900, color: grandPending > 0 ? "#9f1239" : "#166534" }}>{fmt(grandPending)}</strong>
                  </div>
                </div>

                {/* Progress bar */}
                {grandTotal > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#6a7882" }}>
                        Payment Progress {billedWaived > 0 ? `(incl. ${fmt(billedWaived)} waived)` : ""}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 900, color: paidPct >= 100 ? "#16a34a" : "#c46a14" }}>
                        {paidPct >= 100 ? "100% Cleared" : `${paidPct.toFixed(0)}% Paid`}
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "#e5ebee", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${Math.min(100, paidPct).toFixed(1)}%`,
                        background: paidPct >= 100 ? "#16a34a" : "linear-gradient(90deg,#ff9b51,#ea580c)",
                        borderRadius: "inherit", transition: "width .5s ease",
                      }} />
                    </div>
                  </div>
                )}

                <Link
                  href={`/fees/history?student_id=${id}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "11px 16px", borderRadius: 9,
                    border: "1.5px solid #e5ebee", background: "#f8fafc",
                    color: "#1f2d36", textDecoration: "none",
                    fontSize: 13, fontWeight: 900, width: "100%",
                    transition: "background .15s",
                  }}
                >
                  <i className="fa-solid fa-clock-rotate-left" style={{ color: "#ff9b51" }} />
                  View Monthly Breakdown &amp; Full Payment History
                  <i className="fa-solid fa-chevron-right" style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }} />
                </Link>
              </div>
            </section>

          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <aside className={s("sp-side")}>

            {/* ─── FEE SUMMARY ─── */}
            <section className={s("card")}>
              <SecHead
                title="Fee Summary"
                sub="Only issued invoices"
                icon="fa-solid fa-wallet"
                right={<span className={cx(s("badge"), grandPending > 0 ? s("badge-red") : s("badge-green"))}>{grandPending > 0 ? "Pending" : "Cleared"}</span>}
              />
              <div className={s("sp-feebody")}>
                <FeeRow label="Issued Invoices" value={fmt(billedTotal)} />
                {billedWaived > 0 && <FeeRow label="Waived" value={fmt(billedWaived)} accent="#7c3aed" />}
                <div className={s("sp-fee-divider")} />
                <FeeRow label={billedWaived > 0 ? "Net Payable" : "Grand Total"} value={fmt(netPayable)} />
                <FeeRow label="Cash Paid"     value={fmt(grandPaid)}    accent="#16a34a" />
                <FeeRow label="Outstanding"   value={fmt(grandPending)} accent={grandPending > 0 ? "#dc2626" : "#16a34a"} />
                <div className={s("sp-fee-progress-wrap")}>
                  <div className={s("sp-fee-progress-track")}>
                    <div className={s("sp-fee-progress-fill")} style={{
                      width: `${paidPct.toFixed(1)}%`,
                      background: paidPct >= 100 ? "#16a34a" : "linear-gradient(90deg,#ff9b51,#ea580c)"
                    }} />
                  </div>
                  <span className={s("sp-fee-pct")} style={{ color: paidPct >= 100 ? "#16a34a" : "#64748b" }}>
                    {paidPct >= 100 ? "100% Cleared" : `${paidPct.toFixed(0)}% Paid`}
                  </span>
                </div>
              </div>
              {/* Link to full history */}
              <div style={{ padding: "0 16px 14px" }}>
                <Link
                  href={`/fees/history?student_id=${id}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "9px 14px", borderRadius: 8,
                    border: "1.5px solid #e5ebee", background: "#f8fafc",
                    color: "#1f2d36", textDecoration: "none",
                    fontSize: 12, fontWeight: 900, width: "100%",
                  }}
                >
                  <i className="fa-solid fa-clock-rotate-left" style={{ color: "#ff9b51" }} />
                  Full Fee History
                </Link>
              </div>
            </section>

            {/* ─── TRANSPORT ─── */}
            <section className={s("card")}>
              <SecHead
                title="Transport"
                sub="Current year"
                icon="fa-solid fa-bus-simple"
                right={loadingSvc ? undefined : transport ? <span className={cx(s("badge"), s("badge-green"))}>Assigned</span> : <span className={cx(s("badge"))}>Not Assigned</span>}
              />
              {loadingSvc ? <div className={s("sp-svcload")}><Spinner size={18} color="#94a3b8" /></div>
                : transport ? (
                  <div className={s("sp-svcbody")}>
                    <div className={s("sp-svcgrid")}>
                      <SvcRow icon="fa-solid fa-route"        label="Route"    value={transport.route_name} />
                      <SvcRow icon="fa-solid fa-bus"          label="Vehicle"  value={transport.vehicle_number} />
                      <SvcRow icon="fa-solid fa-map-pin"      label="Stop"     value={transport.stop_name} />
                      <SvcRow icon="fa-solid fa-id-badge"     label="Driver"   value={transport.driver_name ? `${transport.driver_name}${transport.driver_phone ? " · " + transport.driver_phone : ""}` : "—"} />
                      <SvcRow icon="fa-regular fa-clock"      label="Pick-up"  value={transport.pickup_time} />
                      <SvcRow icon="fa-regular fa-clock"      label="Drop"     value={transport.drop_time} />
                    </div>
                    <div className={s("sp-fee-divider")} style={{ margin: "14px 0 10px" }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <FeeRow label="Monthly fee" value={fmt(parseFloat(transport.monthly_fee || 0))} />
                      <FeeRow label="Annual fee"  value={fmt(transportAnn)} accent="#0f172a" />
                    </div>
                  </div>
                ) : <p className={s("sp-svcempty")}>Not assigned for this academic year.</p>}
            </section>

            {/* ─── HOSTEL ─── */}
            <section className={s("card")}>
              <SecHead
                title="Hostel"
                sub="Current year"
                icon="fa-solid fa-hotel"
                right={loadingSvc ? undefined : hostel ? <span className={cx(s("badge"), s("badge-green"))}>Assigned</span> : <span className={cx(s("badge"))}>Not Assigned</span>}
              />
              {loadingSvc ? <div className={s("sp-svcload")}><Spinner size={18} color="#94a3b8" /></div>
                : hostel ? (
                  <div className={s("sp-svcbody")}>
                    <div className={s("sp-svcgrid")}>
                      <SvcRow icon="fa-solid fa-building"   label="Hostel"    value={hostel.hostel_name} />
                      <SvcRow icon="fa-solid fa-venus-mars" label="Type"      value={(hostel.hostel_type || "").replace(/_/g, " ")} />
                      <SvcRow icon="fa-solid fa-door-open"  label="Room"      value={`Room ${hostel.room_number} · Floor ${hostel.floor}`} />
                      <SvcRow icon="fa-solid fa-bed"        label="Room Type" value={(hostel.room_type || "").replace(/_/g, " ")} />
                      <SvcRow icon="fa-solid fa-users"      label="Capacity"  value={hostel.capacity ? `${hostel.capacity} beds` : "—"} />
                      {hostel.warden_name ? (
                        <SvcRow icon="fa-solid fa-user-shield" label="Warden" value={`${hostel.warden_name}${hostel.warden_phone ? " · " + hostel.warden_phone : ""}`} />
                      ) : (
                        <div />
                      )}
                    </div>
                    <div className={s("sp-fee-divider")} style={{ margin: "14px 0 10px" }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <FeeRow label="Monthly fee" value={fmt(parseFloat(hostel.monthly_fee || 0))} />
                      <FeeRow label="Annual fee"  value={fmt(hostelAnn)} accent="#0f172a" />
                    </div>
                  </div>
                ) : <p className={s("sp-svcempty")}>Not assigned for this academic year.</p>}
            </section>

            {/* ─── ENROLLMENT HISTORY ─── */}
            <section className={s("card")}>
              <SecHead title="Enrollment History" sub="Academic years" icon="fa-solid fa-timeline" />
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
