/**
 * AttendanceOverviewCard — shared component
 *
 * Shows:
 *  • Full-year card  (AY label, %, P/A/Lv, Total Working Days, Elapsed)
 *  • Current month card
 *  • Previous month card
 *
 * Used by TeacherStudentDetailPage and StudentDashboardPage.
 *
 * Formula: Attendance % = (Working Days − Absent) / Working Days × 100
 * Leave is NOT counted as absent.
 */

"use client";

import { useMemo } from "react";
import { useApi } from "@/lib/useApi";
import { Loader } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { adToBS, bsToAD, daysInBSMonth, BS_MONTH_NAMES } from "@/lib/bs-ad";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function DonutRing({ pct, color, size = 72, stroke = 9 }: {
  pct: number; color: string; size?: number; stroke?: number;
}) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const arc  = (pct / 100) * circ;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {pct > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${arc} ${circ - arc}`} strokeDashoffset={0} strokeLinecap="butt"
          style={{ transform: "rotate(-90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }} />
      )}
    </svg>
  );
}

export function AttCard({ label, pct, present, absent, leave, color, working, elapsed }: {
  label: string; pct: number; present: number; absent: number; leave: number;
  color: string; working?: number; elapsed?: number;
}) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #e2e8f0", borderLeft: `4px solid ${color}`, display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <DonutRing pct={pct} color={color} size={72} stroke={9} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: "#1f2d36" }}>{pct}%</span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { short: "P",  label: "Present", val: present, color: "#12805c", bg: "#e2f6ee" },
            { short: "A",  label: "Absent",  val: absent,  color: "#b42318", bg: "#fde7e7" },
            { short: "Lv", label: "Leave",   val: leave,   color: "#7c3aed", bg: "#f3eeff" },
          ].map(r => (
            <div key={r.short} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: r.color, background: r.bg, padding: "1px 5px", borderRadius: 4, minWidth: 16, textAlign: "center" }}>{r.short}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", flex: 1 }}>{r.label}</span>
              <strong style={{ fontSize: 13, fontWeight: 900, color: r.val === 0 ? "#c6d0d7" : r.color }}>{r.val}</strong>
            </div>
          ))}
          {working !== undefined && working > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 6, borderTop: "1px solid #f0f4f5", marginTop: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: "#6a7882", background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, minWidth: 16, textAlign: "center" }}>W</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", flex: 1 }}>{elapsed !== undefined ? "Total Days" : "Working"}</span>
                <strong style={{ fontSize: 13, fontWeight: 900, color: "#1f2d36" }}>{working}</strong>
              </div>
              {elapsed !== undefined && elapsed > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 900, color: "#1a73e8", background: "#e8f0fe", padding: "1px 5px", borderRadius: 4, minWidth: 16, textAlign: "center" }}>E</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", flex: 1 }}>Elapsed</span>
                  <strong style={{ fontSize: 13, fontWeight: 900, color: "#1a73e8" }}>{elapsed}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface AttendanceOverviewCardProps {
  /** Active academic year object (must have id, year_name, start_date, end_date) */
  activeYear: any;
  /**
   * Base URL for attendance summary API.
   * e.g. "/attendance/me/summary" or "/attendance/student/5/summary"
   * academic_year_id will be appended automatically.
   */
  summaryBaseUrl: string | null;
  /**
   * Function that returns the monthly attendance URL given (year, month) in AD.
   * e.g. (y,m) => `/attendance/me/monthly?year=${y}&month=${m}&academic_year_id=...`
   */
  monthlyUrl: (year: number, month: number) => string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES_AD = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function AttendanceOverviewCard({
  activeYear, summaryBaseUrl, monthlyUrl,
}: AttendanceOverviewCardProps) {
  const { isBS: isBSHook } = useDateFormat();
  const now      = new Date();
  const todayISO = now.toISOString().split("T")[0];

  // ── Yearly summary ─────────────────────────────────────────────────────────
  const summaryUrl = summaryBaseUrl && activeYear?.id
    ? `${summaryBaseUrl}?academic_year_id=${activeYear.id}`
    : "";
  const { data: yearlySummary, loading: sumLoad } = useApi<any>(summaryUrl, [summaryUrl]);

  // ── Full-year working days (year start → year end) ─────────────────────────
  const { data: yearWorkingData } = useApi<any>(
    activeYear?.id && activeYear?.start_date && activeYear?.end_date
      ? `/calendar/working-days?academic_year_id=${activeYear.id}&start_date=${String(activeYear.start_date).slice(0,10)}&end_date=${String(activeYear.end_date).slice(0,10)}`
      : "",
    [activeYear?.id]
  );

  // ── Elapsed working days (year start → today) ──────────────────────────────
  const { data: elapsedData } = useApi<any>(
    activeYear?.id && activeYear?.start_date
      ? `/calendar/working-days?academic_year_id=${activeYear.id}&start_date=${String(activeYear.start_date).slice(0,10)}&end_date=${todayISO}`
      : "",
    [activeYear?.id, todayISO]
  );

  // ── BS/AD display months ───────────────────────────────────────────────────
  const todayBS = useMemo(() => adToBS(now), []);

  const currDisp = useMemo(() => {
    if (isBSHook) return { year: todayBS.year, month: todayBS.month };
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, [isBSHook, todayBS]);

  const prevDisp = useMemo(() => {
    if (isBSHook) {
      const m = todayBS.month - 1;
      return m <= 0 ? { year: todayBS.year - 1, month: 12 } : { year: todayBS.year, month: m };
    }
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [isBSHook, todayBS]);

  // Month display labels
  const cLabel = isBSHook
    ? `${BS_MONTH_NAMES[currDisp.month - 1]} ${currDisp.year}`
    : `${MONTH_NAMES_AD[currDisp.month - 1]} ${currDisp.year}`;
  const pLabel = isBSHook
    ? `${BS_MONTH_NAMES[prevDisp.month - 1]} ${prevDisp.year}`
    : `${MONTH_NAMES_AD[prevDisp.month - 1]} ${prevDisp.year}`;

  // ── AD params for a BS/AD display month ───────────────────────────────────
  const dispToADParams = (disp: { year: number; month: number }) => {
    if (isBSHook) {
      const adStart = bsToAD({ year: disp.year, month: disp.month, day: 1 });
      const lastDay = daysInBSMonth(disp.year, disp.month);
      const adEnd   = bsToAD({ year: disp.year, month: disp.month, day: lastDay });
      const p1 = { year: adStart.getFullYear(), month: adStart.getMonth() + 1 };
      const p2 = (adEnd.getFullYear() !== p1.year || adEnd.getMonth() + 1 !== p1.month)
        ? { year: adEnd.getFullYear(), month: adEnd.getMonth() + 1 } : null;
      return { p1, p2 };
    }
    return { p1: disp, p2: null };
  };

  const currParams = useMemo(() => dispToADParams(currDisp), [currDisp, isBSHook]);
  const prevParams = useMemo(() => dispToADParams(prevDisp), [prevDisp, isBSHook]);

  // ── Monthly records (two calls per month in case BS month spans two AD months) ──
  const url1c = monthlyUrl(currParams.p1.year, currParams.p1.month);
  const url2c = currParams.p2 ? monthlyUrl(currParams.p2.year, currParams.p2.month) : "";
  const url1p = monthlyUrl(prevParams.p1.year, prevParams.p1.month);
  const url2p = prevParams.p2 ? monthlyUrl(prevParams.p2.year, prevParams.p2.month) : "";

  const { data: currRaw1 } = useApi<any>(url1c, [url1c]);
  const { data: currRaw2 } = useApi<any>(url2c, [url2c]);
  const { data: prevRaw1 } = useApi<any>(url1p, [url1p]);
  const { data: prevRaw2 } = useApi<any>(url2p, [url2p]);

  // ── Per-month working days (for accurate % denominator) ────────────────────
  const getMonthADRange = (disp: { year: number; month: number }, capToday: boolean) => {
    if (isBSHook) {
      const adS     = bsToAD({ year: disp.year, month: disp.month, day: 1 });
      const lastDay = daysInBSMonth(disp.year, disp.month);
      const adE     = bsToAD({ year: disp.year, month: disp.month, day: lastDay });
      return {
        start: adS.toISOString().split("T")[0],
        end:   (capToday && adE > now ? now : adE).toISOString().split("T")[0],
      };
    }
    const lastDay = new Date(disp.year, disp.month, 0).getDate();
    const adE     = new Date(disp.year, disp.month - 1, lastDay);
    return {
      start: `${disp.year}-${String(disp.month).padStart(2,"0")}-01`,
      end:   (capToday && adE > now ? now : adE).toISOString().split("T")[0],
    };
  };

  const currRange = useMemo(() => getMonthADRange(currDisp, true),  [currDisp, isBSHook]);
  const prevRange = useMemo(() => getMonthADRange(prevDisp, false), [prevDisp, isBSHook]);

  const mkWDUrl = (range: { start: string; end: string }) =>
    activeYear?.id
      ? `/calendar/working-days?academic_year_id=${activeYear.id}&start_date=${range.start}&end_date=${range.end}`
      : "";

  const { data: currWDData } = useApi<any>(mkWDUrl(currRange), [mkWDUrl(currRange)]);
  const { data: prevWDData } = useApi<any>(mkWDUrl(prevRange), [mkWDUrl(prevRange)]);

  // ── Normalise + filter records to exact BS month range ─────────────────────
  const normalise = (raw: any): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.data))    return raw.data;
    if (Array.isArray(raw.records)) return raw.records;
    return [];
  };

  const filterToBSMonth = (records: any[], disp: { year: number; month: number }): any[] => {
    if (!isBSHook) return records;
    const adStart  = bsToAD({ year: disp.year, month: disp.month, day: 1 });
    const lastDay  = daysInBSMonth(disp.year, disp.month);
    const adEnd    = bsToAD({ year: disp.year, month: disp.month, day: lastDay });
    const startISO = adStart.toISOString().split("T")[0];
    const endISO   = adEnd.toISOString().split("T")[0];
    return records.filter(r => {
      const d = String(r.date ?? r.attendance_date ?? "").slice(0, 10);
      return d >= startISO && d <= endISO;
    });
  };

  const currRecs = useMemo(
    () => filterToBSMonth([...normalise(currRaw1), ...normalise(currRaw2)], currDisp),
    [currRaw1, currRaw2, currDisp, isBSHook]
  );
  const prevRecs = useMemo(
    () => filterToBSMonth([...normalise(prevRaw1), ...normalise(prevRaw2)], prevDisp),
    [prevRaw1, prevRaw2, prevDisp, isBSHook]
  );

  // ── Yearly stats ───────────────────────────────────────────────────────────
  const yPresent = Number(yearlySummary?.total_present ?? 0);
  const yAbsent  = Number(yearlySummary?.total_absent  ?? 0);
  const yLeave   = Number(yearlySummary?.total_leave   ?? 0);
  const yElapsed = Number(elapsedData?.working_days    ?? yearlySummary?.total_working_days ?? 0);
  const yTotalWD = Number(yearWorkingData?.working_days ?? yElapsed);

  // Formula: (Working Days − Absent) / Working Days × 100 — leave NOT counted as absent
  const yPct   = yElapsed > 0 ? Math.max(0, Math.round(((yElapsed - yAbsent) / yElapsed) * 100)) : 0;
  const yColor = yPct >= 85 ? "#12805c" : yPct >= 70 ? "#c46a14" : "#b42318";

  // ── Monthly stats ──────────────────────────────────────────────────────────
  const countS = (arr: any[], s: string) => arr.filter((r: any) => r.status === s).length;
  const mStat = (recs: any[], workingDays: number) => {
    const p  = countS(recs, "present"), a = countS(recs, "absent"), l = countS(recs, "leave");
    const d  = p + a + l;
    const wd = workingDays > 0 ? workingDays : d;
    const pct = wd > 0 ? Math.max(0, Math.round(((wd - a) / wd) * 100)) : 0;
    return { p, a, l, d, pct };
  };

  const currWD = Number(currWDData?.working_days ?? 0);
  const prevWD = Number(prevWDData?.working_days ?? 0);

  const curr   = mStat(currRecs, currWD);
  const prev   = mStat(prevRecs, prevWD);
  const cColor = curr.pct >= 85 ? "#12805c" : curr.pct >= 70 ? "#c46a14" : "#b42318";
  const pColor = prev.pct >= 85 ? "#12805c" : prev.pct >= 70 ? "#c46a14" : "#b42318";

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  if (sumLoad && !yearlySummary) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
        <Loader fullScreen={false} size="sm" text="Loading attendance stats…" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        .aoc-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 480px) { .aoc-2col { grid-template-columns: 1fr; } }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Full-year card */}
        <AttCard
          label={activeYear?.year_name ? `AY ${activeYear.year_name}` : "Full Year"}
          pct={yPct} present={yPresent} absent={yAbsent} leave={yLeave}
          color={yColor}
          working={yTotalWD > 0 ? yTotalWD : undefined}
          elapsed={yElapsed > 0 ? yElapsed : undefined}
        />
        {/* Monthly cards */}
        <div className="aoc-2col">
          <AttCard label={cLabel} pct={curr.pct} present={curr.p} absent={curr.a} leave={curr.l} color={cColor} />
          <AttCard label={pLabel} pct={prev.pct} present={prev.p} absent={prev.a} leave={prev.l} color={pColor} />
        </div>
      </div>
    </>
  );
}
