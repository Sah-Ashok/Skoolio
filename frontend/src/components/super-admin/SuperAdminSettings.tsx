"use client";
import { useState, useEffect } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi, useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

export default function SuperAdminSettings() {
  const { data: settings, loading } = useApi<any>('/platform');
  const { execute: saveSettings, loading: saving } = useMutation('/platform', 'PATCH');

  const [platformName, setPlatformName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (settings) {
      setPlatformName(settings.platform_name);
      setSupportEmail(settings.support_email);
      setMaintenanceMode(settings.maintenance_mode);
    }
  }, [settings]);

  const handleSave = async () => {
    setError("");
    try {
      await saveSettings({
        platform_name: platformName,
        support_email: supportEmail,
        maintenance_mode: maintenanceMode,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    }
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange} style={{
      width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
      background: value ? "#6366f1" : "#cbd5e1", position: "relative", transition: "background 0.2s",
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }} />
    </button>
  );

  const Section = ({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) => (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8eaf0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{title}</h2>
        <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 3 }}>{desc}</p>
      </div>
      <div style={{ padding: "1.5rem" }}>{children}</div>
    </div>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );

  const inputStyle = {
    padding: "9px 13px", border: "1px solid #e2e8f0", borderRadius: 8,
    fontSize: 13.5, color: "#0f172a", background: "#fff", outline: "none",
    fontFamily: "inherit",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f8faff" }}>
        <Topbar title="Settings" subtitle="Platform-wide configuration and preferences" />
        <div style={{ padding: '4rem', textAlign: 'center' }}><Spinner size={32} color="#6366f1" /></div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f8faff" }}>
      <Topbar title="Settings" subtitle="Platform-wide configuration and preferences" />

      <main style={{ flex: 1, padding: "2rem 2.5rem", display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 900, margin: "0 auto", width: "100%" }}>

        {saved && (
          <div style={{ padding: "12px 18px", borderRadius: 10, background: "#dcfce7", border: "1px solid #bbf7d0", color: "#16a34a", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 10 }}>
            <i className="fa-solid fa-circle-check" /> Settings saved successfully.
          </div>
        )}
        {error && (
          <div style={{ padding: "12px 18px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontWeight: 700, fontSize: 13.5 }}>
            {error}
          </div>
        )}

        <Section title="General" desc="Basic platform identity settings">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <Field label="Platform Name">
              <input value={platformName} onChange={e => setPlatformName(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Support Email">
              <input value={supportEmail} onChange={e => setSupportEmail(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </Section>

        <Section title="System" desc="Platform availability and maintenance">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0" }}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>Maintenance Mode</p>
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>When enabled, only super admins can log in to the platform</p>
            </div>
            <Toggle value={maintenanceMode} onChange={() => setMaintenanceMode(v => !v)} />
          </div>
          {maintenanceMode && (
            <div style={{ marginTop: "1rem", padding: "12px 14px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", color: "#c2410c", fontSize: 13, fontWeight: 600 }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} />
              Maintenance mode is ON \u2014 admins, faculty, and students cannot log in until this is disabled and saved.
            </div>
          )}
        </Section>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "10px 28px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff",
            fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer",
            boxShadow: "0 4px 14px rgba(99,102,241,0.35)", opacity: saving ? 0.7 : 1,
          }}>
            {saving ? <Spinner size={16} /> : <><i className="fa-solid fa-floppy-disk" style={{ marginRight: 8 }} />Save Changes</>}
          </button>
        </div>

      </main>
    </div>
  );
}
