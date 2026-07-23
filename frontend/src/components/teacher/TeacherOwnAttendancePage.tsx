"use client";

import { useState, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import {
  adToBS, bsToAD, isoToBS,
  BS_MONTH_NAMES, daysInBSMonth,
} from "@/lib/bs-ad";

const C = {
  brand: "#ff9b51", brandLight: "#fff7ed", brandDark: "#c2410c",
  dark: "#1f2d36", mid: "#6a7882", light: "#eef2f3", white: "#ffffff",
  border: "#dce5e9", green: "#059669", greenBg: "#ecfdf5",
  red: "#dc2626", redBg: "#fef2f2", amber: "#d97706", amberBg: "#fffbeb",
};

const STATUS: Record<string, { label: string; color: string; bg: string; border: string; short: string }> = {
  present:  { label: "Present",  color: C.green, bg: C.greenBg,  border: "#bbf7d0", short: "P"  },
  absent:   { label: "Absent",   color: C.red,   bg: C.redBg,    border: "#fecaca", short: "A"  },
  late:     { label: "Late",     color: C.amber, bg: C.amberBg,  border: "#fde68a", short: "L"  },
  leave:    { label: "Leave",    color: C.mid,   bg: C.light,    border: C.border,  short: "Lv" },
  half_day: { label: "Half Day", color: C.amber, bg: C.amberBg,  border: "#fde68a", short: "½"  },
  off:      { label: "—",        color: "#b0bec5", bg: "#f8fafc", border: "#e9ecef", short: "–"  },
};

const AD_DAYS = ["M","T","W","T","F","S","S"];
const BS_DAYS = ["आ","सो","मं","बु","बि","शु","श"];

export default function TeacherOwnAttendancePage() {
  const now = new Date();
  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth()+1).padStart(2,"0");
    const d = String(now.getDate()).padStart(2,"0");
    return `${y}-${m}-${d}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { activeYear } = useAcademicYear();
  const { isBS, formatMonth } = useDateFormat();

  // ── Display month state (BS year/month for BS schools, AD for others) ──────
  const todayBS = useMemo(() => adToBS(now), []);
  const [year,  setYear]  = useState(() => isBS ? todayBS.year  : now.getFullYear());
  const [month, setMonth] = useState(() => isBS ? todayBS.month : now.getMonth() + 1);

  // ── Convert display month → AD year/month for API calls ──────────────────
  const { apiYear, apiMonth } = useMemo(() => {
    if (!isBS) return { apiYear: year, apiMonth: month };
    const totalDays = daysInBSMonth(year, month);
    const midDay    = Math.min(15, totalDays);
    const adDate    = bsToAD({ year, month, day: midDay });
    return { apiYear: adDate.getFullYear(), apiMonth: adDate.getMonth() + 1 };
  }, [isBS, year, month]);

  // For BS schools, a single BS month spans 2 AD months — fetch both
  const { apiYear2, apiMonth2 } = useMemo(() => {
    if (!isBS) return { apiYear2: null, apiMonth2: null };
    const lastDay = daysInBSMonth(year, month);
    const adLast  = bsToAD({ year, month, day: lastDay });
    const lastAdY = adLast.getFullYear();
    const lastAdM = adLast.getMonth() + 1;
    if (lastAdY !== apiYear || lastAdM !== apiMonth) {
      return { apiYear2: lastAdY, apiMonth2: lastAdM };
    }
    return { apiYear2: null, apiMonth2: null };
  }, [isBS, year, month, apiYear, apiMonth]);

  const { data: attData1, loading: loading1 } = useApi<any>(
    `/teachers/me/attendance?year=${apiYear}&month=${apiMonth}`,
    [apiYear, apiMonth]
  );
  const { data: attData2, loading: loading2 } = useApi<any>(
    apiYear2 ? `/teachers/me/attendance?year=${apiYear2}&month=${apiMonth2}` : null,
    [apiYear2, apiMonth2]
  );

  const loading = loading1 || (!!apiYear2 && loading2);

  // Merge records from both fetches
  const records: any[] = useMemo(() => {
    const r1 = attData1?.records ?? [];
    const r2 = attData2?.records ?? [];
    return [...r1, ...r2];
  }, [attData1, attData2]);

  // Summary: recompute from merged records (or use the primary month's summary if no second fetch)
  const summary: any = useMemo(() => {
    if (!apiYear2) return attData1?.summary ?? {};
    // Recompute from merged records
    let present = 0, absent = 0, half_day = 0, leave = 0;
    records.forEach((r: any) => {
      if (r.status === "present")  present++;
      else if (r.status === "absent")   absent++;
      else if (r.status === "half_day") half_day++;
      else if (r.status === "leave")    leave++;
    });
    return { present_days: present, absent_days: absent, half_days: half_day, leave_days: leave };
  }, [apiYear2, attData1, records]);

  const present  = Number(summary.present_days ?? 0);
  const absent   = Number(summary.absent_days  ?? 0);
  const halfDay  = Number(summary.half_days    ?? 0);
  const leave    = Number(summary.leave_days   ?? 0);
  const effective = present + absent + halfDay + leave;
  const pct = effective > 0 ? Math.round(((present + halfDay * 0.5) / effective) * 100) : 0;

  // Map: AD date string → status (for BS cells lookup)
  const recordsByAdDate = useMemo(() => {
    const m = new Map<string, string>();
    records.forEach((r: any) => m.set(String(r.date).slice(0, 10), r.status));
    return m;
  }, [records]);

  // Map: AD day-of-month → status (for AD calendar)
  const recordsByDay = useMemo(() => {
    const m = new Map<number, string>();
    records.forEach((r: any) => m.set(new Date(r.date + "T00:00:00").getDate(), r.status));
    return m;
  }, [records]);

  // ── BS calendar cells ─────────────────────────────────────────────────────
  const bsCells = useMemo(() => {
    if (!isBS) return null;
    const totalDays = daysInBSMonth(year, month);
    const firstAd   = bsToAD({ year, month, day: 1 });
    const firstDow  = firstAd.getDay();
    const leading   = (firstDow + 6) % 7;

    type Cell = {
      bsDay: number | null;
      adDateStr: string | null;
      status: string | undefined;
      isToday: boolean;
    };

    const cells: Cell[] = Array(leading).fill(null).map(() => ({
      bsDay: null, adDateStr: null, status: undefined, isToday: false,
    }));

    for (let bsD = 1; bsD <= totalDays; bsD++) {
      const ad      = bsToAD({ year, month, day: bsD });
      const adY     = ad.getFullYear();
      const adM     = String(ad.getMonth()+1).padStart(2,"0");
      const adD     = String(ad.getDate()).padStart(2,"0");
      const adStr   = `${adY}-${adM}-${adD}`;
      cells.push({
        bsDay: bsD,
        adDateStr: adStr,
        status: recordsByAdDate.get(adStr),
        isToday: adStr === todayStr,
      });
    }

    while (cells.length % 7 !== 0) cells.push({ bsDay: null, adDateStr: null, status: undefined, isToday: false });
    return cells;
  }, [isBS, year, month, recordsByAdDate, todayStr]);

  // ── AD calendar cells ─────────────────────────────────────────────────────
  const adCells = useMemo(() => {
    if (isBS) return null;
    const daysInMonth   = new Date(year, month, 0).getDate();
    const firstDow      = new Date(year, month - 1, 1).getDay();
    const leadingBlanks = (firstDow + 6) % 7;

    type Cell = { day: number | null; status: string | undefined; isToday: boolean };
    const result: Cell[] = Array(leadingBlanks).fill(null).map(() => ({ day: null, status: undefined, isToday: false }));

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      result.push({ day: d, status: recordsByDay.get(d), isToday: dateStr === todayStr });
    }
    while (result.length % 7 !== 0) result.push({ day: null, status: undefined, isToday: false });
    return result;
  }, [isBS, year, month, recordsByDay, todayStr]);

  // ── Today's status ────────────────────────────────────────────────────────
  const todayStatus = useMemo(() => {
    if (isBS) {
      return bsCells?.find(c => c.isToday)?.status ?? null;
    }
    return adCells?.find(c => c.isToday)?.status ?? null;
  }, [isBS, bsCells, adCells]);

  // ── Month options ─────────────────────────────────────────────────────────
  const monthOptions = useMemo(() => {
    if (!activeYear) return [];
    const opts: { label: string; value: string }[] = [];
    const startStr = String(activeYear.start_date).slice(0, 10);
    const endStr   = String(activeYear.end_date).slice(0, 10);

    if (isBS) {
      const bsStart = isoToBS(startStr);
      const capStr  = todayStr < endStr ? todayStr : endStr;
      const bsCap   = isoToBS(capStr);
      let y = bsStart.year, m = bsStart.month;
      while (y < bsCap.year || (y === bsCap.year && m <= bsCap.month)) {
        opts.push({ value: `${y}-${m}`, label: `${BS_MONTH_NAMES[m-1]} ${y}` });
        m++;
        if (m > 12) { m = 1; y++; }
      }
    } else {
      const d   = new Date(startStr + "T00:00:00");
      d.setDate(1);
      const cap = new Date(Math.min(now.getTime(), new Date(endStr + "T00:00:00").getTime()));
      while (d <= cap) {
        const y = d.getFullYear(), m = d.getMonth() + 1;
        opts.push({ value: `${y}-${m}`, label: formatMonth(y, m) });
        d.setMonth(d.getMonth() + 1);
      }
    }
    return opts.reverse();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeYear, isBS, todayStr, formatMonth]);

  const monthLabel = isBS ? `${BS_MONTH_NAMES[month-1]} ${year}` : formatMonth(year, month);
  const DAYS = isBS ? BS_DAYS : AD_DAYS;

  const circ = 2 * Math.PI * 44;
  const arc  = (pct / 100) * circ;

  return (
    <>
      <style>{`
        .tatt-root { min-height: 100vh; background: ${C.light}; }
        .tatt-main { padding: 16px; max-width: 960px; margin: 0 auto; }
        @media (min-width: 640px) { .tatt-main { padding: 24px 28px 48px; } }
        .tatt-body { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 780px) { .tatt-body { grid-template-columns: 1fr 260px; align-items: start; } }
        .tatt-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; padding: 12px; }
        @media (min-width: 420px) { .tatt-cal { gap: 6px; padding: 14px; } }
        .tatt-day {
          aspect-ratio: 1; border-radius: 8px; min-height: 36px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; border: 1.5px solid transparent;
        }
        .tatt-card { background: #fff; border-radius: 14px; border: 1px solid ${C.border};
          box-shadow: 0 1px 8px rgba(31,45,54,.06); overflow: hidden; }
        .tatt-card-head { padding: 14px 18px; border-bottom: 1px solid ${C.border}; }
        .tatt-card-head p { margin: 0; font-size: 15px; font-weight: 800; color: ${C.dark}; }
        .tatt-card-head span { display: block; margin-top: 3px; font-size: 12px; color: ${C.mid}; font-weight: 600; }
      `}</style>

      <div className="tatt-root">
        <Topbar title="My Attendance" subtitle="Your personal staff attendance record" />
        <div className="tatt-main">
          <div className="tatt-body">

            {/* ── Calendar ── */}
            <div className="tatt-card">
              <div style={{
                padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.dark }}>{monthLabel}</p>
                <select
                  value={`${year}-${month}`}
                  onChange={e => {
                    const [y, m] = e.target.value.split("-").map(Number);
                    setYear(y); setMonth(m);
                  }}
                  style={{
                    padding: "6px 10px", borderRadius: 8,
                    border: `1px solid ${C.border}`, background: C.light,
                    fontSize: 12, fontWeight: 700, color: C.dark, outline: "none", cursor: "pointer",
                  }}
                >
                  {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Day-of-week header */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: C.light, borderBottom: `1px solid ${C.border}` }}>
                {DAYS.map((d, i) => (
                  <div key={i} style={{ padding: "8px 0", textAlign: "center", fontSize: 10, fontWeight: 800, color: C.mid }}>{d}</div>
                ))}
              </div>

              {loading ? (
                <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={24} color={C.brand} /></div>
              ) : (() => {
                const cells = (isBS ? bsCells : adCells) ?? [];
                return (
                  <div className="tatt-cal">
                    {cells.map((cell: any, i: number) => {
                      const dayNum = isBS ? cell.bsDay : cell.day;
                      if (!dayNum) return <div key={`b${i}`} style={{ aspectRatio: "1", minHeight: 36 }} />;
                      const hasRec = !!cell.status;
                      const cfg    = hasRec ? (STATUS[cell.status!] ?? STATUS.off) : STATUS.off;
                      return (
                        <div
                          key={`d${i}`}
                          className="tatt-day"
                          style={{
                            backgroundColor: cell.isToday ? C.brandLight : (hasRec ? cfg.bg   : "transparent"),
                            borderColor:     cell.isToday ? C.brand      : (hasRec ? cfg.border : "transparent"),
                            color:           cell.isToday ? C.brandDark  : (hasRec ? cfg.color  : C.mid),
                            outline:         cell.isToday ? `2px solid ${C.brand}` : "none",
                            outlineOffset:   1,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: cell.isToday ? 900 : 700 }}>{dayNum}</span>
                          {hasRec && <span style={{ fontSize: 8, fontWeight: 900, marginTop: 1 }}>{cfg.short}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Month footer stats */}
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {[
                  { label: "Present",  val: present,  color: C.green },
                  { label: "Absent",   val: absent,   color: C.red   },
                  { label: "Half Day", val: halfDay,  color: C.amber },
                  { label: "Leave",    val: leave,    color: C.mid   },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <strong style={{ display: "block", fontSize: 15, fontWeight: 900, color: s.color }}>{s.val}</strong>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.mid }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Sidebar ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Today's status */}
              <div className="tatt-card">
                <div className="tatt-card-head">
                  <p>Today</p>
                  <span>{now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}</span>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  {todayStatus ? (() => {
                    const cfg = STATUS[todayStatus] ?? STATUS.off;
                    return (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 14px", borderRadius: 10,
                        background: cfg.bg, border: `1px solid ${cfg.border}`,
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                          background: C.white, border: `1px solid ${cfg.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 900, color: cfg.color,
                        }}>{cfg.short}</div>
                        <div>
                          <strong style={{ display: "block", fontSize: 14, fontWeight: 900, color: cfg.color }}>{cfg.label}</strong>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.mid }}>Today's status</span>
                        </div>
                      </div>
                    );
                  })() : (
                    <div style={{ padding: "14px", borderRadius: 10, background: C.light, textAlign: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>Not marked yet by admin</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Donut summary */}
              <div className="tatt-card">
                <div className="tatt-card-head">
                  <p>Month Summary</p>
                  <span>{monthLabel}</span>
                </div>
                <div style={{ padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <svg viewBox="0 0 120 120" width={90} height={90} style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="60" cy="60" r="44" fill="none" stroke="#f1f5f9" strokeWidth="16" />
                        {effective > 0 && absent > 0 && (
                          <circle cx="60" cy="60" r="44" fill="none" stroke="#ff9a9e" strokeWidth="16"
                            strokeDasharray={`${((absent) / effective) * circ} ${circ}`}
                            strokeDashoffset={-arc} strokeLinecap="round"
                          />
                        )}
                        <circle cx="60" cy="60" r="44" fill="none"
                          stroke={effective > 0 ? "#4b8ff7" : "#e2e8f0"} strokeWidth="16"
                          strokeDasharray={`${effective > 0 ? arc : circ} ${circ}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 17, fontWeight: 900, color: C.dark }}>
                          {effective > 0 ? `${pct}%` : "—"}
                        </span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: C.mid }}>present</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                      {([
                        { label: "Present",  val: present, color: "#4b8ff7" },
                        { label: "Absent",   val: absent,  color: "#ff9a9e" },
                        { label: "Half Day", val: halfDay, color: C.amber   },
                        { label: "Leave",    val: leave,   color: C.mid     },
                      ]).map(item => (
                        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: C.mid, fontWeight: 600 }}>{item.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 900, color: C.dark, marginLeft: "auto" }}>{item.val}</span>
                        </div>
                      ))}
                      {effective === 0 && (
                        <p style={{ margin: 0, fontSize: 11, color: C.mid, fontStyle: "italic" }}>No records this month</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Color guide */}
              <div className="tatt-card">
                <div className="tatt-card-head"><p>Color Guide</p></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "14px 18px" }}>
                  {(["present","absent","late","leave","half_day"] as const).map(k => {
                    const cfg = STATUS[k];
                    return (
                      <div key={k} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px", borderRadius: 8,
                        background: cfg.bg, border: `1px solid ${cfg.border}`,
                      }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          background: C.white, border: `1px solid ${cfg.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 900, color: cfg.color,
                        }}>{cfg.short}</div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
