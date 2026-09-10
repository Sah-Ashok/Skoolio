"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApi, clearApiCache } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Loader } from "@/components/shared/Loader";
import DateInput from "@/components/shared/DateInput";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency } from "@/lib/useCurrency";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { isoToBS, daysInBSMonth, BS_MONTH_NAMES } from "@/lib/bs-ad";

// ── Design Tokens ─────────────────────────────────────────────────────────────
const col = {
  navy:     "#0f172a",
  orange:   "#ff9b51",
  bg:       "#f8faff",
  card:     "#ffffff",
  border:   "#e2e8f0",
  muted:    "#64748b",
  green:    "#16a34a",
  greenBg:  "#f0fdf4",
  greenBrd: "#bbf7d0",
  red:      "#dc2626",
  redBg:    "#fef2f2",
  redBrd:   "#fecaca",
  blue:     "#2563eb",
  blueBg:   "#eff6ff",
  blueBrd:  "#bfdbfe",
  purple:   "#7c3aed",
  purpleBg: "#f3eeff",
  purpleBrd:"#ddd6fe",
  amber:    "#d97706",
  amberBg:  "#fffbeb",
  amberBrd: "#fde68a",
};

type Tab = "overview" | "hostels" | "rooms" | "assignments";
type HostelType = "boys" | "girls" | "mixed";
type RoomType = "ac" | "non_ac" | "dormitory";

interface MonthOption {
  key:   string; // e.g. "2083-05" or "2026-08"
  label: string; // e.g. "Bhadra 2083" or "August 2026"
}

