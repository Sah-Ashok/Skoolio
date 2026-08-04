"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { setUser } from "@/store/authSlice";
import { Spinner } from "@/components/shared/Loader";
import styles from "./settings.module.css";
import PaymentSettingsTab from "./PaymentSettingsTab";
import PayrollPolicyTab from "./PayrollPolicyTab";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

type Tab = "general" | "profile" | "security" | "appearance" | "payment" | "payroll";

const TABS: { key: Tab; icon: string; label: string; desc: string }[] = [
  { key: "general",    icon: "fa-sliders",            label: "General",        desc: "Contact & region"    },
  { key: "profile",    icon: "fa-school",             label: "School Profile", desc: "Identity & branding" },
  { key: "security",   icon: "fa-shield-halved",      label: "Security",       desc: "Password & 2FA"      },
  { key: "appearance", icon: "fa-palette",            label: "Appearance",     desc: "Theme & display"     },
  { key: "payment",    icon: "fa-building-columns",   label: "Payment Setup",  desc: "Bank accounts"       },
  { key: "payroll",   icon: "fa-money-check-dollar", label: "Payroll Policy", desc: "Leave & deduction rules" },
];

const TIMEZONES  = ["Asia/Kathmandu", "Asia/Kolkata", "Asia/Dhaka", "UTC"];
const CURRENCIES = [
  { value: "NPR", label: "NPR — Nepalese Rupee (₨)" },
  { value: "INR", label: "INR — Indian Rupee (₹)"   },
  { value: "BDT", label: "BDT — Bangladeshi Taka (৳)" },
];
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ne", label: "Nepali"  },
  { value: "hi", label: "Hindi"   },
];

