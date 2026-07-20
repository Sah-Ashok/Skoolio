"use client";

/**
 * DateInput — drop-in replacement for <input type="date">.
 *
 * • AD schools  → renders a standard <input type="date"> (unchanged)
 * • BS schools  → renders a custom BS calendar picker
 *
 * Props mirror <input type="date">:
 *   value      — AD ISO string "YYYY-MM-DD" (always AD, even for BS schools)
 *   onChange   — receives a synthetic event with value as AD ISO string
 *   name, required, disabled, placeholder, style, className, minDate, maxDate
 */

import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { useDateFormat } from "@/lib/useDateFormat";
import {
  adToBS, bsToISO, daysInBSMonth, BS_MONTH_NAMES, BSDate, isValidBS,
} from "@/lib/bs-ad";

// ─── constants ────────────────────────────────────────────────────────────────
const DROP_W   = 320;   // fixed dropdown width — never less than this
const DOW      = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const NAV_BTN: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: "1.5px solid #e2e8f0", background: "#f8fafc",
  cursor: "pointer", fontSize: 11, color: "#334155",
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0, padding: 0, outline: "none", lineHeight: 1,
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayBS(): BSDate { return adToBS(new Date()); }

function valueToBS(adIso: string): BSDate | null {
  if (!adIso) return null;
  try { return adToBS(new Date(adIso + "T00:00:00")); }
  catch { return null; }
}

// ─── types ────────────────────────────────────────────────────────────────────
interface BsPickerProps {
  value:     string;
  onChange:  (adIso: string) => void;
  disabled?: boolean;
  minDate?:  string;
  maxDate?:  string;
  pickerId:  string;
}

interface DropPos {
  top?:   number;
  bottom?: number;
  left:   number;
  width:  number;
}

