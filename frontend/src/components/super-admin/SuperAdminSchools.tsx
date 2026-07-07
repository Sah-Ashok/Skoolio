"use client";
import { useState } from "react";
import Topbar from "@/components/shared/Topbar";

type SchoolStatus = "active" | "blocked" | "trial";

interface School {
  id: number;
  name: string;
  code: string;
  city: string;
  state: string;
  type: string;
  owner: string;
  email: string;
  phone: string;
  plan: string;
  status: SchoolStatus;
  students: number;
  teachers: number;
  joined: string;
  verified: boolean;
  two_fa_enabled: boolean;
}

const INITIAL_SCHOOLS: School[] = [
  { id: 1, name: "Sunrise Public School",  code: "SUR1042", city: "Birgunj",   state: "Madhesh",  type: "Secondary",        owner: "Rajan Sah",   email: "sunrise@school.np",     phone: "+977-9801234567", plan: "Pro",        status: "active",  students: 620,  teachers: 38, joined: "Jan 2025", verified: true,  two_fa_enabled: true  },
  { id: 2, name: "Himalaya Academy",       code: "HIM2031", city: "Kathmandu", state: "Bagmati",  type: "Higher_Secondary", owner: "Sita Sharma", email: "himalaya@school.np",    phone: "+977-9811234567", plan: "Basic",      status: "active",  students: 310,  teachers: 22, joined: "Mar 2025", verified: true,  two_fa_enabled: false },
  { id: 3, name: "Green Valley School",    code: "GRE3014", city: "Pokhara",   state: "Gandaki",  type: "Primary",          owner: "Hari Thapa",  email: "greenvalley@school.np", phone: "+977-9821234567", plan: "Pro",        status: "blocked", students: 480,  teachers: 30, joined: "Nov 2024", verified: true,  two_fa_enabled: false },
  { id: 4, name: "New Era College",        code: "NEW4025", city: "Lalitpur",  state: "Bagmati",  type: "Higher_Secondary", owner: "Priya Gurung",email: "newera@school.np",      phone: "+977-9831234567", plan: "Enterprise", status: "active",  students: 1200, teachers: 85, joined: "Aug 2024", verified: true,  two_fa_enabled: true  },
  { id: 5, name: "Bright Future School",   code: "BRI5033", city: "Biratnagar",state: "Koshi",    type: "Secondary",        owner: "Mohan KC",    email: "brightfuture@school.np",phone: "+977-9841234567", plan: "Basic",      status: "trial",   students: 90,   teachers: 8,  joined: "Jun 2025", verified: false, two_fa_enabled: false },
  { id: 6, name: "Knowledge Hub",          code: "KNO6011", city: "Dharan",    state: "Koshi",    type: "Primary",          owner: "Nita Rai",    email: "knowledgehub@school.np",phone: "+977-9851234567", plan: "Basic",      status: "active",  students: 240,  teachers: 16, joined: "Feb 2025", verified: true,  two_fa_enabled: false },
];

/* ── tiny toggle component ── */
function TwoFAToggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      title={value ? "Disable 2FA for this school" : "Enable 2FA for this school"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 999,
        border: "none", cursor: "pointer", fontFamily: "inherit",
        fontSize: 11.5, fontWeight: 800,
        background: value ? "#dcfce7" : "#f1f5f9",
        color: value ? "#15803d" : "#64748b",
        transition: "all 0.15s",
      }}
    >
      {/* pill track */}
      <span style={{
        width: 30, height: 16, borderRadius: 999, flexShrink: 0,
        background: value ? "#16a34a" : "#cbd5e1",
        position: "relative", transition: "background 0.2s",
        display: "inline-block",
      }}>
        <span style={{
          position: "absolute", top: 2, left: value ? 14 : 2,
          width: 12, height: 12, borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 0.2s",
          display: "block",
        }} />
      </span>
      {value ? "2FA On" : "2FA Off"}
    </button>
  );
}

