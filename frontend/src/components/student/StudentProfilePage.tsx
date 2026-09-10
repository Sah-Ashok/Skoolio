"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Loader } from "@/components/shared/Loader";
import { useAppSelector } from "@/store/hooks";
import { apiRequest } from "@/lib/api";
import { useDateFormat } from "@/lib/useDateFormat";

// ── helpers ───────────────────────────────────────────────────────────────────
const cap = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : null;

const STREAM_LABEL: Record<string, string> = {
  science: "Science", commerce: "Commerce",
  arts: "Arts / Humanities", not_applicable: "General",
};

// ── sub-components ────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 8px rgba(31,45,54,.07)", overflow: "hidden" }}>
      {children}
    </div>
  );
}

function CardHead({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f4f5", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={`fa-solid ${icon}`} style={{ color: "#FF9B51", fontSize: 13 }} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: "#1e293b" }}>{title}</p>
        {sub && <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>{sub}</p>}
      </div>
    </div>
  );
}

function Field({ label, value, icon, mono }: {
  label: string; value?: string | null; icon?: string; mono?: boolean;
}) {
  const v = value && value !== "—" ? value : null;
  return (
    <div style={{ padding: "11px 0", borderBottom: "1px solid #f7fafb", display: "flex", alignItems: "center", gap: 12 }}>
      {icon && (
        <i className={`fa-solid ${icon}`} style={{ width: 16, textAlign: "center", fontSize: 12, color: "#c6d0d7", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: v ? "#1e293b" : "#d4dde2", fontFamily: mono ? "monospace" : "inherit" }}>
          {v || "—"}
        </span>
      </div>
    </div>
  );
}

function PwdInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required
          style={{ width: "100%", height: 40, padding: "0 40px 0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, fontWeight: 600, outline: "none", background: "#fafbfc", boxSizing: "border-box" }}
        />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13 }}>
          <i className={`fa-solid ${show ? "fa-eye-slash" : "fa-eye"}`} />
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
interface Props {
  /** When provided, fetches that student's data (teacher view — read-only, no photo, no password change) */
  studentId?: number;
}

export default function StudentProfilePage({ studentId }: Props = {}) {
  const isTeacherView = !!studentId;
  const { user }              = useAppSelector(s => s.auth);
  const { formatDate }        = useDateFormat();
  const fmtDate               = (d?: string | null) => d ? formatDate(d) : null;

  // Student's own view — uses /auth/me
  const { data: me,       loading: meLoading }   = useApi<any>(isTeacherView ? "" : "/auth/me");
  const { data: enrollOwn }                       = useApi<any[]>(isTeacherView ? "" : "/students/me/enrollments");

  // Teacher view — fetches student by id + their enrollments
  const { data: studentData, loading: stLoading } = useApi<any>(isTeacherView ? `/students/${studentId}` : "", [studentId]);
  const { data: enrollTeacher }                   = useApi<any[]>(isTeacherView && studentId ? `/students/${studentId}/enrollments` : "", [studentId]);

  const loading     = isTeacherView ? stLoading : meLoading;
  const me2         = isTeacherView ? studentData : me;
  const enrollments = isTeacherView ? enrollTeacher : enrollOwn;

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError,   setPwdError]   = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(""); setPwdSuccess("");
    if (newPwd.length < 6)    { setPwdError("New password must be at least 6 characters."); return; }
    if (newPwd !== confirmPwd) { setPwdError("New passwords do not match."); return; }
    setPwdLoading(true);
    try {
      await apiRequest("/auth/change-password/student", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      });
      setPwdSuccess("Password changed successfully.");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err: any) {
      setPwdError(err.message || "Failed to change password.");
    } finally { setPwdLoading(false); }
  };

  const current  = enrollments?.[0];
  const initials = me2?.full_name
    ? me2.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "S";
  const schoolName = me2?.school_name || (user as any)?.school_name || "";

  // password strength
  const strength = newPwd.length === 0 ? 0 : newPwd.length < 6 ? 1 : newPwd.length < 8 ? 2 : newPwd.length < 10 ? 3 : 4;
  const strengthColor = ["#e2e8f0", "#ef4444", "#f97316", "#eab308", "#22c55e"][strength];
  const strengthLabel = ["", "Too short", "Weak", "Medium", "Strong"][strength];

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
      <style>{`
        .sp-hero       { display:flex; }
        .sp-avatar-col { width:220px; flex-shrink:0; background:#25343F; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:28px 20px; gap:14px; }
        .sp-info-col   { flex:1; min-width:0; padding:26px 26px 22px; }
        @media(max-width:600px){
          .sp-hero       { flex-direction:column; }
          .sp-avatar-col { width:100%; padding:28px 20px 22px; }
          .sp-info-col   { padding:18px 16px 20px; }
        }
      `}</style>
      <Topbar title="My Profile" subtitle="Your personal and academic information" />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        {loading ? (
          <div style={{ padding: "4rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading your profile…" /></div>
        ) : (
          <>
            {/* ══ HERO ══ */}
            <Card>
              <div className="sp-hero">

                {/* Left — dark avatar column */}
                <div className="sp-avatar-col">
                  <div style={{ width: 160, height: 190, borderRadius: 18, background: "#FF9B51", color: "#1e2d38", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, fontWeight: 900, boxShadow: "0 6px 24px rgba(255,155,81,.35)", overflow: "hidden", flexShrink: 0, border: "3px solid rgba(255,155,81,.5)" }}>
                    {me?.photo
                      ? <img src={me.photo} alt={me.full_name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                      : initials
                    }
                  </div>
                </div>

                {/* Right — name + key info */}
                <div className="sp-info-col">
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1e293b", lineHeight: 1.2 }}>{me?.full_name ?? "—"}</h1>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#6a7882" }}>{schoolName}</p>
                    {me?.status && (
                      <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: "capitalize",
                        background: me.status === "active" ? "#dcfce7" : "#fee2e2",
                        color:      me.status === "active" ? "#15803d" : "#b91c1c",
                        border:     `1px solid ${me.status === "active" ? "#bbf7d0" : "#fca5a5"}`,
                      }}>{me.status}</span>
                    )}
                  </div>

                  {/* Adm number */}
                  {me?.admission_number && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "5px 12px", borderRadius: 8, background: "#f7fafb", border: "1px solid #e2e8f0" }}>
                      <i className="fa-solid fa-id-card" style={{ fontSize: 11, color: "#94a3b8" }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", fontFamily: "monospace" }}>
                        Adm# {me.admission_number}
                      </span>
                    </div>
                  )}

                  {/* Quick info chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                    {[
                      { icon: "fa-venus-mars",    val: cap(me?.gender)                    },
                      { icon: "fa-cake-candles",  val: fmtDate(me?.date_of_birth)         },
                      { icon: "fa-calendar-plus", val: fmtDate(me?.admission_date) ? `Joined ${fmtDate(me?.admission_date)}` : null },
                      { icon: "fa-heart-pulse",   val: me?.blood_group                    },
                    ].filter(c => c.val).map(c => (
                      <div key={c.icon} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 8, background: "#f7fafb", border: "1px solid #e8eef0" }}>
                        <i className={`fa-solid ${c.icon}`} style={{ fontSize: 11, color: "#FF9B51" }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{c.val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Class / Section / Roll */}
                  {current && (
                    <div style={{ display: "flex", gap: 20, marginTop: 16, paddingTop: 16, borderTop: "1px solid #f0f4f5", flexWrap: "wrap" }}>
                      {[
                        { label: "Class",    val: current.class_name   || "—" },
                        { label: "Section",  val: current.section_name || "—" },
                        { label: "Roll No.", val: current.roll_number  || "—" },
                        { label: "Year",     val: current.academic_year_name || "—" },
                      ].map(s => (
                        <div key={s.label}>
                          <span style={{ display: "block", fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</span>
                          <strong style={{ fontSize: 15, fontWeight: 900, color: "#1e293b" }}>{s.val}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* ══ Scholarship banner ══ */}
            {me?.scholarship_type && me?.scholarship_percent && (
              <div style={{ padding: "14px 18px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#22c55e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  <i className="fa-solid fa-graduation-cap" />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: "#15803d" }}>
                    {cap(me.scholarship_type)} Scholarship — {me.scholarship_percent}% fee discount
                  </p>
                  {me?.scholarship_remarks && (
                    <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 700, color: "#16a34a" }}>{me.scholarship_remarks}</p>
                  )}
                </div>
              </div>
            )}

            {/* ══ TWO-COL: Personal + Contact ══ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
              <Card>
                <CardHead icon="fa-user" title="Personal Details" />
                <div style={{ padding: "4px 20px 12px" }}>
                  <Field icon="fa-cake-candles"   label="Date of Birth"  value={fmtDate(me?.date_of_birth)} />
                  <Field icon="fa-venus-mars"     label="Gender"         value={cap(me?.gender)} />
                  <Field icon="fa-heart-pulse"    label="Blood Group"    value={me?.blood_group} />
                  <Field icon="fa-pray"           label="Religion"       value={me?.religion} />
                  <Field icon="fa-people-group"   label="Ethnicity"      value={me?.ethnicity} />
                  <Field icon="fa-flag"           label="Nationality"    value={me?.nationality} />
                </div>
              </Card>

              <Card>
                <CardHead icon="fa-address-book" title="Contact Details" />
                <div style={{ padding: "4px 20px 12px" }}>
                  <Field icon="fa-envelope"   label="Email"   value={me?.email} />
                  <Field icon="fa-phone"      label="Phone"   value={me?.phone} />
                  <Field icon="fa-city"       label="City"    value={me?.city} />
                  <Field icon="fa-map"        label="State"   value={me?.state} />
                  <Field icon="fa-earth-asia" label="Country" value={me?.country} />
                </div>
              </Card>
            </div>

            {/* ══ Enrollment (academic) ══ */}
            {current && (
              <Card>
                <CardHead icon="fa-school" title="Academic Enrollment" sub={current.academic_year_name} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 0, padding: "4px 20px 12px" }}>
                  <div style={{ paddingRight: 20 }}>
                    <Field icon="fa-school"      label="Class"        value={current.class_name} />
                    <Field icon="fa-table-cells" label="Section"      value={current.section_name} />
                    <Field icon="fa-list-ol"     label="Roll Number"  value={current.roll_number?.toString()} />
                  </div>
                  <div style={{ paddingLeft: 20, borderLeft: "1px solid #f0f4f5" }}>
                    <Field icon="fa-code-branch" label="Stream"           value={STREAM_LABEL[current.stream] || cap(current.stream)} />
                    <Field icon="fa-id-card"     label="Registration No." value={current.registration_number} mono />
                    <Field icon="fa-star"        label="Symbol Number"    value={current.symbol_number} mono />
                  </div>
                </div>
              </Card>
            )}

            {/* ══ Guardian ══ */}
            <Card>
              <CardHead icon="fa-user-shield" title="Guardian Details" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 0, padding: "4px 20px 12px" }}>
                <div style={{ paddingRight: 20 }}>
                  <Field icon="fa-user"          label="Guardian Name"  value={me?.guardian_name} />
                  <Field icon="fa-people-arrows" label="Relation"       value={cap(me?.guardian_relation)} />
                  <Field icon="fa-phone"         label="Guardian Phone" value={me?.guardian_phone} />
                </div>
                <div style={{ paddingLeft: 20, borderLeft: "1px solid #f0f4f5" }}>
                  <Field icon="fa-envelope" label="Guardian Email" value={me?.guardian_email} />
                  <Field icon="fa-house"    label="Address"        value={me?.guardian_address} />
                </div>
              </div>
            </Card>

            {/* ══ Special needs ══ */}
            {me?.disability && (
              <Card>
                <CardHead icon="fa-wheelchair" title="Special Needs" />
                <div style={{ padding: "4px 20px 12px" }}>
                  <Field icon="fa-notes-medical" label="Details" value={me?.disability_description} />
                </div>
              </Card>
            )}

            {/* ══ Change Password ══ */}
            <Card>
              <CardHead icon="fa-lock" title="Change Password" sub="Keep your account secure" />
              <form onSubmit={handleChangePassword} style={{ padding: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 16 }}>
                  <PwdInput label="Current Password"     value={currentPwd}  onChange={setCurrentPwd}  placeholder="Current password" />
                  <PwdInput label="New Password"         value={newPwd}      onChange={setNewPwd}      placeholder="Min. 6 characters" />
                  <PwdInput label="Confirm New Password" value={confirmPwd}  onChange={setConfirmPwd}  placeholder="Repeat new password" />
                </div>

                {newPwd.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
                      {[1,2,3,4].map(n => (
                        <div key={n} style={{ flex: 1, height: 4, borderRadius: 999, background: strength >= n ? strengthColor : "#e2e8f0", transition: "background .2s" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: strengthColor }}>{strengthLabel}</span>
                  </div>
                )}

                {pwdError && (
                  <div style={{ padding: "9px 13px", borderRadius: 8, background: "#fde7e7", border: "1px solid #fca5a5", color: "#b42318", fontSize: 12, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <i className="fa-solid fa-triangle-exclamation" />{pwdError}
                  </div>
                )}
                {pwdSuccess && (
                  <div style={{ padding: "9px 13px", borderRadius: 8, background: "#e2f6ee", border: "1px solid #a7f3d0", color: "#12805c", fontSize: 12, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <i className="fa-solid fa-circle-check" />{pwdSuccess}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button type="submit" disabled={pwdLoading}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 9, border: "none", background: "#FF9B51", color: "#fff", fontWeight: 900, fontSize: 13, cursor: pwdLoading ? "not-allowed" : "pointer", opacity: pwdLoading ? 0.75 : 1 }}>
                    {pwdLoading
                      ? <><i className="fa-solid fa-spinner fa-spin" /> Updating…</>
                      : <><i className="fa-solid fa-key" /> Update Password</>
                    }
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>Min. 6 characters required</span>
                </div>
              </form>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
