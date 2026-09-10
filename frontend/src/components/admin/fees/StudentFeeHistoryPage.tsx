"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useCurrency } from "@/lib/useCurrency";
import { useDateFormat } from "@/lib/useDateFormat";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import Loader, { Spinner } from "@/components/shared/Loader";

// ── Design Tokens ────────────────────────────────────────────────────────────
const col = {
  navy:       "#0f172a",
  navyLight:  "#1e293b",
  orange:     "#ea580c",
  orangeBg:   "#fff7ed",
  orangeBrd:  "#fed7aa",
  bg:         "#f8fafc",
  card:       "#ffffff",
  border:     "#e2e8f0",
  muted:      "#64748b",
  lightMuted: "#94a3b8",
  green:      "#16a34a",
  greenBg:    "#f0fdf4",
  greenBrd:   "#bbf7d0",
  red:        "#dc2626",
  redBg:      "#fef2f2",
  redBrd:     "#fecaca",
  blue:       "#2563eb",
  blueBg:     "#eff6ff",
  blueBrd:    "#bfdbfe",
  purple:     "#7c3aed",
  purpleBg:   "#f3eeff",
  purpleBrd:  "#ddd6fe",
  amber:      "#d97706",
  amberBg:    "#fffbeb",
  amberBrd:   "#fde68a",
  slate:      "#475569",
};

const getInitials = (name: string) =>
  (name || "?")
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

const formatClassName = (name?: string) => {
  if (!name) return "";
  const trimmed = name.trim();
  if (/^(class|grade|nursery|kg|playgroup|lkg|ukg)\b/i.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `Class ${trimmed}`;
  return trimmed;
};

// ── Badges ───────────────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  academic:  { label: "Tuition",   icon: "fa-graduation-cap", color: col.blue,   bg: col.blueBg,   border: col.blueBrd },
  yearly:    { label: "Yearly",    icon: "fa-calendar-check", color: col.purple, bg: col.purpleBg, border: col.purpleBrd },
  transport: { label: "Transport", icon: "fa-bus-simple",     color: col.amber,  bg: col.amberBg,  border: col.amberBrd },
  hostel:    { label: "Hostel",    icon: "fa-building",       color: col.purple, bg: col.purpleBg, border: col.purpleBrd },
  misc:      { label: "One-Time",  icon: "fa-receipt",        color: col.slate,  bg: "#f1f5f9",    border: col.border },
  payment:   { label: "Payment",   icon: "fa-check-circle",   color: col.green,  bg: col.greenBg,  border: col.greenBrd },
};

function CategoryBadge({ category }: { category: string }) {
  const cat = category?.toLowerCase() || "academic";
  const cfg = CATEGORY_META[cat] || CATEGORY_META.misc;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 6,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        textTransform: "capitalize",
      }}
    >
      <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: 9.5 }} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() || "unpaid";
  let bg = col.redBg, color = col.red, border = col.redBrd;
  if (s === "paid") {
    bg = col.greenBg; color = col.green; border = col.greenBrd;
  } else if (s === "partial") {
    bg = col.amberBg; color = col.amber; border = col.amberBrd;
  } else if (s === "waived") {
    bg = col.purpleBg; color = col.purple; border = col.purpleBrd;
  } else if (s === "cancelled") {
    bg = "#fef2f2"; color = "#dc2626"; border = "#fecaca";
  }
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 800,
        padding: "2px 8px",
        borderRadius: 999,
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {s}
    </span>
  );
}

// ── Student Autocomplete Switcher ────────────────────────────────────────────
function StudentSearchAutoComplete({
  basePath = "",
  compact = false,
  placeholder = "Search student by name, admission no...",
  onSelect,
}: {
  basePath?: string;
  compact?: boolean;
  placeholder?: string;
  onSelect?: (st: any) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiRequest<any>(
          `/students/search?q=${encodeURIComponent(query.trim())}`
        );
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray((res?.data as any)?.data)
          ? (res.data as any).data
          : Array.isArray(res)
          ? res
          : [];
        setResults(list);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
  }, [query]);

  const handleSelect = (st: any) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    if (onSelect) {
      onSelect(st);
    } else {
      router.push(`${basePath || ""}/fees/history?student_id=${st.id}`);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", maxWidth: compact ? 340 : 540 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#ffffff",
          border: `1.5px solid ${col.border}`,
          borderRadius: compact ? 8 : 12,
          padding: compact ? "6px 12px" : "10px 16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <i className="fa-solid fa-magnifying-glass" style={{ color: col.orange, fontSize: compact ? 12 : 14, flexShrink: 0 }} />
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            border: "none",
            outline: "none",
            width: "100%",
            fontSize: compact ? 12.5 : 13.5,
            fontWeight: 600,
            color: col.navy,
            background: "transparent",
          }}
        />
        {searching && <Spinner size={compact ? 12 : 14} color={col.orange} />}
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            style={{
              border: "none", background: "none", color: col.lightMuted, cursor: "pointer",
              padding: "2px 4px", fontSize: 12, lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#ffffff",
            border: `1.5px solid ${col.border}`,
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
            maxHeight: 340,
            overflowY: "auto",
            zIndex: 9999,
          }}
        >
          {results.length > 0 ? (
            <div>
              <div style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: `1px solid ${col.border}`, fontSize: 11, fontWeight: 800, color: col.muted, textTransform: "uppercase" }}>
                Matching Students ({results.length})
              </div>
              {results.map((st) => (
                <div
                  key={st.id}
                  onClick={() => handleSelect(st)}
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    borderBottom: `1px solid #f8fafc`,
                    cursor: "pointer",
                    background: "#ffffff",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        width: 34, height: 34, borderRadius: 8, background: col.orangeBg,
                        border: `1.5px solid ${col.orangeBrd}`, color: col.orange,
                        fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(st.full_name)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: 13, color: col.navy, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {st.full_name}
                      </strong>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                        {st.class_name && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: col.blue, background: col.blueBg, border: `1px solid ${col.blueBrd}`, padding: "1px 6px", borderRadius: 4 }}>
                            {formatClassName(st.class_name)}
                          </span>
                        )}
                        {st.admission_number && (
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: col.muted }}>
                            #{st.admission_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <i className="fa-solid fa-arrow-right" style={{ color: col.lightMuted, fontSize: 11 }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 18, textAlign: "center", color: col.muted, fontSize: 12 }}>
              No students found matching "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Directory Mode (when no student selected) ────────────────────────────────
