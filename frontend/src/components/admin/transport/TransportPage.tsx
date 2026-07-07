"use client";
import { useState, useEffect } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./transport.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

type Tab = "overview" | "vehicles" | "routes" | "assignments";

const VEHICLE_TYPES = ["bus","van","minibus","other"];
const VEHICLE_STATUSES = ["active","inactive","maintenance"];

// ── helpers ──────────────────────────────────────────────────────────────────
const initials = (name: string) => name?.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() || "?";

const statusBadge = (st: string) => {
  const map: Record<string,string> = { active:"badge-green", inactive:"badge-yellow", maintenance:"badge-red", available:"badge-green", full:"badge-red" };
  return cx(s("badge"), s(map[st] || "badge-gray"));
};

export default function TransportPage() {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: summary, refetch: refetchSummary } = useApi<any>(
    activeYear?.id ? `/transport/summary?academic_year_id=${activeYear.id}` : "", [activeYear?.id]
  );
  
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);

  const { data: vehicles, loading: vLoading, refetch: refetchVehicles } = useApi<any[]>("/transport/vehicles");
  const { data: routes,   loading: rLoading, refetch: refetchRoutes   } = useApi<any[]>(
    activeYear?.id ? `/transport/routes?academic_year_id=${activeYear.id}` : "", [activeYear?.id]
  );
  const { data: enrollments } = useApi<any[]>(
    activeYear?.id ? `/students/enrollments?academic_year_id=${activeYear.id}` : "", [activeYear?.id]
  );

  // ── Vehicle form ──────────────────────────────────────────────────────────
  const [showVForm, setShowVForm] = useState(false);
  const [vForm, setVForm] = useState({ vehicle_number:"", vehicle_type:"bus", capacity:"", driver_name:"", driver_phone:"", driver_license:"", helper_name:"", helper_phone:"", gps_tracking:false, status:"active", notes:"" });
  const [vSaving, setVSaving] = useState(false);
  const [editVehicleId, setEditVehicleId] = useState<number|null>(null);
  const [confirmVId, setConfirmVId] = useState<number|null>(null);
  const [deletingVId, setDeletingVId] = useState<number|null>(null);

  // ── Route form ────────────────────────────────────────────────────────────
  const [showRForm, setShowRForm] = useState(false);
  const [rForm, setRForm] = useState({ name:"", description:"", vehicle_id:"", status:"active" });
  const [rSaving, setRSaving] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<number|null>(null);
  const [confirmRId, setConfirmRId] = useState<number|null>(null);
  const [deletingRId, setDeletingRId] = useState<number|null>(null);

  // ── Stops ─────────────────────────────────────────────────────────────────
  const [routeDetail, setRouteDetail] = useState<any>(null);
  const [rDetailLoading, setRDetailLoading] = useState(false);
  const [showStopForm, setShowStopForm] = useState(false);
  const [stopForm, setStopForm] = useState({ name:"", pickup_time:"", drop_time:"", monthly_fee:"", stop_order:"" });
  const [stopSaving, setStopSaving] = useState(false);

  // ── Assignment form ───────────────────────────────────────────────────────
  const [aForm, setAForm] = useState({ student_id:"", route_id:"", stop_id:"", start_date: new Date().toISOString().split("T")[0] });
  const [aStops, setAStops] = useState<any[]>([]);
  const [aSaving, setASaving] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [aLoading, setALoading] = useState(false);
  const [confirmAId, setConfirmAId] = useState<number|null>(null);

  // Load route detail when selected
  useEffect(() => {
    if (!selectedRouteId) { setRouteDetail(null); return; }
    const load = async () => {
      setRDetailLoading(true);
      try {
        const res = await apiRequest<{data:any}>(`/transport/routes/${selectedRouteId}`);
        setRouteDetail(res.data);
      } catch { setRouteDetail(null); }
      finally { setRDetailLoading(false); }
    };
    load();
  }, [selectedRouteId]);

  // Load stops when route selected in assignment form
  useEffect(() => {
    const load = async () => {
      if (!aForm.route_id) { setAStops([]); return; }
      try {
        const res = await apiRequest<{data:any[]}>(`/transport/routes/${aForm.route_id}/stops`);
        setAStops(res.data || []);
      } catch { setAStops([]); }
    };
    load();
  }, [aForm.route_id]);

  // Load all assignments for overview
  useEffect(() => {
    if (tab !== "assignments" || !activeYear?.id) return;
    const load = async () => {
      setALoading(true);
      try {
        const all: any[] = [];
        for (const route of routes || []) {
          const res = await apiRequest<{data:any[]}>(`/transport/routes/${route.id}/students`);
          all.push(...(res.data || []).map((a:any) => ({ ...a, route_name: route.name })));
        }
        setAssignments(all);
      } catch { setAssignments([]); }
      finally { setALoading(false); }
    };
    load();
  }, [tab, routes]);

  // ── GENERATE BILLS ────────────────────────────────────────────────────────
  const generateBills = async () => {
    if (!activeYear?.id) return;
    if (!billingMonth) {
      dispatch(showToast({ type:"error", title:"Missing", message:"Please select a billing month." }));
      return;
    }
    setGenerating(true);
    try {
      const res = await apiRequest<{data:any}>("/fees/transport/generate", {
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

  // ── VEHICLE CRUD ──────────────────────────────────────────────────────────
  const saveVehicle = async () => {
    if (!vForm.vehicle_number || !vForm.driver_name || !vForm.capacity) {
      dispatch(showToast({ type:"error", title:"Missing Fields", message:"Vehicle number, driver and capacity are required." })); return;
    }
    setVSaving(true);
    try {
      const payload = { ...vForm, capacity: Number(vForm.capacity), gps_tracking: vForm.gps_tracking };
      if (editVehicleId) {
        await apiRequest(`/transport/vehicles/${editVehicleId}`, { method:"PATCH", body: JSON.stringify(payload) });
        dispatch(showToast({ type:"success", title:"Updated", message:"Vehicle updated." }));
      } else {
        await apiRequest("/transport/vehicles", { method:"POST", body: JSON.stringify(payload) });
        dispatch(showToast({ type:"success", title:"Created", message:"Vehicle added." }));
      }
      setShowVForm(false); setEditVehicleId(null);
      setVForm({ vehicle_number:"", vehicle_type:"bus", capacity:"", driver_name:"", driver_phone:"", driver_license:"", helper_name:"", helper_phone:"", gps_tracking:false, status:"active", notes:"" });
      refetchVehicles();
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setVSaving(false); }
  };

  const deleteVehicle = async (id: number) => {
    setDeletingVId(id); setConfirmVId(null);
    try {
      await apiRequest(`/transport/vehicles/${id}`, { method:"DELETE" });
      dispatch(showToast({ type:"success", title:"Deleted", message:"Vehicle removed." }));
      refetchVehicles();
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setDeletingVId(null); }
  };

  const startEditVehicle = (v: any) => {
    setEditVehicleId(v.id);
    setVForm({ vehicle_number: v.vehicle_number, vehicle_type: v.vehicle_type, capacity: String(v.capacity), driver_name: v.driver_name, driver_phone: v.driver_phone||"", driver_license: v.driver_license||"", helper_name: v.helper_name||"", helper_phone: v.helper_phone||"", gps_tracking: v.gps_tracking, status: v.status, notes: v.notes||"" });
    setShowVForm(true);
  };

  // ── ROUTE CRUD ────────────────────────────────────────────────────────────
  const saveRoute = async () => {
    if (!rForm.name) { dispatch(showToast({ type:"error", title:"Required", message:"Route name is required." })); return; }
    if (!activeYear?.id) return;
    setRSaving(true);
    try {
      await apiRequest("/transport/routes", { method:"POST", body: JSON.stringify({ ...rForm, academic_year_id: activeYear.id, vehicle_id: rForm.vehicle_id ? Number(rForm.vehicle_id) : undefined }) });
      dispatch(showToast({ type:"success", title:"Created", message:"Route created." }));
      setShowRForm(false); setRForm({ name:"", description:"", vehicle_id:"", status:"active" });
      refetchRoutes();
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setRSaving(false); }
  };

  const deleteRoute = async (id: number) => {
    setDeletingRId(id); setConfirmRId(null);
    try {
      await apiRequest(`/transport/routes/${id}`, { method:"DELETE" });
      dispatch(showToast({ type:"success", title:"Deleted", message:"Route removed." }));
      if (selectedRouteId === id) setSelectedRouteId(null);
      refetchRoutes(); refetchSummary();
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setDeletingRId(null); }
  };

  // ── STOP CRUD ─────────────────────────────────────────────────────────────
  const saveStop = async () => {
    if (!stopForm.name || !selectedRouteId) return;
    setStopSaving(true);
    try {
      await apiRequest("/transport/stops", { method:"POST", body: JSON.stringify({ ...stopForm, route_id: selectedRouteId, monthly_fee: Number(stopForm.monthly_fee)||0, stop_order: Number(stopForm.stop_order)||1 }) });
      dispatch(showToast({ type:"success", title:"Stop Added", message:`Stop "${stopForm.name}" added.` }));
      setShowStopForm(false); setStopForm({ name:"", pickup_time:"", drop_time:"", monthly_fee:"", stop_order:"" });
      setSelectedRouteId(selectedRouteId); // re-trigger detail load
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setStopSaving(false); }
  };

  const deleteStop = async (id: number) => {
    try {
      await apiRequest(`/transport/stops/${id}`, { method:"DELETE" });
      dispatch(showToast({ type:"success", title:"Deleted", message:"Stop removed." }));
      setSelectedRouteId(selectedRouteId);
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
  };

  // ── ASSIGNMENT CRUD ───────────────────────────────────────────────────────
  const saveAssignment = async () => {
    if (!aForm.student_id || !aForm.route_id || !aForm.stop_id) {
      dispatch(showToast({ type:"error", title:"Missing", message:"Student, route and stop are required." })); return;
    }
    if (!activeYear?.id) return;
    setASaving(true);
    try {
      await apiRequest("/transport/assignments", { method:"POST", body: JSON.stringify({ ...aForm, student_id: Number(aForm.student_id), route_id: Number(aForm.route_id), stop_id: Number(aForm.stop_id), academic_year_id: activeYear.id }) });
      dispatch(showToast({ type:"success", title:"Assigned", message:"Student assigned to route." }));
      setAForm({ student_id:"", route_id:"", stop_id:"", start_date: new Date().toISOString().split("T")[0] });
      setAStops([]);
      // reload assignments
      const all: any[] = [];
      for (const route of routes || []) {
        const res = await apiRequest<{data:any[]}>(`/transport/routes/${route.id}/students`);
        all.push(...(res.data || []).map((a:any) => ({ ...a, route_name: route.name })));
      }
      setAssignments(all);
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setASaving(false); }
  };

  const endAssignment = async (id: number) => {
    setConfirmAId(null);
    try {
      await apiRequest(`/transport/assignments/${id}`, { method:"PATCH", body: JSON.stringify({ status:"inactive", end_date: new Date().toISOString().split("T")[0] }) });
      dispatch(showToast({ type:"success", title:"Ended", message:"Transport assignment ended." }));
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  const TABS: { key: Tab; icon: string; label: string }[] = [
    { key:"overview", icon:"fa-chart-pie", label:"Overview" },
    { key:"vehicles", icon:"fa-bus", label:`Vehicles (${vehicles?.length||0})` },
    { key:"routes",   icon:"fa-route", label:`Routes (${routes?.length||0})` },
    { key:"assignments", icon:"fa-users", label:"Assignments" },
  ];

  return (
    <div className={s("page")}>
      <Topbar title="Transport" subtitle="Manage school transport — vehicles, routes and student assignments" />
      <main className={s("content")}>

        {/* Hero */}
        <section className={s("hero")}>
          <div>
            <div className={s("eyebrow")}>Transport Module</div>
            <h1>School Transport</h1>
            <p>Manage vehicles, plan routes, add stops and assign students to transport.</p>
          </div>
          <div className={s("hero-actions")}>
            {tab === "overview" && (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input 
                  type="month" 
                  value={billingMonth} 
                  onChange={e => setBillingMonth(e.target.value)} 
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, fontWeight: 700 }}
                />
                <button className={cx(s("btn"), s("btn-primary"))} onClick={generateBills} disabled={generating}>
                  {generating ? <Spinner size={14}/> : <i className="fa-solid fa-file-invoice-dollar" />} {generating ? "Generating..." : "Generate Bills"}
                </button>
              </div>
            )}
            {tab === "vehicles" && (
              <button className={cx(s("btn"), s("btn-primary"))} onClick={() => { setShowVForm(v=>!v); setEditVehicleId(null); }}>
                <i className={`fa-solid fa-${showVForm ? "xmark" : "plus"}`} /> {showVForm ? "Cancel" : "Add Vehicle"}
              </button>
            )}
            {tab === "routes" && (
              <button className={cx(s("btn"), s("btn-primary"))} onClick={() => setShowRForm(v=>!v)}>
                <i className={`fa-solid fa-${showRForm ? "xmark" : "plus"}`} /> {showRForm ? "Cancel" : "Add Route"}
              </button>
            )}
          </div>
        </section>

        {/* Tabs */}
        <div className={s("tabs")}>
          {TABS.map(t => (
            <button key={t.key} className={cx(s("tab"), tab===t.key && s("tab-active"))} onClick={() => setTab(t.key)}>
              <i className={`fa-solid ${t.icon}`} /> {t.label}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW ══ */}
        {tab === "overview" && (
          <>
            <div className={s("stats-grid")}>
              {[
                { label:"Active Vehicles", value: summary?.active_vehicles||0, icon:"fa-bus", color:"#ff9b51", bg:"#fff3e8" },
                { label:"Active Routes",   value: summary?.active_routes||0,   icon:"fa-route", color:"#1d4ed8", bg:"#dbeafe" },
                { label:"Students Riding", value: summary?.students_assigned||0, icon:"fa-users", color:"#15803d", bg:"#dcfce7" },
                { label:"Total Vehicles",  value: vehicles?.length||0,          icon:"fa-car", color:"#7c3aed", bg:"#f3e8ff" },
              ].map(c => (
                <div key={c.label} className={s("stat-card")}>
                  <div className={s("stat-icon")} style={{ background: c.bg, color: c.color }}>
                    <i className={`fa-solid ${c.icon}`} />
                  </div>
                  <div><p>{c.label}</p><strong>{c.value}</strong></div>
                </div>
              ))}
            </div>
            {/* Route overview cards */}
            <div className={s("panel")}>
              <div className={s("panel-head")}>
                <div><h2><i className="fa-solid fa-route" style={{color:"#ff9b51",marginRight:8}}/>Routes Overview</h2></div>
              </div>
              <div className={s("route-grid")}>
                {(routes||[]).length === 0 ? (
                  <div className={s("empty")}><i className="fa-solid fa-route"/><p>No routes yet. Go to Routes tab to add one.</p></div>
                ) : (routes||[]).map((r:any) => (
                  <div key={r.id} className={s("route-card")}>
                    <h3>{r.name}</h3>
                    {r.description && <p style={{fontSize:12,color:"#6b7b86",marginBottom:8}}>{r.description}</p>}
                    <div className={s("route-card-meta")}>
                      {r.vehicle_number && <span className={s("meta-chip")}><i className="fa-solid fa-bus"/>{r.vehicle_number}</span>}
                      <span className={s("meta-chip")}><i className="fa-solid fa-map-pin"/>{r.stop_count||0} stops</span>
                      <span className={s("meta-chip")}><i className="fa-solid fa-users"/>{r.student_count||0} students</span>
                    </div>
                    <div style={{marginTop:10}}><span className={statusBadge(r.status)}>{r.status}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══ VEHICLES ══ */}
        {tab === "vehicles" && (
          <div className={s("panel")}>
            <div className={s("panel-head")}>
              <div><h2><i className="fa-solid fa-bus" style={{color:"#ff9b51",marginRight:8}}/>Fleet Management</h2></div>
            </div>
            {/* Add/Edit form */}
            {showVForm && (
              <div className={s("inline-form")}>
                <div className={s("form-grid")}>
                  <label className={s("field")}><span>Vehicle No <em>*</em></span><input value={vForm.vehicle_number} onChange={e=>setVForm({...vForm,vehicle_number:e.target.value})} placeholder="BA-1-KHA-1234"/></label>
                  <label className={s("field")}><span>Type</span><select value={vForm.vehicle_type} onChange={e=>setVForm({...vForm,vehicle_type:e.target.value})}>{VEHICLE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
                  <label className={s("field")}><span>Capacity <em>*</em></span><input type="number" min="1" value={vForm.capacity} onChange={e=>setVForm({...vForm,capacity:e.target.value})} placeholder="40"/></label>
                  <label className={s("field")}><span>Driver Name <em>*</em></span><input value={vForm.driver_name} onChange={e=>setVForm({...vForm,driver_name:e.target.value})} placeholder="Ram Sharma"/></label>
                  <label className={s("field")}><span>Driver Phone</span><input value={vForm.driver_phone} onChange={e=>setVForm({...vForm,driver_phone:e.target.value})} placeholder="98XXXXXXXX"/></label>
                  <label className={s("field")}><span>License No</span><input value={vForm.driver_license} onChange={e=>setVForm({...vForm,driver_license:e.target.value})} placeholder="License number"/></label>
                  <label className={s("field")}><span>Helper Name</span><input value={vForm.helper_name} onChange={e=>setVForm({...vForm,helper_name:e.target.value})} placeholder="Optional"/></label>
                  <label className={s("field")}><span>Helper Phone</span><input value={vForm.helper_phone} onChange={e=>setVForm({...vForm,helper_phone:e.target.value})} placeholder="Optional"/></label>
                  <label className={s("field")}><span>Status</span><select value={vForm.status} onChange={e=>setVForm({...vForm,status:e.target.value})}>{VEHICLE_STATUSES.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
                  <label className={s("field")} style={{gridColumn:"1/-1",flexDirection:"row",alignItems:"center",gap:10}}>
                    <input type="checkbox" checked={vForm.gps_tracking} onChange={e=>setVForm({...vForm,gps_tracking:e.target.checked})} style={{width:"auto",minHeight:"auto"}}/>
                    <span>GPS Tracking Enabled</span>
                  </label>
                  <label className={cx(s("field"),s("full"))}><span>Notes</span><input value={vForm.notes} onChange={e=>setVForm({...vForm,notes:e.target.value})} placeholder="Optional notes…"/></label>
                </div>
                <div className={s("form-actions")}>
                  <button className={s("btn")} onClick={()=>{setShowVForm(false);setEditVehicleId(null);}}>Cancel</button>
                  <button className={cx(s("btn"),s("btn-primary"))} onClick={saveVehicle} disabled={vSaving}>
                    {vSaving?<><Spinner size={14}/>Saving…</>:<><i className="fa-solid fa-check"/>{editVehicleId?"Update":"Add"} Vehicle</>}
                  </button>
                </div>
              </div>
            )}
            <div className={s("table-wrap")}>
              {vLoading ? <div style={{padding:"2rem",textAlign:"center"}}><Spinner size={28}/></div> : (
                <table>
                  <thead><tr><th>Vehicle</th><th>Type</th><th>Driver</th><th>Capacity</th><th>GPS</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {(vehicles||[]).length===0 ? (
                      <tr><td colSpan={7} className={s("empty")}><i className="fa-solid fa-bus"/><p>No vehicles yet.</p></td></tr>
                    ) : (vehicles||[]).map((v:any) => (
                      <tr key={v.id}>
                        <td><strong style={{fontSize:13}}>{v.vehicle_number}</strong>{v.assigned_route_name && <span style={{display:"block",fontSize:11,color:"#6b7b86"}}>{v.assigned_route_name}</span>}</td>
                        <td><span className={cx(s("badge"),s("badge-blue"))} style={{textTransform:"capitalize"}}>{v.vehicle_type}</span></td>
                        <td><div><strong style={{fontSize:13}}>{v.driver_name}</strong><span style={{display:"block",fontSize:11,color:"#6b7b86"}}>{v.driver_phone||"—"}</span></div></td>
                        <td style={{fontWeight:800}}>{v.capacity}</td>
                        <td>{v.gps_tracking ? <span className={cx(s("badge"),s("badge-green"))}>Yes</span> : <span className={cx(s("badge"),s("badge-gray"))}>No</span>}</td>
                        <td><span className={statusBadge(v.status)} style={{textTransform:"capitalize"}}>{v.status}</span></td>
                        <td>
                          {confirmVId===v.id ? (
                            <div className={s("confirm-row")}>
                              <span style={{fontSize:12,fontWeight:700,color:"#f43f5e"}}>Delete?</span>
                              <button className={cx(s("btn"),s("btn-sm"),s("btn-danger"))} onClick={()=>deleteVehicle(v.id)} disabled={deletingVId===v.id}>{deletingVId===v.id?<Spinner size={11}/>:"Yes"}</button>
                              <button className={cx(s("btn"),s("btn-sm"))} onClick={()=>setConfirmVId(null)}>No</button>
                            </div>
                          ) : (
                            <div className={s("row-actions")}>
                              <button className={cx(s("btn"),s("btn-sm"))} onClick={()=>startEditVehicle(v)}><i className="fa-solid fa-pen"/></button>
                              <button className={cx(s("btn"),s("btn-sm"),s("btn-danger"))} onClick={()=>setConfirmVId(v.id)}><i className="fa-solid fa-trash"/></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ══ ROUTES ══ */}
        {tab === "routes" && (
          <div className={s("two-col")}>
            {/* Route list */}
            <div className={s("panel")}>
              <div className={s("panel-head")}>
                <div><h2><i className="fa-solid fa-route" style={{color:"#ff9b51",marginRight:8}}/>Routes</h2><p>Click a route to view stops and students</p></div>
              </div>
              {showRForm && (
                <div className={s("inline-form")}>
                  <div className={s("form-grid-2")}>
                    <label className={s("field")}><span>Route Name <em>*</em></span><input autoFocus value={rForm.name} onChange={e=>setRForm({...rForm,name:e.target.value})} placeholder="Route A — Birgunj"/></label>
                    <label className={s("field")}><span>Vehicle</span><select value={rForm.vehicle_id} onChange={e=>setRForm({...rForm,vehicle_id:e.target.value})}><option value="">— No vehicle —</option>{(vehicles||[]).filter((v:any)=>v.status==="active").map((v:any)=><option key={v.id} value={v.id}>{v.vehicle_number} ({v.driver_name})</option>)}</select></label>
                    <label className={cx(s("field"),s("full"))}><span>Description</span><input value={rForm.description} onChange={e=>setRForm({...rForm,description:e.target.value})} placeholder="Optional description…"/></label>
                  </div>
                  <div className={s("form-actions")}>
                    <button className={s("btn")} onClick={()=>setShowRForm(false)}>Cancel</button>
                    <button className={cx(s("btn"),s("btn-primary"))} onClick={saveRoute} disabled={rSaving}>{rSaving?<><Spinner size={14}/>Saving…</>:<><i className="fa-solid fa-check"/>Save Route</>}</button>
                  </div>
                </div>
              )}
              {rLoading ? <div style={{padding:"2rem",textAlign:"center"}}><Spinner size={28}/></div> : (
                <div style={{padding:"12px 14px",display:"grid",gap:8}}>
                  {(routes||[]).length===0 ? <div className={s("empty")}><i className="fa-solid fa-route"/><p>No routes yet.</p></div>
                  : (routes||[]).map((r:any) => (
                    <div key={r.id} className={cx(s("route-card"), selectedRouteId===r.id && s("route-card-active"))} onClick={()=>setSelectedRouteId(r.id)}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                        <h3>{r.name}</h3>
                        {confirmRId===r.id ? (
                          <div className={s("confirm-row")} onClick={e=>e.stopPropagation()}>
                            <span style={{fontSize:11,fontWeight:700,color:"#f43f5e"}}>Delete?</span>
                            <button className={cx(s("btn"),s("btn-sm"),s("btn-danger"))} onClick={()=>deleteRoute(r.id)} disabled={deletingRId===r.id}>{deletingRId===r.id?<Spinner size={11}/>:"Yes"}</button>
                            <button className={cx(s("btn"),s("btn-sm"))} onClick={()=>setConfirmRId(null)}>No</button>
                          </div>
                        ) : (
                          <button className={cx(s("btn"),s("btn-sm"),s("btn-danger"))} onClick={e=>{e.stopPropagation();setConfirmRId(r.id)}}><i className="fa-solid fa-trash"/></button>
                        )}
                      </div>
                      <div className={s("route-card-meta")}>
                        {r.vehicle_number && <span className={s("meta-chip")}><i className="fa-solid fa-bus"/>{r.vehicle_number}</span>}
                        <span className={s("meta-chip")}><i className="fa-solid fa-map-pin"/>{r.stop_count||0} stops</span>
                        <span className={s("meta-chip")}><i className="fa-solid fa-users"/>{r.student_count||0} students</span>
                        <span className={statusBadge(r.status)}>{r.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Route detail — stops */}
            <div>
              {!selectedRouteId ? (
                <div className={s("panel")}>
                  <div className={s("empty")} style={{padding:"3rem"}}><i className="fa-solid fa-map-location-dot"/><p>Select a route to view its stops</p></div>
                </div>
              ) : rDetailLoading ? (
                <div className={s("panel")}><div style={{padding:"2rem",textAlign:"center"}}><Spinner size={28}/></div></div>
              ) : routeDetail && (
                <div className={s("panel")}>
                  <div className={s("panel-head")}>
                    <div><h2><i className="fa-solid fa-map-pin" style={{color:"#ff9b51",marginRight:8}}/>{routeDetail.name} — Stops</h2><p>{routeDetail.stop_count||routeDetail.stops?.length||0} stops</p></div>
                    <button className={cx(s("btn"),s("btn-primary"),s("btn-sm"))} onClick={()=>setShowStopForm(v=>!v)}>
                      <i className={`fa-solid fa-${showStopForm?"xmark":"plus"}`}/> {showStopForm?"Cancel":"Add Stop"}
                    </button>
                  </div>

                  {showStopForm && (
                    <div className={s("inline-form")} style={{margin:"14px 14px 0"}}>
                      <div className={s("form-grid")}>
                        <label className={s("field")}><span>Stop Name <em>*</em></span><input autoFocus value={stopForm.name} onChange={e=>setStopForm({...stopForm,name:e.target.value})} placeholder="Main Chowk"/></label>
                        <label className={s("field")}><span>Pickup Time</span><input type="time" value={stopForm.pickup_time} onChange={e=>setStopForm({...stopForm,pickup_time:e.target.value})}/></label>
                        <label className={s("field")}><span>Drop Time</span><input type="time" value={stopForm.drop_time} onChange={e=>setStopForm({...stopForm,drop_time:e.target.value})}/></label>
                        <label className={s("field")}><span>Monthly Fee (₹)</span><input type="number" value={stopForm.monthly_fee} onChange={e=>setStopForm({...stopForm,monthly_fee:e.target.value})} placeholder="500"/></label>
                        <label className={s("field")}><span>Order</span><input type="number" min="1" value={stopForm.stop_order} onChange={e=>setStopForm({...stopForm,stop_order:e.target.value})} placeholder="1"/></label>
                      </div>
                      <div className={s("form-actions")}><button className={s("btn")} onClick={()=>setShowStopForm(false)}>Cancel</button><button className={cx(s("btn"),s("btn-primary"))} onClick={saveStop} disabled={stopSaving}>{stopSaving?<><Spinner size={14}/>Saving…</>:<><i className="fa-solid fa-check"/>Add Stop</>}</button></div>
                    </div>
                  )}

                  <div className={s("stop-list")}>
                    {(!routeDetail.stops||routeDetail.stops.length===0) ? (
                      <div className={s("empty")}><i className="fa-solid fa-map-pin"/><p>No stops yet. Add one above.</p></div>
                    ) : routeDetail.stops.map((stop:any,idx:number) => (
                      <div key={stop.id} className={s("stop-row")}>
                        <div className={s("stop-number")}>{idx+1}</div>
                        <div className={s("stop-info")}>
                          <strong>{stop.name}</strong>
                          <span>{stop.pickup_time ? `↑ ${stop.pickup_time}` : ""}{stop.drop_time ? `  ↓ ${stop.drop_time}` : ""}{!stop.pickup_time && !stop.drop_time ? "No times set" : ""}</span>
                        </div>
                        {stop.student_count > 0 && <span className={cx(s("badge"),s("badge-blue"))}>{stop.student_count} students</span>}
                        <span className={s("stop-fee")}>₹{stop.monthly_fee||0}/mo</span>
                        <button className={cx(s("btn"),s("btn-sm"),s("btn-danger"))} onClick={()=>deleteStop(stop.id)}><i className="fa-solid fa-trash"/></button>
                      </div>
                    ))}
                  </div>

                  {/* Students on this route */}
                  {routeDetail.students?.length > 0 && (
                    <>
                      <div className={s("panel-head")} style={{borderTop:"1px solid rgba(191,201,209,0.42)"}}>
                        <div><h2><i className="fa-solid fa-users" style={{color:"#ff9b51",marginRight:8}}/>Students on this route</h2></div>
                      </div>
                      <div className={s("table-wrap")}>
                        <table>
                          <thead><tr><th>Student</th><th>Stop</th><th>Pickup</th><th>Fee</th></tr></thead>
                          <tbody>
                            {routeDetail.students.map((a:any) => (
                              <tr key={a.id}>
                                <td><div className={s("avatar-cell")}><span className={s("avatar")}>{initials(a.full_name)}</span><div><strong style={{fontSize:13}}>{a.full_name}</strong><span style={{display:"block",fontSize:11,color:"#6b7b86"}}>{a.admission_number}</span></div></div></td>
                                <td style={{fontWeight:700}}>{a.stop_name}</td>
                                <td style={{color:"#6b7b86",fontSize:13}}>{a.pickup_time||"—"}</td>
                                <td style={{fontWeight:800,color:"#ff9b51"}}>₹{a.monthly_fee||0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ ASSIGNMENTS ══ */}
        {tab === "assignments" && (
          <div className={s("two-col")}>
            {/* Assign form */}
            <div className={s("panel")}>
              <div className={s("panel-head")}><div><h2><i className="fa-solid fa-user-plus" style={{color:"#ff9b51",marginRight:8}}/>Assign Student to Route</h2></div></div>
              <div className={s("form-grid-2")}>
                <label className={s("field")}><span>Student <em>*</em></span>
                  <select value={aForm.student_id} onChange={e=>setAForm({...aForm,student_id:e.target.value})}>
                    <option value="">— Select Student —</option>
                    {(enrollments||[]).map((en:any) => <option key={en.student_id} value={en.student_id}>{en.full_name} ({en.admission_number})</option>)}
                  </select>
                </label>
                <label className={s("field")}><span>Route <em>*</em></span>
                  <select value={aForm.route_id} onChange={e=>setAForm({...aForm,route_id:e.target.value,stop_id:""})}>
                    <option value="">— Select Route —</option>
                    {(routes||[]).map((r:any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
                <label className={s("field")}><span>Stop <em>*</em></span>
                  <select value={aForm.stop_id} onChange={e=>setAForm({...aForm,stop_id:e.target.value})} disabled={!aForm.route_id||!aStops.length}>
                    <option value="">— Select Stop —</option>
                    {aStops.map((st:any) => <option key={st.id} value={st.id}>{st.name} — ₹{st.monthly_fee}/mo</option>)}
                  </select>
                </label>
                <label className={s("field")}><span>Start Date</span><input type="date" value={aForm.start_date} onChange={e=>setAForm({...aForm,start_date:e.target.value})}/></label>
              </div>
              <div className={s("form-actions")}>
                <button className={cx(s("btn"),s("btn-primary"))} onClick={saveAssignment} disabled={aSaving}>{aSaving?<><Spinner size={14}/>Assigning…</>:<><i className="fa-solid fa-check"/>Assign Student</>}</button>
              </div>
            </div>

            {/* Assignment list */}
            <div className={s("panel")}>
              <div className={s("panel-head")}><div><h2><i className="fa-solid fa-list" style={{color:"#ff9b51",marginRight:8}}/>Current Assignments</h2><p>{assignments.length} active assignments</p></div></div>
              <div className={s("table-wrap")}>
                {aLoading ? <div style={{padding:"2rem",textAlign:"center"}}><Spinner size={28}/></div> : (
                  <table>
                    <thead><tr><th>Student</th><th>Route</th><th>Stop</th><th>Fee</th><th></th></tr></thead>
                    <tbody>
                      {assignments.length===0 ? <tr><td colSpan={5} className={s("empty")}><i className="fa-solid fa-users-slash"/><p>No assignments yet.</p></td></tr>
                      : assignments.map((a:any) => (
                        <tr key={a.id}>
                          <td><div className={s("avatar-cell")}><span className={s("avatar")}>{initials(a.full_name)}</span><strong style={{fontSize:13}}>{a.full_name}</strong></div></td>
                          <td style={{fontSize:13,fontWeight:700}}>{a.route_name}</td>
                          <td style={{fontSize:13}}>{a.stop_name}</td>
                          <td style={{fontWeight:800,color:"#ff9b51",fontSize:13}}>₹{a.monthly_fee||0}</td>
                          <td>
                            {confirmAId===a.id ? (
                              <div className={s("confirm-row")}>
                                <span style={{fontSize:11,fontWeight:700,color:"#f43f5e"}}>End?</span>
                                <button className={cx(s("btn"),s("btn-sm"),s("btn-danger"))} onClick={()=>endAssignment(a.id)}>Yes</button>
                                <button className={cx(s("btn"),s("btn-sm"))} onClick={()=>setConfirmAId(null)}>No</button>
                              </div>
                            ) : <button className={cx(s("btn"),s("btn-sm"),s("btn-danger"))} onClick={()=>setConfirmAId(a.id)}><i className="fa-solid fa-xmark"/></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
