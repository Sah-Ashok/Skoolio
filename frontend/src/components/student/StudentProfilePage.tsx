"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppSelector } from "@/store/hooks";
import { apiRequest } from "@/lib/api";

/* ── helpers ── */
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;

const cap = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : null;

const streamLabel: Record<string, string> = {
  science: "Science", commerce: "Commerce",
  arts: "Arts / Humanities", not_applicable: "General",
};

const bgColor: Record<string, { bg: string; color: string }> = {
  "A+": { bg: "#fee2e2", color: "#dc2626" }, "A-": { bg: "#fee2e2", color: "#dc2626" },
  "B+": { bg: "#fef3c7", color: "#d97706" }, "B-": { bg: "#fef3c7", color: "#d97706" },
  "O+": { bg: "#dcfce7", color: "#16a34a" }, "O-": { bg: "#dcfce7", color: "#16a34a" },
  "AB+": { bg: "#e0e7ff", color: "#4338ca" }, "AB-": { bg: "#e0e7ff", color: "#4338ca" },
};

/* ── shared styles ── */
const pwdLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
  textTransform: "uppercase", color: "#94a3b8", marginBottom: 6,
};
const pwdInputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid #e2e8f0", fontSize: 14, color: "#1e293b",
  background: "#f8fafc", outline: "none", boxSizing: "border-box",
};

/* ── single info row ── */
function Row({ icon, label, value, highlight = false }: {
  icon: string; label: string; value?: string | null; highlight?: boolean;
}) {
  const val = value && value !== "-" ? value : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: highlight ? "#fff1df" : "#f8fafc", color: highlight ? "#e98239" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: "#94a3b8", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: val ? "#1e293b" : "#cbd5e1", wordBreak: "break-word" }}>{val ?? "Not provided"}</div>
      </div>
    </div>
  );
}

/* ── section title ── */
function SectionTitle({ icon, label, color = "#FF9B51" }: { icon: string; label: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 12px", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: `${color}20`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>{label}</span>
    </div>
  );
}