function StudentFeeSearchDirectory({ basePath = "" }: { basePath?: string }) {
  const router = useRouter();
  const { formatDate } = useDateFormat();
  const { academicYearId } = useAcademicYear();
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: classesData } = useApi<any[]>(
    academicYearId ? `/classes?academic_year_id=${academicYearId}` : ""
  );

  const { data: financeAccount } = useApi<any>(
    basePath !== "/finance" ? "/school/finance-account" : null
  );
  const hasActiveFinanceAccount = Boolean(
    basePath !== "/finance" && financeAccount && (financeAccount.id || financeAccount.email) && financeAccount.status !== "inactive"
  );
  const classes = useMemo(() => {
    if (Array.isArray(classesData)) return classesData;
    if (Array.isArray((classesData as any)?.data)) return (classesData as any).data;
    return [];
  }, [classesData]);

  const loadInitialStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<any>("/students?limit=40");
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res)
        ? res
        : [];
      setStudents(list);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const isInitialMount = useRef(true);

  useEffect(() => {
    loadInitialStudents();
  }, [loadInitialStudents]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!query.trim()) {
      loadInitialStudents();
      return;
    }
    if (query.trim().length < 2) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiRequest<any>(
          `/students/search?q=${encodeURIComponent(query.trim())}`
        );
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.data)
          ? res.data.data
          : Array.isArray(res)
          ? res
          : [];
        setStudents(list);
      } catch {
        setStudents([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, loadInitialStudents]);

  const studentList = Array.isArray(students) ? students : [];
  const filteredStudents = useMemo(() => {
    if (classFilter === "all") return studentList;
    return studentList.filter((st: any) => {
      if (st.class_id && String(st.class_id) === String(classFilter)) return true;
      const matchedClass = classes.find((c: any) => String(c.id) === String(classFilter));
      if (matchedClass && st.class_name && st.class_name.toLowerCase() === (matchedClass.name || "").toLowerCase()) return true;
      return false;
    });
  }, [studentList, classFilter, classes]);

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, color: col.orange, textTransform: "uppercase", letterSpacing: 0.8, display: "inline-block", marginBottom: 4 }}>
            Accounting &amp; Auditing
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: col.navy, margin: "0 0 4px" }}>
            Student Fee Ledgers &amp; Statements
          </h1>
          <p style={{ fontSize: 13, color: col.muted, margin: 0 }}>
            Select a student to view their official accounting ledger, invoices, payments, and running balance.
          </p>
        </div>
        {hasActiveFinanceAccount ? (
          <div
            style={{
              height: 38,
              padding: "0 14px",
              borderRadius: 8,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              fontSize: 12.5,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
            title="Fee collection is delegated to the Finance Manager account"
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            Fee Counter: Finance Officer
          </div>
        ) : (
          <Link
            href={`${basePath || ""}/fees/collect`}
            style={{
              height: 38, padding: "0 16px", borderRadius: 8, background: col.orange, color: "#fff",
              fontWeight: 800, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
            }}
          >
            <i className="fa-solid fa-hand-holding-dollar" /> Open Fee Counter
          </Link>
        )}
      </div>

      {/* Search Toolbar */}
      <div style={{ background: "#fff", border: `1.5px solid ${col.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: col.orange, fontSize: 13 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student by name, admission #, phone..."
            style={{
              width: "100%", height: 38, paddingLeft: 34, paddingRight: 12,
              borderRadius: 8, border: `1px solid ${col.border}`, fontSize: 13, outline: "none",
            }}
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          style={{
            height: 38, padding: "0 12px", borderRadius: 8, border: `1px solid ${col.border}`,
            fontSize: 13, fontWeight: 600, color: col.navy, outline: "none", minWidth: 160,
          }}
        >
          <option value="all">All Classes</option>
          {classes.map((c: any) => (
            <option key={c.id} value={c.id}>{formatClassName(c.name)}</option>
          ))}
        </select>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <Loader fullScreen={false} size="md" text="Loading student accounts..." />
      ) : filteredStudents.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${col.border}`, borderRadius: 12, padding: 48, textAlign: "center" }}>
          <i className="fa-solid fa-user-slash" style={{ fontSize: 36, color: col.lightMuted, marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 800, color: col.navy, margin: "0 0 6px" }}>No Student Accounts Found</h3>
          <p style={{ fontSize: 13, color: col.muted, margin: 0 }}>Try adjusting your search query or class filter.</p>
        </div>
      ) : (
        <div style={{ background: "#fff", border: `1.5px solid ${col.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: `2px solid ${col.border}` }}>
                  <th style={{ padding: "12px 16px", fontWeight: 800, color: col.navy, width: 50 }}>#</th>
                  <th style={{ padding: "12px 16px", fontWeight: 800, color: col.navy }}>Student Name</th>
                  <th style={{ padding: "12px 16px", fontWeight: 800, color: col.navy }}>Admission #</th>
                  <th style={{ padding: "12px 16px", fontWeight: 800, color: col.navy }}>Class &amp; Section</th>
                  <th style={{ padding: "12px 16px", fontWeight: 800, color: col.navy }}>Roll No</th>
                  <th style={{ padding: "12px 16px", fontWeight: 800, color: col.navy }}>Contact</th>
                  <th style={{ padding: "12px 16px", fontWeight: 800, color: col.navy, textAlign: "center" }}>Status</th>
                  <th style={{ padding: "12px 16px", fontWeight: 800, color: col.navy, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st: any, idx: number) => {
                  const isActive = (st.status || "active").toLowerCase() === "active";
                  return (
                    <tr
                      key={st.id}
                      onClick={() => router.push(`${basePath || ""}/fees/history?student_id=${st.id}`)}
                      style={{
                        borderBottom: `1px solid #f1f5f9`,
                        cursor: "pointer",
                        background: idx % 2 === 0 ? "#ffffff" : "#fafcff",
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fff7ed")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#ffffff" : "#fafcff")}
                    >
                      {/* # */}
                      <td style={{ padding: "12px 16px", color: col.lightMuted, fontWeight: 700, fontSize: 12 }}>
                        {idx + 1}
                      </td>

                      {/* Student Name (Direct clean typography, no first letter box) */}
                      <td style={{ padding: "12px 16px" }}>
                        <strong style={{ fontSize: 13.5, fontWeight: 800, color: col.navy, display: "block" }}>
                          {st.full_name}
                        </strong>
                        {st.admission_date && (
                          <span style={{ fontSize: 11, color: col.lightMuted }}>
                            Enrolled: {formatDate(String(st.admission_date).slice(0, 10))}
                          </span>
                        )}
                      </td>

                      {/* Admission Number */}
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: col.slate }}>
                        #{st.admission_number || "—"}
                      </td>

                      {/* Class & Section */}
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: col.blue,
                            background: col.blueBg,
                            border: `1px solid ${col.blueBrd}`,
                            padding: "3px 8px",
                            borderRadius: 6,
                            display: "inline-block",
                          }}
                        >
                          {formatClassName(st.class_name) || "—"}
                          {st.section_name ? ` · Sec ${st.section_name}` : ""}
                        </span>
                      </td>

                      {/* Roll Number */}
                      <td style={{ padding: "12px 16px", fontSize: 12.5, fontWeight: 600, color: col.slate }}>
                        {st.roll_number ?? "—"}
                      </td>

                      {/* Contact */}
                      <td style={{ padding: "12px 16px", fontSize: 12, color: col.muted, fontWeight: 600 }}>
                        {st.phone || st.parent_phone || st.guardian_phone || "—"}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: isActive ? col.greenBg : "#f1f5f9",
                            color: isActive ? col.green : col.muted,
                            border: `1px solid ${isActive ? col.greenBrd : col.border}`,
                            textTransform: "uppercase",
                          }}
                        >
                          {st.status || "active"}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`${basePath || ""}/fees/history?student_id=${st.id}`);
                          }}
                          style={{
                            height: 30,
                            padding: "0 12px",
                            borderRadius: 6,
                            border: `1px solid ${col.orangeBrd}`,
                            background: col.orangeBg,
                            color: col.orange,
                            fontWeight: 800,
                            fontSize: 12,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            transition: "all 0.12s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = col.orange;
                            e.currentTarget.style.color = "#fff";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = col.orangeBg;
                            e.currentTarget.style.color = col.orange;
                          }}
                        >
                          View Ledger <i className="fa-solid fa-arrow-right" style={{ fontSize: 10 }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN STUDENT ACCOUNTING LEDGER PAGE ──────────────────────────────────────
export default function StudentFeeHistoryPage({ basePath = "" }: { basePath?: string }) {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = searchParams.get("student_id") || searchParams.get("studentId");

  const { fmt } = useCurrency();
  const { formatDate, formatFeeName, isBS } = useDateFormat();
  const { academicYearId } = useAcademicYear();

  // Academic Year Switcher (guarded: only fetch if viewing student ledger)
  const { data: allYearsData } = useApi<any[]>(studentId ? "/academic-years" : null);

  const { data: financeAccount } = useApi<any>(
    studentId && basePath !== "/finance" ? "/school/finance-account" : null
  );
  const hasActiveFinanceAccount = Boolean(
    basePath !== "/finance" && financeAccount && (financeAccount.id || financeAccount.email) && financeAccount.status !== "inactive"
  );
  const yearsList = useMemo(() => {
    if (Array.isArray(allYearsData)) return allYearsData;
    if (Array.isArray((allYearsData as any)?.data)) return (allYearsData as any).data;
    return [];
  }, [allYearsData]);

  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  useEffect(() => {
    if (academicYearId && selectedYearId === null) setSelectedYearId(academicYearId);
  }, [academicYearId, selectedYearId]);

  // Student details
  const { data: student } = useApi<any>(
    studentId ? `/students/${studentId}` : ""
  );

  // Collections and payments via useApi with SWR caching
  const collectionsUrl = studentId && selectedYearId
    ? `/fees/collections/student/${studentId}?academic_year_id=${selectedYearId}`
    : null;
  const paymentsUrl = studentId && selectedYearId
    ? `/fees/payments/student/${studentId}?academic_year_id=${selectedYearId}`
    : null;

  const {
    data: colData,
    loading: colLoading,
    refetch: refetchCollections,
  } = useApi<any>(collectionsUrl);

  const {
    data: payData,
    loading: payLoading,
    refetch: refetchPayments,
  } = useApi<any>(paymentsUrl);

  const collections = useMemo(() => {
    if (!colData) return [];
    if (Array.isArray(colData)) return colData;
    if (Array.isArray(colData?.data)) return colData.data;
    if (Array.isArray(colData?.data?.data)) return colData.data.data;
    return [];
  }, [colData]);

  const payments = useMemo(() => {
    if (!payData) return [];
    if (Array.isArray(payData)) return payData;
    if (Array.isArray(payData?.data)) return payData.data;
    if (Array.isArray(payData?.data?.data)) return payData.data.data;
    return [];
  }, [payData]);

  const loading = colLoading || payLoading;

  const refetchData = useCallback(() => {
    refetchCollections();
    refetchPayments();
  }, [refetchCollections, refetchPayments]);

  // Filter state
  const [viewFilter, setViewFilter] = useState<"all" | "invoices" | "payments">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sync Dues Modal State
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncChoice, setSyncChoice] = useState<"admission_month" | "session_start">("admission_month");
  const [syncing, setSyncing] = useState(false);

  // ── Sync Dues Handler ───────────────────────────────────────────────────────
  const handleSyncDues = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !selectedYearId) return;
    setSyncing(true);
    try {
      const res = await apiRequest<{ data: any; message: string }>(`/fees/students/${studentId}/sync-dues`, {
        method: "POST",
        body: JSON.stringify({
          billing_start_choice: syncChoice,
          academic_year_id: selectedYearId,
        }),
      });
      dispatch(showToast({
        type: "success",
        title: "Dues Synchronized",
        message: res.message || "Student dues generated successfully.",
      }));
      setShowSyncModal(false);
      refetchData();
    } catch (err: any) {
      dispatch(showToast({
        type: "error",
        title: "Sync Failed",
        message: err.message || "Could not synchronize dues.",
      }));
    } finally {
      setSyncing(false);
    }
  };

  // ── Executive Financial Totals ──────────────────────────────────────────────
  const { totalBilled, totalPaid, totalWaived, totalDue, uniqueReceiptsCount } = useMemo(() => {
    let billed = 0;
    let paid = 0;
    let waived = 0;
    let due = 0;

    const colList = Array.isArray(collections) ? collections : [];
    const payList = Array.isArray(payments) ? payments : [];

    colList.forEach((c: any) => {
      if (c.status === "cancelled") return;
      const net = Number(c.net_amount ?? c.total_amount ?? 0);
      billed += net;
      if (c.status === "waived") {
        waived += Math.max(0, net - Number(c.paid_amount || 0));
      } else {
        due += Number(c.remaining_amount || 0);
      }
    });

    const receiptSet = new Set<string>();
    payList.forEach((p: any) => {
      paid += Number(p.paid_amount ?? p.amount ?? 0);
      if (p.receipt_number) receiptSet.add(p.receipt_number);
      else receiptSet.add(`pay-${p.id}`);
    });

    return { totalBilled: billed, totalPaid: paid, totalWaived: waived, totalDue: due, uniqueReceiptsCount: receiptSet.size };
  }, [collections, payments]);

  // ── Chronological Unified Ledger Entries ────────────────────────────────────
  const ledgerEntries = useMemo(() => {
    interface LedgerItem {
      id: string;
      date: string;
      rawDate: string;
      billDate?: string;
      dueDate?: string;
      paymentDate?: string;
      receiptTime?: string;
      type: "invoice" | "payment";
      particulars: string;
      category: string;
      refNo: string;
      debit: number;
      originalDebit?: number;
      waived: number;
      waiveReason?: string;
      credit: number;
      runningBalance?: number;
      status: string;
      collectionId?: number;
      paymentId?: number;
      isOverdue?: boolean;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const items: LedgerItem[] = [];
    const colList = Array.isArray(collections) ? collections : [];
    const payList = Array.isArray(payments) ? payments : [];

    // Add Invoices / Dues (Debit)
    colList.forEach((c: any) => {
      const dueDateStr = c.due_date ? String(c.due_date).slice(0, 10) : "";
      const billedDateStr = c.created_at ? String(c.created_at).slice(0, 10) : (c.billing_from_month ? `${c.billing_from_month}-01` : todayStr);
      const d = dueDateStr || billedDateStr;
      const isCancelled = c.status === "cancelled";
      const isOverdue = c.status !== "paid" && c.status !== "waived" && !isCancelled && Boolean(dueDateStr) && dueDateStr < todayStr;
      const net = Number(c.net_amount ?? c.total_amount ?? 0);
      const paid = Number(c.paid_amount || 0);
      const waivedAmt = c.status === "waived" ? Math.max(0, net - paid) : 0;

      items.push({
        id: `inv-${c.id}`,
        date: d,
        rawDate: d,
        billDate: billedDateStr,
        dueDate: dueDateStr,
        type: "invoice",
        particulars: formatFeeName(c.fee_name),
        category: c.frequency === "yearly" ? "yearly" : (c.fee_type || "academic"),
        refNo: `INV-${c.id}`,
        debit: isCancelled ? 0 : net,
        originalDebit: net,
        waived: waivedAmt,
        waiveReason: c.fine_reason || undefined,
        credit: 0,
        status: c.status,
        collectionId: c.id,
        isOverdue,
      });
    });

    // Group payments by receipt_number so a single counter transaction appears as ONE credit entry in the ledger
    const paymentsByReceipt = new Map<string, {
      id: number;
      date: string;
      rawDate: string;
      receiptDate: string;
      receiptNumber: string;
      method: string;
      remarks?: string;
      totalPaid: number;
      itemsCount: number;
    }>();

    payList.forEach((p: any) => {
      const receiptNo = p.receipt_number || `RCP-${p.id}`;
      const d = p.payment_date ? String(p.payment_date).slice(0, 10) : String(p.created_at || todayStr).slice(0, 10);
      const receiptCreated = p.created_at ? String(p.created_at).slice(0, 10) : d;
      const paidAmt = Number(p.paid_amount ?? p.amount ?? 0);

      if (!paymentsByReceipt.has(receiptNo)) {
        paymentsByReceipt.set(receiptNo, {
          id: p.id,
          date: d,
          rawDate: d,
          receiptDate: receiptCreated,
          receiptNumber: receiptNo,
          method: p.payment_method?.replace(/_/g, " ") || "Cash",
          remarks: p.remarks,
          totalPaid: paidAmt,
          itemsCount: 1,
        });
      } else {
        const entry = paymentsByReceipt.get(receiptNo)!;
        entry.totalPaid += paidAmt;
        entry.itemsCount += 1;
        if (!entry.remarks && p.remarks) entry.remarks = p.remarks;
      }
    });

    // Add Payments Received (Credit) — One clean entry per receipt
    for (const [, gp] of paymentsByReceipt) {
      items.push({
        id: `pay-${gp.id}`,
        date: gp.date,
        rawDate: gp.rawDate,
        paymentDate: gp.date,
        receiptTime: gp.receiptDate,
        type: "payment",
        particulars: `Payment Received (${gp.method.toUpperCase()})${gp.itemsCount > 1 ? ` · ${gp.itemsCount} Items Settled` : ""}${gp.remarks ? ` — ${gp.remarks}` : ""}`,
        category: "payment",
        refNo: gp.receiptNumber,
        debit: 0,
        waived: 0,
        credit: gp.totalPaid,
        status: "paid",
        paymentId: gp.id,
      });
    }

    // Sort chronologically ascending
    items.sort((a, b) => {
      if (a.rawDate !== b.rawDate) return a.rawDate.localeCompare(b.rawDate);
      // Invoices first on the same date so charges occur before payments
      if (a.type !== b.type) return a.type === "invoice" ? -1 : 1;
      // If both are invoices on the same date, yearly fees occur before tuition fees
      if (a.category === "yearly" && b.category !== "yearly") return -1;
      if (b.category === "yearly" && a.category !== "yearly") return 1;
      return a.id.localeCompare(b.id);
    });

    // Compute Running Balance: Deduct both payments (credit) and waived amounts
    let balance = 0;
    items.forEach((item) => {
      if (item.status !== "cancelled") {
        balance += (item.debit - item.credit - (item.waived || 0));
      }
      item.runningBalance = balance;
    });

    return items;
  }, [collections, payments, isBS]);

  // ── Filtered Ledger Entries ────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    return ledgerEntries.filter((item) => {
      if (viewFilter === "invoices" && item.type !== "invoice") return false;
      if (viewFilter === "payments" && item.type !== "payment") return false;

      if (categoryFilter !== "all") {
        if (categoryFilter === "misc" && (item.category === "misc" || item.category === "store")) {
          // match
        } else if (item.category !== categoryFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesParticulars = item.particulars.toLowerCase().includes(q);
        const matchesRef = item.refNo.toLowerCase().includes(q);
        if (!matchesParticulars && !matchesRef) return false;
      }

      return true;
    });
  }, [ledgerEntries, viewFilter, categoryFilter, searchQuery]);

  // If no student selected, render the directory search view
  if (!studentId) {
    return <StudentFeeSearchDirectory basePath={basePath} />;
  }

  const enrollmentsList = Array.isArray(student?.enrollments) ? student.enrollments : [];
  const enrollment = enrollmentsList.find((e: any) => e.academic_year_id === selectedYearId)
    || enrollmentsList.find((e: any) => e.status === "active")
    || enrollmentsList[0];

  const studentName = student?.full_name || "Student Account";
  const className = enrollment?.class_name || student?.class_name || "";
  const sectionName = enrollment?.section_name || student?.section_name || "";
  const rollNo = enrollment?.roll_number ?? student?.roll_number ?? "—";
  const admissionNo = student?.admission_number || "—";
  const scholarshipPct = enrollment?.scholarship_percent ?? student?.scholarship_percent ?? 0;
  const scholarshipType = enrollment?.scholarship_type ?? student?.scholarship_type ?? "";
  const admissionDateRaw = student?.admission_date ? String(student.admission_date).slice(0, 10) : "";

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 16px" }}>
      {/* ── Print Header (Only visible when printing) ── */}
      <div className="print-only" style={{ display: "none", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a", textTransform: "uppercase" }}>
              Student Statement of Account
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569" }}>
              Official Student Fee Ledger &amp; Transaction History
            </p>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#475569" }}>
            <strong>Statement Date:</strong> {new Date().toLocaleDateString()}<br />
            <strong>Academic Year:</strong> {yearsList.find((y: any) => y.id === selectedYearId)?.year_name || "Active Session"}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, padding: "12px 0", borderBottom: "1px solid #e2e8f0", fontSize: 12 }}>
          <div><strong>Student Name:</strong> {studentName}</div>
          <div><strong>Admission No:</strong> {admissionNo}</div>
          <div><strong>Class &amp; Section:</strong> {formatClassName(className)} {sectionName ? `(${sectionName})` : ""}</div>
          <div><strong>Roll No:</strong> {rollNo}</div>
        </div>
      </div>

      {/* ── Screen Top Action Bar ── */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link
              href={`${basePath || ""}/fees/history`}
              style={{
                fontSize: 12, fontWeight: 700, color: col.muted, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}
            >
              <i className="fa-solid fa-arrow-left" /> Back to Accounts
            </Link>
            <span style={{ color: col.lightMuted }}>/</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: col.orange, textTransform: "uppercase", letterSpacing: 0.8 }}>
              Account Ledger
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: col.navy, margin: 0 }}>
            {studentName}
          </h1>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StudentSearchAutoComplete
            basePath={basePath}
            compact
            placeholder="Switch student account..."
          />
          <button
            type="button"
            onClick={() => setShowSyncModal(true)}
            style={{
              height: 36, padding: "0 14px", borderRadius: 8, border: `1.5px solid ${col.orangeBrd}`,
              background: col.orangeBg, color: col.orange, fontWeight: 800, fontSize: 12.5, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
            title="Automatically check class structures and generate any missing monthly or one-time dues"
          >
            <i className="fa-solid fa-wand-magic-sparkles" /> Sync Dues
          </button>
          {!hasActiveFinanceAccount && (
            <Link
              href={`${basePath || ""}/fees/collect?student_id=${studentId}`}
              style={{
                height: 36, padding: "0 16px", borderRadius: 8, background: col.navy, color: "#fff",
                fontWeight: 800, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
              }}
            >
              <i className="fa-solid fa-hand-holding-dollar" /> Collect Fee
            </Link>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              height: 36, padding: "0 12px", borderRadius: 8, border: `1px solid ${col.border}`,
              background: "#fff", color: col.slate, fontWeight: 700, fontSize: 12.5, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="fa-solid fa-print" /> Print
          </button>
        </div>
      </div>

      {/* ── Student Profile & Academic Year Card ── */}
      <div
        className="no-print"
        style={{
          background: "#fff", border: `1.5px solid ${col.border}`, borderRadius: 12,
          padding: "16px 20px", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                width: 48, height: 48, borderRadius: 12, background: col.orangeBg,
                border: `2px solid ${col.orangeBrd}`, color: col.orange, fontSize: 16, fontWeight: 900,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              {getInitials(studentName)}
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 16, fontWeight: 900, color: col.navy }}>{studentName}</strong>
                {(() => {
                  const s = (student?.status || "active").toLowerCase();
                  const isAct = s === "active";
                  const sBg = isAct ? col.greenBg : s === "graduated" ? col.blueBg : s === "transferred" ? col.amberBg : col.redBg;
                  const sColor = isAct ? col.green : s === "graduated" ? col.blue : s === "transferred" ? col.amber : col.red;
                  const sBrd = isAct ? col.greenBrd : s === "graduated" ? col.blueBrd : s === "transferred" ? col.amberBrd : col.redBrd;
                  return (
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: sColor, background: sBg, border: `1px solid ${sBrd}`, padding: "2px 7px", borderRadius: 999, textTransform: "uppercase" }}>
                      {s}
                    </span>
                  );
                })()}
                {admissionDateRaw && (
                  <span style={{ fontSize: 11.5, color: col.muted, fontWeight: 600 }}>
                    · Enrolled: {formatDate(admissionDateRaw)}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap", fontSize: 12, color: col.muted }}>
                <span><strong>Class:</strong> {formatClassName(className)} {sectionName ? `(${sectionName})` : ""}</span>
                <span><strong>Roll:</strong> {rollNo}</span>
                <span><strong>Adm No:</strong> #{admissionNo}</span>
                {student?.guardian_phone && <span><strong>Phone:</strong> {student.guardian_phone}</span>}
              </div>
            </div>
          </div>

          {/* Academic Session Selector & Scholarship */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {Number(scholarshipPct) > 0 && (
              <span style={{ padding: "4px 10px", borderRadius: 8, background: col.greenBg, border: `1px solid ${col.greenBrd}`, color: col.green, fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <i className="fa-solid fa-award" />
                {scholarshipType || "Scholarship"}: {scholarshipPct}% concession
              </span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: col.muted }}>Session:</span>
              <select
                value={selectedYearId || ""}
                onChange={(e) => setSelectedYearId(Number(e.target.value))}
                style={{
                  height: 34, padding: "0 10px", borderRadius: 8, border: `1px solid ${col.border}`,
                  fontSize: 12.5, fontWeight: 700, color: col.navy, outline: "none", background: "#f8fafc",
                }}
              >
                {yearsList.map((y: any) => (
                  <option key={y.id} value={y.id}>{y.year_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Executive Financial KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
        {/* Total Billed (Dr) */}
        <div style={{ background: "#fff", border: `1.5px solid ${col.border}`, borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: col.muted, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Total Billed (Debit)
          </span>
          <strong style={{ fontSize: 22, fontWeight: 900, color: col.navy, display: "block", margin: "4px 0 2px" }}>
            {fmt(totalBilled)}
          </strong>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: col.lightMuted }}>
            {collections.length} invoice{collections.length !== 1 ? "s" : ""} generated
          </span>
        </div>

        {/* Total Paid (Cr) */}
        <div style={{ background: "#fff", border: `1.5px solid ${col.greenBrd}`, borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: col.green, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Total Collected (Credit)
          </span>
          <strong style={{ fontSize: 22, fontWeight: 900, color: col.green, display: "block", margin: "4px 0 2px" }}>
            {fmt(totalPaid)}
          </strong>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: col.muted }}>
            {uniqueReceiptsCount} payment receipt{uniqueReceiptsCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Concessions / Waived */}
        <div style={{ background: "#fff", border: `1.5px solid ${col.border}`, borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: col.purple, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Waived &amp; Concessions
          </span>
          <strong style={{ fontSize: 22, fontWeight: 900, color: col.purple, display: "block", margin: "4px 0 2px" }}>
            {fmt(totalWaived)}
          </strong>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: col.lightMuted }}>
            Concessions applied
          </span>
        </div>

        {/* Outstanding Balance */}
        <div
          style={{
            background: totalDue > 0 ? col.redBg : col.greenBg,
            border: `1.5px solid ${totalDue > 0 ? col.redBrd : col.greenBrd}`,
            borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: totalDue > 0 ? col.red : col.green, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Outstanding Balance
          </span>
          <strong style={{ fontSize: 22, fontWeight: 900, color: totalDue > 0 ? col.red : col.green, display: "block", margin: "4px 0 2px" }}>
            {fmt(totalDue)}
          </strong>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: totalDue > 0 ? col.red : col.green }}>
            {totalDue > 0 ? "Pending Payment" : "All Fees Cleared ✓"}
          </span>
        </div>
      </div>

      {/* ── Toolbar & Filters ── */}
      <div
        className="no-print"
        style={{
          background: "#fff", border: `1.5px solid ${col.border}`, borderRadius: 12,
          padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: 12,
        }}
      >
        {/* View Mode Pills */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Ledger Entries", count: ledgerEntries.length },
            { id: "invoices", label: "Invoices (Debit)", count: collections.length },
            { id: "payments", label: "Receipts (Credit)", count: ledgerEntries.filter(e => e.type === "payment").length },
          ].map((tab) => {
            const active = viewFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewFilter(tab.id as any)}
                style={{
                  height: 32, padding: "0 12px", borderRadius: 6,
                  border: `1px solid ${active ? col.navy : col.border}`,
                  background: active ? col.navy : "#f8fafc",
                  color: active ? "#fff" : col.slate,
                  fontWeight: 700, fontSize: 12, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  transition: "all 0.12s",
                }}
              >
                {tab.label}
                <span
                  style={{
                    fontSize: 10, fontWeight: 900, padding: "1px 5px", borderRadius: 999,
                    background: active ? "rgba(255,255,255,0.2)" : "#e2e8f0",
                    color: active ? "#fff" : col.muted,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Category Filter */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              height: 34, padding: "0 10px", borderRadius: 8, border: `1px solid ${col.border}`,
              fontSize: 12.5, fontWeight: 600, color: col.navy, outline: "none", background: "#f8fafc",
            }}
          >
            <option value="all">All Categories</option>
            <option value="academic">Tuition Fees</option>
            <option value="yearly">Yearly / Annual Fees</option>
            <option value="transport">Transport</option>
            <option value="hostel">Hostel</option>
            <option value="misc">One-Time / Misc</option>
          </select>
          <div style={{ position: "relative", minWidth: 200 }}>
            <i className="fa-solid fa-filter" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: col.lightMuted, fontSize: 11 }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description..."
              style={{
                height: 34, paddingLeft: 28, paddingRight: 10, borderRadius: 8,
                border: `1px solid ${col.border}`, fontSize: 12, outline: "none", width: "100%",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── THE ACCOUNTING LEDGER TABLE ── */}
      <div
        style={{
          background: "#fff", border: `1.5px solid ${col.border}`, borderRadius: 12,
          overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        {loading ? (
          <div style={{ padding: 40 }}>
            <Loader fullScreen={false} size="md" text="Loading ledger transactions..." />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <i className="fa-solid fa-receipt" style={{ fontSize: 36, color: col.lightMuted, marginBottom: 12 }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: col.navy, margin: "0 0 6px" }}>No Ledger Records Found</h3>
            <p style={{ fontSize: 12.5, color: col.muted, margin: "0 0 16px" }}>
              There are no billing or payment records matching the selected view filter.
            </p>
            <button
              type="button"
              onClick={() => setShowSyncModal(true)}
              style={{
                height: 34, padding: "0 14px", borderRadius: 6, border: "none",
                background: col.orange, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <i className="fa-solid fa-wand-magic-sparkles" /> Sync &amp; Generate Dues Now
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: `2px solid ${col.border}` }}>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: col.navy, width: 140 }}>Date</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: col.navy }}>Particulars / Description</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: col.navy, width: 100 }}>Category</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: col.navy, width: 105 }}>Ref / Receipt #</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: col.navy, textAlign: "right", width: 100 }}>Billed (Dr)</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: col.purple, textAlign: "right", width: 95 }}>Waived</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: col.green, textAlign: "right", width: 100 }}>Paid (Cr)</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: col.navy, textAlign: "right", width: 110 }}>Balance</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: col.navy, textAlign: "center", width: 85 }}>Status</th>
                  <th className="no-print" style={{ padding: "10px 14px", fontWeight: 800, color: col.navy, textAlign: "right", width: 95 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((item, idx) => {
                  const isInvoice = item.type === "invoice";
                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: `1px solid #f1f5f9`,
                        background: idx % 2 === 0 ? "#ffffff" : "#fafcff",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#ffffff" : "#fafcff")}
                    >
                      {/* Date (Dual Date: Billed vs Due, or Paid vs Issued) */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        {isInvoice ? (
                          <>
                            <strong style={{ color: col.navy, display: "block", fontSize: 12 }}>
                              {formatDate(item.billDate || item.date)}
                            </strong>
                            {item.dueDate && (
                              <span style={{
                                fontSize: 10.5,
                                color: item.isOverdue ? col.red : col.muted,
                                display: "flex",
                                alignItems: "center",
                                gap: 3.5,
                                marginTop: 1,
                                fontWeight: item.isOverdue ? 800 : 500,
                              }}>
                                <i className="fa-regular fa-clock" style={{ fontSize: 9.5 }} />
                                Due: {formatDate(item.dueDate)}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <strong style={{ color: col.green, display: "block", fontSize: 12 }}>
                              {formatDate(item.paymentDate || item.date)}
                            </strong>
                            <span style={{
                              fontSize: 10.5,
                              color: col.lightMuted,
                              display: "flex",
                              alignItems: "center",
                              gap: 3.5,
                              marginTop: 1,
                            }}>
                              <i className="fa-solid fa-receipt" style={{ fontSize: 9.5 }} />
                              Receipt: {formatDate(item.receiptTime || item.date)}
                            </span>
                          </>
                        )}
                      </td>

                      {/* Particulars */}
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <i
                              className={isInvoice ? "fa-solid fa-file-invoice" : "fa-solid fa-circle-check"}
                              style={{ color: isInvoice ? (item.isOverdue ? col.red : col.blue) : col.green, fontSize: 11 }}
                            />
                            <span style={{ fontWeight: 700, color: isInvoice ? col.navy : col.green }}>
                              {item.particulars}
                            </span>
                          </div>
                          {item.waiveReason && (
                            <span style={{
                              fontSize: 10.5,
                              color: item.status === "cancelled" ? col.red : col.purple,
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              marginLeft: 17,
                            }}>
                              <i className="fa-solid fa-ban" style={{ fontSize: 9 }} />
                              {item.status === "cancelled" ? `Voided: ${item.waiveReason}` : `Waived: ${item.waiveReason}`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td style={{ padding: "10px 14px" }}>
                        <CategoryBadge category={item.category} />
                      </td>

                      {/* Reference No */}
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11.5, fontWeight: 600, color: col.slate }}>
                        {item.refNo}
                      </td>

                      {/* Billed (Dr) */}
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: item.debit > 0 ? col.navy : col.lightMuted }}>
                        {item.status === "cancelled" ? (
                          <span style={{ textDecoration: "line-through", color: col.lightMuted, fontSize: 11.5 }} title="Voided / Cancelled Bill">
                            {fmt(item.originalDebit || 0)}
                          </span>
                        ) : item.debit > 0 ? fmt(item.debit) : "—"}
                      </td>

                      {/* Waived */}
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: item.waived > 0 ? col.purple : col.lightMuted }}>
                        {item.waived > 0 ? fmt(item.waived) : "—"}
                      </td>

                      {/* Paid (Cr) */}
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: item.credit > 0 ? col.green : col.lightMuted }}>
                        {item.credit > 0 ? fmt(item.credit) : "—"}
                      </td>

                      {/* Running Balance */}
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 900, color: (item.runningBalance || 0) > 0 ? col.navy : col.green }}>
                        {fmt(item.runningBalance || 0)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <StatusBadge status={item.status} />
                      </td>

                      {/* Action Button */}
                      <td className="no-print" style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {isInvoice && item.status !== "paid" && item.status !== "waived" && item.status !== "cancelled" ? (
                          !hasActiveFinanceAccount ? (
                            <Link
                              href={`${basePath || ""}/fees/collect?student_id=${studentId}&collection_id=${item.collectionId}`}
                              style={{
                                padding: "4px 10px", borderRadius: 6, background: col.orange, color: "#fff",
                                fontSize: 11, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                              }}
                            >
                              <i className="fa-solid fa-hand-holding-dollar" style={{ fontSize: 10 }} /> Pay
                            </Link>
                          ) : (
                            <span style={{ fontSize: 11, color: col.lightMuted, fontStyle: "italic" }}>
                              Auditing
                            </span>
                          )
                        ) : !isInvoice && item.paymentId ? (
                          <Link
                            href={`${basePath || ""}/fees/receipt/${item.paymentId}`}
                            target="_blank"
                            style={{
                              padding: "4px 8px", borderRadius: 6, border: `1px solid ${col.border}`, background: "#fff",
                              color: col.navy, fontSize: 11, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                            }}
                            title="View and print payment receipt"
                          >
                            <i className="fa-solid fa-receipt" style={{ color: col.green, fontSize: 10 }} /> Receipt
                          </Link>
                        ) : (
                          <span style={{ color: col.lightMuted, fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Summary Footer */}
              <tfoot>
                <tr style={{ background: "#f8fafc", borderTop: `2px solid ${col.border}`, fontWeight: 900 }}>
                  <td colSpan={4} style={{ padding: "12px 14px", textAlign: "right", color: col.navy, textTransform: "uppercase", fontSize: 12 }}>
                    Ledger Summary Totals:
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: col.navy, fontSize: 13 }}>
                    {fmt(totalBilled)}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: col.purple, fontSize: 13 }}>
                    {totalWaived > 0 ? fmt(totalWaived) : "—"}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: col.green, fontSize: 13 }}>
                    {fmt(totalPaid)}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: totalDue > 0 ? col.red : col.green, fontSize: 13.5 }}>
                    {fmt(totalDue)}
                  </td>
                  <td colSpan={2} style={{ padding: "12px 14px" }} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Official Print Signatures (Only visible when printing) ── */}
      <div className="print-only" style={{ display: "none", marginTop: 48 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 24 }}>
          <div style={{ textAlign: "center", width: 200, borderTop: "1px dashed #475569", paddingTop: 6, fontSize: 11 }}>
            Parent / Guardian Signature
          </div>
          <div style={{ textAlign: "center", width: 200, borderTop: "1px dashed #475569", paddingTop: 6, fontSize: 11 }}>
            Authorized Accountant / Cashier
          </div>
        </div>
      </div>

      {/* ── DUES RE-SYNC MODAL ── */}
      {showSyncModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff", borderRadius: 14, maxWidth: 460, width: "100%",
              padding: 24, boxShadow: "0 20px 48px rgba(15, 23, 42, 0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 8, background: col.orangeBg, color: col.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                  <i className="fa-solid fa-wand-magic-sparkles" />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: col.navy }}>
                    Synchronize Student Dues
                  </h3>
                  <span style={{ fontSize: 11.5, color: col.muted }}>
                    Generate missing bills for {studentName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                style={{ border: "none", background: "none", fontSize: 18, color: col.lightMuted, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: col.muted, lineHeight: 1.5, margin: "0 0 16px" }}>
              The system will inspect all active fee structures for <strong>{formatClassName(className)}</strong> and automatically generate any missing monthly tuition or annual dues up to the current month.
            </p>

            <form onSubmit={handleSyncDues}>
              <label style={{ fontSize: 12, fontWeight: 800, color: col.navy, display: "block", marginBottom: 8 }}>
                Calculate Dues Starting From:
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                <label
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10,
                    border: `1.5px solid ${syncChoice === "admission_month" ? col.orange : col.border}`,
                    background: syncChoice === "admission_month" ? col.orangeBg : "#fff", cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="syncChoice"
                    value="admission_month"
                    checked={syncChoice === "admission_month"}
                    onChange={() => setSyncChoice("admission_month")}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <strong style={{ fontSize: 13, color: col.navy, display: "block" }}>
                      From Admission Month (Recommended)
                    </strong>
                    <span style={{ fontSize: 11.5, color: col.muted }}>
                      Bills tuition only from the student's admission date ({admissionDateRaw ? formatDate(admissionDateRaw) : "Join date"}) up to the current active month.
                    </span>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10,
                    border: `1.5px solid ${syncChoice === "session_start" ? col.orange : col.border}`,
                    background: syncChoice === "session_start" ? col.orangeBg : "#fff", cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="syncChoice"
                    value="session_start"
                    checked={syncChoice === "session_start"}
                    onChange={() => setSyncChoice("session_start")}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <strong style={{ fontSize: 13, color: col.navy, display: "block" }}>
                      From Session Start (Full Session Back-Dues)
                    </strong>
                    <span style={{ fontSize: 11.5, color: col.muted }}>
                      Bills tuition for every month from the start of the academic year up to now, regardless of admission date.
                    </span>
                  </div>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => setShowSyncModal(false)}
                  style={{
                    height: 36, padding: "0 16px", borderRadius: 8, border: `1px solid ${col.border}`,
                    background: "#fff", color: col.navy, fontWeight: 700, fontSize: 12.5, cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncing}
                  style={{
                    height: 36, padding: "0 18px", borderRadius: 8, border: "none",
                    background: col.orange, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  {syncing ? <Spinner size={13} color="#fff" /> : <i className="fa-solid fa-arrows-rotate" />}
                  {syncing ? "Generating Dues..." : "Sync Dues Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Print Stylesheet ── */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print,
          aside,
          nav,
          header,
          footer {
            display: none !important;
          }
          .print-only {
            display: block !important;
            visibility: visible !important;
          }
          table,
          table * {
            visibility: visible !important;
          }
          body {
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