// ─── BsCalendarPicker ─────────────────────────────────────────────────────────
function BsCalendarPicker({ value, onChange, disabled, minDate, maxDate, pickerId }: BsPickerProps) {
  const tBS        = todayBS();
  const selectedBS = valueToBS(value);

  const [viewYear,  setViewYear]  = useState(() => selectedBS?.year  ?? tBS.year);
  const [viewMonth, setViewMonth] = useState(() => selectedBS?.month ?? tBS.month);
  const [yearInput, setYearInput] = useState(() => String(selectedBS?.year ?? tBS.year));
  const [open,      setOpen]      = useState(false);
  const [pos,       setPos]       = useState<DropPos | null>(null);
  const [mounted,   setMounted]   = useState(false);

  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // sync yearInput when viewYear changes
  useEffect(() => { setYearInput(String(viewYear)); }, [viewYear]);

  // ── position calculation ──────────────────────────────────────────────────
  const computePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r  = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // always use DROP_W; pick side so it stays on screen
    const fitsRight = r.left + DROP_W <= vw - 8;
    const left      = fitsRight
      ? Math.max(8, r.left)
      : Math.max(8, vw - DROP_W - 8);

    const dropH  = 380;
    const goUp   = r.bottom + dropH > vh && r.top >= dropH;

    setPos({
      top:    goUp  ? undefined : r.bottom + 5,
      bottom: goUp  ? vh - r.top + 5 : undefined,
      left,
      width:  DROP_W,
    });
  }, []);

  // when picker opens: snap view + reposition
  useEffect(() => {
    if (!open) return;
    const bs = valueToBS(value);
    if (bs) { setViewYear(bs.year); setViewMonth(bs.month); }
    else    { setViewYear(tBS.year); setViewMonth(tBS.month); }
    computePos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // reposition on scroll / resize
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", computePos, true);
    window.addEventListener("resize", computePos);
    return () => {
      window.removeEventListener("scroll", computePos, true);
      window.removeEventListener("resize", computePos);
    };
  }, [open, computePos]);

  // outside-click close
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t    = e.target as Node;
      const drop = document.getElementById(pickerId);
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        !(drop && drop.contains(t))
      ) setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open, pickerId]);

  // ── calendar math ─────────────────────────────────────────────────────────
  const days    = daysInBSMonth(viewYear, viewMonth);
  const firstDow = (() => {
    try {
      const ad = new Date(bsToISO({ year: viewYear, month: viewMonth, day: 1 }) + "T00:00:00");
      return (ad.getDay() + 6) % 7; // Mon = 0
    } catch { return 0; }
  })();

  const minBS = minDate ? valueToBS(minDate) : null;
  const maxBS = maxDate ? valueToBS(maxDate) : null;

  const isDis = (day: number): boolean => {
    const b: BSDate = { year: viewYear, month: viewMonth, day };
    if (minBS) {
      if (b.year  < minBS.year)  return true;
      if (b.year === minBS.year && b.month  < minBS.month)  return true;
      if (b.year === minBS.year && b.month === minBS.month && b.day < minBS.day) return true;
    }
    if (maxBS) {
      if (b.year  > maxBS.year)  return true;
      if (b.year === maxBS.year && b.month  > maxBS.month)  return true;
      if (b.year === maxBS.year && b.month === maxBS.month && b.day > maxBS.day) return true;
    }
    return false;
  };

  const isSel = (d: number) =>
    selectedBS?.year === viewYear && selectedBS?.month === viewMonth && selectedBS?.day === d;
  const isTod = (d: number) =>
    tBS.year === viewYear && tBS.month === viewMonth && tBS.day === d;

  // ── actions ───────────────────────────────────────────────────────────────
  const selectDay = (day: number) => {
    if (isDis(day) || disabled) return;
    const bs: BSDate = { year: viewYear, month: viewMonth, day };
    if (!isValidBS(bs)) return;
    onChange(bsToISO(bs));
    setOpen(false);
  };

  const prevMonth = () => viewMonth === 1
    ? (setViewYear(y => y - 1), setViewMonth(12))
    : setViewMonth(m => m - 1);

  const nextMonth = () => viewMonth === 12
    ? (setViewYear(y => y + 1), setViewMonth(1))
    : setViewMonth(m => m + 1);

  const commitYear = (raw: string) => {
    const y = parseInt(raw, 10);
    if (!isNaN(y) && y >= 2000 && y <= 2099) setViewYear(y);
    else setYearInput(String(viewYear)); // revert invalid
  };

  const goToday = () => {
    setViewYear(tBS.year);
    setViewMonth(tBS.month);
    setYearInput(String(tBS.year));
  };

  // ── display string ────────────────────────────────────────────────────────
  const displayValue = selectedBS
    ? `${selectedBS.day} ${BS_MONTH_NAMES[selectedBS.month - 1]} ${selectedBS.year} BS`
    : "";

  // ── dropdown ──────────────────────────────────────────────────────────────
  const dropdown = pos && (
    <div
      id={pickerId}
      style={{
        position: "fixed",
        zIndex:   99999,
        top:      pos.top,
        bottom:   pos.bottom,
        left:     pos.left,
        width:    pos.width,
        background: "#fff",
        border: "1.5px solid #e2e8f0",
        borderRadius: 14,
        boxShadow: "0 20px 60px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.08)",
        padding: "14px 14px 12px",
        boxSizing: "border-box",
        fontFamily: "inherit",
      }}
    >
      {/* kill webkit spin arrows — scoped to this picker only */}
      <style>{`
        #${pickerId} input[type=number]::-webkit-inner-spin-button,
        #${pickerId} input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        #${pickerId} input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* ── ROW 1: month navigation ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <button type="button" onClick={prevMonth} style={NAV_BTN} title="Previous month">
          <i className="fa-solid fa-chevron-left" />
        </button>
        <select
          value={viewMonth}
          onChange={e => setViewMonth(Number(e.target.value))}
          style={{
            flex: 1,
            height: 34,
            border: "1.5px solid #e2e8f0",
            borderRadius: 8,
            background: "#f8fafc",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
            color: "#1e293b",
            padding: "0 8px",
            outline: "none",
            appearance: "none" as any,
            WebkitAppearance: "none" as any,
            textAlign: "center",
          }}
        >
          {BS_MONTH_NAMES.map((n, i) => (
            <option key={i} value={i + 1}>{n}</option>
          ))}
        </select>
        <button type="button" onClick={nextMonth} style={NAV_BTN} title="Next month">
          <i className="fa-solid fa-chevron-right" />
        </button>
      </div>

      {/* ── ROW 2: year navigation — own row, never competes with month ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginBottom: 12,
        paddingBottom: 12,
        borderBottom: "1px solid #f1f5f9",
      }}>
        <button
          type="button"
          onClick={() => setViewYear(y => Math.max(2000, y - 1))}
          style={NAV_BTN}
          title="Previous year"
        >
          <i className="fa-solid fa-chevron-left" />
        </button>

        {/* year input — always has enough room on its own row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            value={yearInput}
            min={2000}
            max={2099}
            onChange={e => setYearInput(e.target.value)}
            onBlur={()  => commitYear(yearInput)}
            onKeyDown={e => e.key === "Enter" && commitYear(yearInput)}
            style={{
              width: 80,
              height: 34,
              border: "1.5px solid #e2e8f0",
              borderRadius: 8,
              background: "#f8fafc",
              fontSize: 16,
              fontWeight: 900,
              fontFamily: "inherit",
              color: "#1e293b",
              textAlign: "center",
              outline: "none",
              padding: 0,
            }}
          />
          <span style={{
            fontSize: 12,
            fontWeight: 800,
            color: "#64748b",
            letterSpacing: .4,
            userSelect: "none",
          }}>
            BS
          </span>
        </div>

        <button
          type="button"
          onClick={() => setViewYear(y => Math.min(2099, y + 1))}
          style={NAV_BTN}
          title="Next year"
        >
          <i className="fa-solid fa-chevron-right" />
        </button>
      </div>

      {/* ── DOW header ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        marginBottom: 4,
        gap: 2,
      }}>
        {DOW.map(d => (
          <div key={d} style={{
            textAlign: "center",
            fontSize: 10,
            fontWeight: 900,
            color: "#94a3b8",
            letterSpacing: .4,
            paddingBottom: 4,
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* ── day grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {/* leading blanks */}
        {Array(firstDow).fill(null).map((_, i) => <div key={`g${i}`} />)}

        {Array.from({ length: days }, (_, i) => i + 1).map(day => {
          const sel = isSel(day);
          const tod = isTod(day);
          const dis = isDis(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => selectDay(day)}
              disabled={dis}
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: 7,
                border: tod && !sel ? "1.5px solid #ff9b51" : "1.5px solid transparent",
                fontSize: 12,
                fontWeight: sel ? 900 : 500,
                cursor: dis ? "not-allowed" : "pointer",
                background: sel ? "#ff9b51" : "transparent",
                color: sel ? "#fff" : dis ? "#cbd5e1" : tod ? "#c2410c" : "#1e293b",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                minWidth: 0,
                transition: "background .08s",
                outline: "none",
              }}
              onMouseEnter={e => { if (!sel && !dis) (e.currentTarget as HTMLElement).style.background = "#f1f5f9"; }}
              onMouseLeave={e => { if (!sel && !dis) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* ── footer ── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid #f1f5f9",
      }}>
        <button
          type="button"
          onClick={() => { onChange(""); setOpen(false); }}
          style={{
            fontSize: 12, fontWeight: 700, color: "#94a3b8",
            background: "none", border: "none",
            cursor: "pointer", fontFamily: "inherit",
            padding: "4px 8px", borderRadius: 6,
          }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={goToday}
          style={{
            fontSize: 12, fontWeight: 800, color: "#ff9b51",
            background: "#fff7ed", border: "1px solid #fed7aa",
            cursor: "pointer", fontFamily: "inherit",
            padding: "4px 14px", borderRadius: 6,
          }}
        >
          Today
        </button>
      </div>
    </div>
  );

  // ── trigger ───────────────────────────────────────────────────────────────
  return (
    <div ref={triggerRef} style={{ position: "relative", width: "100%" }}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={e => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(o => !o);
          }
        }}
        style={{
          width: "100%",
          minHeight: 44,        // matches .field input height
          border: `1.5px solid ${open ? "#ff9148" : "#c6d0d7"}`,
          borderRadius: 8,
          padding: "0 13px",
          fontSize: 14,
          fontWeight: 800,
          fontFamily: "inherit",
          background: disabled ? "#f8fafc" : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: disabled ? "default" : "pointer",
          color: displayValue ? "#1f2d36" : "#94a3b8",
          boxSizing: "border-box",
          boxShadow: open ? "0 0 0 3px rgba(255,145,72,0.15)" : "none",
          transition: "border-color .15s, box-shadow .15s",
          userSelect: "none",
          outline: "none",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {displayValue || "Select date (BS)"}
        </span>
        <i
          className="fa-solid fa-calendar-days"
          style={{ color: open ? "#ff9148" : "#94a3b8", fontSize: 13, flexShrink: 0 }}
        />
      </div>

      {/* portal — renders into <body>, escapes all overflow:hidden parents */}
      {mounted && open && pos && createPortal(dropdown, document.body)}
    </div>
  );
}

// ── DateInput — public component ──────────────────────────────────────────────
interface DateInputProps {
  name?:        string;
  value:        string;
  onChange:     (e: React.ChangeEvent<HTMLInputElement> | { target: { name: string; value: string } }) => void;
  required?:    boolean;
  disabled?:    boolean;
  placeholder?: string;
  style?:       React.CSSProperties;
  className?:   string;
  minDate?:     string;
  maxDate?:     string;
}

export default function DateInput({
  name = "",
  value,
  onChange,
  required,
  disabled,
  placeholder,
  style,
  className,
  minDate,
  maxDate,
}: DateInputProps) {
  const { isBS } = useDateFormat();
  // useId gives a stable unique id per instance — safe for multiple pickers on same page
  const rawId = useId();
  // useId can contain colons which are invalid in CSS selectors used in <style> scoping
  const pickerId = "bsp" + rawId.replace(/[^a-zA-Z0-9]/g, "");

  const handleBSChange = useCallback((adIso: string) => {
    onChange({ target: { name, value: adIso } } as any);
  }, [name, onChange]);

  if (!isBS) {
    return (
      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        style={style}
        className={className}
        min={minDate}
        max={maxDate}
      />
    );
  }

  return (
    <div style={{ width: "100%", position: "relative", ...style }} className={className}>
      <BsCalendarPicker
        value={value}
        onChange={handleBSChange}
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        pickerId={pickerId}
      />
      {/* Hidden native input so HTML5 `required` validation still works */}
      {required && (
        <input
          type="text"
          required
          value={value}
          onChange={() => {}}
          style={{
            position: "absolute", opacity: 0,
            pointerEvents: "none", width: 1, height: 1,
            top: 0, left: 0,
          }}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