export default function SuperAdminSchools() {
  const [schools, setSchools]     = useState<School[]>(INITIAL_SCHOOLS);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("all");

  const toggle2FA = (id: number) =>
    setSchools(prev => prev.map(s => s.id === id ? { ...s, two_fa_enabled: !s.two_fa_enabled } : s));

  const toggleBlock = (id: number) =>
    setSchools(prev => prev.map(s =>
      s.id === id ? { ...s, status: (s.status === "blocked" ? "active" : "blocked") as SchoolStatus } : s
    ));

  const filtered = schools.filter(s => {
    const q = search.toLowerCase();
    return (s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q))
      && (statusFilter === "all" || s.status === statusFilter);
  });

  const statusStyle = (st: string) => ({
    active:  { bg: "#dcfce7", color: "#16a34a" },
    blocked: { bg: "#fee2e2", color: "#dc2626" },
    trial:   { bg: "#fef9c3", color: "#ca8a04" },
  }[st] || { bg: "#e0e7ff", color: "#4338ca" });

  const planColor = (p: string) => ({ Basic: "#3b82f6", Pro: "#6366f1", Enterprise: "#8b5cf6" }[p] || "#6366f1");

  const COLS = ["School", "Code", "Location", "Type", "Plan", "Students", "Teachers", "2FA", "Status", "Actions"];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f8faff" }}>
      <Topbar title="Schools" subtitle="Manage all registered schools on the platform" />

      <main style={{ flex: 1, padding: "2rem 2.5rem", display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1480, margin: "0 auto", width: "100%" }}>

        {/* Summary cards */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
          {[
            { label: "Total Schools", value: schools.length,                               icon: "fa-building-columns", color: "#6366f1", bg: "#eef2ff" },
            { label: "Active",        value: schools.filter(s => s.status === "active").length,  icon: "fa-circle-check",    color: "#16a34a", bg: "#dcfce7" },
            { label: "Blocked",       value: schools.filter(s => s.status === "blocked").length, icon: "fa-ban",             color: "#dc2626", bg: "#fee2e2" },
            { label: "2FA Enabled",   value: schools.filter(s => s.two_fa_enabled).length,      icon: "fa-shield-halved",   color: "#0284c7", bg: "#e0f2fe" },
          ].map(c => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 14, padding: "1.2rem 1.4rem", border: "1px solid #e8eaf0", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: c.bg, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                <i className={`fa-solid ${c.icon}`} />
              </div>
              <div>
                <p style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>{c.label}</p>
                <h3 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{c.value}</h3>
              </div>
            </div>
          ))}
        </section>

        {/* Toolbar */}
        <div style={{ background: "#fff", borderRadius: 12, padding: "0.9rem 1.25rem", border: "1px solid #e8eaf0", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "#f8fafc", borderRadius: 8, padding: "0.6rem 1rem", border: "1px solid #e2e8f0" }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 13 }} />
            <input
              type="search"
              placeholder="Search by school name or city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 13.5, color: "#1e293b", width: "100%", fontFamily: "inherit" }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatus(e.target.value)}
            style={{ padding: "0.6rem 1rem", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#1e293b", background: "#fff", outline: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="trial">Trial</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8eaf0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "1.1rem 1.5rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
              Showing <span style={{ color: "#6366f1" }}>{filtered.length}</span> of {schools.length} schools
            </p>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", background: "#f1f5f9", padding: "4px 10px", borderRadius: 6 }}>
              <i className="fa-solid fa-shield-halved" style={{ marginRight: 5, color: "#0284c7" }} />
              {schools.filter(s => s.two_fa_enabled).length} schools have 2FA enabled
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {COLS.map(h => (
                    <th key={h} style={{ padding: "11px 16px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #e8eaf0", whiteSpace: "nowrap" }}>
                      {h === "2FA" ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <i className="fa-solid fa-shield-halved" style={{ color: "#0284c7" }} /> 2FA
                        </span>
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(sc => {
                  const sb = statusStyle(sc.status);
                  return (
                    <tr key={sc.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                      {/* School */}
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#eef2ff,#e0e7ff)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                            {sc.name.charAt(0)}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{sc.name}</p>
                            <p style={{ fontSize: 11, color: "#94a3b8" }}>{sc.email}</p>
                          </div>
                        </div>
                      </td>
                      {/* Code */}
                      <td style={{ padding: "13px 16px", color: "#64748b", fontFamily: "monospace", fontSize: 12 }}>{sc.code}</td>
                      {/* Location */}
                      <td style={{ padding: "13px 16px", color: "#475569" }}>{sc.city}, {sc.state}</td>
                      {/* Type */}
                      <td style={{ padding: "13px 16px", color: "#64748b", fontSize: 12 }}>{sc.type.replace("_", " ")}</td>
                      {/* Plan */}
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: "#eef2ff", color: planColor(sc.plan) }}>{sc.plan}</span>
                      </td>
                      {/* Students */}
                      <td style={{ padding: "13px 16px", color: "#475569", fontWeight: 600 }}>{sc.students.toLocaleString()}</td>
                      {/* Teachers */}
                      <td style={{ padding: "13px 16px", color: "#475569", fontWeight: 600 }}>{sc.teachers}</td>
                      {/* 2FA toggle */}
                      <td style={{ padding: "13px 16px" }}>
                        <TwoFAToggle value={sc.two_fa_enabled} onChange={() => toggle2FA(sc.id)} />
                      </td>
                      {/* Status */}
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: sb.bg, color: sb.color, textTransform: "capitalize" }}>{sc.status}</span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e0e7ff", background: "#eef2ff", color: "#6366f1", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>View</button>
                          {sc.status === "blocked"
                            ? <button onClick={() => toggleBlock(sc.id)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #dcfce7", background: "#dcfce7", color: "#16a34a", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Unblock</button>
                            : <button onClick={() => toggleBlock(sc.id)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #fee2e2", background: "#fee2e2", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Block</button>
                          }
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
