"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { apiRequest } from "@/lib/api";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const cap = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";

// ── Reusable sub-components ───────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 8px rgba(31,45,54,.07)", overflow: "hidden", ...style }}>
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

function Field({ label, value, icon }: { label: string; value?: string | null; icon?: string }) {
  return (
    <div style={{ padding: "11px 0", borderBottom: "1px solid #f7fafb", display: "flex", alignItems: "center", gap: 12 }}>
      {icon && (
        <i className={`fa-solid ${icon}`} style={{ width: 16, textAlign: "center", fontSize: 12, color: "#c6d0d7", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: value && value !== "—" ? "#1e293b" : "#c6d0d7" }}>{value || "—"}</span>
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
export default function TeacherProfilePage() {
  const { data: me, loading } = useApi<any>("/auth/me");

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError,   setPwdError]   = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");

  const initials = me?.full_name
    ? me.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "T";

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(""); setPwdSuccess("");
    if (newPwd.length < 6)     { setPwdError("New password must be at least 6 characters."); return; }
    if (newPwd !== confirmPwd) { setPwdError("New passwords do not match."); return; }
    setPwdLoading(true);
    try {
      await apiRequest("/auth/change-password/teacher", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      });
      setPwdSuccess("Password changed successfully.");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err: any) {
      setPwdError(err.message || "Failed to change password.");
    } finally { setPwdLoading(false); }
  };

  // password strength
  const strength = newPwd.length === 0 ? 0 : newPwd.length < 6 ? 1 : newPwd.length < 8 ? 2 : newPwd.length < 10 ? 3 : 4;
  const strengthColor = ["#e2e8f0", "#ef4444", "#f97316", "#eab308", "#22c55e"][strength];
  const strengthLabel = ["", "Too short", "Weak", "Medium", "Strong"][strength];

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
      <style>{`
        .tp-hero       { display:flex; }
        .tp-avatar-col { width:200px; flex-shrink:0; background:#25343F; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:36px 20px; gap:14px; }
        .tp-info-col   { flex:1; min-width:0; padding:28px 28px 24px; }
        @media(max-width:600px){
          .tp-hero       { flex-direction:column; }
          .tp-avatar-col { width:100%; padding:28px 20px 22px; }
          .tp-info-col   { padding:18px 16px 20px; }
        }
      `}</style>
      <Topbar title="My Profile" subtitle="Your personal and professional information" />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        {loading ? (
          <div style={{ padding: "5rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <>
            {/* ══ HERO ══ */}
            <Card>
              <div className="tp-hero">

                {/* Left — avatar column */}
                <div className="tp-avatar-col">
                  <div style={{ width: 80, height: 80, borderRadius: 20, background: "#FF9B51", color: "#1e2d38", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900, boxShadow: "0 6px 20px rgba(255,155,81,.4)" }}>
                    {initials}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.45)", letterSpacing: "0.5px", textTransform: "uppercase" }}>Faculty</span>
                    <span style={{ display: "block", marginTop: 6, padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                      background: me?.status === "active" ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
                      color:      me?.status === "active" ? "#4ade80"              : "#f87171",
                      border:     `1px solid ${me?.status === "active" ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`,
                      textTransform: "capitalize",
                    }}>{me?.status ?? "—"}</span>
                  </div>
                </div>

                {/* Right — name + details */}
                <div className="tp-info-col">
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1e293b", lineHeight: 1.2 }}>{me?.full_name ?? "—"}</h1>
                  <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 700, color: "#6a7882" }}>{me?.school_name ?? ""}</p>

                  {/* Quick info chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
                    {[
                      { icon: "fa-graduation-cap", val: me?.qualification                        },
                      { icon: "fa-briefcase",       val: `${me?.experience_years ?? 0} yrs exp`  },
                      { icon: "fa-calendar-check",  val: fmtDate(me?.join_date)                  },
                      { icon: "fa-venus-mars",      val: cap(me?.gender)                         },
                    ].filter(c => c.val && c.val !== "—").map(c => (
                      <div key={c.icon} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 8, background: "#f7fafb", border: "1px solid #e8eef0" }}>
                        <i className={`fa-solid ${c.icon}`} style={{ fontSize: 12, color: "#FF9B51" }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{c.val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Subject chips */}
                  {me?.subjects?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14, alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Subjects</span>
                      {me.subjects.map((s: any) => (
                        <span key={s.id} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: "#fff7ed", border: "1px solid #fde68a", color: "#c46a14" }}>
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* ══ TWO-COL: Personal + Contact ══ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
              <Card>
                <CardHead icon="fa-user" title="Personal Information" />
                <div style={{ padding: "4px 20px 12px" }}>
                  <Field icon="fa-id-card"      label="Full Name"     value={me?.full_name} />
                  <Field icon="fa-cake-candles" label="Date of Birth" value={fmtDate(me?.date_of_birth)} />
                  <Field icon="fa-venus-mars"   label="Gender"        value={cap(me?.gender)} />
                  <Field icon="fa-circle-dot"   label="Status"        value={cap(me?.status)} />
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

            {/* ══ Professional ══ */}
            <Card>
              <CardHead icon="fa-briefcase" title="Professional Information" sub="Academic credentials and employment details" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 0, padding: "4px 20px 12px" }}>
                <div style={{ paddingRight: 20 }}>
                  <Field icon="fa-graduation-cap" label="Qualification" value={me?.qualification} />
                  <Field icon="fa-briefcase"      label="Experience"    value={`${me?.experience_years ?? 0} years`} />
                </div>
                <div style={{ paddingLeft: 20, borderLeft: "1px solid #f0f4f5" }}>
                  <Field icon="fa-calendar-check"   label="Date of Joining" value={fmtDate(me?.join_date)} />
                  <Field icon="fa-building-columns" label="School"          value={me?.school_name} />
                </div>
              </div>
            </Card>

            {/* ══ Change Password ══ */}
            <Card>
              <CardHead icon="fa-lock" title="Change Password" sub="Keep your account secure with a strong password" />
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
                  <button type="submit" disabled={pwdLoading} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 9, border: "none", background: "#FF9B51", color: "#fff", fontWeight: 900, fontSize: 13, cursor: pwdLoading ? "not-allowed" : "pointer", opacity: pwdLoading ? 0.75 : 1 }}>
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
