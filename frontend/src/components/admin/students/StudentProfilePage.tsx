"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./students.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
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
  if (loading)  return <div className={s("sp-loading")}><Spinner size={32} color="#ff9b51" /></div>;
  if (!student) return <div className={s("sp-empty")}>Student not found.</div>;

  /* ── Fee compute ── */
  const billedTotal  = fees.reduce((a, f) => a + parseFloat(f.net_amount || f.total_amount || 0), 0);
  const billedPaid   = fees.reduce((a, f) => a + parseFloat(f.paid_amount || 0), 0);
  const grandTotal   = billedTotal;
  const grandPaid    = billedPaid;
  const grandPending = Math.max(0, fees.reduce((a, f) => a + parseFloat(f.remaining_amount || 0), 0));
  const paidPct      = grandTotal > 0 ? (grandPaid / grandTotal) * 100 : 0;
  const unpaidFees   = fees.filter((f: any) => parseFloat(f.remaining_amount || 0) > 0.009);

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
                  ? <span className={cx(s("badge"), s("badge-red"))}>Fee Due {fmt(grandPending)}</span>
                  : <span className={cx(s("badge"), s("badge-green"))}>Fee Cleared</span>
                }
                {!loadingSvc && transport && <span className={cx(s("badge"), s("badge-blue"))}><i className="fa-solid fa-bus" /> {transport.route_name}</span>}
                {!loadingSvc && hostel    && <span className={cx(s("badge"), s("badge-yellow"))}><i className="fa-solid fa-building" /> {hostel.hostel_name}</span>}
              </div>
            </div>
          </div>
          <div className={s("sp-hero-stats")}>
            <StatBox label="Attendance (Year)" value={`${yearPct}%`}               sub={`${yearPresent} / ${yearMarked} days`} />
            <StatBox label="Fee Paid"          value={fmt(grandPaid)}              sub={`of ${fmt(grandTotal)}`} />
            <StatBox label="Enrollments"       value={String(enrollments?.length || 0)} sub="academic years" />
          </div>
        </section>

        {/* MAIN GRID */}
        <div className={s("sp-grid")}>

          {/* ── LEFT COLUMN ── */}
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

            {/* ─────────── ATTENDANCE — shared component ─────────── */}
            <section className={s("card")}>
              <SecHead
                title="Attendance Overview"
                sub={activeYear?.year_name ?? "Current Year"}
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
                title="Fee History"
                sub="Full monthly breakdown and payment timeline"
                right={
                  <Link
                    href={`/fees/history?student_id=${id}`}
                    style={{
                      padding: "6px 14px", borderRadius: 8,
                      background: "#ff9b51", color: "#fff",
                      textDecoration: "none", fontSize: 12, fontWeight: 900,
                      display: "inline-flex", alignItems: "center", gap: 7,
                    }}
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square" /> View Full History
                  </Link>
                }
              />
              <div style={{ padding: "18px 20px" }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 12, marginBottom: 16,
                }}>
                  {/* Billed */}
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "#f0f4ff", border: "1px solid #c7d2fe",
                  }}>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#4338ca", textTransform: "uppercase", marginBottom: 4 }}>Billed</span>
                    <strong style={{ fontSize: 18, fontWeight: 900, color: "#3730a3" }}>{fmt(grandTotal)}</strong>
                  </div>
                  {/* Paid */}
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "#f0fdf4", border: "1px solid #bbf7d0",
                  }}>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#15803d", textTransform: "uppercase", marginBottom: 4 }}>Paid</span>
                    <strong style={{ fontSize: 18, fontWeight: 900, color: "#166534" }}>{fmt(grandPaid)}</strong>
                  </div>
                  {/* Pending */}
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: grandPending > 0 ? "#fff1f2" : "#f0fdf4",
                    border: `1px solid ${grandPending > 0 ? "#fecdd3" : "#bbf7d0"}`,
                  }}>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: grandPending > 0 ? "#be123c" : "#15803d", textTransform: "uppercase", marginBottom: 4 }}>Pending</span>
                    <strong style={{ fontSize: 18, fontWeight: 900, color: grandPending > 0 ? "#9f1239" : "#166534" }}>{fmt(grandPending)}</strong>
                  </div>
                </div>

                {/* Progress bar */}
                {grandTotal > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#6a7882" }}>Payment Progress</span>
                      <span style={{ fontSize: 11, fontWeight: 900, color: paidPct >= 100 ? "#16a34a" : "#c46a14" }}>{paidPct.toFixed(0)}%</span>
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
                right={<span className={cx(s("badge"), grandPending > 0 ? s("badge-red") : s("badge-green"))}>{grandPending > 0 ? "Pending" : "Cleared"}</span>}
              />
              <div className={s("sp-feebody")}>
                <FeeRow label="Issued invoices" value={fmt(billedTotal)} />
                <div className={s("sp-fee-divider")} />
                <FeeRow label="Grand Total"   value={fmt(grandTotal)} />
                <FeeRow label="Paid"          value={fmt(grandPaid)}    accent="#16a34a" />
                <FeeRow label="Outstanding"   value={fmt(grandPending)} accent={grandPending > 0 ? "#dc2626" : "#16a34a"} />
                <div className={s("sp-fee-progress-wrap")}>
                  <div className={s("sp-fee-progress-track")}>
                    <div className={s("sp-fee-progress-fill")} style={{ width: `${paidPct.toFixed(1)}%` }} />
                  </div>
                  <span className={s("sp-fee-pct")}>{paidPct.toFixed(0)}% paid</span>
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
                    <FeeRow label="Monthly fee" value={fmt(parseFloat(transport.monthly_fee || 0))} />
                    <FeeRow label="Annual fee"  value={fmt(transportAnn)} accent="#1e293b" />
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
                    <FeeRow label="Monthly fee" value={fmt(parseFloat(hostel.monthly_fee || 0))} />
                    <FeeRow label="Annual fee"  value={fmt(hostelAnn)} accent="#1e293b" />
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
