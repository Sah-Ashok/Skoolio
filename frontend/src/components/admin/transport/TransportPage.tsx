"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./transport.module.css";
import { useApi, clearApiCache } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency, CurrencyAmount } from "@/lib/useCurrency";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Skeleton, SkeletonStatRow, SkeletonTable } from "@/components/shared/Skeleton";
import DateInput from "@/components/shared/DateInput";
import { adToBS, bsToISO, BS_MONTH_NAMES } from "@/lib/bs-ad";

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
  const { isBS } = useDateFormat();
  const { fmt: fmtCur } = useCurrency();
  const [tab, setTab] = useState<Tab>("overview");

  const pathname = usePathname();
  const isFinance = pathname?.startsWith("/finance");

  const [financeTick, setFinanceTick] = useState(0);
  useEffect(() => {
    const handleAccountChange = () => {
      clearApiCache("/school/finance-account");
      setFinanceTick((t) => t + 1);
    };
    window.addEventListener("finance-account-changed", handleAccountChange);
    return () => window.removeEventListener("finance-account-changed", handleAccountChange);
  }, []);

  const { data: financeAccount } = useApi<any>(
    !isFinance ? "/school/finance-account" : null,
    [financeTick]
  );
  const hasActiveFinanceAccount = Boolean(
    financeAccount && (financeAccount.id || financeAccount.email) && financeAccount.status !== "inactive"
  );

  const collectUrl = isFinance ? "/finance/fees/collect" : "/fees/collect";

  const { activeYear } = useAcademicYear();
  const { data: summary, refetch: refetchSummary } = useApi<any>(
    activeYear?.id ? `/transport/summary?academic_year_id=${activeYear.id}` : "", [activeYear?.id]
  );
  
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);

  const bsMonthOptions = useMemo(() => {
    if (!isBS) return [];
    const startAD = activeYear?.start_date
      ? new Date(activeYear.start_date + "T00:00:00")
      : (() => { const d = new Date(); d.setMonth(d.getMonth() - 12); return d; })();
    const endAD = activeYear?.end_date
      ? new Date(activeYear.end_date + "T00:00:00")
      : (() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d; })();
    const startBS = adToBS(startAD), endBS = adToBS(endAD);
    const opts: { key: string; label: string; adValue: string }[] = [];
    let y = startBS.year, m = startBS.month;
    while (y < endBS.year || (y === endBS.year && m <= endBS.month)) {
      const ad = new Date(bsToISO({ year: y, month: m, day: 15 }) + "T00:00:00");
      opts.push({
        key: `${y}-${String(m).padStart(2, "0")}`,
        label: `${BS_MONTH_NAMES[m - 1]} ${y}`,
        adValue: `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, "0")}`,
      });
      if (m === 12) { y++; m = 1; } else m++;
    }
    return opts;
  }, [isBS, activeYear]);

  // Set default current BS month when BS mode is active
  useEffect(() => {
    if (isBS && bsMonthOptions.length > 0) {
      const todayBS = adToBS(new Date());
      const currentOpt = bsMonthOptions.find(o => o.label.startsWith(`${BS_MONTH_NAMES[todayBS.month - 1]} ${todayBS.year}`));
      if (currentOpt) {
        setBillingMonth(currentOpt.adValue);
      } else if (bsMonthOptions[0]) {
        setBillingMonth(bsMonthOptions[0].adValue);
      }
    }
  }, [isBS, bsMonthOptions]);

  const { data: vehicles, loading: vLoading, refetch: refetchVehicles } = useApi<any[]>("/transport/vehicles");
  const { data: staffList } = useApi<any[]>("/staff");
  const { data: routes,   loading: rLoading, refetch: refetchRoutes   } = useApi<any[]>(
    activeYear?.id ? `/transport/routes?academic_year_id=${activeYear.id}` : "", [activeYear?.id]
  );
  const { data: enrollments } = useApi<any[]>(
    activeYear?.id ? `/students/enrollments?academic_year_id=${activeYear.id}` : "", [activeYear?.id]
  );

  // ── Vehicle form ──────────────────────────────────────────────────────────
  const [showVForm, setShowVForm] = useState(false);
  const [vForm, setVForm] = useState({ vehicle_number:"", vehicle_type:"bus", capacity:"", driver_name:"", driver_phone:"", driver_license:"", helper_name:"", helper_phone:"", gps_tracking:false, status:"active", notes:"" });
  const [selectedStaffDriverId, setSelectedStaffDriverId] = useState<string>("");
  const [selectedStaffHelperId, setSelectedStaffHelperId] = useState<string>("");
  const [vSaving, setVSaving] = useState(false);
  const [editVehicleId, setEditVehicleId] = useState<number|null>(null);
  const [confirmVId, setConfirmVId] = useState<number|null>(null);
  const [deletingVId, setDeletingVId] = useState<number|null>(null);

  // Sort staff to show Drivers / Transport staff first
  const sortedStaffForDriver = useMemo(() => {
    if (!staffList) return [];
    return [...staffList].sort((a, b) => {
      const aRole = (a.role_name || "").toLowerCase();
      const bRole = (b.role_name || "").toLowerCase();
      const aIsDriver = aRole.includes("driver") || aRole.includes("transport") ? 1 : 0;
      const bIsDriver = bRole.includes("driver") || bRole.includes("transport") ? 1 : 0;
      if (aIsDriver !== bIsDriver) return bIsDriver - aIsDriver;
      return (a.full_name || "").localeCompare(b.full_name || "");
    });
  }, [staffList]);

  const handleSelectDriver = (staffId: string) => {
    setSelectedStaffDriverId(staffId);
    if (!staffId) return;
    const selected = (staffList || []).find((s: any) => String(s.id) === String(staffId));
    if (selected) {
      setVForm(prev => ({
        ...prev,
        driver_name: selected.full_name,
        driver_phone: selected.phone || prev.driver_phone,
        driver_license: selected.license_number || prev.driver_license,
      }));
    }
  };

  const handleSelectHelper = (staffId: string) => {
    setSelectedStaffHelperId(staffId);
    if (!staffId) return;
    const selected = (staffList || []).find((s: any) => String(s.id) === String(staffId));
    if (selected) {
      setVForm(prev => ({
        ...prev,
        helper_name: selected.full_name,
        helper_phone: selected.phone || prev.helper_phone,
      }));
    }
  };

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

  // Load route detail helper
  const fetchRouteDetail = useCallback(async (routeId: number) => {
    if (!routeId) { setRouteDetail(null); return; }
    setRDetailLoading(true);
    try {
      const res = await apiRequest<{data:any}>(`/transport/routes/${routeId}`);
      setRouteDetail(res.data);
    } catch {
      setRouteDetail(null);
    } finally {
      setRDetailLoading(false);
    }
  }, []);

  // Load route detail when selectedRouteId changes
  useEffect(() => {
    if (selectedRouteId) {
      fetchRouteDetail(selectedRouteId);
    } else {
      setRouteDetail(null);
    }
  }, [selectedRouteId, fetchRouteDetail]);

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

  // Load all assignments helper
  const fetchAssignments = useCallback(async () => {
    if (!activeYear?.id) return;
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
  }, [activeYear?.id, routes]);

  // Load all assignments for overview
  useEffect(() => {
    if (tab === "assignments") {
      fetchAssignments();
    }
  }, [tab, fetchAssignments]);

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
      setSelectedStaffDriverId(""); setSelectedStaffHelperId("");
      setVForm({ vehicle_number:"", vehicle_type:"bus", capacity:"", driver_name:"", driver_phone:"", driver_license:"", helper_name:"", helper_phone:"", gps_tracking:false, status:"active", notes:"" });
      refetchVehicles();
      refetchSummary();
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setVSaving(false); }
  };

  const deleteVehicle = async (id: number) => {
    setDeletingVId(id); setConfirmVId(null);
    try {
      await apiRequest(`/transport/vehicles/${id}`, { method:"DELETE" });
      dispatch(showToast({ type:"success", title:"Deleted", message:"Vehicle removed." }));
      refetchVehicles();
      refetchSummary();
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setDeletingVId(null); }
  };

  const startEditVehicle = (v: any) => {
    setEditVehicleId(v.id);
    setSelectedStaffDriverId("");
    setSelectedStaffHelperId("");
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
      refetchSummary();
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setRSaving(false); }
  };

  const deleteRoute = async (id: number) => {
    setDeletingRId(id); setConfirmRId(null);
    try {
      await apiRequest(`/transport/routes/${id}`, { method:"DELETE" });
      dispatch(showToast({ type:"success", title:"Deleted", message:"Route removed." }));
      if (selectedRouteId === id) setSelectedRouteId(null);
      refetchRoutes();
      refetchSummary();
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setDeletingRId(null); }
  };

  // ── STOP CRUD ─────────────────────────────────────────────────────────────
  const saveStop = async () => {
    if (!stopForm.name || !selectedRouteId) return;
    setStopSaving(true);
    try {
      await apiRequest("/transport/stops", {
        method: "POST",
        body: JSON.stringify({
          ...stopForm,
          route_id: selectedRouteId,
          monthly_fee: Number(stopForm.monthly_fee) || 0,
          stop_order: Number(stopForm.stop_order) || 1,
        }),
      });
      dispatch(showToast({ type:"success", title:"Stop Added", message:`Stop "${stopForm.name}" added.` }));
      setShowStopForm(false);
      setStopForm({ name:"", pickup_time:"", drop_time:"", monthly_fee:"", stop_order:"" });
      fetchRouteDetail(selectedRouteId);
      refetchRoutes();
      refetchSummary();
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setStopSaving(false); }
  };

  const deleteStop = async (id: number) => {
    try {
      await apiRequest(`/transport/stops/${id}`, { method:"DELETE" });
      dispatch(showToast({ type:"success", title:"Deleted", message:"Stop removed." }));
      if (selectedRouteId) fetchRouteDetail(selectedRouteId);
      refetchRoutes();
      refetchSummary();
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
      fetchAssignments();
      if (selectedRouteId) fetchRouteDetail(selectedRouteId);
      refetchRoutes();
      refetchSummary();
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
    finally { setASaving(false); }
  };

  const endAssignment = async (id: number) => {
    setConfirmAId(null);
    try {
      await apiRequest(`/transport/assignments/${id}`, { method:"PATCH", body: JSON.stringify({ status:"inactive", end_date: new Date().toISOString().split("T")[0] }) });
      dispatch(showToast({ type:"success", title:"Ended", message:"Transport assignment ended." }));
      setAssignments(prev => prev.filter(a => a.id !== id));
      if (selectedRouteId) fetchRouteDetail(selectedRouteId);
      refetchRoutes();
      refetchSummary();
    } catch (e:any) { dispatch(showToast({ type:"error", title:"Failed", message: e.message })); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  const TABS: { key: Tab; icon: string; label: string }[] = [
    { key:"overview", icon:"fa-chart-pie", label:"Overview" },
    { key:"vehicles", icon:"fa-bus", label:`Vehicles (${vehicles?.length||0})` },
    { key:"routes",   icon:"fa-route", label:`Routes (${routes?.length||0})` },
    { key:"assignments", icon:"fa-users", label:"Assignments" },
  ];

  if (!isFinance && hasActiveFinanceAccount) {
    return (
      <div style={{ minHeight: "80vh", background: "#f8faff", display: "grid", placeItems: "center", padding: "40px 20px" }}>
        <div style={{
          background: "#fff",
          border: "1.5px solid #e2e8f0",
          borderRadius: 16,
          maxWidth: 560,
          width: "100%",
          padding: "36px 32px",
          textAlign: "center",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "#ecfdf5",
            color: "#059669",
            display: "grid",
            placeItems: "center",
            fontSize: 24,
            margin: "0 auto 18px",
            border: "1px solid #a7f3d0",
          }}>
            <i className="fa-solid fa-bus" />
          </div>

          <span style={{
            padding: "3px 10px",
            borderRadius: 999,
            background: "#ecfdf5",
            color: "#047857",
            fontSize: 11.5,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            display: "inline-block",
            marginBottom: 10,
          }}>
            Facilities Delegated
          </span>

          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", margin: "0 0 10px" }}>
            Transport Facility Managed by Finance Department
          </h2>

          <p style={{ fontSize: 13.5, color: "#64748b", lineHeight: 1.6, margin: "0 0 20px" }}>
            Your school has configured an active <strong>Finance Manager</strong> ({financeAccount?.full_name || "Finance Officer"} &bull; {financeAccount?.email}).
            School transport routes, vehicle allocations, and transport fee billing are currently delegated to the <strong>Finance Portal</strong>.
          </p>

          <div style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "14px 18px",
            textAlign: "left",
            fontSize: 12.5,
            color: "#64748b",
            marginBottom: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
              <i className="fa-solid fa-circle-info" style={{ color: "#2563eb" }} />
              Admin Access &amp; Fallback
            </div>
            <div>
              If the Finance Manager access is revoked, complete control over transport facilities will immediately return to the School Admin dashboard.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/dashboard"
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: 9,
                background: "#0f172a",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i className="fa-solid fa-gauge-high" /> Return to Dashboard
            </Link>
            <Link
              href="/settings?tab=finance-account"
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: 9,
                border: "1.5px solid #e2e8f0",
                background: "#fff",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i className="fa-solid fa-user-shield" /> Manage Finance Access
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s("page")}>
      <main className={s("content")}>

        {/* Hero */}
        <section className={s("hero")}>
          <div>
            <div className={s("eyebrow")}>Transport Module</div>
            <h1>School Transport</h1>
            <p>Manage vehicles, plan routes, add stops and assign students to transport.</p>
          </div>
          <div className={s("hero-actions")}>
            <Link
              href={collectUrl}
              className={cx(s("btn"), s("btn-secondary"))}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", minHeight: 34, padding: "0 14px", fontSize: 12.5 }}
            >
              <i className="fa-solid fa-hand-holding-dollar" style={{ color: "#16a34a" }} /> Collect Fee
            </Link>
            {tab === "overview" && (
              <div className={s("billing-group")}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 6, color: "#64748b", fontSize: 13 }}>
                  <i className="fa-regular fa-calendar" />
                  <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>Month:</span>
                </div>
                {isBS && bsMonthOptions.length > 0 ? (
                  <select
                    className={s("month-select")}
                    value={billingMonth}
                    onChange={e => setBillingMonth(e.target.value)}
                  >
                    {bsMonthOptions.map(opt => (
                      <option key={opt.key} value={opt.adValue}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="month"
                    value={billingMonth}
                    onChange={e => setBillingMonth(e.target.value)}
                    className={s("month-select")}
                  />
                )}
                <button
                  className={cx(s("btn"), s("btn-primary"))}
                  onClick={generateBills}
                  disabled={generating}
                  style={{ minHeight: 34, padding: "0 14px", fontSize: 12.5 }}
                >
                  {generating ? <Spinner size={14} /> : <i className="fa-solid fa-file-invoice-dollar" />}
                  {generating ? "Generating..." : "Generate Bills"}
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
            {!summary && !routes ? (
              <div style={{ marginBottom: "1.5rem" }}>
                <SkeletonStatRow count={4} />
              </div>
            ) : (
              <div className={s("stats-grid")}>
                <div className={cx(s("stat-card"), s("stat-blue"))}>
                  <div className={s("stat-icon")}>
                    <i className="fa-solid fa-bus" />
                  </div>
                  <div>
                    <p>Fleet Vehicles</p>
                    <strong>{summary?.active_vehicles || 0} <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700 }}>/ {vehicles?.length || 0} Total</span></strong>
                  </div>
                </div>

                <div className={cx(s("stat-card"), s("stat-amber"))}>
                  <div className={s("stat-icon")}>
                    <i className="fa-solid fa-route" />
                  </div>
                  <div>
                    <p>Active Routes</p>
                    <strong>{summary?.active_routes || 0}</strong>
                  </div>
                </div>

                <div className={cx(s("stat-card"), s("stat-green"))}>
                  <div className={s("stat-icon")}>
                    <i className="fa-solid fa-user-graduate" />
                  </div>
                  <div>
                    <p>Students Riding</p>
                    <strong>{summary?.students_assigned || 0}</strong>
                  </div>
                </div>

                <div className={cx(s("stat-card"), s("stat-purple"))}>
                  <div className={s("stat-icon")}>
                    <i className="fa-solid fa-map-location-dot" />
                  </div>
                  <div>
                    <p>Pickup Stops</p>
                    <strong>{routes?.reduce((acc: number, r: any) => acc + (r.stop_count || 0), 0) || 0}</strong>
                  </div>
                </div>
              </div>
            )}
            {/* Route overview cards */}
            <div className={s("panel")}>
              <div className={s("panel-head")}>
                <div><h2><i className="fa-solid fa-route" style={{color:"#ff9b51",marginRight:8}}/>Routes Overview</h2></div>
              </div>
              <div className={s("route-grid")}>
                {!routes ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={s("route-card")} style={{ padding: "1.25rem" }}>
                      <Skeleton width="60%" height={20} style={{ marginBottom: 10 }} />
                      <Skeleton width="90%" height={14} style={{ marginBottom: 12 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <Skeleton width={70} height={24} borderRadius={12} />
                        <Skeleton width={70} height={24} borderRadius={12} />
                      </div>
                    </div>
                  ))
                ) : (routes||[]).length === 0 ? (
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

                  {/* Staff Driver Selector */}
                  <label className={s("field")}>
                    <span>Select Driver from Staff</span>
                    <select value={selectedStaffDriverId} onChange={e=>handleSelectDriver(e.target.value)}>
                      <option value="">— Select from Staff List —</option>
                      {sortedStaffForDriver.map((st: any) => (
                        <option key={st.id} value={st.id}>
                          {st.full_name} {st.role_name ? `(${st.role_name})` : ""} {st.phone ? `— ${st.phone}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={s("field")}><span>Driver Name <em>*</em></span><input value={vForm.driver_name} onChange={e=>setVForm({...vForm,driver_name:e.target.value})} placeholder="Driver full name"/></label>
                  <label className={s("field")}><span>Driver Phone</span><input value={vForm.driver_phone} onChange={e=>setVForm({...vForm,driver_phone:e.target.value})} placeholder="98XXXXXXXX"/></label>

                  <label className={s("field")}><span>License No</span><input value={vForm.driver_license} onChange={e=>setVForm({...vForm,driver_license:e.target.value})} placeholder="License number"/></label>

                  {/* Staff Helper Selector */}
                  <label className={s("field")}>
                    <span>Select Helper from Staff</span>
                    <select value={selectedStaffHelperId} onChange={e=>handleSelectHelper(e.target.value)}>
                      <option value="">— Select from Staff List (Optional) —</option>
                      {(staffList || []).map((st: any) => (
                        <option key={st.id} value={st.id}>
                          {st.full_name} {st.role_name ? `(${st.role_name})` : ""} {st.phone ? `— ${st.phone}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
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
              {vLoading && !vehicles ? (
                <SkeletonTable rows={5} columns={7} />
              ) : (
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
              {rLoading ? <div style={{padding:"2rem 1rem",textAlign:"center"}}><Loader fullScreen={false} size="sm" text="Loading routes…" /></div> : (
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
                <div className={s("panel")}><div style={{padding:"2rem 1rem",textAlign:"center"}}><Loader fullScreen={false} size="sm" text="Loading route details…" /></div></div>
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
                        <label className={s("field")}><span>Monthly Fee</span><input type="number" value={stopForm.monthly_fee} onChange={e=>setStopForm({...stopForm,monthly_fee:e.target.value})} placeholder="500"/></label>
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
                        <span className={s("stop-fee")}><CurrencyAmount amount={stop.monthly_fee || 0} />/mo</span>
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
                                <td style={{fontWeight:800,color:"#ff9b51"}}><CurrencyAmount amount={a.monthly_fee || 0} /></td>
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
          (!vehicles || vehicles.length === 0 || !routes || routes.length === 0) ? (
            <div className={s("panel")} style={{ padding: "48px 24px", textAlign: "center", maxWidth: 720, margin: "16px auto" }}>
              <div style={{
                width: 68, height: 68, borderRadius: 20,
                background: (!vehicles || vehicles.length === 0) ? "#fff3e8" : "#eff6ff",
                color: (!vehicles || vehicles.length === 0) ? "#ea580c" : "#2563eb",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, marginBottom: 18
              }}>
                <i className={`fa-solid ${(!vehicles || vehicles.length === 0) ? "fa-bus" : "fa-route"}`} />
              </div>

              <h2 style={{ fontSize: 21, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
                {(!vehicles || vehicles.length === 0) ? "Add a Vehicle First" : "Create a Route & Stops First"}
              </h2>

              <p style={{ fontSize: 13.5, color: "#64748b", fontWeight: 600, maxWidth: 500, margin: "0 auto 26px", lineHeight: 1.6 }}>
                {(!vehicles || vehicles.length === 0)
                  ? "Before assigning students to transport, you need to register at least one school vehicle in your fleet."
                  : "Vehicles are registered, but no routes or stops have been created yet. Create a route first so students can be mapped to pickup stops."}
              </p>

              {/* Step indicator */}
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 30, flexWrap: "wrap" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "9px 15px", borderRadius: 10,
                  background: (vehicles && vehicles.length > 0) ? "#ecfdf5" : "#fff7ed",
                  border: `1px solid ${(vehicles && vehicles.length > 0) ? "#a7f3d0" : "#ffedd5"}`,
                  fontSize: 12.5, fontWeight: 800, color: (vehicles && vehicles.length > 0) ? "#059669" : "#c2410c"
                }}>
                  <i className={`fa-solid ${(vehicles && vehicles.length > 0) ? "fa-circle-check" : "fa-1"}`} />
                  <span>1. Fleet Vehicle {(vehicles && vehicles.length > 0) ? `(${vehicles.length})` : ""}</span>
                </div>

                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "9px 15px", borderRadius: 10,
                  background: (routes && routes.length > 0) ? "#ecfdf5" : "#eff6ff",
                  border: `1px solid ${(routes && routes.length > 0) ? "#a7f3d0" : "#bfdbfe"}`,
                  fontSize: 12.5, fontWeight: 800, color: (routes && routes.length > 0) ? "#059669" : "#1d4ed8"
                }}>
                  <i className={`fa-solid ${(routes && routes.length > 0) ? "fa-circle-check" : "fa-2"}`} />
                  <span>2. Route & Stops {(routes && routes.length > 0) ? `(${routes.length})` : ""}</span>
                </div>

                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "9px 15px", borderRadius: 10,
                  background: "#f8fafc", border: "1px solid #e2e8f0",
                  fontSize: 12.5, fontWeight: 800, color: "#94a3b8"
                }}>
                  <i className="fa-solid fa-3" />
                  <span>3. Student Assignment</span>
                </div>
              </div>

              <div>
                {(!vehicles || vehicles.length === 0) ? (
                  <button
                    type="button"
                    className={cx(s("btn"), s("btn-primary"))}
                    style={{ padding: "10px 24px", fontSize: 13.5 }}
                    onClick={() => {
                      setTab("vehicles");
                      setShowVForm(true);
                      setEditVehicleId(null);
                    }}
                  >
                    <i className="fa-solid fa-plus" /> Add First Vehicle
                  </button>
                ) : (
                  <button
                    type="button"
                    className={cx(s("btn"), s("btn-primary"))}
                    style={{ padding: "10px 24px", fontSize: 13.5 }}
                    onClick={() => {
                      setTab("routes");
                      setShowRForm(true);
                    }}
                  >
                    <i className="fa-solid fa-plus" /> Create First Route
                  </button>
                )}
              </div>
            </div>
          ) : (
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
                      {aStops.map((st:any) => <option key={st.id} value={st.id}>{st.name} — {fmtCur(st.monthly_fee)}/mo</option>)}
                    </select>
                  </label>
                  <label className={s("field")}>
                    <span>Start Date</span>
                    <DateInput value={aForm.start_date} onChange={e => setAForm({...aForm, start_date: e.target.value})} />
                  </label>
                </div>
                <div className={s("form-actions")}>
                  <button className={cx(s("btn"),s("btn-primary"))} onClick={saveAssignment} disabled={aSaving}>{aSaving?<><Spinner size={14}/>Assigning…</>:<><i className="fa-solid fa-check"/>Assign Student</>}</button>
                </div>
              </div>

              {/* Assignment list */}
              <div className={s("panel")}>
                <div className={s("panel-head")}><div><h2><i className="fa-solid fa-list" style={{color:"#ff9b51",marginRight:8}}/>Current Assignments</h2><p>{assignments.length} active assignments</p></div></div>
                <div className={s("table-wrap")}>
                  {aLoading ? <div style={{padding:"2rem 1rem",textAlign:"center"}}><Loader fullScreen={false} size="sm" text="Loading assignments…" /></div> : (
                    <table>
                      <thead><tr><th>Student</th><th>Route</th><th>Stop</th><th>Fee</th><th></th></tr></thead>
                      <tbody>
                        {assignments.length===0 ? <tr><td colSpan={5} className={s("empty")}><i className="fa-solid fa-users-slash"/><p>No assignments yet.</p></td></tr>
                        : assignments.map((a:any) => (
                          <tr key={a.id}>
                            <td><div className={s("avatar-cell")}><span className={s("avatar")}>{initials(a.full_name)}</span><strong style={{fontSize:13}}>{a.full_name}</strong></div></td>
                            <td style={{fontSize:13,fontWeight:700}}>{a.route_name}</td>
                            <td style={{fontSize:13}}>{a.stop_name}</td>
                            <td style={{fontWeight:800,color:"#ff9b51",fontSize:13}}><CurrencyAmount amount={a.monthly_fee || 0} /></td>
                            <td>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Link
                                  href={`${collectUrl}?student_id=${a.student_id}`}
                                  style={{
                                    padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0",
                                    background: "#fff", color: "#2563eb", fontSize: 11, fontWeight: 800,
                                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                                  }}
                                >
                                  <i className="fa-solid fa-hand-holding-dollar" /> Collect
                                </Link>
                                {confirmAId===a.id ? (
                                  <div className={s("confirm-row")}>
                                    <span style={{fontSize:11,fontWeight:700,color:"#f43f5e"}}>End?</span>
                                    <button className={cx(s("btn"),s("btn-sm"),s("btn-danger"))} onClick={()=>endAssignment(a.id)}>Yes</button>
                                    <button className={cx(s("btn"),s("btn-sm"))} onClick={()=>setConfirmAId(null)}>No</button>
                                  </div>
                                ) : <button className={cx(s("btn"),s("btn-sm"),s("btn-danger"))} onClick={()=>setConfirmAId(a.id)}><i className="fa-solid fa-xmark"/></button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
