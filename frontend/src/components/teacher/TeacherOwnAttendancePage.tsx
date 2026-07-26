"use client";

import { useCallback, useMemo } from "react";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useApi } from "@/lib/useApi";
import { adToBS } from "@/lib/bs-ad";
import OwnAttendancePage, { StatusCfg, SummaryFields } from "@/components/shared/OwnAttendancePage";

// ── Teacher status config ─────────────────────────────────────────────────────
// Teachers have "half_day" — NO "late" status (that's student-only)
const STATUS_CONFIG: Record<string, StatusCfg> = {
  present:  { label: "Present",  short: "P",  color: "#12805c", bg: "#e2f6ee", border: "#a7f3d0" },
  absent:   { label: "Absent",   short: "A",  color: "#b42318", bg: "#fde7e7", border: "#fca5a5" },
  leave:    { label: "Leave",    short: "Lv", color: "#7c3aed", bg: "#f3eeff", border: "#ddd6fe" },
  half_day: { label: "Half Day", short: "½",  color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
};

// Colors for the Today card
const STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  present:  { color: "#12805c", bg: "#e2f6ee", border: "#a7f3d0" },
  absent:   { color: "#b42318", bg: "#fde7e7", border: "#fca5a5" },
  late:     { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  leave:    { color: "#7c3aed", bg: "#f3eeff", border: "#ddd6fe" },
  half_day: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
};

export default function TeacherOwnAttendancePage() {
  const { activeYear } = useAcademicYear();
  const academicYearId = activeYear?.id ?? null;
  const now            = new Date();
  const todayBS        = adToBS(now);

  // ── Today's record (for sidebar card) ────────────────────────────────────
  const todayStr  = now.toISOString().split("T")[0];
  const todayYear = now.getFullYear();
  const todayMon  = now.getMonth() + 1;

  const { data: todayRaw } = useApi<any>(
    `/teachers/me/attendance?year=${todayYear}&month=${todayMon}`,
    [todayYear, todayMon]
  );
  const todayStatus: string | null = useMemo(() => {
    const records: any[] = todayRaw?.records ?? (Array.isArray(todayRaw) ? todayRaw : []);
    const rec = records.find((r: any) => String(r.date).slice(0, 10) === todayStr);
    return rec?.status ?? null;
  }, [todayRaw, todayStr]);

  // ── API URL factories ──────────────────────────────────────────────────────
  const monthlyApiUrl = useCallback(
    (year: number, month: number) => `/teachers/me/attendance?year=${year}&month=${month}`,
    []
  );

  const summaryApiUrl = academicYearId
    ? `/teachers/me/attendance/yearly?academic_year_id=${academicYearId}`
    : null;

  // ── Record accessors ───────────────────────────────────────────────────────
  const getRecordStatus = useCallback((r: any): string => r.status, []);
  const getRecordDate   = useCallback((r: any): string => String(r.date).slice(0, 10), []);

  const getSummaryFields = useCallback((data: any): SummaryFields => ({
    total_present:         Number(data.total_present      ?? data.summary?.present_days  ?? 0),
    total_absent:          Number(data.total_absent       ?? data.summary?.absent_days   ?? 0),
    total_leave:           Number(data.total_leave        ?? data.summary?.leave_days    ?? 0),
    total_late:            0,   // teachers do not have "late" — always 0
    total_half_day:        Number(data.total_half_days    ?? data.summary?.half_days     ?? data.total_half_day ?? 0),
    total_working_days:    Number(data.total_working_days ?? 0),
    attendance_percentage: Number(data.attendance_percentage ?? 0),
  }), []);

  // ── Today card (teacher-only sidebar element) ─────────────────────────────
  const todayCfg = todayStatus ? STATUS_CONFIG[todayStatus] : null;
  const todayCard = (
    <div style={{ background:"#fff", borderRadius:14, border:"1px solid #dce5e9", overflow:"hidden", boxShadow:"0 2px 8px rgba(31,45,54,.05)" }}>
      <div style={{ padding:"14px 18px", borderBottom:"1px solid #eef2f3" }}>
        <p style={{ margin:0, fontSize:14, fontWeight:900, color:"#1f2d36" }}>Today</p>
        <p style={{ margin:"2px 0 0", fontSize:11, fontWeight:700, color:"#6a7882" }}>
          {now.toLocaleDateString("en-US", { weekday:"long", day:"numeric", month:"long" })}
        </p>
      </div>
      <div style={{ padding:"14px 18px" }}>
        {todayCfg ? (
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:10, background:todayCfg.bg, border:`1px solid ${todayCfg.border}` }}>
            <div style={{ width:36, height:36, borderRadius:9, flexShrink:0, background:"#fff", border:`1px solid ${todayCfg.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:todayCfg.color }}>
              {todayCfg.short}
            </div>
            <div>
              <strong style={{ display:"block", fontSize:14, fontWeight:900, color:todayCfg.color }}>{todayCfg.label}</strong>
              <span style={{ fontSize:11, fontWeight:600, color:"#6a7882" }}>Today's status</span>
            </div>
          </div>
        ) : (
          <div style={{ padding:"14px", borderRadius:10, background:"#f1f5f9", textAlign:"center" }}>
            <span style={{ fontSize:12, fontWeight:600, color:"#6a7882" }}>Not marked yet by admin</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <OwnAttendancePage
      monthlyApiUrl={monthlyApiUrl}
      summaryApiUrl={summaryApiUrl}
      academicYearId={academicYearId}
      activeYearName={activeYear?.year_name ?? "Academic Year"}
      topbarTitle="My Attendance"
      topbarSub="Your personal staff attendance record"
      statusConfig={STATUS_CONFIG}
      getRecordStatus={getRecordStatus}
      getRecordDate={getRecordDate}
      getSummaryFields={getSummaryFields}
      todayCard={todayCard}
    />
  );
}
