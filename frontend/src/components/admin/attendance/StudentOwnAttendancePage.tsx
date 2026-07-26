"use client";

import { useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import OwnAttendancePage, { StatusCfg, SummaryFields } from "@/components/shared/OwnAttendancePage";

// ── Student status config ────────────────────────────────────────────────────
// Students: present, absent, suspended, leave  (late → suspended)
const STATUS_CONFIG: Record<string, StatusCfg> = {
  present:   { label: "Present",   short: "P",  color: "#12805c", bg: "#e2f6ee", border: "#a7f3d0" },
  absent:    { label: "Absent",    short: "A",  color: "#b42318", bg: "#fde7e7", border: "#fca5a5" },
  suspended: { label: "Suspended", short: "Su", color: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc" },
  leave:     { label: "Leave",     short: "Lv", color: "#7c3aed", bg: "#f3eeff", border: "#ddd6fe" },
};

export default function StudentOwnAttendancePage() {
  const activeYear     = useAppSelector(s => s.academicYear?.activeYear);
  const academicYearId = activeYear?.id ?? null;

  const monthlyApiUrl = useCallback(
    (year: number, month: number) =>
      academicYearId
        ? `/attendance/me/monthly?year=${year}&month=${month}&academic_year_id=${academicYearId}`
        : null,
    [academicYearId]
  );

  const summaryApiUrl = academicYearId
    ? `/attendance/me/summary?academic_year_id=${academicYearId}`
    : null;

  const getRecordStatus = useCallback((r: any): string => r.status, []);
  const getRecordDate   = useCallback((r: any): string => String(r.date).slice(0, 10), []);

  const getSummaryFields = useCallback((data: any): SummaryFields => ({
    total_present:         Number(data.total_present         ?? 0),
    total_absent:          Number(data.total_absent          ?? 0),
    total_leave:           Number(data.total_leave           ?? 0),
    total_late:            Number(data.total_suspended       ?? data.total_late ?? 0),
    total_half_day:        0,
    total_working_days:    Number(data.total_working_days    ?? 0),
    attendance_percentage: Number(data.attendance_percentage ?? 0),
  }), []);

  return (
    <OwnAttendancePage
      monthlyApiUrl={monthlyApiUrl}
      summaryApiUrl={summaryApiUrl}
      academicYearId={academicYearId}
      activeYearName={activeYear?.year_name ?? "Academic Year"}
      topbarTitle="My Attendance"
      topbarSub="Monthly calendar and full-year summary"
      statusConfig={STATUS_CONFIG}
      getRecordStatus={getRecordStatus}
      getRecordDate={getRecordDate}
      getSummaryFields={getSummaryFields}
    />
  );
}
