"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./students.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

function fmt(n: number) { return n.toLocaleString("en-IN"); }
function pctColor(p: number) { return p >= 85 ? "#16a34a" : p >= 70 ? "#d97706" : "#dc2626"; }
const ATT_CLS: Record<string, string> = { present: "present", absent: "absent", late: "late", leave: "off" };

/* ─── HERO STAT BOX ────────────────────────────────────────────────────────── */
function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={s("sp-stat")}>
      <span className={s("sp-stat-label")}>{label}</span>
      <strong className={s("sp-stat-val")}>{value}</strong>
      {sub && <span className={s("sp-stat-sub")}>{sub}</span>}
    </div>
  );
}

/* ─── DETAIL LIST ROW ──────────────────────────────────────────────────────── */
function DRow({ label, value, cap }: { label: string; value: string; cap?: boolean }) {
  return (
    <div className={s("sp-drow")}>
      <span>{label}</span>
      <strong style={{ textTransform: cap ? "capitalize" : "none" }}>{value || "—"}</strong>
    </div>
  );
}

/* ─── SECTION HEADER ───────────────────────────────────────────────────────── */
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

/* ─── SERVICE ROW (transport / hostel) ─────────────────────────────────────── */
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

/* ─── FEE LINE ──────────────────────────────────────────────────────────────── */
function FeeRow({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: string }) {
  return (
    <div className={s("sp-feerow")}>
      <span style={{ color: muted ? "#94a3b8" : "#64748b" }}>{label}</span>
      <strong style={{ color: accent || "#1e293b" }}>{value}</strong>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function StudentProfilePage() {
  const searchParams = useSearchParams();
  const id = searchParams?.get("id");

  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: student, loading } = useApi<any>(id ? `/students/${id}` : "");
  const { data: enrollments } = useApi<any[]>(id ? `/students/${id}/enrollments` : "");
  const { data: fees }        = useApi<any[]>(id ? `/fees/collections/student/${id}` : "");

  const [transport, setTransport]         = useState<any>(null);
  const [hostel,    setHostel]            = useState<any>(null);
  const [loadingSvc, setLoadingSvc]       = useState(true);
  const [attSummary, setAttSummary]       = useState<any>(null);
  const [monthlyAtt, setMonthlyAtt]       = useState<any[]>([]);
  const [attMonth,   setAttMonth]         = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  /* fetch transport + hostel */
  useEffect(() => {
    if (!id || !activeYear?.id) return;
    setLoadingSvc(true);
    Promise.allSettled([
      apiRequest<{ data: any }>(`/transport/students/${id}?academic_year_id=${activeYear.id}`),
      apiRequest<{ data: any }>(`/hostel/students/${id}?academic_year_id=${activeYear.id}`),
    ]).then(([t, h]) => {
      setTransport(t.status === "fulfilled" ? t.value?.data : null);
      setHostel(   h.status === "fulfilled" ? h.value?.data : null);
    }).finally(() => setLoadingSvc(false));
  }, [id, activeYear?.id]);

  /* fetch attendance summary */
  useEffect(() => {
    if (!id || !activeYear?.id) return;
    const s = activeYear.start_date?.split("T")[0];
    const e = activeYear.end_date?.split("T")[0];
    apiRequest<{ data: any }>(
      `/attendance/student/${id}/summary?academic_year_id=${activeYear.id}&start_date=${s}&end_date=${e}`
    ).then(r => setAttSummary(r.data)).catch(() => setAttSummary(null));
  }, [id, activeYear?.id]);

  /* fetch monthly calendar */
  useEffect(() => {
    if (!id) return;
    const [yr, mo] = attMonth.split("-");
    apiRequest<{ data: any[] }>(`/attendance/student/${id}/monthly?year=${yr}&month=${parseInt(mo)}`)
      .then(r => setMonthlyAtt(r.data || [])).catch(() => setMonthlyAtt([]));
  }, [id, attMonth]);

  if (!id)      return <div className={s("sp-empty")}>No student selected.</div>;
  if (loading)  return <div className={s("sp-loading")}><Spinner size={32} color="#ff9b51" /></div>;
  if (!student) return <div className={s("sp-empty")}>Student not found.</div>;

  /* ── derived numbers ── */
  const tuitionTotal   = fees?.reduce((a, f) => a + parseFloat(f.total_amount || "0"), 0) || 0;
  const tuitionPaid    = fees?.reduce((a, f) => a + parseFloat(f.paid_amount  || "0"), 0) || 0;
  const tuitionPending = tuitionTotal - tuitionPaid;
  const transportAnn   = transport ? parseFloat(transport.monthly_fee || "0") * 12 : 0;
  const hostelAnn      = hostel    ? parseFloat(hostel.monthly_fee    || "0") * 12 : 0;
  const grandTotal     = tuitionTotal + transportAnn + hostelAnn;
  const grandPaid      = tuitionPaid;
  const grandPending   = grandTotal - grandPaid;
  const paidPct        = grandTotal > 0 ? (grandPaid / grandTotal) * 100 : 0;

  const attPct     = attSummary?.attendance_percentage ?? 0;
  const attPresent = attSummary?.total_present         ?? 0;
  const attAbsent  = attSummary?.total_absent          ?? 0;
  const attLate    = attSummary?.total_late            ?? 0;
  const attLeave   = attSummary?.total_leave           ?? 0;
  const attWork    = attSummary?.total_working_days    ?? 0;

  /* ── calendar ── */
  const [yr, mo] = attMonth.split("-").map(Number);
  const totalDays = new Date(yr, mo, 0).getDate();
  let leading = new Date(yr, mo - 1, 1).getDay() - 1;
  if (leading < 0) leading = 6;
  const dayMap: Record<string, string> = {};
  monthlyAtt.forEach(r => { if (r.date) dayMap[r.date.split("T")[0]] = r.status; });
  const calCells: { day: number | null; status?: string }[] = [
    ...Array(leading).fill({ day: null }),
    ...Array.from({ length: totalDays }, (_, i) => {
      const d = i + 1;
      const ds = `${yr}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      return { day: d, status: dayMap[ds] };
    }),
  ];
  while (calCells.length % 7) calCells.push({ day: null });

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthOpts = (() => {
    if (!activeYear) return [];
    const opts: { value: string; label: string }[] = [];
    const d = new Date(activeYear.start_date); d.setDate(1);
    const end = new Date(activeYear.end_date);
    while (d <= end) {
      opts.push({ value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
      d.setMonth(d.getMonth() + 1);
    }
    return opts;
  })();

  const enr = enrollments?.[0];
  const initials = (student.full_name || "").split(" ").map((p: string) => p[0]).join("").substring(0,2).toUpperCase();

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

        {/* HERO */}
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
                Admitted {student.admission_date ? new Date(student.admission_date).toLocaleDateString() : "—"}
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
            <StatBox label="Attendance" value={`${attPct}%`} sub={`${attPresent} / ${attWork} days`} />
            <StatBox label="Fee Paid"   value={`₹${fmt(grandPaid)}`} sub={`of ₹${fmt(grandTotal)}`} />
            <StatBox label="Enrollments" value={String(enrollments?.length || 0)} sub="academic years" />
          </div>
        </section>

        {/* MAIN GRID */}
        <div className={s("sp-grid")}>

          {/* ── LEFT ── */}
          <div className={s("sp-col")}>

            {/* Student info */}
            <section className={s("card")}>
              <SecHead title="Personal Information" sub="Identity, contact and guardian" />
              <div className={s("sp-dlist")}>
                <DRow label="Date of Birth"     value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : ""} />
                <DRow label="Gender"            value={student.gender}         cap />
                <DRow label="Blood Group"       value={student.blood_group} />
                <DRow label="Email"             value={student.email} />
                <DRow label="Phone"             value={student.phone} />
                <DRow label="Address"           value={[student.city, student.state, student.country].filter(Boolean).join(", ")} />
                <DRow label="Guardian Name"     value={student.guardian_name} />
                <DRow label="Guardian Relation" value={student.guardian_relation} cap />
                <DRow label="Guardian Phone"    value={student.guardian_phone} />
                <DRow label="Admission Date"    value={student.admission_date ? new Date(student.admission_date).toLocaleDateString() : ""} />
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

            {/* Attendance */}
            <section className={s("card")}>
              <SecHead
                title="Attendance"
                sub={`${new Date(yr, mo - 1).toLocaleString("default", { month: "long", year: "numeric" })}`}
                right={
                  <select
                    value={attMonth}
                    onChange={e => setAttMonth(e.target.value)}
                    className={s("sp-select")}
                  >
                    {monthOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                }
              />

              {/* Stats strip */}
              <div className={s("sp-att-strip")}>
                {[
                  { l: "Rate",    v: `${attPct}%`,          c: pctColor(attPct) },
                  { l: "Working", v: attWork,                 c: "#1e293b" },
                  { l: "Present", v: attPresent,              c: "#16a34a" },
                  { l: "Absent",  v: attAbsent,               c: "#dc2626" },
                  { l: "Late",    v: attLate,                 c: "#d97706" },
                  { l: "Leave",   v: attLeave,                c: "#64748b" },
                ].map(m => (
                  <div key={m.l} className={s("sp-att-stat")}>
                    <span>{m.l}</span>
                    <strong style={{ color: m.c }}>{m.v}</strong>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className={s("sp-att-bar-wrap")}>
                <div className={s("sp-att-bar-track")}>
                  <div className={s("sp-att-bar-fill")} style={{ width: `${attPct}%`, background: pctColor(attPct) }} />
                </div>
              </div>

              {/* Calendar */}
              <div className={s("sp-cal-wrap")}>
                <div className={s("sp-cal")}>
                  {["M","T","W","T","F","S","S"].map((d, i) => <div key={i} className={s("sp-cal-hdr")}>{d}</div>)}
                  {calCells.map((c, i) => (
                    <div
                      key={i}
                      className={cx(s("sp-cal-day"), c.status ? s(ATT_CLS[c.status] || "off") : c.day ? "" : s("off"))}
                      style={{ opacity: c.day ? 1 : 0 }}
                    >
                      {c.day}
                    </div>
                  ))}
                </div>
                <div className={s("sp-cal-legend")}>
                  {[["Present","#16a34a"],["Absent","#dc2626"],["Late","#d97706"],["Leave","#94a3b8"]].map(([l, c]) => (
                    <span key={l} className={s("sp-leg")} style={{ color: c as string }}>
                      <i style={{ background: c as string }} />{l}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* ── RIGHT ── */}
          <aside className={s("sp-side")}>

            {/* Fee summary */}
            <section className={s("card")}>
              <SecHead
                title="Fee Summary"
                sub="Tuition · Transport · Hostel"
                right={
                  <span className={cx(s("badge"), grandPending > 0 ? s("badge-red") : s("badge-green"))}>
                    {grandPending > 0 ? "Pending" : "Cleared"}
                  </span>
                }
              />
              <div className={s("sp-feebody")}>
                <FeeRow label="Tuition (assigned)"  value={`₹${fmt(tuitionTotal)}`} />
                <FeeRow label="Transport (annual)"   value={transport ? `₹${fmt(transportAnn)}` : "—"} muted={!transport} />
                <FeeRow label="Hostel (annual)"      value={hostel    ? `₹${fmt(hostelAnn)}`    : "—"} muted={!hostel} />
                <div className={s("sp-fee-divider")} />
                <FeeRow label="Grand Total"    value={`₹${fmt(grandTotal)}`} />
                <FeeRow label="Paid"           value={`₹${fmt(grandPaid)}`}    accent="#16a34a" />
                <FeeRow label="Outstanding"    value={`₹${fmt(grandPending)}`} accent={grandPending > 0 ? "#dc2626" : "#16a34a"} />
                <div className={s("sp-fee-progress-wrap")}>
                  <div className={s("sp-fee-progress-track")}>
                    <div className={s("sp-fee-progress-fill")} style={{ width: `${paidPct}%` }} />
                  </div>
                  <span className={s("sp-fee-pct")}>{paidPct.toFixed(0)}% paid</span>
                </div>
              </div>
            </section>

            {/* Transport */}
            <section className={s("card")}>
              <SecHead
                title="Transport"
                sub="Current year"
                right={
                  loadingSvc ? undefined :
                  transport
                    ? <span className={cx(s("badge"), s("badge-green"))}>Assigned</span>
                    : <span className={cx(s("badge"))}>Not Assigned</span>
                }
              />
              {loadingSvc
                ? <div className={s("sp-svcload")}><Spinner size={18} color="#94a3b8" /></div>
                : transport ? (
                  <div className={s("sp-svcbody")}>
                    <SvcRow icon="fa-solid fa-route"       label="Route"    value={transport.route_name} />
                    <SvcRow icon="fa-solid fa-bus"         label="Vehicle"  value={transport.vehicle_number} />
                    <SvcRow icon="fa-solid fa-map-pin"     label="Stop"     value={transport.stop_name} />
                    <SvcRow icon="fa-regular fa-clock"     label="Pick-up"  value={transport.pickup_time} />
                    <SvcRow icon="fa-regular fa-clock"     label="Drop"     value={transport.drop_time} />
                    {transport.driver_name && <SvcRow icon="fa-solid fa-id-badge" label="Driver" value={`${transport.driver_name}${transport.driver_phone ? " · " + transport.driver_phone : ""}`} />}
                    <div className={s("sp-fee-divider")} />
                    <FeeRow label="Monthly fee" value={`₹${fmt(parseFloat(transport.monthly_fee || "0"))}`} />
                    <FeeRow label="Annual fee"  value={`₹${fmt(transportAnn)}`} accent="#1e293b" />
                  </div>
                ) : (
                  <p className={s("sp-svcempty")}>Not assigned for this academic year.</p>
                )
              }
            </section>

            {/* Hostel */}
            <section className={s("card")}>
              <SecHead
                title="Hostel"
                sub="Current year"
                right={
                  loadingSvc ? undefined :
                  hostel
                    ? <span className={cx(s("badge"), s("badge-green"))}>Assigned</span>
                    : <span className={cx(s("badge"))}>Not Assigned</span>
                }
              />
              {loadingSvc
                ? <div className={s("sp-svcload")}><Spinner size={18} color="#94a3b8" /></div>
                : hostel ? (
                  <div className={s("sp-svcbody")}>
                    <SvcRow icon="fa-solid fa-building"     label="Hostel"    value={hostel.hostel_name} />
                    <SvcRow icon="fa-solid fa-venus-mars"   label="Type"      value={(hostel.hostel_type || "").replace(/_/g," ")} />
                    <SvcRow icon="fa-solid fa-door-open"    label="Room"      value={`Room ${hostel.room_number} · Floor ${hostel.floor}`} />
                    <SvcRow icon="fa-solid fa-bed"          label="Room Type" value={(hostel.room_type || "").replace(/_/g," ")} />
                    <SvcRow icon="fa-solid fa-users"        label="Capacity"  value={hostel.capacity ? `${hostel.capacity} beds` : "—"} />
                    {hostel.warden_name && <SvcRow icon="fa-solid fa-user-shield" label="Warden" value={`${hostel.warden_name}${hostel.warden_phone ? " · " + hostel.warden_phone : ""}`} />}
                    <div className={s("sp-fee-divider")} />
                    <FeeRow label="Monthly fee" value={`₹${fmt(parseFloat(hostel.monthly_fee || "0"))}`} />
                    <FeeRow label="Annual fee"  value={`₹${fmt(hostelAnn)}`} accent="#1e293b" />
                  </div>
                ) : (
                  <p className={s("sp-svcempty")}>Not assigned for this academic year.</p>
                )
              }
            </section>

            {/* Enrollment history */}
            <section className={s("card")}>
              <SecHead title="Enrollment History" sub="Academic years" />
              <div className={s("sp-enrlist")}>
                {enrollments?.length ? enrollments.map(en => (
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