/* ── Badges ── */
function Badge({ text, color, bg, border }: { text: string; color: string; bg: string; border?: string }) {
  return (
    <span style={{
      padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 800,
      color, background: bg, border: border ? `1px solid ${border}` : "none",
      textTransform: "capitalize", display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {text.replace("_", " ")}
    </span>
  );
}

const hostelTypeBadge = (t: HostelType) => {
  if (t === "boys")  return <Badge text="Boys Hostel"  color={col.blue}   bg={col.blueBg}   border={col.blueBrd} />;
  if (t === "girls") return <Badge text="Girls Hostel" color={col.purple} bg={col.purpleBg} border={col.purpleBrd} />;
  return <Badge text="Co-Ed / Mixed" color={col.amber} bg={col.amberBg} border={col.amberBrd} />;
};

const roomTypeBadge = (t: RoomType) => {
  if (t === "ac")        return <Badge text="AC Room"     color={col.blue}   bg={col.blueBg}   border={col.blueBrd} />;
  if (t === "dormitory") return <Badge text="Dormitory"   color={col.purple} bg={col.purpleBg} border={col.purpleBrd} />;
  return <Badge text="Non-AC" color={col.muted} bg="#f1f5f9" border="#cbd5e1" />;
};

const statusBadge = (s: string) => {
  if (s === "active" || s === "available" || s === "paid")
    return <Badge text={s} color={col.green}  bg={col.greenBg}  border={col.greenBrd} />;
  if (s === "full" || s === "left" || s === "unpaid")
    return <Badge text={s} color={col.red}    bg={col.redBg}    border={col.redBrd} />;
  if (s === "maintenance" || s === "transferred" || s === "partial")
    return <Badge text={s} color={col.amber}  bg={col.amberBg}  border={col.amberBrd} />;
  return <Badge text={s} color={col.muted} bg="#f1f5f9" border="#cbd5e1" />;
};

/* ── Modal wrapper ── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: col.card, borderRadius: 16, width: "100%", maxWidth: 540,
          maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
          border: `1.5px solid ${col.border}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: "16px 22px", borderBottom: `1px solid ${col.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: col.navy, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              border: "none", background: "none", fontSize: 18, cursor: "pointer",
              color: col.muted, padding: 4, lineHeight: 1,
            }}
          >✕</button>
        </div>
        <div style={{ padding: "20px 22px" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: col.navy, marginBottom: 5 }}>
        {label} {required && <span style={{ color: col.red }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", height: 38, padding: "0 12px",
  border: `1.5px solid ${col.border}`, borderRadius: 8, background: "#fff",
  color: col.navy, fontSize: 13, fontWeight: 700, outline: "none",
};

const pad = (n: number) => String(n).padStart(2, "0");

function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
export default function HostelPage() {
  const dispatch = useAppDispatch();
  const { isBS, formatDate } = useDateFormat();
  const { activeYear, academicYearId } = useAcademicYear();

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

  const [tab, setTab] = useState<Tab>("overview");

  // Currency
  const { symbol: currencySymbol } = useCurrency();

  // Data queries
  const { data: summary,  refetch: refetchSummary }                  = useApi<any>("/hostel/summary");
  const { data: hostels,  loading: hLoading, refetch: refetchHostels } = useApi<any[]>("/hostel");
  const { data: students }                                           = useApi<any[]>(
    activeYear?.id ? `/students/enrollments?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );

  // Month Options (BS / AD) for Fee Status Tracking
  const today = useMemo(() => new Date(), []);
  const monthOptions = useMemo((): MonthOption[] => {
    if (!activeYear) return [];
    const opts: MonthOption[] = [];

    if (!isBS) {
      const start = localDate(String(activeYear.start_date).slice(0, 10));
      const cur   = new Date(start.getFullYear(), start.getMonth(), 1);
      const end   = new Date(today.getFullYear(), today.getMonth(), 1);
      const AD_MONTHS = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December",
      ];
      while (cur <= end) {
        const ay = cur.getFullYear(), am = cur.getMonth() + 1;
        opts.push({
          key:   `${ay}-${pad(am)}`,
          label: `${AD_MONTHS[am - 1]} ${ay}`,
        });
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      const startISO = String(activeYear.start_date).slice(0, 10);
      const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      const startBS  = isoToBS(startISO);
      const todayBS  = isoToBS(todayISO);
      let bsY = startBS.year, bsM = startBS.month;
      while (bsY < todayBS.year || (bsY === todayBS.year && bsM <= todayBS.month)) {
        opts.push({
          key:   `${bsY}-${pad(bsM)}`,
          label: `${BS_MONTH_NAMES[bsM - 1]} ${bsY}`,
        });
        bsM++; if (bsM > 12) { bsM = 1; bsY++; }
      }
    }

    return opts.reverse();
  }, [activeYear, today, isBS]);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");

  useEffect(() => {
    if (monthOptions.length && !selectedMonthKey) {
      setSelectedMonthKey(monthOptions[0].key);
    }
  }, [monthOptions, selectedMonthKey]);

  // Fee Status Collection for the selected month
  const [feeStatusList, setFeeStatusList] = useState<any[]>([]);
  const [feeLoading, setFeeLoading]       = useState(false);

  const loadFeeStatus = useCallback(async () => {
    if (!academicYearId || !selectedMonthKey) return;
    setFeeLoading(true);
    try {
      const res = await apiRequest<{ data: any[] }>(
        `/fees/monthly/status?academic_year_id=${academicYearId}&billing_month=${selectedMonthKey}`
      );
      setFeeStatusList(res.data || []);
    } catch {
      setFeeStatusList([]);
    } finally {
      setFeeLoading(false);
    }
  }, [academicYearId, selectedMonthKey]);

  useEffect(() => {
    loadFeeStatus();
  }, [loadFeeStatus]);

  // Map fee collection by student_id
  const studentFeeMap = useMemo(() => {
    const map = new Map<number, {
      status: "paid" | "partial" | "unpaid";
      total_amount: number;
      paid_amount: number;
      remaining_amount: number;
    }>();

    (feeStatusList || []).forEach(f => {
      if (f.fee_type === "hostel") {
        const sId = Number(f.student_id);
        const prev = map.get(sId);
        const tot = (prev?.total_amount || 0) + Number(f.net_amount || f.total_amount || 0);
        const pd  = (prev?.paid_amount || 0) + Number(f.paid_amount || 0);
        const rem = (prev?.remaining_amount || 0) + Number(f.remaining_amount || 0);
        const st: "paid" | "partial" | "unpaid" = rem <= 0 ? "paid" : pd > 0 ? "partial" : "unpaid";
        map.set(sId, { status: st, total_amount: tot, paid_amount: pd, remaining_amount: rem });
      }
    });
    return map;
  }, [feeStatusList]);

  /* ── Hostel Form State ── */
  const [showHForm, setShowHForm] = useState(false);
  const [editHId, setEditHId]     = useState<number | null>(null);
  const [hSaving, setHSaving]     = useState(false);
  const [confirmHId, setConfirmHId] = useState<number | null>(null);
  const [hForm, setHForm]         = useState({
    name: "", hostel_type: "boys", total_capacity: "",
    warden_name: "", warden_phone: "", warden_email: "",
    address: "", status: "active"
  });

  /* ── Room State ── */
  const [selectedHostelId, setSelectedHostelId] = useState<number | null>(null);
  const [rooms, setRooms]                       = useState<any[]>([]);
  const [roomsLoading, setRoomsLoading]         = useState(false);
  const [showRForm, setShowRForm]               = useState(false);
  const [editRId, setEditRId]                   = useState<number | null>(null);
  const [rSaving, setRSaving]                   = useState(false);
  const [confirmRId, setConfirmRId]             = useState<number | null>(null);
  const [rForm, setRForm]                       = useState({
    hostel_id: "", room_number: "", floor: "1",
    room_type: "non_ac", capacity: "2", monthly_fee: "",
    status: "available", notes: ""
  });

  // Default selected hostel for Rooms tab
  useEffect(() => {
    if (!selectedHostelId && hostels?.length) {
      setSelectedHostelId(hostels[0].id);
    }
  }, [hostels, selectedHostelId]);

  const loadRooms = useCallback(async (hostelId: number) => {
    setRoomsLoading(true);
    try {
      const res = await apiRequest<{ data: any[] }>(`/hostel/${hostelId}/rooms`);
      setRooms(res.data || []);
    } catch {
      setRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedHostelId) loadRooms(selectedHostelId);
  }, [selectedHostelId, loadRooms]);

  /* ── Student Boarding & Dues State ── */
  const [viewHostelAssignId, setViewHostelAssignId] = useState<number | null>(null);
  const [assignments, setAssignments]               = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [showAForm, setShowAForm]                   = useState(false);
  const [aSaving, setASaving]                       = useState(false);
  const [confirmAId, setConfirmAId]                 = useState<number | null>(null);
  const [assignSearch, setAssignSearch]             = useState("");
  const [statusFilter, setStatusFilter]             = useState<"all" | "pending" | "paid">("all");

  const [studentSearch, setStudentSearch]           = useState("");
  const [showStudentDrop, setShowStudentDrop]       = useState(false);
  const [selectedStudent, setSelectedStudent]       = useState<any>(null);
  const [assignHostelId, setAssignHostelId]         = useState<string>("");
  const [assignRooms, setAssignRooms]               = useState<any[]>([]);
  const [aForm, setAForm]                           = useState({
    student_id: "", hostel_id: "", room_id: "",
    joining_date: new Date().toISOString().slice(0, 10),
    notes: ""
  });

  // Default selected hostel for Assignments tab
  useEffect(() => {
    if (!viewHostelAssignId && hostels?.length) {
      setViewHostelAssignId(hostels[0].id);
    }
  }, [hostels, viewHostelAssignId]);

  const loadAssignments = useCallback(async (hostelId: number) => {
    setAssignmentsLoading(true);
    try {
      const res = await apiRequest<{ data: any[] }>(`/hostel/${hostelId}/students`);
      setAssignments(res.data || []);
    } catch {
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewHostelAssignId) loadAssignments(viewHostelAssignId);
  }, [viewHostelAssignId, loadAssignments]);

  // Load available rooms when assignHostelId changes in modal
  useEffect(() => {
    if (assignHostelId) {
      apiRequest<{ data: any[] }>(`/hostel/${assignHostelId}/rooms`)
        .then(res => setAssignRooms(res.data || []))
        .catch(() => setAssignRooms([]));
    } else {
      setAssignRooms([]);
    }
  }, [assignHostelId]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase();
    return (students || []).filter((s: any) =>
      !q ||
      (s.full_name || "").toLowerCase().includes(q) ||
      (s.admission_number || "").toLowerCase().includes(q) ||
      (s.roll_number || "").toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const displayedAssignments = useMemo(() => {
    const q = assignSearch.toLowerCase();
    return assignments.filter((a: any) => {
      const sName = (a.full_name || a.student_name || "").toLowerCase();
      const matchSearch =
        !q ||
        sName.includes(q) ||
        (a.admission_number || "").toLowerCase().includes(q) ||
        (a.room_number || "").toLowerCase().includes(q);

      if (!matchSearch) return false;

      const feeInfo = studentFeeMap.get(Number(a.student_id));
      if (statusFilter === "pending") {
        return feeInfo?.status === "unpaid" || feeInfo?.status === "partial";
      }
      if (statusFilter === "paid") {
        return feeInfo?.status === "paid";
      }
      return true;
    });
  }, [assignments, assignSearch, statusFilter, studentFeeMap]);

  /* ── Calculations ── */
  const totalBeds     = summary?.total_beds ?? 0;
  const occupiedBeds  = summary?.occupied_beds ?? 0;
  const availableBeds = Math.max(0, totalBeds - occupiedBeds);
  const occupancyPct  = (h: any) => {
    const cap = Number(h.total_bed_capacity || h.total_capacity || 0);
    const occ = Number(h.occupied_beds || 0);
    return cap > 0 ? Math.round((occ / cap) * 100) : 0;
  };

  // Total pending dues across all boarding students in the selected hostel
  const totalHostelDues = useMemo(() => {
    let due = 0;
    assignments.forEach(a => {
      const f = studentFeeMap.get(Number(a.student_id));
      if (f?.remaining_amount) due += f.remaining_amount;
    });
    return due;
  }, [assignments, studentFeeMap]);

  /* ── HOSTEL CRUD ── */
  const openAddHostel = () => {
    setEditHId(null);
    setHForm({ name: "", hostel_type: "boys", total_capacity: "", warden_name: "", warden_phone: "", warden_email: "", address: "", status: "active" });
    setShowHForm(true);
  };

  const openEditHostel = (h: any) => {
    setEditHId(h.id);
    setHForm({
      name: h.name, hostel_type: h.hostel_type, total_capacity: String(h.total_capacity),
      warden_name: h.warden_name || "", warden_phone: h.warden_phone || "",
      warden_email: h.warden_email || "", address: h.address || "", status: h.status,
    });
    setShowHForm(true);
  };

  const saveHostel = async () => {
    if (!hForm.name || !hForm.total_capacity) {
      dispatch(showToast({ type: "error", title: "Required Fields", message: "Hostel name and total capacity are required." }));
      return;
    }
    setHSaving(true);
    try {
      const payload = { ...hForm, total_capacity: Number(hForm.total_capacity) };
      if (editHId) await apiRequest(`/hostel/${editHId}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await apiRequest("/hostel", { method: "POST", body: JSON.stringify(payload) });
      dispatch(showToast({ type: "success", title: "Saved", message: `Hostel ${editHId ? "updated" : "created"} successfully.` }));
      setShowHForm(false);
      refetchHostels();
      refetchSummary();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Error", message: e.message }));
    } finally {
      setHSaving(false);
    }
  };

  const deleteHostel = async (id: number) => {
    try {
      await apiRequest(`/hostel/${id}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Deleted", message: "Hostel removed." }));
      setConfirmHId(null);
      refetchHostels();
      refetchSummary();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Error", message: e.message }));
    }
  };

  /* ── ROOM CRUD ── */
  const openAddRoom = () => {
    setEditRId(null);
    setRForm({
      hostel_id: String(selectedHostelId || ""), room_number: "", floor: "1",
      room_type: "non_ac", capacity: "2", monthly_fee: "", status: "available", notes: ""
    });
    setShowRForm(true);
  };

  const openEditRoom = (r: any) => {
    setEditRId(r.id);
    setRForm({
      hostel_id: String(r.hostel_id), room_number: r.room_number, floor: String(r.floor),
      room_type: r.room_type, capacity: String(r.capacity), monthly_fee: String(r.monthly_fee),
      status: r.status, notes: r.notes || ""
    });
    setShowRForm(true);
  };

  const saveRoom = async () => {
    if (!rForm.room_number || !rForm.monthly_fee) {
      dispatch(showToast({ type: "error", title: "Required Fields", message: "Room number and monthly fee are required." }));
      return;
    }
    setRSaving(true);
    try {
      const payload = {
        ...rForm,
        hostel_id: Number(rForm.hostel_id || selectedHostelId),
        floor: Number(rForm.floor),
        capacity: Number(rForm.capacity),
        monthly_fee: Number(rForm.monthly_fee)
      };
      if (editRId) await apiRequest(`/hostel/rooms/${editRId}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await apiRequest("/hostel/rooms", { method: "POST", body: JSON.stringify(payload) });
      dispatch(showToast({ type: "success", title: "Saved", message: `Room ${editRId ? "updated" : "added"} successfully.` }));
      setShowRForm(false);
      if (selectedHostelId) loadRooms(selectedHostelId);
      refetchSummary();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Error", message: e.message }));
    } finally {
      setRSaving(false);
    }
  };

  const deleteRoom = async (id: number) => {
    try {
      await apiRequest(`/hostel/rooms/${id}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Deleted", message: "Room removed." }));
      setConfirmRId(null);
      if (selectedHostelId) loadRooms(selectedHostelId);
      refetchSummary();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Error", message: e.message }));
    }
  };

  /* ── ASSIGNMENT CRUD ── */
  const openAssignModal = () => {
    setSelectedStudent(null);
    setStudentSearch("");
    setAssignHostelId(String(viewHostelAssignId || hostels?.[0]?.id || ""));
    setAForm({
      student_id: "", hostel_id: String(viewHostelAssignId || hostels?.[0]?.id || ""),
      room_id: "", joining_date: new Date().toISOString().slice(0, 10), notes: ""
    });
    setShowAForm(true);
  };

  const saveAssignment = async () => {
    const joining_date = aForm.joining_date || new Date().toISOString().slice(0, 10);
    if (!aForm.student_id || !aForm.hostel_id || !aForm.room_id || !activeYear?.id) {
      dispatch(showToast({ type: "error", title: "Required Fields", message: "Student, hostel, and room are required." }));
      return;
    }
    setASaving(true);
    try {
      await apiRequest("/hostel/assignments", {
        method: "POST",
        body: JSON.stringify({
          ...aForm,
          joining_date,
          student_id: Number(aForm.student_id),
          hostel_id: Number(aForm.hostel_id),
          room_id: Number(aForm.room_id),
          academic_year_id: activeYear.id,
        })
      });
      dispatch(showToast({ type: "success", title: "Assigned", message: "Student assigned to room successfully." }));
      setShowAForm(false);
      if (viewHostelAssignId) loadAssignments(viewHostelAssignId);
      if (selectedHostelId) loadRooms(selectedHostelId);
      refetchSummary();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Error", message: e.message }));
    } finally {
      setASaving(false);
    }
  };

  const vacateAssignment = async (id: number) => {
    try {
      await apiRequest(`/hostel/assignments/${id}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Vacated", message: "Student accommodation vacated." }));
      setConfirmAId(null);
      if (viewHostelAssignId) loadAssignments(viewHostelAssignId);
      if (selectedHostelId) loadRooms(selectedHostelId);
      refetchSummary();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Error", message: e.message }));
    }
  };

  if (!isFinance && hasActiveFinanceAccount) {
    return (
      <div style={{ minHeight: "80vh", background: col.bg, display: "grid", placeItems: "center", padding: "40px 20px" }}>
        <div style={{
          background: "#fff",
          border: `1.5px solid ${col.border}`,
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
            <i className="fa-solid fa-building" />
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

          <h2 style={{ fontSize: 20, fontWeight: 900, color: col.navy, margin: "0 0 10px" }}>
            Hostel Facility Managed by Finance Department
          </h2>

          <p style={{ fontSize: 13.5, color: col.muted, lineHeight: 1.6, margin: "0 0 20px" }}>
            Your school has configured an active <strong>Finance Manager</strong> ({financeAccount?.full_name || "Finance Officer"} &bull; {financeAccount?.email}).
            Hostel allocations, room management, and boarding fee dues are currently delegated to the <strong>Finance Portal</strong>.
          </p>

          <div style={{
            background: "#f8fafc",
            border: `1px solid ${col.border}`,
            borderRadius: 10,
            padding: "14px 18px",
            textAlign: "left",
            fontSize: 12.5,
            color: col.muted,
            marginBottom: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: col.navy, marginBottom: 4 }}>
              <i className="fa-solid fa-circle-info" style={{ color: col.blue }} />
              Admin Access &amp; Fallback
            </div>
            <div>
              If the Finance Manager access is revoked, complete control over hostel facilities will immediately return to the School Admin dashboard.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/dashboard"
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: 9,
                background: col.navy,
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
                border: `1.5px solid ${col.border}`,
                background: "#fff",
                color: col.navy,
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
    <div style={{ minHeight: "100vh", background: "#f8faff", display: "flex", flexDirection: "column" }}>
      <style>{`
        .h-stat-card {
          flex: 1; min-width: 140px; height: 76px; border-radius: 12px;
          border: 1.5px solid #e2e8f0; background: #fff; padding: 12px 16px;
          display: flex; align-items: center; justify-content: space-between;
          box-shadow: 0 1px 3px rgba(15,23,42,0.03);
        }
        .h-tab-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 15px; border-radius: 8px; border: none;
          cursor: pointer; font-size: 12.5px; font-weight: 800;
          transition: all 0.15s;
        }
        .h-table-wrap { overflow-x: auto; }
        .h-table-wrap table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .h-table-wrap th {
          background: #f8fafc; padding: 11px 14px; font-weight: 800; font-size: 11px;
          color: #475569; text-transform: uppercase; letter-spacing: 0.5px;
          border-bottom: 1px solid #e2e8f0; text-align: left;
        }
        .h-table-wrap td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
      `}</style>

      <main style={{ padding: "24px 28px 48px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Header Toolbar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap", borderBottom: "1px solid #e2e8f0", paddingBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: col.orange,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900,
            }}>
              <i className="fa-solid fa-hotel" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: col.navy, margin: 0 }}>
                Hostel &amp; Accommodation
              </h1>
              <p style={{ fontSize: 12.5, color: col.muted, fontWeight: 600, margin: "2px 0 0" }}>
                Manage hostels, room allocations, student boarding, and pending fee dues
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link
              href={collectUrl}
              style={{
                height: 38, padding: "0 14px", borderRadius: 8, border: `1.5px solid ${col.border}`,
                background: "#fff", color: col.navy, fontWeight: 800, fontSize: 12.5,
                display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
              }}
            >
              <i className="fa-solid fa-hand-holding-dollar" style={{ color: col.green }} /> Collect Fee
            </Link>

            <button
              onClick={openAddHostel}
              style={{
                height: 38, padding: "0 16px", borderRadius: 8, border: "none",
                background: col.orange, color: "#fff", fontWeight: 900, fontSize: 13,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                boxShadow: "0 2px 8px rgba(255,155,81,0.25)",
              }}
            >
              <i className="fa-solid fa-plus" /> Add Hostel
            </button>
          </div>
        </div>

        {/* ── 5 Stat Metric Cards (~75px) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <div className="h-stat-card">
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: col.muted, textTransform: "uppercase" }}>Active Hostels</span>
              <div style={{ fontSize: 20, fontWeight: 900, color: col.navy }}>{summary?.active_hostels ?? 0}</div>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "#eff6ff", color: col.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
              <i className="fa-solid fa-building" />
            </div>
          </div>

          <div className="h-stat-card">
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: col.muted, textTransform: "uppercase" }}>Total Rooms</span>
              <div style={{ fontSize: 20, fontWeight: 900, color: col.navy }}>{summary?.total_rooms ?? 0}</div>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "#f3eeff", color: col.purple, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
              <i className="fa-solid fa-door-open" />
            </div>
          </div>

          <div className="h-stat-card">
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: col.muted, textTransform: "uppercase" }}>Total Capacity</span>
              <div style={{ fontSize: 20, fontWeight: 900, color: col.navy }}>{totalBeds} Beds</div>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "#fff7ed", color: col.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
              <i className="fa-solid fa-bed" />
            </div>
          </div>

          <div className="h-stat-card" style={{ borderLeft: `4px solid ${col.green}` }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: col.green, textTransform: "uppercase" }}>Occupied Beds</span>
              <div style={{ fontSize: 20, fontWeight: 900, color: col.green }}>{occupiedBeds}</div>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: col.greenBg, color: col.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
              <i className="fa-solid fa-user-check" />
            </div>
          </div>

          <div className="h-stat-card" style={{ borderLeft: `4px solid ${availableBeds > 0 ? col.blue : col.red}` }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: availableBeds > 0 ? col.blue : col.red, textTransform: "uppercase" }}>Available Beds</span>
              <div style={{ fontSize: 20, fontWeight: 900, color: availableBeds > 0 ? col.blue : col.red }}>{availableBeds}</div>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: availableBeds > 0 ? col.blueBg : col.redBg, color: availableBeds > 0 ? col.blue : col.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
              <i className="fa-solid fa-bed-pulse" />
            </div>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div style={{ display: "flex", gap: 6, background: "#f1f5f9", padding: 4, borderRadius: 10, width: "fit-content", border: `1px solid ${col.border}` }}>
          {[
            { id: "overview",    icon: "fa-gauge-high", label: "Overview" },
            { id: "hostels",     icon: "fa-building",   label: "Hostels" },
            { id: "rooms",       icon: "fa-door-open",  label: "Rooms" },
            { id: "assignments", icon: "fa-users-gear", label: "Boarding & Fee Dues" },
          ].map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as Tab)}
                className="h-tab-btn"
                style={{
                  background: active ? "#fff" : "transparent",
                  color: active ? col.navy : col.muted,
                  boxShadow: active ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
                }}
              >
                <i className={`fa-solid ${t.icon}`} style={{ fontSize: 12, color: active ? col.orange : undefined }} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ════════════ TAB 1: OVERVIEW ════════════ */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {hLoading ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading hostels…" /></div>
            ) : !(hostels?.length) ? (
              <div style={{ background: "#fff", border: `1.5px solid ${col.border}`, borderRadius: 14, padding: "4rem 2rem", textAlign: "center", color: col.muted }}>
                <i className="fa-solid fa-hotel" style={{ fontSize: 40, opacity: 0.35, marginBottom: 12, display: "block" }} />
                <p style={{ fontWeight: 800, fontSize: 16, color: col.navy, margin: 0 }}>No Hostels Added Yet</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Add your first hostel building to manage rooms and boarding.</p>
                <button
                  onClick={openAddHostel}
                  style={{
                    marginTop: 12, height: 38, padding: "0 18px", borderRadius: 8, border: "none",
                    background: col.orange, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
                  }}
                >
                  <i className="fa-solid fa-plus" /> Add Hostel
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                {hostels.map((h: any) => {
                  const pct = occupancyPct(h);
                  const pctColor = pct >= 90 ? col.red : pct >= 70 ? col.amber : col.green;
                  const hCapacity = Number(h.total_bed_capacity || h.total_capacity || 0);
                  const hOccupied = Number(h.occupied_beds || 0);
                  const hVacant   = Math.max(0, hCapacity - hOccupied);

                  return (
                    <div
                      key={h.id}
                      style={{
                        background: "#fff", borderRadius: 14, border: `1.5px solid ${col.border}`,
                        padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14,
                        boxShadow: "0 1px 3px rgba(15,23,42,0.03)",
                      }}
                    >
                      {/* Hostel Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: h.hostel_type === "boys" ? col.blueBg : h.hostel_type === "girls" ? col.purpleBg : col.amberBg,
                            color: h.hostel_type === "boys" ? col.blue : h.hostel_type === "girls" ? col.purple : col.amber,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                          }}>
                            <i className={`fa-solid ${h.hostel_type === "boys" ? "fa-mars" : h.hostel_type === "girls" ? "fa-venus" : "fa-venus-mars"}`} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: 15, fontWeight: 900, color: col.navy, margin: 0 }}>{h.name}</h3>
                            <div style={{ marginTop: 4, display: "flex", gap: 5, flexWrap: "wrap" }}>
                              {hostelTypeBadge(h.hostel_type)}
                              {statusBadge(h.status)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Occupancy Progress */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: col.muted }}>Occupancy Rate</span>
                          <strong style={{ fontSize: 13, fontWeight: 900, color: pctColor }}>{pct}%</strong>
                        </div>
                        <div style={{ height: 6, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pctColor, borderRadius: 99, transition: "width 0.4s" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11.5, fontWeight: 700, color: col.muted }}>
                          <span><i className="fa-solid fa-user-check" style={{ color: col.green, marginRight: 4 }} />{hOccupied} Occupied</span>
                          <span><i className="fa-solid fa-door-open" style={{ color: col.blue, marginRight: 4 }} />{h.total_rooms || 0} Rooms</span>
                          <span><i className="fa-solid fa-bed" style={{ color: col.purple, marginRight: 4 }} />{hVacant} Vacant</span>
                        </div>
                      </div>

                      {/* Warden Info */}
                      {h.warden_name ? (
                        <div style={{
                          padding: "8px 12px", borderRadius: 8, background: "#f8fafc",
                          border: `1px solid ${col.border}`, fontSize: 12, color: col.muted, fontWeight: 600,
                        }}>
                          <i className="fa-solid fa-user-shield" style={{ color: col.orange, marginRight: 6 }} />
                          Warden: <strong style={{ color: col.navy }}>{h.warden_name}</strong>
                          {h.warden_phone && <span style={{ marginLeft: 8 }}><i className="fa-solid fa-phone" style={{ fontSize: 10, marginRight: 3 }} />{h.warden_phone}</span>}
                        </div>
                      ) : null}

                      {/* Card Actions */}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => { setSelectedHostelId(h.id); setTab("rooms"); }}
                          style={{
                            flex: 1, height: 34, borderRadius: 7, border: `1px solid ${col.border}`,
                            background: "#fff", color: col.navy, fontWeight: 800, fontSize: 12, cursor: "pointer",
                            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                          }}
                        >
                          <i className="fa-solid fa-door-open" style={{ color: col.blue }} /> View Rooms
                        </button>
                        <button
                          onClick={() => { setViewHostelAssignId(h.id); setTab("assignments"); }}
                          style={{
                            flex: 1, height: 34, borderRadius: 7, border: `1px solid ${col.border}`,
                            background: "#fff", color: col.navy, fontWeight: 800, fontSize: 12, cursor: "pointer",
                            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                          }}
                        >
                          <i className="fa-solid fa-users-gear" style={{ color: col.purple }} /> Boarding &amp; Dues
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════ TAB 2: HOSTELS ════════════ */}
        {tab === "hostels" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              background: "#fff", borderRadius: 14, border: `1.5px solid ${col.border}`,
              overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.03)",
            }}>
              <div style={{
                padding: "14px 18px", borderBottom: `1px solid ${col.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: col.navy }}>
                  All Hostels ({hostels?.length || 0})
                </span>
                <button
                  onClick={openAddHostel}
                  style={{
                    height: 32, padding: "0 12px", borderRadius: 6, border: "none",
                    background: col.orange, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer",
                  }}
                >
                  <i className="fa-solid fa-plus" /> New Hostel
                </button>
              </div>

              <div className="h-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 45 }}>#</th>
                      <th>Hostel Name</th>
                      <th>Type</th>
                      <th>Capacity</th>
                      <th>Rooms</th>
                      <th>Occupancy</th>
                      <th>Warden</th>
                      <th>Status</th>
                      <th style={{ width: 110, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hLoading ? (
                      <tr><td colSpan={9} style={{ textAlign: "center", padding: "2rem" }}><Loader fullScreen={false} size="md" text="Loading hostels…" /></td></tr>
                    ) : !(hostels?.length) ? (
                      <tr><td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: col.muted, fontWeight: 700 }}>No hostels created yet.</td></tr>
                    ) : (
                      hostels.map((h: any, idx: number) => (
                        <tr key={h.id}>
                          <td style={{ fontWeight: 800, color: col.muted, fontSize: 12 }}>{idx + 1}</td>
                          <td>
                            <strong style={{ color: col.navy, fontSize: 13.5 }}>{h.name}</strong>
                            {h.address && <p style={{ fontSize: 11, color: col.muted, margin: "2px 0 0" }}>{h.address}</p>}
                          </td>
                          <td>{hostelTypeBadge(h.hostel_type)}</td>
                          <td style={{ fontWeight: 800 }}>{h.total_capacity} Beds</td>
                          <td style={{ fontWeight: 800 }}>{h.total_rooms || 0}</td>
                          <td>
                            <span style={{ fontWeight: 800, color: Number(h.occupied_beds) > 0 ? col.green : col.muted }}>
                              {h.occupied_beds || 0}
                            </span>
                            <span style={{ color: col.muted, fontSize: 12 }}> / {h.total_bed_capacity || h.total_capacity}</span>
                          </td>
                          <td style={{ fontSize: 12, color: col.muted, fontWeight: 600 }}>{h.warden_name || "—"}</td>
                          <td>{statusBadge(h.status)}</td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              <button
                                onClick={() => openEditHostel(h)}
                                style={{
                                  padding: "4px 8px", borderRadius: 6, border: `1px solid ${col.border}`,
                                  background: "#fff", color: col.blue, fontSize: 11, fontWeight: 800, cursor: "pointer",
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setConfirmHId(h.id)}
                                style={{
                                  padding: "4px 8px", borderRadius: 6, border: `1px solid ${col.redBrd}`,
                                  background: col.redBg, color: col.red, fontSize: 11, fontWeight: 800, cursor: "pointer",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ TAB 3: ROOMS ════════════ */}
        {tab === "rooms" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Toolbar */}
            <div style={{
              background: "#fff", borderRadius: 12, border: `1.5px solid ${col.border}`,
              padding: "10px 16px", display: "flex", justifyContent: "space-between",
              alignItems: "center", flexWrap: "wrap", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: col.muted }}>Hostel:</span>
                <select
                  value={selectedHostelId || ""}
                  onChange={e => setSelectedHostelId(Number(e.target.value))}
                  style={{
                    height: 36, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${col.border}`,
                    fontSize: 13, fontWeight: 800, color: col.navy, background: "#fff", outline: "none",
                  }}
                >
                  {(hostels || []).map((h: any) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                <span style={{ fontSize: 12, color: col.muted, fontWeight: 700 }}>
                  ({rooms.length} Rooms)
                </span>
              </div>

              <button
                onClick={openAddRoom}
                disabled={!selectedHostelId}
                style={{
                  height: 36, padding: "0 14px", borderRadius: 8, border: "none",
                  background: col.orange, color: "#fff", fontWeight: 800, fontSize: 12.5,
                  cursor: selectedHostelId ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <i className="fa-solid fa-plus" /> Add Room
              </button>
            </div>

            {/* Room Cards Grid */}
            {roomsLoading ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading rooms…" /></div>
            ) : !rooms.length ? (
              <div style={{ background: "#fff", border: `1.5px solid ${col.border}`, borderRadius: 14, padding: "3rem", textAlign: "center", color: col.muted }}>
                <i className="fa-solid fa-door-open" style={{ fontSize: 36, opacity: 0.35, marginBottom: 10, display: "block" }} />
                <p style={{ fontWeight: 800, fontSize: 15, color: col.navy, margin: 0 }}>No rooms created for this hostel</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Click "Add Room" to create accommodation rooms.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                {rooms.map((r: any) => {
                  const occ = Number(r.occupied_count || 0);
                  const cap = Number(r.capacity || 1);
                  const isFull = occ >= cap;

                  return (
                    <div
                      key={r.id}
                      style={{
                        background: "#fff", borderRadius: 12, border: `1.5px solid ${isFull ? col.redBrd : col.border}`,
                        padding: "16px", display: "flex", flexDirection: "column", gap: 12,
                        boxShadow: "0 1px 3px rgba(15,23,42,0.02)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <strong style={{ fontSize: 16, fontWeight: 900, color: col.navy }}>Room {r.room_number}</strong>
                          <p style={{ fontSize: 11.5, color: col.muted, fontWeight: 700, margin: "2px 0 0" }}>Floor {r.floor}</p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                          {roomTypeBadge(r.room_type)}
                          {statusBadge(r.status)}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: `1px solid ${col.border}` }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: col.muted, textTransform: "uppercase" }}>Occupancy</span>
                          <p style={{ fontSize: 13.5, fontWeight: 900, color: isFull ? col.red : col.green, margin: "2px 0 0" }}>
                            {occ} / {cap} Beds
                          </p>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: `1px solid ${col.border}` }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: col.muted, textTransform: "uppercase" }}>Monthly Fee</span>
                          <p style={{ fontSize: 13.5, fontWeight: 900, color: col.navy, margin: "2px 0 0" }}>
                            {currencySymbol} {Number(r.monthly_fee).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {r.notes && <p style={{ fontSize: 11.5, color: col.muted, margin: 0, fontWeight: 600 }}>{r.notes}</p>}

                      <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
                        <button
                          onClick={() => openEditRoom(r)}
                          style={{
                            flex: 1, height: 30, borderRadius: 6, border: `1px solid ${col.border}`,
                            background: "#fff", color: col.blue, fontSize: 11.5, fontWeight: 800, cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmRId(r.id)}
                          style={{
                            flex: 1, height: 30, borderRadius: 6, border: `1px solid ${col.redBrd}`,
                            background: col.redBg, color: col.red, fontSize: 11.5, fontWeight: 800, cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════ TAB 4: STUDENT BOARDING & FEE DUES ════════════ */}
        {tab === "assignments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Control Toolbar */}
            <div style={{
              background: "#fff", borderRadius: 12, border: `1.5px solid ${col.border}`,
              padding: "12px 16px", display: "flex", justifyContent: "space-between",
              alignItems: "center", flexWrap: "wrap", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 280, flexWrap: "wrap" }}>
                {/* Month Picker */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: col.muted }}>Month:</span>
                  <select
                    value={selectedMonthKey}
                    onChange={e => setSelectedMonthKey(e.target.value)}
                    style={{
                      height: 36, padding: "0 10px", borderRadius: 8, border: `1.5px solid ${col.border}`,
                      fontSize: 12.5, fontWeight: 800, color: col.navy, background: "#fff", outline: "none",
                    }}
                  >
                    {monthOptions.map(o => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Hostel Selector */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: col.muted }}>Hostel:</span>
                  <select
                    value={viewHostelAssignId || ""}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setViewHostelAssignId(v);
                    }}
                    style={{
                      height: 36, padding: "0 10px", borderRadius: 8, border: `1.5px solid ${col.border}`,
                      fontSize: 12.5, fontWeight: 800, color: col.navy, background: "#fff", outline: "none",
                    }}
                  >
                    {(hostels || []).map((h: any) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>

                {/* Search Bar */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, border: `1.5px solid ${col.border}`,
                  borderRadius: 8, padding: "0 10px", background: "#f8fafc", height: 36, minWidth: 180, flex: 1,
                }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 12 }} />
                  <input
                    type="search"
                    placeholder="Search student, admission no, room…"
                    value={assignSearch}
                    onChange={e => setAssignSearch(e.target.value)}
                    style={{ border: "none", background: "transparent", width: "100%", fontSize: 12, outline: "none", color: col.navy, fontWeight: 600 }}
                  />
                </div>

                {/* Dues Filter Pills */}
                <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 3, borderRadius: 8 }}>
                  {(["all", "pending", "paid"] as const).map(f => {
                    const active = statusFilter === f;
                    return (
                      <button
                        key={f}
                        onClick={() => setStatusFilter(f)}
                        style={{
                          padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer",
                          fontSize: 11.5, fontWeight: 800,
                          background: active ? "#fff" : "transparent",
                          color: active ? col.navy : col.muted,
                          boxShadow: active ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
                        }}
                      >
                        {f === "all" ? "All" : f === "pending" ? "Pending Dues" : "Paid"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Action */}
              <button
                onClick={openAssignModal}
                style={{
                  height: 36, padding: "0 14px", borderRadius: 8, border: "none",
                  background: col.orange, color: "#fff", fontWeight: 800, fontSize: 12.5,
                  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                  boxShadow: "0 2px 8px rgba(255,155,81,0.25)",
                }}
              >
                <i className="fa-solid fa-user-plus" /> Assign Student
              </button>
            </div>

            {/* Assignments Table */}
            <div style={{
              background: "#fff", borderRadius: 14, border: `1.5px solid ${col.border}`,
              overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.03)",
            }}>
              <div className="h-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 45 }}>#</th>
                      <th>Boarding Student</th>
                      <th>Admission No</th>
                      <th>Room &amp; Floor</th>
                      <th>Room Type</th>
                      <th>Monthly Fee</th>
                      <th>Joined Date</th>
                      <th>Fee Status ({monthOptions.find(o => o.key === selectedMonthKey)?.label || "Month"})</th>
                      <th style={{ width: 150, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentsLoading || feeLoading ? (
                      <tr><td colSpan={9} style={{ textAlign: "center", padding: "2rem" }}><Loader fullScreen={false} size="md" text="Loading assignments…" /></td></tr>
                    ) : !(displayedAssignments.length) ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", padding: "3rem", color: col.muted, fontWeight: 700 }}>
                          {assignSearch ? "No students match your search." : "No students currently assigned to this hostel."}
                        </td>
                      </tr>
                    ) : (
                      displayedAssignments.map((a: any, idx: number) => {
                        const feeInfo = studentFeeMap.get(Number(a.student_id));
                        const isPaid    = feeInfo?.status === "paid";
                        const isPartial = feeInfo?.status === "partial";
                        const isUnpaid  = feeInfo?.status === "unpaid";
                        const studentName = a.full_name || a.student_name || "Student";
                        const joinDate = a.joining_date || a.joined_date;

                        return (
                          <tr key={a.id}>
                            <td style={{ fontWeight: 800, color: col.muted, fontSize: 12 }}>{idx + 1}</td>
                            <td>
                              <strong style={{ color: col.navy, fontSize: 13.5 }}>{studentName}</strong>
                              {a.class_name && (
                                <p style={{ fontSize: 11, color: col.muted, margin: "2px 0 0", fontWeight: 600 }}>
                                  {a.class_name} {a.section_name ? `• ${a.section_name}` : ""}
                                </p>
                              )}
                            </td>
                            <td style={{ fontSize: 12.5, fontWeight: 700, color: col.muted }}>{a.admission_number || "—"}</td>
                            <td>
                              <strong style={{ color: col.navy }}>Room {a.room_number}</strong>
                              <p style={{ fontSize: 11, color: col.muted, margin: "2px 0 0" }}>Floor {a.floor}</p>
                            </td>
                            <td>{roomTypeBadge(a.room_type)}</td>
                            <td style={{ fontWeight: 800, color: col.navy }}>
                              {currencySymbol} {Number(a.monthly_fee).toLocaleString()}
                            </td>
                            <td style={{ fontSize: 12, color: col.muted, fontWeight: 700 }}>
                              {joinDate ? formatDate(joinDate) : "—"}
                            </td>
                            <td>
                              {isPaid ? (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800,
                                  background: col.greenBg, color: col.green, border: `1px solid ${col.greenBrd}`,
                                }}>
                                  <i className="fa-solid fa-circle-check" /> Paid ({currencySymbol} {feeInfo?.paid_amount?.toLocaleString()})
                                </span>
                              ) : isPartial ? (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800,
                                  background: col.amberBg, color: col.amber, border: `1px solid ${col.amberBrd}`,
                                }}>
                                  <i className="fa-solid fa-clock" /> Due: {currencySymbol} {feeInfo?.remaining_amount?.toLocaleString()}
                                </span>
                              ) : isUnpaid ? (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800,
                                  background: col.redBg, color: col.red, border: `1px solid ${col.redBrd}`,
                                }}>
                                  <i className="fa-solid fa-circle-exclamation" /> Due: {currencySymbol} {feeInfo?.remaining_amount?.toLocaleString()}
                                </span>
                              ) : (
                                <span style={{ fontSize: 11.5, color: col.muted, fontWeight: 600 }}>
                                  Unbilled / No Record
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                <Link
                                  href={`${collectUrl}?student_id=${a.student_id}`}
                                  style={{
                                    padding: "4px 8px", borderRadius: 6, border: `1px solid ${col.border}`,
                                    background: "#fff", color: col.blue, fontSize: 11, fontWeight: 800,
                                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                                  }}
                                >
                                  <i className="fa-solid fa-hand-holding-dollar" /> Collect
                                </Link>

                                {a.status === "active" && (
                                  <button
                                    onClick={() => setConfirmAId(a.id)}
                                    style={{
                                      padding: "4px 8px", borderRadius: 6, border: `1px solid ${col.redBrd}`,
                                      background: col.redBg, color: col.red, fontSize: 11, fontWeight: 800, cursor: "pointer",
                                    }}
                                  >
                                    Vacate
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer with Summary */}
              {!assignmentsLoading && displayedAssignments.length > 0 && (
                <div style={{
                  padding: "12px 18px", background: "#f8fafc", borderTop: `1px solid ${col.border}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
                }}>
                  <span style={{ fontSize: 12.5, color: col.muted, fontWeight: 700 }}>
                    Showing <strong>{displayedAssignments.length}</strong> of <strong>{assignments.length}</strong> boarding students
                  </span>

                  {totalHostelDues > 0 && (
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: col.red }}>
                      Total Hostel Dues for this Hostel: <strong>{currencySymbol} {totalHostelDues.toLocaleString()}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MODALS ── */}
        {/* Hostel Add/Edit Modal */}
        {showHForm && (
          <Modal title={editHId ? "Edit Hostel" : "Add New Hostel"} onClose={() => setShowHForm(false)}>
            <Field label="Hostel Name" required>
              <input
                type="text" placeholder="e.g. Boys Hostel Alpha"
                value={hForm.name}
                onChange={e => setHForm(f => ({ ...f, name: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Hostel Type" required>
                <select
                  value={hForm.hostel_type}
                  onChange={e => setHForm(f => ({ ...f, hostel_type: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="boys">Boys Hostel</option>
                  <option value="girls">Girls Hostel</option>
                  <option value="mixed">Co-ed / Mixed</option>
                </select>
              </Field>

              <Field label="Total Bed Capacity" required>
                <input
                  type="number" min="1" placeholder="e.g. 50"
                  value={hForm.total_capacity}
                  onChange={e => setHForm(f => ({ ...f, total_capacity: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Warden Name">
                <input
                  type="text" placeholder="Full name"
                  value={hForm.warden_name}
                  onChange={e => setHForm(f => ({ ...f, warden_name: e.target.value }))}
                  style={inputStyle}
                />
              </Field>

              <Field label="Warden Phone">
                <input
                  type="tel" placeholder="Mobile number"
                  value={hForm.warden_phone}
                  onChange={e => setHForm(f => ({ ...f, warden_phone: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Address / Location">
              <input
                type="text" placeholder="Building, block, campus location"
                value={hForm.address}
                onChange={e => setHForm(f => ({ ...f, address: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowHForm(false)}
                style={{
                  height: 36, padding: "0 14px", borderRadius: 8, border: `1.5px solid ${col.border}`,
                  background: "#fff", color: col.navy, fontWeight: 800, fontSize: 12.5, cursor: "pointer",
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={saveHostel}
                disabled={hSaving}
                style={{
                  height: 36, padding: "0 18px", borderRadius: 8, border: "none",
                  background: col.orange, color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer",
                }}
              >{hSaving ? "Saving..." : "Save Hostel"}</button>
            </div>
          </Modal>
        )}

        {/* Room Add/Edit Modal */}
        {showRForm && (
          <Modal title={editRId ? "Edit Room" : "Add Room"} onClose={() => setShowRForm(false)}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Room Number" required>
                <input
                  type="text" placeholder="e.g. 101"
                  value={rForm.room_number}
                  onChange={e => setRForm(f => ({ ...f, room_number: e.target.value }))}
                  style={inputStyle}
                />
              </Field>

              <Field label="Floor">
                <input
                  type="number" min="0" placeholder="1"
                  value={rForm.floor}
                  onChange={e => setRForm(f => ({ ...f, floor: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Room Type">
                <select
                  value={rForm.room_type}
                  onChange={e => setRForm(f => ({ ...f, room_type: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="non_ac">Non-AC</option>
                  <option value="ac">AC Room</option>
                  <option value="dormitory">Dormitory</option>
                </select>
              </Field>

              <Field label="Bed Capacity" required>
                <input
                  type="number" min="1" placeholder="2"
                  value={rForm.capacity}
                  onChange={e => setRForm(f => ({ ...f, capacity: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label={`Monthly Fee (${currencySymbol})`} required>
              <input
                type="number" min="0" placeholder="e.g. 4000"
                value={rForm.monthly_fee}
                onChange={e => setRForm(f => ({ ...f, monthly_fee: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            <Field label="Notes / Amenities">
              <input
                type="text" placeholder="Balcony, attached bathroom, etc."
                value={rForm.notes}
                onChange={e => setRForm(f => ({ ...f, notes: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowRForm(false)}
                style={{
                  height: 36, padding: "0 14px", borderRadius: 8, border: `1.5px solid ${col.border}`,
                  background: "#fff", color: col.navy, fontWeight: 800, fontSize: 12.5, cursor: "pointer",
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={saveRoom}
                disabled={rSaving}
                style={{
                  height: 36, padding: "0 18px", borderRadius: 8, border: "none",
                  background: col.orange, color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer",
                }}
              >{rSaving ? "Saving..." : "Save Room"}</button>
            </div>
          </Modal>
        )}

        {/* Student Assign Modal */}
        {showAForm && (
          <Modal title="Assign Student to Hostel" onClose={() => setShowAForm(false)}>
            {/* Student Search */}
            <Field label="Select Student" required>
              <div style={{ position: "relative" }}>
                <input
                  type="search"
                  placeholder="Search student by name or admission no…"
                  value={selectedStudent ? selectedStudent.full_name : studentSearch}
                  onChange={e => {
                    setStudentSearch(e.target.value);
                    setSelectedStudent(null);
                    setAForm(f => ({ ...f, student_id: "" }));
                    setShowStudentDrop(true);
                  }}
                  onFocus={() => setShowStudentDrop(true)}
                  style={inputStyle}
                />
                {showStudentDrop && !selectedStudent && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                    background: "#fff", border: `1.5px solid ${col.border}`, borderRadius: 8,
                    maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                  }}>
                    {filteredStudents.slice(0, 10).map((st: any) => (
                      <div
                        key={st.id}
                        onClick={() => {
                          setSelectedStudent(st);
                          setAForm(f => ({ ...f, student_id: String(st.id) }));
                          setShowStudentDrop(false);
                        }}
                        style={{
                          padding: "8px 12px", borderBottom: `1px solid ${col.border}`,
                          cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: col.navy,
                        }}
                      >
                        <div>{st.full_name}</div>
                        <span style={{ fontSize: 11, color: col.muted }}>
                          {st.admission_number ? `Adm: ${st.admission_number}` : ""} {st.class_name ? `· ${st.class_name}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            {/* Hostel Selector in modal */}
            <Field label="Hostel" required>
              <select
                value={assignHostelId}
                onChange={e => {
                  setAssignHostelId(e.target.value);
                  setAForm(f => ({ ...f, hostel_id: e.target.value, room_id: "" }));
                }}
                style={inputStyle}
              >
                <option value="">— Select Hostel —</option>
                {(hostels || []).map((h: any) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </Field>

            {/* Room Selector in modal */}
            <Field label="Room" required>
              <select
                value={aForm.room_id}
                onChange={e => setAForm(f => ({ ...f, room_id: e.target.value }))}
                style={inputStyle}
                disabled={!assignHostelId}
              >
                <option value="">— Select Available Room —</option>
                {assignRooms.map((r: any) => {
                  const occ = Number(r.occupied_count || 0);
                  const cap = Number(r.capacity || 1);
                  const isFull = occ >= cap;
                  return (
                    <option key={r.id} value={r.id} disabled={isFull}>
                      Room {r.room_number} (Floor {r.floor}) — {occ}/{cap} Beds {isFull ? "[FULL]" : `(${currencySymbol} ${r.monthly_fee}/mo)`}
                    </option>
                  );
                })}
              </select>
            </Field>

            <Field label="Joining Date" required>
              <DateInput
                value={aForm.joining_date}
                onChange={(val: any) => setAForm(f => ({ ...f, joining_date: typeof val === "string" ? val : (val?.target?.value || "") }))}
                style={{ width: "100%" }}
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowAForm(false)}
                style={{
                  height: 36, padding: "0 14px", borderRadius: 8, border: `1.5px solid ${col.border}`,
                  background: "#fff", color: col.navy, fontWeight: 800, fontSize: 12.5, cursor: "pointer",
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={saveAssignment}
                disabled={aSaving}
                style={{
                  height: 36, padding: "0 18px", borderRadius: 8, border: "none",
                  background: col.orange, color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer",
                }}
              >{aSaving ? "Assigning..." : "Assign Student"}</button>
            </div>
          </Modal>
        )}

        {/* Delete Hostel Confirmation */}
        {confirmHId && (
          <Modal title="Delete Hostel" onClose={() => setConfirmHId(null)}>
            <p style={{ fontSize: 13.5, color: col.navy, fontWeight: 600 }}>
              Are you sure you want to remove this hostel? All associated rooms and assignments will also be deleted.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setConfirmHId(null)}
                style={{
                  height: 36, padding: "0 14px", borderRadius: 8, border: `1.5px solid ${col.border}`,
                  background: "#fff", color: col.navy, fontWeight: 800, fontSize: 12.5, cursor: "pointer",
                }}
              >Cancel</button>
              <button
                onClick={() => deleteHostel(confirmHId)}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 8, border: "none",
                  background: col.red, color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer",
                }}
              >Delete</button>
            </div>
          </Modal>
        )}

        {/* Delete Room Confirmation */}
        {confirmRId && (
          <Modal title="Delete Room" onClose={() => setConfirmRId(null)}>
            <p style={{ fontSize: 13.5, color: col.navy, fontWeight: 600 }}>
              Are you sure you want to delete this room?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setConfirmRId(null)}
                style={{
                  height: 36, padding: "0 14px", borderRadius: 8, border: `1.5px solid ${col.border}`,
                  background: "#fff", color: col.navy, fontWeight: 800, fontSize: 12.5, cursor: "pointer",
                }}
              >Cancel</button>
              <button
                onClick={() => deleteRoom(confirmRId)}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 8, border: "none",
                  background: col.red, color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer",
                }}
              >Delete</button>
            </div>
          </Modal>
        )}

        {/* Vacate Student Confirmation */}
        {confirmAId && (
          <Modal title="Vacate Accommodation" onClose={() => setConfirmAId(null)}>
            <p style={{ fontSize: 13.5, color: col.navy, fontWeight: 600 }}>
              Are you sure you want to vacate this student from their assigned hostel room?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setConfirmAId(null)}
                style={{
                  height: 36, padding: "0 14px", borderRadius: 8, border: `1.5px solid ${col.border}`,
                  background: "#fff", color: col.navy, fontWeight: 800, fontSize: 12.5, cursor: "pointer",
                }}
              >Cancel</button>
              <button
                onClick={() => vacateAssignment(confirmAId)}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 8, border: "none",
                  background: col.red, color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer",
                }}
              >Vacate</button>
            </div>
          </Modal>
        )}

      </main>
    </div>
  );
}