function Field({ label, required, hint, children, full }: {
  label: string; required?: boolean; hint?: string;
  children: React.ReactNode; full?: boolean;
}) {
  return (
    <div className={cx(s("field"), full ? s("full") : undefined)}>
      <label>
        {label}
        {required && <em> *</em>}
        {hint && <span className={s("field-hint")}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function InfoChip({ icon, label, value, tone = "default" }: {
  icon: string; label: string; value: string;
  tone?: "green" | "amber" | "blue" | "default";
}) {
  return (
    <div className={cx(s("chip"), s(`chip-${tone}`))}>
      <div className={s("chip-icon")}><i className={`fa-solid ${icon}`} /></div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </div>
  );
}

function ToggleRow({ label, desc, on }: { label: string; desc: string; on: boolean }) {
  return (
    <div className={s("toggle-row")}>
      <div><strong>{label}</strong><span>{desc}</span></div>
      <div className={cx(s("toggle"), on ? s("toggle-on") : s("toggle-off"))} />
    </div>
  );
}

export default function AdminSettingsPage() {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector(s => s.auth.user);
  const [tab,      setTab]      = useState<Tab>("general");
  const [showPass, setShowPass] = useState(false);

  const { data: settings, loading, refetch } = useApi<any>("/school/settings");

  const [g, setG] = useState({
    school_name: "", email: "", phone: "", website: "",
    address: "", city: "", state: "", country: "Nepal",
    timezone: "Asia/Kathmandu", currency: "NPR", language: "en",
    calendar_system: "AD" as "AD" | "BS",
  });

  const [pw, setPw] = useState({
    current_password: "", new_password: "", confirm_password: "",
  });

  useEffect(() => {
    if (!settings) return;
    setG({
      school_name:     settings.school_name     ?? "",
      email:           settings.email           ?? "",
      phone:           settings.phone           ?? "",
      website:         settings.website         ?? "",
      address:         settings.address         ?? "",
      city:            settings.city            ?? "",
      state:           settings.state           ?? "",
      country:         settings.country         ?? "Nepal",
      timezone:        settings.timezone        ?? "Asia/Kathmandu",
      currency:        settings.currency        ?? "NPR",
      language:        settings.language        ?? "en",
      calendar_system: (settings.calendar_system ?? "AD") as "AD" | "BS",
    });
  }, [settings]);

  const { execute: saveG,  loading: savingG  } = useMutation("/school/settings",        "PATCH");
  const { execute: savePw, loading: savingPw } = useMutation("/school/change-password", "PATCH");

  const setGField  = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }) =>
    setG(f => ({ ...f, [e.target.name]: e.target.value }));
  const setPwField = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPw(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!g.school_name || !g.email) {
      dispatch(showToast({ type: "error", title: "Required", message: "School name and email are required." }));
      return;
    }
    const res = await saveG(g);
    if (res !== null) {
      dispatch(showToast({ type: "success", title: "Saved", message: "Settings updated successfully." }));
      if (authUser) dispatch(setUser({ ...authUser, calendar_system: g.calendar_system }));
      refetch();
    }
  };

  const handlePw = async () => {
    if (!pw.current_password || !pw.new_password || !pw.confirm_password) {
      dispatch(showToast({ type: "error", title: "Required", message: "All fields are required." })); return;
    }
    if (pw.new_password.length < 6) {
      dispatch(showToast({ type: "error", title: "Too Short", message: "Password must be at least 6 characters." })); return;
    }
    if (pw.new_password !== pw.confirm_password) {
      dispatch(showToast({ type: "error", title: "Mismatch", message: "New passwords do not match." })); return;
    }
    const res = await savePw({ current_password: pw.current_password, new_password: pw.new_password });
    if (res !== null) {
      dispatch(showToast({ type: "success", title: "Done", message: "Password changed successfully." }));
      setPw({ current_password: "", new_password: "", confirm_password: "" });
    }
  };

  const initials      = g.school_name ? g.school_name.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase() : "SC";
  const pwMatch       = pw.new_password && pw.confirm_password && pw.new_password === pw.confirm_password;
  const pwMismatch    = pw.confirm_password && pw.new_password !== pw.confirm_password;
  const pwStrength    = !pw.new_password ? null : pw.new_password.length < 6 ? "Weak" : pw.new_password.length < 10 ? "Fair" : "Strong";
  const pwWidth       = !pw.new_password ? "0%" : pw.new_password.length >= 10 ? "100%" : pw.new_password.length >= 6 ? "60%" : "30%";
  const pwStrengthClass = pwStrength === "Weak" ? s("strength-weak") : pwStrength === "Fair" ? s("strength-fair") : s("strength-strong");

  return (
    <div className={s("page")}>
      <Topbar title="Settings" subtitle="Manage your school account and preferences" />

      <main className={s("content")}>
        {/* Hero */}
        <div className={s("hero")}>
          <div className={s("hero-left")}>
            <div className={s("hero-avatar")}>{initials}</div>
            <div>
              <h1>{g.school_name || "Your School"}</h1>
              <p>{g.email || "Configure your school settings below"}</p>
            </div>
          </div>
          <div className={s("hero-chips")}>
            <InfoChip icon="fa-id-badge"     label="School Code" value={settings?.school_code || "—"}             tone="blue"    />
            <InfoChip icon="fa-circle-check" label="Verified"    value={settings?.is_verified ? "Yes" : "No"}     tone={settings?.is_verified ? "green" : "default"} />
            <InfoChip icon="fa-user-shield"  label="2FA"         value={settings?.two_fa_enabled ? "On" : "Off"}  tone={settings?.two_fa_enabled ? "green" : "amber"} />
            <InfoChip icon="fa-calendar"     label="Calendar"    value={g.calendar_system === "BS" ? "BS (Bikram Sambat)" : "AD (Gregorian)"} tone={g.calendar_system === "BS" ? "green" : "default"} />
          </div>
        </div>

        {/* Tab bar */}
        <div className={s("tabbar")}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cx(s("tabbar-item"), tab === t.key ? s("tabbar-active") : undefined)}
            >
              <div className={s("tabbar-icon")}><i className={`fa-solid ${t.icon}`} /></div>
              <div className={s("tabbar-label")}><strong>{t.label}</strong><span>{t.desc}</span></div>
            </button>
          ))}
        </div>

        {/* Panel */}
        {loading ? (
          <div className={s("loading")}><Spinner size={32} color="#FF9B51" /><p>Loading settings…</p></div>
        ) : (
          <div className={s("panel")}>

            {/* ════ GENERAL ════ */}
            {tab === "general" && (
              <>
                <div className={s("panel-head")}>
                  <div className={s("ph-icon")}><i className="fa-solid fa-sliders" /></div>
                  <div><h2>General Settings</h2><p>Contact information, address and regional preferences</p></div>
                  <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={savingG}>
                    {savingG ? <Spinner size={14} /> : <i className="fa-solid fa-floppy-disk" />} Save Changes
                  </button>
                </div>

                <div className={s("section-group")}>
                  <div className={s("section-label")}><i className="fa-solid fa-address-card" /> Contact Information</div>
                  <div className={s("grid")}>
                    <Field label="School Name" required><input name="school_name" value={g.school_name} onChange={setGField} placeholder="e.g. Sunrise Academy" /></Field>
                    <Field label="Email Address" required><input name="email" type="email" value={g.email} onChange={setGField} placeholder="admin@school.edu.np" /></Field>
                    <Field label="Phone Number"><input name="phone" type="tel" value={g.phone} onChange={setGField} placeholder="98XXXXXXXX" /></Field>
                    <Field label="Website"><input name="website" value={g.website} onChange={setGField} placeholder="https://yourschool.edu.np" /></Field>
                  </div>
                </div>

                <div className={s("section-group")}>
                  <div className={s("section-label")}><i className="fa-solid fa-location-dot" /> Address</div>
                  <div className={s("grid")}>
                    <Field label="Street Address" full><input name="address" value={g.address} onChange={setGField} placeholder="e.g. Baneshwor, Kathmandu" /></Field>
                    <Field label="City"><input name="city" value={g.city} onChange={setGField} placeholder="e.g. Kathmandu" /></Field>
                    <Field label="State / Province"><input name="state" value={g.state} onChange={setGField} placeholder="e.g. Bagmati" /></Field>
                    <Field label="Country"><input name="country" value={g.country} onChange={setGField} placeholder="Nepal" /></Field>
                  </div>
                </div>

                <div className={s("section-group")}>
                  <div className={s("section-label")}><i className="fa-solid fa-earth-asia" /> Regional Preferences</div>
                  <div className={s("grid3")}>
                    <Field label="Timezone">
                      <select name="timezone" value={g.timezone} onChange={setGField}>
                        {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </Field>
                    <Field label="Currency">
                      <select name="currency" value={g.currency} onChange={setGField}>
                        {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Language">
                      <select name="language" value={g.language} onChange={setGField}>
                        {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </Field>
                  </div>

                  {/* Calendar system picker */}
                  <div style={{ marginTop: 16, padding: "16px 18px", borderRadius: 12, border: "1px solid #dce5e9", background: "#f8fafc" }}>
                    <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, color: "#25343f" }}>
                      <i className="fa-solid fa-calendar" style={{ color: "#ff9b51", marginRight: 8 }} />Date Display System
                    </p>
                    <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 600, color: "#6a7882" }}>
                      Choose how dates are shown throughout the app. Dates are always stored in AD — this is display-only.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[
                        { value: "AD", label: "AD — Gregorian",      sub: "January 1, 2024 · Used internationally", flag: "🌐" },
                        { value: "BS", label: "BS — Bikram Sambat",   sub: "1 Baishakh 2081 · Used in Nepal",       flag: "🇳🇵" },
                      ].map(opt => (
                        <div key={opt.value} onClick={() => setG(f => ({ ...f, calendar_system: opt.value as "AD" | "BS" }))}
                          style={{ padding: "14px 16px", borderRadius: 10, cursor: "pointer", border: `2px solid ${g.calendar_system === opt.value ? "#ff9b51" : "#dce5e9"}`, background: g.calendar_system === opt.value ? "#fff7ed" : "#fff", display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s" }}>
                          <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, border: `2px solid ${g.calendar_system === opt.value ? "#ff9b51" : "#c8d6de"}`, background: g.calendar_system === opt.value ? "#ff9b51" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {g.calendar_system === opt.value && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#25343f" }}>{opt.flag} {opt.label}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#6a7882", marginTop: 2 }}>{opt.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {g.calendar_system === "BS" && (
                      <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #bbf7d0", fontSize: 12, fontWeight: 700, color: "#059669" }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
                        All date inputs and displays will switch to Bikram Sambat. Save to apply.
                      </div>
                    )}
                  </div>
                </div>

                <div className={s("panel-footer")}>
                  <button className={cx(s("btn"), s("btn-ghost"))} onClick={() => refetch()}><i className="fa-solid fa-rotate-left" /> Reset</button>
                  <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={savingG}>
                    {savingG ? <Spinner size={14} /> : <i className="fa-solid fa-floppy-disk" />} Save Changes
                  </button>
                </div>
              </>
            )}

            {/* ════ PROFILE ════ */}
            {tab === "profile" && (
              <>
                <div className={s("panel-head")}>
                  <div className={s("ph-icon")}><i className="fa-solid fa-school" /></div>
                  <div><h2>School Profile</h2><p>Public-facing identity and branding details</p></div>
                  <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={savingG}>
                    {savingG ? <Spinner size={14} /> : <i className="fa-solid fa-floppy-disk" />} Save Profile
                  </button>
                </div>
                <div style={{ padding: "24px 28px 0" }}>
                  <div className={s("profile-banner")}>
                    <div className={s("profile-avatar-wrap")}>
                      <div className={s("profile-avatar")}>{initials}</div>
                      <div className={s("profile-avatar-badge")}><i className="fa-solid fa-camera" /></div>
                    </div>
                    <div className={s("profile-banner-info")}>
                      <h3>{g.school_name || "Your School Name"}</h3>
                      <p>{g.email || "—"}{g.phone ? ` · ${g.phone}` : ""}</p>
                      <p style={{ fontSize: 11, color: "#8a9daa", marginTop: 6 }}>Logo upload coming soon</p>
                    </div>
                    <div className={s("profile-banner-stats")}>
                      {[
                        { label: "Code",     value: settings?.school_code || "—" },
                        { label: "Verified", value: settings?.is_verified ? "✓ Yes" : "✗ No" },
                        { label: "Calendar", value: g.calendar_system === "BS" ? "🇳🇵 BS" : "🌐 AD" },
                      ].map(stat => (
                        <div key={stat.label} className={s("pb-stat")}>
                          <span>{stat.label}</span><strong>{stat.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={s("section-group")} style={{ marginTop: 24 }}>
                  <div className={s("section-label")}><i className="fa-solid fa-pen-to-square" /> Edit Identity</div>
                  <div className={s("grid")}>
                    <Field label="School Name" required><input name="school_name" value={g.school_name} onChange={setGField} /></Field>
                    <Field label="Email"><input name="email" type="email" value={g.email} onChange={setGField} /></Field>
                    <Field label="Phone"><input name="phone" value={g.phone} onChange={setGField} /></Field>
                    <Field label="Website"><input name="website" value={g.website} onChange={setGField} /></Field>
                    <Field label="City"><input name="city" value={g.city} onChange={setGField} /></Field>
                    <Field label="Country"><input name="country" value={g.country} onChange={setGField} /></Field>
                  </div>
                </div>
                <div className={s("panel-footer")}>
                  <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={savingG}>
                    {savingG ? <Spinner size={14} /> : <i className="fa-solid fa-floppy-disk" />} Save Profile
                  </button>
                </div>
              </>
            )}

            {/* ════ SECURITY ════ */}
            {tab === "security" && (
              <>
                <div className={s("panel-head")}>
                  <div className={cx(s("ph-icon"), s("ph-icon-red"))}><i className="fa-solid fa-shield-halved" /></div>
                  <div><h2>Security</h2><p>Manage your password and authentication settings</p></div>
                </div>
                <div className={s("section-group")}>
                  <div className={s("section-label")}><i className="fa-solid fa-lock" /> Change Password</div>
                  <div className={s("pw-card")}>
                    <div className={s("pw-strength-row")}>
                      <i className="fa-solid fa-circle-info" />
                      <span>Use at least 6 characters. Mix uppercase, numbers and symbols for a stronger password.</span>
                    </div>
                    <div className={s("pw-fields")}>
                      <div>
                        <Field label="Current Password" required>
                          <div className={s("pw-wrap")}>
                            <input name="current_password" type={showPass ? "text" : "password"} value={pw.current_password} onChange={setPwField} placeholder="Your current password" />
                            <button type="button" onClick={() => setShowPass(v => !v)}><i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`} /></button>
                          </div>
                        </Field>
                      </div>
                      <div>
                        <Field label="New Password" required>
                          <input name="new_password" type={showPass ? "text" : "password"} value={pw.new_password} onChange={setPwField} placeholder="Min. 6 characters" />
                          {pw.new_password && (
                            <>
                              <div className={s("strength-bar")}><div className={cx(s("strength-fill"), pwStrengthClass)} style={{ width: pwWidth }} /></div>
                              <span className={s("strength-label")}>{pwStrength}</span>
                            </>
                          )}
                        </Field>
                      </div>
                      <div>
                        <Field label="Confirm New Password" required>
                          <input name="confirm_password" type={showPass ? "text" : "password"} value={pw.confirm_password} onChange={setPwField} placeholder="Repeat new password" />
                          {pwMismatch && <span className={s("err-msg")}><i className="fa-solid fa-circle-exclamation" /> Passwords do not match</span>}
                          {pwMatch    && <span className={s("ok-msg")}><i className="fa-solid fa-circle-check" /> Passwords match</span>}
                        </Field>
                      </div>
                    </div>
                    <div style={{ padding: "16px 18px" }}>
                      <button className={cx(s("btn"), s("btn-primary"))} onClick={handlePw} disabled={savingPw}>
                        {savingPw ? <Spinner size={14} /> : <i className="fa-solid fa-lock" />} Update Password
                      </button>
                    </div>
                  </div>
                </div>
                <div className={s("section-group")}>
                  <div className={s("section-label")}><i className="fa-solid fa-mobile-screen-button" /> Two-Factor Authentication</div>
                  <div className={s("security-card")}>
                    <div className={cx(s("sc-icon"), s("sc-orange"))}><i className="fa-solid fa-mobile-screen-button" /></div>
                    <div className={s("sc-body")}>
                      <strong>Email OTP Verification</strong>
                      <p>When enabled, a 6-digit OTP is emailed to you on every login.</p>
                    </div>
                    <span className={cx(s("badge"), s(settings?.two_fa_enabled ? "badge-green" : "badge-yellow"))}>
                      {settings?.two_fa_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className={s("info-note")}>
                    <i className="fa-solid fa-circle-info" />
                    <span>2FA is managed by your Super Admin. Contact them to enable or disable it.</span>
                  </div>
                </div>
              </>
            )}

            {/* ════ APPEARANCE ════ */}
            {tab === "appearance" && (
              <>
                <div className={s("panel-head")}>
                  <div className={cx(s("ph-icon"), s("ph-icon-violet"))}><i className="fa-solid fa-palette" /></div>
                  <div><h2>Appearance</h2><p>Customize how your school dashboard looks and feels</p></div>
                </div>
                <div className={s("section-group")}>
                  <div className={s("section-label")}><i className="fa-solid fa-swatchbook" /> Theme</div>
                  <div className={s("theme-grid")}>
                    {[
                      { label: "Default Light", sub: "Clean and minimal",   accent: "#ff9b51", bg: "#fff",    sidebar: "#25343f", active: true  },
                      { label: "Slate Dark",    sub: "Easy on the eyes",    accent: "#ff9b51", bg: "#1e2a35", sidebar: "#151e26", active: false },
                      { label: "Ocean Blue",    sub: "Cool and focused",    accent: "#3b82f6", bg: "#f0f7ff", sidebar: "#1e3a5f", active: false },
                    ].map(theme => (
                      <div key={theme.label} className={cx(s("theme-card"), theme.active ? s("theme-active") : undefined)}>
                        {theme.active && <div className={s("theme-check")}><i className="fa-solid fa-check" /></div>}
                        <div className={s("theme-mockup")} style={{ background: theme.bg }}>
                          <div className={s("tm-sidebar")} style={{ background: theme.sidebar }}>
                            {[1,2,3].map(i => <div key={i} className={s("tm-sitem")} style={{ background: i === 1 ? `${theme.accent}44` : undefined }} />)}
                          </div>
                          <div className={s("tm-body")}>
                            <div className={s("tm-topbar")} style={{ background: theme.bg }} />
                            <div className={s("tm-cards")}>
                              {[1,2,3,4].map(i => (
                                <div key={i} className={s("tm-card")} style={{ background: theme.bg === "#fff" ? "#f4f7f8" : "#ffffff14" }}>
                                  <div style={{ height: 7, width: "60%", background: theme.accent, borderRadius: 3, opacity: 0.8 }} />
                                  <div style={{ height: 4, width: "80%", background: theme.bg === "#fff" ? "#e1e8eb" : "#ffffff30", borderRadius: 3 }} />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className={s("theme-info")}>
                          <div className={s("theme-accent")} style={{ background: theme.accent }} />
                          <div><strong>{theme.label}</strong><span>{theme.sub}</span></div>
                          {theme.active && <span className={cx(s("badge"), s("badge-green"))} style={{ fontSize: 10 }}>Active</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={s("info-note")} style={{ marginTop: 14 }}>
                    <i className="fa-solid fa-circle-info" />
                    <span>Additional themes are coming in a future update.</span>
                  </div>
                </div>
                <div className={s("section-group")}>
                  <div className={s("section-label")}><i className="fa-solid fa-display" /> Display Preferences</div>
                  <div className={s("pref-list")}>
                    <ToggleRow label="Show student photos in tables"  desc="Display admission photos next to student names" on={false} />
                    <ToggleRow label="Compact table rows"             desc="Reduce row padding for denser data viewing"    on={false} />
                    <ToggleRow label="Fee pending alerts on login"    desc="Show a banner when students have overdue fees" on={true}  />
                    <ToggleRow label="Sidebar collapsed by default"   desc="Start with sidebar minimised"                 on={false} />
                  </div>
                  <div className={s("info-note")} style={{ marginTop: 12 }}>
                    <i className="fa-solid fa-circle-info" />
                    <span>Display preference saving is coming soon.</span>
                  </div>
                </div>
              </>
            )}

            {/* ════ PAYMENT ════ */}
            {tab === "payment" && <PaymentSettingsTab />}

            {/* ════ PAYROLL POLICY ════ */}
            {tab === "payroll" && <PayrollPolicyTab />}

          </div>
        )}
      </main>
    </div>
  );
}
