"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";

/* ── tiny CSS-in-JS helpers ── */
const col = {
  navy:     "#25343F",
  orange:   "#FF9B51",
  bg:       "#f8faff",
  card:     "#ffffff",
  border:   "#e2e8ef",
  muted:    "#64748b",
  green:    "#16a34a",
  greenBg:  "#dcfce7",
  red:      "#dc2626",
  redBg:    "#fee2e2",
  blue:     "#0284c7",
  blueBg:   "#e0f2fe",
  purple:   "#7c3aed",
  purpleBg: "#ede9fe",
  yellow:   "#d97706",
  yellowBg: "#fef3c7",
};

type Tab = "overview" | "hostels" | "rooms" | "assignments";
type HostelType = "boys" | "girls" | "mixed";
type RoomType = "ac" | "non_ac" | "dormitory";

/* ── status badge ── */
function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11.5, fontWeight: 800, color, background: bg, textTransform: "capitalize" as const, display: "inline-block" }}>
      {text.replace("_", " ")}
    </span>
  );
}

const hostelTypeBadge = (t: HostelType) => {
  const m: Record<HostelType, [string, string]> = {
    boys:  [col.blue,   col.blueBg  ],
    girls: [col.purple, col.purpleBg],
    mixed: [col.orange, "#fff7ed"   ],
  };
  return <Badge text={t} color={m[t]?.[0] ?? col.muted} bg={m[t]?.[1] ?? col.bg} />;
};

const roomTypeBadge = (t: RoomType) => {
  const m: Record<RoomType, [string, string]> = {
    ac:         [col.blue,   col.blueBg  ],
    non_ac:     [col.muted,  "#f1f5f9"   ],
    dormitory:  [col.purple, col.purpleBg],
  };
  return <Badge text={t} color={m[t]?.[0] ?? col.muted} bg={m[t]?.[1] ?? col.bg} />;
};

const statusBadge = (s: string) => {
  const m: Record<string, [string, string]> = {
    active:      [col.green,  col.greenBg  ],
    available:   [col.green,  col.greenBg  ],
    full:        [col.red,    col.redBg    ],
    maintenance: [col.yellow, col.yellowBg ],
    inactive:    [col.muted,  "#f1f5f9"   ],
    left:        [col.red,    col.redBg    ],
    transferred: [col.yellow, col.yellowBg ],
  };
  return <Badge text={s} color={m[s]?.[0] ?? col.muted} bg={m[s]?.[1] ?? col.bg} />;
};

/* ── Modal wrapper ── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}>
      <div style={{ background: col.card, borderRadius: 18, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${col.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, color: col.navy, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: col.muted }}>✕</button>
        </div>
        <div style={{ padding: "20px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

/* ── FormField ── */
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: col.navy, marginBottom: 6 }}>
        {label} {required && <span style={{ color: col.red }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", minHeight: 40, padding: "8px 12px",
  border: `1.5px solid ${col.border}`, borderRadius: 9, background: "#fafcfd",
  color: col.navy, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", outline: "none",
};

const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

/* ── Stat card ── */
function StatCard({ icon, label, value, color, bg }: { icon: string; label: string; value: any; color: string; bg: string }) {
  return (
    <div style={{ background: col.card, borderRadius: 14, padding: "1.2rem 1.4rem", border: `1px solid ${col.border}`, display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ width: 44, height: 44, borderRadius: 11, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div>
        <p style={{ fontSize: 11.5, color: col.muted, fontWeight: 600, margin: 0 }}>{label}</p>
        <h3 style={{ fontSize: 24, fontWeight: 900, color: col.navy, margin: 0 }}>{value ?? "—"}</h3>
      </div>
    </div>
  );
}

/* ── Tab button ── */
function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 18px", border: "none", borderRadius: 10, fontFamily: "inherit",
      fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
      background: active ? col.orange : "transparent",
      color: active ? "#fff" : col.muted,
      boxShadow: active ? "0 2px 8px rgba(255,155,81,0.3)" : "none",
      transition: "all 0.15s",
    }}>
      <i className={`fa-solid ${icon}`} />
      {label}
    </button>
  );
}