export default function StudentProfilePage() {
  const { user }              = useAppSelector(s => s.auth);
  const { data: me, loading } = useApi<any>("/auth/me");
  const { data: enrollments } = useApi<any[]>("/students/me/enrollments");

  // ── change password ──
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError,   setPwdError]   = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(""); setPwdSuccess("");
    if (newPwd.length < 6)       { setPwdError("New password must be at least 6 characters."); return; }
    if (newPwd !== confirmPwd)    { setPwdError("New passwords do not match."); return; }
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
    } finally {
      setPwdLoading(false);
    }
  };

  const current  = enrollments?.[0];
  const initials = me?.full_name
    ? me.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "S";
  const schoolName = me?.school_name || (user as any)?.school_name || "";
  const bgroup     = me?.blood_group;
  const bclr       = bgroup ? bgColor[bgroup] : null;

  return (
    <>
      <style>{`
        .spp { min-height:100vh; background:#f0f4f8; font-family:'Nunito','Inter',sans-serif; }
        .spp-mob-bar { display:none; align-items:center; justify-content:center; padding:13px 20px; background:#fff; border-bottom:1.5px solid #e2e8f0; position:sticky; top:0; z-index:50; }
        .spp-mob-logo { height:28px; object-fit:contain; }
        .spp-mob-logo-txt { font-size:20px; font-weight:900; color:#25343F; letter-spacing:-0.5px; display:none; }
        .spp-mob-logo-txt em { font-style:normal; color:#FF9B51; }
        .spp-desk-bar { background:#fff; height:64px; display:flex; align-items:center; padding:0 28px; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:50; box-shadow:0 1px 6px rgba(37,52,63,0.06); }
        .spp-desk-bar h2 { font-size:17px; font-weight:800; color:#25343F; }
        .spp-desk-bar p  { font-size:12px; color:#94a3b8; margin-top:1px; }
        .spp-scroll { padding:20px; max-width:620px; margin:0 auto; display:flex; flex-direction:column; gap:14px; }
        .spp-hero { border-radius:20px; overflow:hidden; box-shadow:0 6px 28px rgba(37,52,63,0.18); }
        .spp-hero-top { background:linear-gradient(135deg,#1e3a4c 0%,#2c4f66 50%,#1e3a4c 100%); padding:30px 24px ; position:relative; text-align:center; }
        .spp-hero-top::before { content:""; position:absolute; inset:0; background:radial-gradient(circle at 20% 50%,rgba(255,155,81,0.12) 0%,transparent 60%),radial-gradient(circle at 80% 20%,rgba(255,255,255,0.05) 0%,transparent 40%); pointer-events:none; }
        .spp-hero-school { font-size:11px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; color:rgba(255,255,255,0.5); margin-bottom:24px; position:relative; z-index:1; }
        .spp-avatar-wrap { position:relative; z-index:1; display:inline-block; }
        .spp-avatar { width:220px; height:220px; border-radius:18px; border:3.5px solid rgba(255,155,81,0.8); box-shadow:0 8px 32px rgba(0,0,0,0.4); background:linear-gradient(135deg,#314653,#1e3a4c); display:flex; align-items:center; justify-content:center; font-size:38px; font-weight:900; color:#FF9B51; letter-spacing:-1px; overflow:hidden; position:relative; }
        .spp-avatar img { width:100%; height:100%; object-fit:cover; object-position:top; border-radius:14px; }
        .spp-avatar::after { content:""; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.08) 0%,transparent 60%); border-radius:14px; pointer-events:none; }
        .spp-bg-badge { position:absolute; bottom:-8px; right:-8px; padding:4px 9px; border-radius:8px; font-size:12px; font-weight:900; border:2px solid #fff; box-shadow:0 3px 10px rgba(0,0,0,0.25); white-space:nowrap; }
        .spp-hero-bottom { background:#fff; margin-top:-52px; padding-top:62px; padding-bottom:18px; padding-inline:20px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px; }
        .spp-name { font-size:22px; font-weight:900; color:#1e293b; letter-spacing:-0.4px; line-height:1.1; }
        .spp-adm  { font-size:12px; color:#94a3b8; margin-top:-4px; }
        .spp-pills { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:2px; }
        .spp-pill  { display:inline-flex; align-items:center; gap:5px; padding:5px 13px; border-radius:999px; font-size:11.5px; font-weight:800; }
        .spp-strip { background:#fff; border-radius:16px; overflow:hidden; display:grid; grid-template-columns:repeat(3,1fr); box-shadow:0 2px 12px rgba(37,52,63,0.07); border:1px solid #f1f5f9; }
        .spp-strip-item { padding:14px 10px; display:flex; flex-direction:column; align-items:center; text-align:center; position:relative; }
        .spp-strip-item + .spp-strip-item::before { content:""; position:absolute; left:0; top:20%; bottom:20%; width:1px; background:#f1f5f9; }
        .spp-strip-val { font-size:18px; font-weight:900; color:#1e293b; line-height:1.1; }
        .spp-strip-key { font-size:9.5px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.6px; margin-top:4px; }
        .spp-scholar { border-radius:14px; padding:14px 18px; background:linear-gradient(120deg,#dcfce7,#d1fae5); border:1px solid #86efac; display:flex; align-items:center; gap:12px; }
        .spp-scholar-icon { width:40px; height:40px; border-radius:10px; flex-shrink:0; background:#4ade80; color:#14532d; display:flex; align-items:center; justify-content:center; font-size:17px; }
        .spp-scholar-title { font-size:13px; font-weight:900; color:#14532d; }
        .spp-scholar-sub   { font-size:11px; font-weight:700; color:#166534; margin-top:2px; }
        .spp-card { background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(37,52,63,0.06); border:1px solid #f1f5f9; }
        .spp-card > div:last-child { border-bottom:none !important; }
        @media (max-width: 768px) {
          .spp-desk-bar { display:none; } .spp-mob-bar { display:flex; }
          .spp-scroll { padding:16px; gap:12px; } .spp-hero-top { padding:24px 18px ; }
          .spp-avatar { width:220px; height:220px; border-radius:14px; font-size:30px; }
          .spp-avatar::after { border-radius:11px; } .spp-name { font-size:20px; }
          .spp-hero-bottom { padding-top:54px; }
        }
        @media (max-width: 380px) { .spp-name { font-size:18px; } .spp-strip-val { font-size:15px; } }
      `}</style>

      <div className="spp">

        <header className="spp-desk-bar">
          <div><h2>My Profile</h2><p>Your personal and academic information</p></div>
        </header>

        <header className="spp-mob-bar">
          <img src="/Logo.png" alt="Skoolio" className="spp-mob-logo"
            onError={e => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              (e.currentTarget.nextElementSibling as HTMLElement).style.display = "block";
            }}
          />
          <span className="spp-mob-logo-txt"><em>Skoo</em>lio</span>
        </header>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <Spinner size={36} color="#FF9B51" />
          </div>
        ) : (
          <main className="spp-scroll">

            {/* ══ HERO ══ */}
            <div className="spp-hero">
              <div className="spp-hero-top">
                
                <div className="spp-avatar-wrap">
                  <div className="spp-avatar">
                    {me?.photo ? <img src={me.photo} alt={me.full_name} /> : initials}
                  </div>
                  {bgroup && bclr && (
                    <div className="spp-bg-badge" style={{ background: bclr.bg, color: bclr.color }}>{bgroup}</div>
                  )}
                </div>
              </div>
              <div className="spp-hero-bottom">
                <div className="spp-name">{me?.full_name || "—"}</div>
                {me?.admission_number && <div className="spp-adm">Admission # {me.admission_number}</div>}
                <div className="spp-pills">
                  {me?.gender && (
                    <span className="spp-pill" style={{ background: "#eff6ff", color: "#2563eb" }}>
                      <i className="fa-solid fa-venus-mars" style={{ fontSize: 10 }} />{cap(me.gender)}
                    </span>
                  )}
                  {me?.nationality && (
                    <span className="spp-pill" style={{ background: "#f0fdf4", color: "#15803d" }}>
                      <i className="fa-solid fa-flag" style={{ fontSize: 10 }} />{me.nationality}
                    </span>
                  )}
                  {me?.status && (
                    <span className="spp-pill" style={{ background: me.status === "active" ? "#dcfce7" : "#fef3c7", color: me.status === "active" ? "#15803d" : "#b45309" }}>
                      <i className={`fa-solid ${me.status === "active" ? "fa-circle-check" : "fa-clock"}`} style={{ fontSize: 10 }} />{cap(me.status)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ══ STAT STRIP ══ */}
            <div className="spp-strip">
              <div className="spp-strip-item">
                <div className="spp-strip-val">{current?.class_name || "—"}</div>
                <div className="spp-strip-key">Class</div>
              </div>
              <div className="spp-strip-item">
                <div className="spp-strip-val">{current?.section_name ? `Sec ${current.section_name}` : "—"}</div>
                <div className="spp-strip-key">Section</div>
              </div>
              <div className="spp-strip-item">
                <div className="spp-strip-val">{current?.roll_number || "—"}</div>
                <div className="spp-strip-key">Roll No</div>
              </div>
            </div>

            {/* ══ SCHOLARSHIP ══ */}
            {me?.scholarship_type && me?.scholarship_percent && (
              <div className="spp-scholar">
                <div className="spp-scholar-icon"><i className="fa-solid fa-graduation-cap" /></div>
                <div>
                  <div className="spp-scholar-title">{cap(me.scholarship_type)} Scholarship — {me.scholarship_percent}% fee discount</div>
                  {me?.scholarship_remarks && <div className="spp-scholar-sub">{me.scholarship_remarks}</div>}
                </div>
              </div>
            )}

            {/* ══ ENROLLMENT ══ */}
            {current && (
              <div className="spp-card">
                <SectionTitle icon="fa-school" label="Academic Enrollment" color="#6366f1" />
                <Row icon="fa-calendar-check" label="Academic Year"   value={current.academic_year_name} highlight />
                <Row icon="fa-chalkboard"     label="Class"           value={current.class_name} />
                <Row icon="fa-table-cells"    label="Section"         value={current.section_name ? `Section ${current.section_name}` : null} />
                <Row icon="fa-hashtag"        label="Roll Number"     value={current.roll_number?.toString()} />
                <Row icon="fa-code-branch"    label="Stream"          value={streamLabel[current.stream] || cap(current.stream)} />
                {current.registration_number && <Row icon="fa-id-card" label="Registration No." value={current.registration_number} />}
                {current.symbol_number        && <Row icon="fa-star"   label="Symbol Number"    value={current.symbol_number} />}
              </div>
            )}

            {/* ══ PERSONAL DETAILS ══ */}
            <div className="spp-card">
              <SectionTitle icon="fa-user" label="Personal Details" color="#FF9B51" />
              <Row icon="fa-envelope"      label="Email"           value={me?.email}              highlight />
              <Row icon="fa-phone"         label="Phone"           value={me?.phone}              highlight />
              <Row icon="fa-cake-candles"  label="Date of Birth"   value={fmt(me?.date_of_birth)} />
              <Row icon="fa-heart-pulse"   label="Blood Group"     value={me?.blood_group}        highlight />
              <Row icon="fa-pray"          label="Religion"        value={me?.religion} />
              <Row icon="fa-people-group"  label="Ethnicity"       value={me?.ethnicity} />
              <Row icon="fa-location-dot"  label="City"            value={me?.city} />
              <Row icon="fa-map"           label="State"           value={me?.state} />
              <Row icon="fa-earth-asia"    label="Country"         value={me?.country} />
              
              <Row icon="fa-calendar-plus" label="Admission Date"  value={fmt(me?.admission_date)} highlight />
            </div>

            {/* ══ GUARDIAN DETAILS ══ */}
            <div className="spp-card">
              <SectionTitle icon="fa-user-shield" label="Guardian Details" color="#0284c7" />
              <Row icon="fa-user"          label="Guardian Name"  value={me?.guardian_name}           highlight />
              <Row icon="fa-people-arrows" label="Relation"       value={cap(me?.guardian_relation)} />
              <Row icon="fa-phone"         label="Guardian Phone" value={me?.guardian_phone}          highlight />
              <Row icon="fa-envelope"      label="Guardian Email" value={me?.guardian_email} />
              <Row icon="fa-house"         label="Address"        value={me?.guardian_address} />
            </div>

            {/* ══ SPECIAL NEEDS ══ */}
            {me?.disability && (
              <div className="spp-card">
                <SectionTitle icon="fa-wheelchair" label="Special Needs" color="#9333ea" />
                <Row icon="fa-notes-medical" label="Details" value={me?.disability_description} />
              </div>
            )}

            {/* ══ CHANGE PASSWORD ══ */}
            <div className="spp-card">
              <SectionTitle icon="fa-lock" label="Change Password" color="#6366f1" />
              <form onSubmit={handleChangePassword} style={{ padding: "4px 20px 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>

                  <div>
                    <label style={pwdLabelStyle}>Current Password</label>
                    <input type="password" style={pwdInputStyle} placeholder="Enter current password"
                      value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required />
                  </div>

                  <div>
                    <label style={pwdLabelStyle}>New Password</label>
                    <input type="password" style={pwdInputStyle} placeholder="Min. 6 characters"
                      value={newPwd} onChange={e => setNewPwd(e.target.value)} required />
                  </div>

                  <div>
                    <label style={pwdLabelStyle}>Confirm New Password</label>
                    <input type="password" style={pwdInputStyle} placeholder="Repeat new password"
                      value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
                  </div>

                  {pwdError && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13 }}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 7 }} />{pwdError}
                    </div>
                  )}
                  {pwdSuccess && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", color: "#16a34a", fontSize: 13 }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: 7 }} />{pwdSuccess}
                    </div>
                  )}

                  <button type="submit" disabled={pwdLoading} style={{
                    padding: "11px 24px", borderRadius: 10, border: "none",
                    background: pwdLoading ? "#a5b4fc" : "#6366f1", color: "#fff",
                    fontSize: 14, fontWeight: 700, cursor: pwdLoading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 8, alignSelf: "flex-start",
                  }}>
                    {pwdLoading
                      ? <><i className="fa-solid fa-spinner fa-spin" />Updating...</>
                      : <><i className="fa-solid fa-key" />Update Password</>
                    }
                  </button>
                </div>
              </form>
            </div>

            <div style={{ height: 8 }} />
          </main>
        )}
      </div>
    </>
  );
}
