"use client";

import { useCallback } from "react";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import OwnAttendancePage, { StatusCfg, SummaryFields } from "@/components/shared/OwnAttendancePage";

// ── Teacher status config ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, StatusCfg> = {
  present:  { label: "Present",  short: "P",  color: "#12805c", bg: "#e2f6ee", border: "#a7f3d0" },
  absent:   { label: "Absent",   short: "A",  color: "#b42318", bg: "#fde7e7", border: "#fca5a5" },
  leave:    { label: "Leave",    short: "Lv", color: "#7c3aed", bg: "#f3eeff", border: "#ddd6fe" },
  half_day: { label: "Half Day", short: "½",  color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
};

export default function TeacherOwnAttendancePage() {
  const { activeYear } = useAcademicYear();
  const academicYearId = activeYear?.id ?? null;

  const monthlyApiUrl = useCallback(
    (year: number, month: number) => `/teachers/me/attendance?year=${year}&month=${month}`,
    []
  );

  const summaryApiUrl = academicYearId
    ? `/teachers/me/attendance/yearly?academic_year_id=${academicYearId}`
    : null;

  const getRecordStatus = useCallback((r: any): string => r.status, []);
  const getRecordDate   = useCallback((r: any): string => String(r.date).slice(0, 10), []);

  const getSummaryFields = useCallback((data: any): SummaryFields => ({
    total_present:         Number(data.total_present      ?? data.summary?.present_days  ?? 0),
    total_absent:          Number(data.total_absent       ?? data.summary?.absent_days   ?? 0),
    total_leave:           Number(data.total_leave        ?? data.summary?.leave_days    ?? 0),
    total_late:            0,
    total_half_day:        Number(data.total_half_days    ?? data.summary?.half_days     ?? data.total_half_day ?? 0),
    total_working_days:    Number(data.total_working_days ?? 0),
    attendance_percentage: Number(data.attendance_percentage ?? 0),
  }), []);

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
    />
  );
}