/* ── Primary button ── */
function Btn({ onClick, icon, label, variant = "primary", disabled, loading }: { onClick?: () => void; icon?: string; label: string; variant?: "primary" | "outline" | "danger" | "soft"; disabled?: boolean; loading?: boolean }) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: col.orange, color: "#fff", border: "none", boxShadow: "0 2px 8px rgba(255,155,81,0.25)" },
    outline: { background: "transparent", color: col.navy, border: `1.5px solid ${col.border}` },
    danger:  { background: col.redBg, color: col.red, border: `1px solid ${col.red}` },
    soft:    { background: col.blueBg, color: col.blue, border: "none" },
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{ ...styles[variant], padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, opacity: disabled ? 0.55 : 1, transition: "all 0.15s" }}>
      {loading ? <Spinner size={14} /> : icon ? <i className={`fa-solid ${icon}`} /> : null}
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export default function HostelPage() {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: summary,  refetch: refetchSummary } = useApi<any>("/hostel/summary");
  
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);

  const { data: hostels,  loading: hLoading, refetch: refetchHostels } = useApi<any[]>("/hostel");
  const { data: students } = useApi<any[]>(activeYear?.id ? `/students/enrollments?academic_year_id=${activeYear.id}` : "", [activeYear?.id]);

  /* ── Hostel form ── */
  const [showHForm, setShowHForm] = useState(false);
  const [editHId, setEditHId] = useState<number | null>(null);
  const [hSaving, setHSaving] = useState(false);
  const [confirmHId, setConfirmHId] = useState<number | null>(null);
  const [hForm, setHForm] = useState({ name: "", hostel_type: "boys", total_capacity: "", warden_name: "", warden_phone: "", warden_email: "", address: "", status: "active" });

  /* ── Room state ── */
  const [selectedHostelId, setSelectedHostelId] = useState<number | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [showRForm, setShowRForm] = useState(false);
  const [editRId, setEditRId] = useState<number | null>(null);
  const [rSaving, setRSaving] = useState(false);
  const [confirmRId, setConfirmRId] = useState<number | null>(null);
  const [rForm, setRForm] = useState({ hostel_id: "", room_number: "", floor: "1", room_type: "non_ac", capacity: "2", monthly_fee: "", status: "available", notes: "" });

  /* ── Student search for assignment form ── */
  const [studentSearch, setStudentSearch] = useState("");
  const [showStudentDrop, setShowStudentDrop] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const filteredStudents = (students || []).filter((s: any) => {
    const q = studentSearch.toLowerCase();
    return (
      (s.full_name || "").toLowerCase().includes(q) ||
      (s.admission_number || "").toLowerCase().includes(q)
    );
  }).slice(0, 50); // cap at 50 for performance

  const selectStudent = (s: any) => {
    setSelectedStudent(s);
    setStudentSearch(`${s.full_name} — ${s.admission_number}`);
    setAForm(f => ({ ...f, student_id: String(s.student_id || s.id) }));
    setShowStudentDrop(false);
  };

  /* ── Assignment form ── */
  const [showAForm, setShowAForm] = useState(false);
  const [aSaving, setASaving] = useState(false);
  const [aForm, setAForm] = useState({ student_id: "", hostel_id: "", room_id: "", joining_date: new Date().toISOString().split("T")[0], notes: "" });
  const [aRooms, setARooms] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [viewHostelAssignId, setViewHostelAssignId] = useState<number | null>(null);

  /* ── Load rooms for a hostel ── */
  const loadRooms = useCallback(async (hostelId: number) => {
    setRoomsLoading(true);
    try {
      const res = await apiRequest<{ data: any[] }>(`/hostel/${hostelId}/rooms`);
      setRooms(res.data || []);
    } catch { setRooms([]); }
    finally { setRoomsLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedHostelId) loadRooms(selectedHostelId);
  }, [selectedHostelId, loadRooms]);

  useEffect(() => {
    if (tab === "rooms" && !selectedHostelId && hostels?.length) setSelectedHostelId(hostels[0].id);
  }, [tab, hostels, selectedHostelId]);

  /* ── Load rooms when hostel changes in assignment form ── */
  useEffect(() => {
    if (!aForm.hostel_id) { setARooms([]); return; }
    apiRequest<{ data: any[] }>(`/hostel/${aForm.hostel_id}/rooms`)
      .then(r => setARooms((r.data || []).filter((rm: any) => rm.status !== "full")))
      .catch(() => setARooms([]));
  }, [aForm.hostel_id]);

  /* ── Load assignments for hostel ── */
  const loadAssignments = useCallback(async (hostelId: number) => {
    setAssignmentsLoading(true);
    try {
      const res = await apiRequest<{ data: any[] }>(`/hostel/${hostelId}/students`);
      setAssignments(res.data || []);
    } catch { setAssignments([]); }
    finally { setAssignmentsLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "assignments" && viewHostelAssignId) loadAssignments(viewHostelAssignId);
  }, [tab, viewHostelAssignId, loadAssignments]);

  useEffect(() => {
    if (tab === "assignments" && !viewHostelAssignId && hostels?.length) setViewHostelAssignId(hostels[0].id);
  }, [tab, hostels, viewHostelAssignId]);

  const hf = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setHForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const rf = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setRForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const af = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setAForm(f => ({ ...f, [e.target.name]: e.target.value }));

  // ── GENERATE BILLS ──
  const generateBills = async () => {
    if (!activeYear?.id) return;
    if (!billingMonth) {
      dispatch(showToast({ type:"error", title:"Missing", message:"Please select a billing month." }));
      return;
    }
    setGenerating(true);
    try {
      const res = await apiRequest<{data:any}>("/fees/hostel/generate", {
        method: "POST",
        body: JSON.stringify({ academic_year_id: activeYear.id, billing_month: billingMonth })
      });
      dispatch(showToast({ type:"success", title:"Success", message:`${res.data.created} bills generated.` }));
      refetchSummary();
    } catch (e:any) {
      dispatch(showToast({ type:"error", title:"Failed", message: e.message }));
    } finally {
      setGenerating(false);
    }
  };

  /* ── HOSTEL CRUD ── */
  const openAddHostel = () => { setEditHId(null); setHForm({ name:"",hostel_type:"boys",total_capacity:"",warden_name:"",warden_phone:"",warden_email:"",address:"",status:"active" }); setShowHForm(true); };
  const openEditHostel = (h: any) => { setEditHId(h.id); setHForm({ name:h.name,hostel_type:h.hostel_type,total_capacity:String(h.total_capacity),warden_name:h.warden_name||"",warden_phone:h.warden_phone||"",warden_email:h.warden_email||"",address:h.address||"",status:h.status }); setShowHForm(true); };

  const saveHostel = async () => {
    if (!hForm.name || !hForm.total_capacity) { dispatch(showToast({ type:"error", title:"Missing", message:"Name and capacity are required." })); return; }
    setHSaving(true);
    try {
      const payload = { ...hForm, total_capacity: Number(hForm.total_capacity) };
      if (editHId) await apiRequest(`/hostel/${editHId}`, { method:"PATCH", body:JSON.stringify(payload) });
      else await apiRequest("/hostel", { method:"POST", body:JSON.stringify(payload) });
      dispatch(showToast({ type:"success", title:"Saved", message:`Hostel ${editHId?"updated":"created"} successfully.` }));
      setShowHForm(false); refetchHostels(); refetchSummary();
    } catch (e: any) { dispatch(showToast({ type:"error", title:"Error", message:e.message })); }
    finally { setHSaving(false); }
  };

  const deleteHostel = async (id: number) => {
    try { await apiRequest(`/hostel/${id}`, { method:"DELETE" }); dispatch(showToast({ type:"success", title:"Deleted", message:"Hostel removed." })); setConfirmHId(null); refetchHostels(); refetchSummary(); }
    catch (e: any) { dispatch(showToast({ type:"error", title:"Error", message:e.message })); }
  };

  /* ── ROOM CRUD ── */
  const openAddRoom = () => { setEditRId(null); setRForm({ hostel_id: String(selectedHostelId||""), room_number:"", floor:"1", room_type:"non_ac", capacity:"2", monthly_fee:"", status:"available", notes:"" }); setShowRForm(true); };
  const openEditRoom = (r: any) => { setEditRId(r.id); setRForm({ hostel_id:String(r.hostel_id), room_number:r.room_number, floor:String(r.floor), room_type:r.room_type, capacity:String(r.capacity), monthly_fee:String(r.monthly_fee), status:r.status, notes:r.notes||"" }); setShowRForm(true); };

  const saveRoom = async () => {
    if (!rForm.room_number || !rForm.monthly_fee) { dispatch(showToast({ type:"error", title:"Missing", message:"Room number and monthly fee are required." })); return; }
    setRSaving(true);
    try {
      const payload = { ...rForm, hostel_id:Number(rForm.hostel_id||selectedHostelId), floor:Number(rForm.floor), capacity:Number(rForm.capacity), monthly_fee:Number(rForm.monthly_fee) };
      if (editRId) await apiRequest(`/hostel/rooms/${editRId}`, { method:"PATCH", body:JSON.stringify(payload) });
      else await apiRequest("/hostel/rooms", { method:"POST", body:JSON.stringify(payload) });
      dispatch(showToast({ type:"success", title:"Saved", message:`Room ${editRId?"updated":"added"} successfully.` }));
      setShowRForm(false); if (selectedHostelId) loadRooms(selectedHostelId); refetchSummary();
    } catch (e: any) { dispatch(showToast({ type:"error", title:"Error", message:e.message })); }
    finally { setRSaving(false); }
  };

  const deleteRoom = async (id: number) => {
    try { await apiRequest(`/hostel/rooms/${id}`, { method:"DELETE" }); dispatch(showToast({ type:"success", title:"Deleted", message:"Room removed." })); setConfirmRId(null); if (selectedHostelId) loadRooms(selectedHostelId); refetchSummary(); }
    catch (e: any) { dispatch(showToast({ type:"error", title:"Error", message:e.message })); }
  };

  /* ── ASSIGNMENT ── */
  const saveAssignment = async () => {
    if (!aForm.student_id || !aForm.hostel_id || !aForm.room_id || !activeYear?.id) { dispatch(showToast({ type:"error", title:"Missing", message:"Student, hostel, and room are required." })); return; }
    setASaving(true);
    try {
      await apiRequest("/hostel/assignments", { method:"POST", body:JSON.stringify({ ...aForm, student_id:Number(aForm.student_id), hostel_id:Number(aForm.hostel_id), room_id:Number(aForm.room_id), academic_year_id:activeYear.id }) });
      dispatch(showToast({ type:"success", title:"Assigned", message:"Student assigned to hostel room." }));
      setShowAForm(false); if (viewHostelAssignId) loadAssignments(viewHostelAssignId); if (selectedHostelId) loadRooms(selectedHostelId); refetchSummary();
    } catch (e: any) { dispatch(showToast({ type:"error", title:"Error", message:e.message })); }
    finally { setASaving(false); }
  };

  const vacateAssignment = async (id: number) => {
    try { await apiRequest(`/hostel/assignments/${id}`, { method:"PATCH", body:JSON.stringify({ status:"left", leaving_date: new Date().toISOString().split("T")[0] }) }); dispatch(showToast({ type:"success", title:"Done", message:"Student marked as left." })); if (viewHostelAssignId) loadAssignments(viewHostelAssignId); refetchSummary(); }
    catch (e: any) { dispatch(showToast({ type:"error", title:"Error", message:e.message })); }
  };

  const occupancyPct = (hostel: any) => {
    const beds = Number(hostel.total_bed_capacity || hostel.total_capacity || 1);
    const occ  = Number(hostel.occupied_beds || 0);
    return Math.min(100, Math.round((occ / beds) * 100));
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", background:col.bg }}>
      <Topbar title="Hostel" subtitle="Manage hostels, rooms, and student accommodation" />

      <main style={{ flex:1, padding:"1.5rem 2rem", display:"flex", flexDirection:"column", gap:"1.5rem" }}>

        {/* ── Summary Cards ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem" }}>
          <StatCard icon="fa-building"    label="Active Hostels"   value={summary?.active_hostels   ?? 0} color={col.blue}   bg={col.blueBg}   />
          <StatCard icon="fa-door-open"   label="Total Rooms"      value={summary?.total_rooms       ?? 0} color={col.purple} bg={col.purpleBg} />
          <StatCard icon="fa-bed"         label="Total Beds"        value={summary?.total_beds        ?? 0} color={col.orange} bg="#fff7ed"       />
          <StatCard icon="fa-user-check"  label="Occupied Beds"     value={summary?.occupied_beds     ?? 0} color={col.green}  bg={col.greenBg}  />
        </div>

        {/* ── Tab bar ── */}
        <div style={{ display:"flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display:"flex", gap:8, padding:"8px 12px", background:col.card, borderRadius:14, border:`1px solid ${col.border}`, width:"fit-content" }}>
            <TabBtn active={tab==="overview"}     onClick={()=>setTab("overview")}     icon="fa-gauge-high"    label="Overview"     />
            <TabBtn active={tab==="hostels"}      onClick={()=>setTab("hostels")}      icon="fa-building"      label="Hostels"      />
            <TabBtn active={tab==="rooms"}        onClick={()=>setTab("rooms")}        icon="fa-door-open"     label="Rooms"        />
            <TabBtn active={tab==="assignments"}  onClick={()=>setTab("assignments")}  icon="fa-user-check"    label="Assignments"  />
          </div>
          {tab === "overview" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input 
                type="month" 
                value={billingMonth} 
                onChange={e => setBillingMonth(e.target.value)} 
                style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${col.border}`, fontSize: 13, fontWeight: 700 }}
              />
              <Btn onClick={generateBills} loading={generating} icon="fa-file-invoice-dollar" label={generating ? "Generating..." : "Generate Bills"} />
            </div>
          )}
        </div>

        {/* ════════════ OVERVIEW ════════════ */}
        {tab === "overview" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:"1.25rem" }}>
            {hLoading ? <Spinner size={32} color={col.orange} /> : (hostels || []).map((h: any) => {
              const pct = occupancyPct(h);
              const pctColor = pct >= 90 ? col.red : pct >= 70 ? col.yellow : col.green;
              return (
                <div key={h.id} style={{ background:col.card, borderRadius:16, border:`1px solid ${col.border}`, padding:"20px 22px", boxShadow:"0 2px 8px rgba(37,52,63,0.05)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                      <div style={{ width:44, height:44, borderRadius:12, background:h.hostel_type==="boys"?col.blueBg:h.hostel_type==="girls"?col.purpleBg:"#fff7ed", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                        <i className={`fa-solid ${h.hostel_type==="boys"?"fa-mars":h.hostel_type==="girls"?"fa-venus":"fa-venus-mars"}`} style={{ color:h.hostel_type==="boys"?col.blue:h.hostel_type==="girls"?col.purple:col.orange }} />
                      </div>
                      <div>
                        <p style={{ fontWeight:900, fontSize:15, color:col.navy, margin:0 }}>{h.name}</p>
                        <div style={{ marginTop:4, display:"flex", gap:6 }}>
                          {hostelTypeBadge(h.hostel_type)}
                          {statusBadge(h.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Occupancy bar */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ fontSize:11.5, fontWeight:700, color:col.muted }}>Occupancy</span>
                      <strong style={{ fontSize:13, fontWeight:900, color:pctColor }}>{pct}%</strong>
                    </div>
                    <div style={{ height:6, borderRadius:999, background:"#e1e8eb" }}>
                      <div style={{ height:"100%", width:`${pct}%`, borderRadius:999, background:pctColor, transition:"width 0.4s" }} />
                    </div>
                    <div style={{ display:"flex", gap:16, marginTop:6 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:col.muted }}><i className="fa-solid fa-bed" style={{ marginRight:4, color:col.blue }} />{h.occupied_beds || 0} occupied</span>
                      <span style={{ fontSize:11, fontWeight:700, color:col.muted }}><i className="fa-solid fa-door-open" style={{ marginRight:4, color:col.green }} />{h.total_rooms || 0} rooms</span>
                      <span style={{ fontSize:11, fontWeight:700, color:col.muted }}><i className="fa-solid fa-layer-group" style={{ marginRight:4, color:col.purple }} />{h.total_bed_capacity || h.total_capacity} beds</span>
                    </div>
                  </div>
                  {h.warden_name && (
                    <div style={{ padding:"10px 12px", borderRadius:9, background:"#f8fafc", border:`1px solid ${col.border}`, fontSize:12.5, color:col.muted, fontWeight:700 }}>
                      <i className="fa-solid fa-user-shield" style={{ marginRight:6, color:col.orange }} />
                      Warden: <strong style={{ color:col.navy }}>{h.warden_name}</strong>
                      {h.warden_phone && <span style={{ marginLeft:10 }}><i className="fa-solid fa-phone" style={{ marginRight:4 }} />{h.warden_phone}</span>}
                    </div>
                  )}
                  <div style={{ marginTop:12, display:"flex", gap:8 }}>
                    <Btn variant="soft" icon="fa-door-open" label="View Rooms" onClick={() => { setSelectedHostelId(h.id); setTab("rooms"); }} />
                    <Btn variant="outline" icon="fa-users" label="Students" onClick={() => { setViewHostelAssignId(h.id); setTab("assignments"); }} />
                  </div>
                </div>
              );
            })}
            {!hLoading && !(hostels?.length) && (
              <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"3rem", color:col.muted }}>
                <i className="fa-solid fa-building" style={{ fontSize:40, marginBottom:12, display:"block" }} />
                <p style={{ fontWeight:700, fontSize:15 }}>No hostels yet. Add your first hostel!</p>
                <div style={{ marginTop:12 }}>
                  <Btn icon="fa-plus" label="Add Hostel" onClick={() => { openAddHostel(); setTab("hostels"); }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════ HOSTELS TAB ════════════ */}
        {tab === "hostels" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h2 style={{ margin:0, fontSize:16, fontWeight:900, color:col.navy }}>All Hostels <span style={{ color:col.muted, fontWeight:600, fontSize:13 }}>({hostels?.length || 0})</span></h2>
              <Btn icon="fa-plus" label="Add Hostel" onClick={openAddHostel} />
            </div>
            <div style={{ background:col.card, borderRadius:14, border:`1px solid ${col.border}`, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13.5 }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {["Hostel Name","Type","Capacity","Rooms","Occupied","Warden","Status","Actions"].map(h => (
                      <th key={h} style={{ padding:"11px 14px", textAlign:"left", color:col.muted, fontWeight:700, fontSize:11, textTransform:"uppercase" as const, letterSpacing:"0.4px", borderBottom:`1px solid ${col.border}`, whiteSpace:"nowrap" as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hLoading ? (
                    <tr><td colSpan={8} style={{ textAlign:"center", padding:"3rem" }}><Spinner size={28} /></td></tr>
                  ) : (hostels || []).map((h: any) => (
                    <tr key={h.id} style={{ borderBottom:`1px solid #f8fafc` }}>
                      <td style={{ padding:"12px 14px" }}>
                        <div>
                          <p style={{ fontWeight:800, color:col.navy, margin:0 }}>{h.name}</p>
                          {h.address && <p style={{ fontSize:11, color:col.muted, margin:"2px 0 0" }}>{h.address}</p>}
                        </div>
                      </td>
                      <td style={{ padding:"12px 14px" }}>{hostelTypeBadge(h.hostel_type)}</td>
                      <td style={{ padding:"12px 14px", fontWeight:700 }}>{h.total_capacity}</td>
                      <td style={{ padding:"12px 14px", fontWeight:700 }}>{h.total_rooms || 0}</td>
                      <td style={{ padding:"12px 14px" }}>
                        <span style={{ fontWeight:800, color:Number(h.occupied_beds)>0?col.green:col.muted }}>{h.occupied_beds || 0}</span>
                        <span style={{ color:col.muted, fontSize:12 }}> / {h.total_bed_capacity || h.total_capacity}</span>
                      </td>
                      <td style={{ padding:"12px 14px", color:col.muted, fontSize:12.5 }}>{h.warden_name || "—"}</td>
                      <td style={{ padding:"12px 14px" }}>{statusBadge(h.status)}</td>
                      <td style={{ padding:"12px 14px" }}>
                        <div style={{ display:"flex", gap:6 }}>
                          <Btn variant="soft"    icon="fa-pen" label="Edit"   onClick={() => openEditHostel(h)} />
                          <Btn variant="danger"  icon="fa-trash" label="Del" onClick={() => setConfirmHId(h.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!hLoading && !hostels?.length && (
                    <tr><td colSpan={8} style={{ textAlign:"center", padding:"2rem", color:col.muted, fontWeight:700 }}>No hostels found. Click "Add Hostel" to begin.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════ ROOMS TAB ════════════ */}
        {tab === "rooms" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap" as const, gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <h2 style={{ margin:0, fontSize:16, fontWeight:900, color:col.navy }}>Rooms</h2>
                <select value={selectedHostelId || ""} onChange={e => setSelectedHostelId(Number(e.target.value))} style={{ ...inputStyle, width:"auto", minHeight:36 }}>
                  <option value="">— Select Hostel —</option>
                  {(hostels || []).map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <Btn icon="fa-plus" label="Add Room" onClick={openAddRoom} disabled={!selectedHostelId} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"1rem" }}>
              {roomsLoading ? <Spinner size={28} color={col.orange} /> :
                rooms.map((r: any) => {
                  const occ = Number(r.occupied_count || 0);
                  const cap = Number(r.capacity || 1);
                  const isFull = occ >= cap;
                  return (
                    <div key={r.id} style={{ background:col.card, borderRadius:14, border:`1px solid ${isFull?col.red:col.border}`, padding:"16px 18px", display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div>
                          <p style={{ fontWeight:900, fontSize:16, color:col.navy, margin:0 }}>Room {r.room_number}</p>
                          <p style={{ fontSize:11.5, color:col.muted, margin:"3px 0 0", fontWeight:700 }}>Floor {r.floor}</p>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                          {roomTypeBadge(r.room_type)}
                          {statusBadge(r.status)}
                        </div>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                        <div style={{ padding:"8px 10px", borderRadius:8, background:"#f8fafc", border:`1px solid ${col.border}` }}>
                          <p style={{ fontSize:10.5, fontWeight:800, color:col.muted, margin:"0 0 3px" }}>OCCUPANCY</p>
                          <p style={{ fontSize:14, fontWeight:900, color:isFull?col.red:col.green, margin:0 }}>{occ} / {cap}</p>
                        </div>
                        <div style={{ padding:"8px 10px", borderRadius:8, background:"#f8fafc", border:`1px solid ${col.border}` }}>
                          <p style={{ fontSize:10.5, fontWeight:800, color:col.muted, margin:"0 0 3px" }}>MONTHLY FEE</p>
                          <p style={{ fontSize:14, fontWeight:900, color:col.navy, margin:0 }}>₹{Number(r.monthly_fee).toLocaleString()}</p>
                        </div>
                      </div>
                      {r.notes && <p style={{ fontSize:12, color:col.muted, margin:0, fontWeight:600 }}>{r.notes}</p>}
                      <div style={{ display:"flex", gap:6 }}>
                        <Btn variant="soft"   icon="fa-pen"   label="Edit"   onClick={() => openEditRoom(r)} />
                        <Btn variant="danger" icon="fa-trash" label="Delete" onClick={() => setConfirmRId(r.id)} />
                      </div>
                    </div>
                  );
                })
              }
              {!roomsLoading && !rooms.length && selectedHostelId && (
                <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"2rem", color:col.muted, fontWeight:700 }}>
                  No rooms yet for this hostel. Click "Add Room" to begin.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════ ASSIGNMENTS TAB ════════════ */}
        {tab === "assignments" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap" as const, gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <h2 style={{ margin:0, fontSize:16, fontWeight:900, color:col.navy }}>Student Assignments</h2>
                <select value={viewHostelAssignId || ""} onChange={e => { const v = Number(e.target.value); setViewHostelAssignId(v); loadAssignments(v); }} style={{ ...inputStyle, width:"auto", minHeight:36 }}>
                  <option value="">— Select Hostel —</option>
                  {(hostels||[]).map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <Btn icon="fa-user-plus" label="Assign Student" onClick={() => setShowAForm(true)} />
            </div>
            <div style={{ background:col.card, borderRadius:14, border:`1px solid ${col.border}`, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13.5 }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {["Student","Admission No","Room","Floor","Type","Fee/mo","Joined","Status","Action"].map(h => (
                      <th key={h} style={{ padding:"11px 14px", textAlign:"left", color:col.muted, fontWeight:700, fontSize:11, textTransform:"uppercase" as const, letterSpacing:"0.4px", borderBottom:`1px solid ${col.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignmentsLoading ? (
                    <tr><td colSpan={9} style={{ textAlign:"center", padding:"3rem" }}><Spinner size={28} /></td></tr>
                  ) : assignments.map((a: any) => (
                    <tr key={a.id} style={{ borderBottom:`1px solid #f8fafc` }}>
                      <td style={{ padding:"11px 14px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:34, height:34, borderRadius:10, background:`linear-gradient(135deg,${col.blueBg},${col.purpleBg})`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13, color:col.blue, flexShrink:0 }}>
                            {(a.full_name||"?").charAt(0)}
                          </div>
                          <strong style={{ fontSize:13 }}>{a.full_name}</strong>
                        </div>
                      </td>
                      <td style={{ padding:"11px 14px", color:col.muted, fontFamily:"monospace", fontSize:12 }}>{a.admission_number}</td>
                      <td style={{ padding:"11px 14px", fontWeight:700 }}>Room {a.room_number}</td>
                      <td style={{ padding:"11px 14px", color:col.muted }}>Floor {a.floor}</td>
                      <td style={{ padding:"11px 14px" }}>{roomTypeBadge(a.room_type)}</td>
                      <td style={{ padding:"11px 14px", fontWeight:800 }}>₹{Number(a.monthly_fee).toLocaleString()}</td>
                      <td style={{ padding:"11px 14px", color:col.muted, fontSize:12 }}>{a.joining_date?.slice(0,10)}</td>
                      <td style={{ padding:"11px 14px" }}>{statusBadge(a.status)}</td>
                      <td style={{ padding:"11px 14px" }}>
                        {a.status === "active" && <Btn variant="danger" icon="fa-door-open" label="Vacate" onClick={() => vacateAssignment(a.id)} />}
                      </td>
                    </tr>
                  ))}
                  {!assignmentsLoading && !assignments.length && (
                    <tr><td colSpan={9} style={{ textAlign:"center", padding:"2rem", color:col.muted, fontWeight:700 }}>No active assignments for this hostel.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ════════════ MODALS ════════════ */}

      {/* Hostel Form */}
      {showHForm && (
        <Modal title={editHId?"Edit Hostel":"Add New Hostel"} onClose={() => setShowHForm(false)}>
          <Field label="Hostel Name" required><input name="name" style={inputStyle} value={hForm.name} onChange={hf} placeholder="e.g. Boys Hostel A" /></Field>
          <div style={grid2}>
            <Field label="Type" required>
              <select name="hostel_type" style={inputStyle} value={hForm.hostel_type} onChange={hf}>
                <option value="boys">Boys</option><option value="girls">Girls</option><option value="mixed">Mixed</option>
              </select>
            </Field>
            <Field label="Total Capacity" required><input name="total_capacity" type="number" style={inputStyle} value={hForm.total_capacity} onChange={hf} placeholder="e.g. 100" /></Field>
          </div>
          <div style={grid2}>
            <Field label="Warden Name"><input name="warden_name" style={inputStyle} value={hForm.warden_name} onChange={hf} placeholder="Warden's name" /></Field>
            <Field label="Warden Phone"><input name="warden_phone" style={inputStyle} value={hForm.warden_phone} onChange={hf} placeholder="+977-XXXXXXXXXX" /></Field>
          </div>
          <div style={grid2}>
            <Field label="Warden Email"><input name="warden_email" type="email" style={inputStyle} value={hForm.warden_email} onChange={hf} placeholder="warden@school.edu" /></Field>
            <Field label="Status">
              <select name="status" style={inputStyle} value={hForm.status} onChange={hf}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <Field label="Address"><textarea name="address" style={{ ...inputStyle, minHeight:70, resize:"vertical" as const }} value={hForm.address} onChange={hf} placeholder="Full address" /></Field>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
            <Btn variant="outline" label="Cancel" onClick={() => setShowHForm(false)} />
            <Btn label={editHId?"Save Changes":"Create Hostel"} icon="fa-floppy-disk" onClick={saveHostel} loading={hSaving} />
          </div>
        </Modal>
      )}

      {/* Room Form */}
      {showRForm && (
        <Modal title={editRId?"Edit Room":"Add New Room"} onClose={() => setShowRForm(false)}>
          <div style={grid2}>
            <Field label="Room Number" required><input name="room_number" style={inputStyle} value={rForm.room_number} onChange={rf} placeholder="e.g. 101" /></Field>
            <Field label="Floor"><input name="floor" type="number" min="0" style={inputStyle} value={rForm.floor} onChange={rf} /></Field>
          </div>
          <div style={grid2}>
            <Field label="Room Type" required>
              <select name="room_type" style={inputStyle} value={rForm.room_type} onChange={rf}>
                <option value="ac">AC</option><option value="non_ac">Non-AC</option><option value="dormitory">Dormitory</option>
              </select>
            </Field>
            <Field label="Capacity" required><input name="capacity" type="number" min="1" style={inputStyle} value={rForm.capacity} onChange={rf} /></Field>
          </div>
          <div style={grid2}>
            <Field label="Monthly Fee (₹)" required><input name="monthly_fee" type="number" min="0" style={inputStyle} value={rForm.monthly_fee} onChange={rf} placeholder="e.g. 3000" /></Field>
            <Field label="Status">
              <select name="status" style={inputStyle} value={rForm.status} onChange={rf}>
                <option value="available">Available</option><option value="full">Full</option><option value="maintenance">Maintenance</option>
              </select>
            </Field>
          </div>
          <Field label="Notes"><textarea name="notes" style={{ ...inputStyle, minHeight:60, resize:"vertical" as const }} value={rForm.notes} onChange={rf} placeholder="Optional notes" /></Field>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
            <Btn variant="outline" label="Cancel" onClick={() => setShowRForm(false)} />
            <Btn label={editRId?"Save Changes":"Add Room"} icon="fa-floppy-disk" onClick={saveRoom} loading={rSaving} />
          </div>
        </Modal>
      )}

      {/* Assignment Form */}
      {showAForm && (
        <Modal title="Assign Student to Hostel" onClose={() => { setShowAForm(false); setStudentSearch(""); setSelectedStudent(null); }}>
          <Field label="Student" required>
            {/* Searchable combobox — works with 1000+ students */}
            <div style={{ position: "relative" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 12, color: col.muted, fontSize: 13, pointerEvents: "none" }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 36 }}
                  placeholder="Search by name or admission no..."
                  value={studentSearch}
                  onChange={e => { setStudentSearch(e.target.value); setShowStudentDrop(true); setAForm(f => ({ ...f, student_id: "" })); setSelectedStudent(null); }}
                  onFocus={() => setShowStudentDrop(true)}
                  onBlur={() => setTimeout(() => setShowStudentDrop(false), 150)}
                  autoComplete="off"
                />
                {studentSearch && (
                  <button
                    style={{ position: "absolute", right: 10, background: "none", border: "none", cursor: "pointer", color: col.muted, fontSize: 14, padding: 4 }}
                    onMouseDown={e => { e.preventDefault(); setStudentSearch(""); setAForm(f => ({ ...f, student_id: "" })); setSelectedStudent(null); setShowStudentDrop(false); }}
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
              {showStudentDrop && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                  background: col.card, border: `1.5px solid ${col.border}`,
                  borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  zIndex: 200, maxHeight: 220, overflowY: "auto",
                }}>
                  {filteredStudents.length === 0 ? (
                    <div style={{ padding: "12px 14px", fontSize: 13, color: col.muted, fontWeight: 600 }}>
                      {studentSearch ? "No students match your search" : "Start typing to search..."}
                    </div>
                  ) : filteredStudents.map((s: any) => (
                    <div
                      key={s.student_id || s.id}
                      onMouseDown={() => selectStudent(s)}
                      style={{
                        padding: "10px 14px", cursor: "pointer",
                        borderBottom: `1px solid ${col.border}`,
                        background: aForm.student_id === String(s.student_id || s.id) ? col.blueBg : "transparent",
                        display: "flex", alignItems: "center", gap: 10,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = col.bg)}
                      onMouseLeave={e => (e.currentTarget.style.background = aForm.student_id === String(s.student_id || s.id) ? col.blueBg : "transparent")}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: col.blueBg, color: col.blue, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>
                        {(s.full_name || "?").charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: col.navy }}>{s.full_name}</div>
                        <div style={{ fontSize: 11, color: col.muted, fontWeight: 600 }}>{s.admission_number}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedStudent && (
              <div style={{ marginTop: 6, padding: "6px 10px", background: col.greenBg, border: `1px solid #86efac`, borderRadius: 7, fontSize: 12, fontWeight: 700, color: col.green, display: "flex", alignItems: "center", gap: 6 }}>
                <i className="fa-solid fa-circle-check" />
                {selectedStudent.full_name} selected
              </div>
            )}
          </Field>
          <div style={grid2}>
            <Field label="Hostel" required>
              <select name="hostel_id" style={inputStyle} value={aForm.hostel_id} onChange={af}>
                <option value="">— Select Hostel —</option>
                {(hostels||[]).map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>
            <Field label="Room" required>
              <select name="room_id" style={inputStyle} value={aForm.room_id} onChange={af} disabled={!aForm.hostel_id}>
                <option value="">— Select Room —</option>
                {aRooms.map((r: any) => <option key={r.id} value={r.id}>Room {r.room_number} (Floor {r.floor}) — {r.occupied_count||0}/{r.capacity} beds</option>)}
              </select>
            </Field>
          </div>
          <Field label="Joining Date" required><input name="joining_date" type="date" style={inputStyle} value={aForm.joining_date} onChange={af} /></Field>
          <Field label="Notes"><textarea name="notes" style={{ ...inputStyle, minHeight:60, resize:"vertical" as const }} value={aForm.notes} onChange={af} placeholder="Optional notes" /></Field>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
            <Btn variant="outline" label="Cancel" onClick={() => setShowAForm(false)} />
            <Btn label="Assign Student" icon="fa-user-plus" onClick={saveAssignment} loading={aSaving} />
          </div>
        </Modal>
      )}

      {/* Confirm delete hostel */}
      {confirmHId !== null && (
        <Modal title="Delete Hostel?" onClose={() => setConfirmHId(null)}>
          <p style={{ fontSize:13.5, color:col.muted, fontWeight:700 }}>This will permanently delete the hostel and all its rooms. This cannot be undone.</p>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16 }}>
            <Btn variant="outline" label="Cancel" onClick={() => setConfirmHId(null)} />
            <Btn variant="danger" icon="fa-trash" label="Delete Hostel" onClick={() => deleteHostel(confirmHId)} />
          </div>
        </Modal>
      )}

      {/* Confirm delete room */}
      {confirmRId !== null && (
        <Modal title="Delete Room?" onClose={() => setConfirmRId(null)}>
          <p style={{ fontSize:13.5, color:col.muted, fontWeight:700 }}>This will permanently delete the room. This cannot be undone.</p>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16 }}>
            <Btn variant="outline" label="Cancel" onClick={() => setConfirmRId(null)} />
            <Btn variant="danger" icon="fa-trash" label="Delete Room" onClick={() => deleteRoom(confirmRId)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
