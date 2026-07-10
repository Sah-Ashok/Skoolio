"use client";

import React, { useState, useEffect, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import { Spinner } from "@/components/shared/Loader";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import styles from "./promotion.module.css";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

function initials(name: string) {
  return name?.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

// ── Types ───────────────────────────────────────────────────────────────────

interface AcademicYear { id: number; year_name: string; status: string; }
interface ClassItem     { id: number; name: string; academic_year_id: number; }
interface SectionItem   { id: number; name: string; class_id: number; }

interface StudentRow {
  enrollment_id:    number;
  student_id:       number;
  full_name:        string;
  admission_number: string;
  class_name:       string;
  section_name:     string;
  section_id:       number;
  roll_number?:     string;
  stream:           string;
  is_promoted:      boolean;
  gender:           string;
  // mutable per-row overrides (set by user)
  _target_class_id?:   number;
  _target_section_id?: number;
  _excluded?:          boolean;
}

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Select Classes", "Review Students", "Confirm", "Done"] as const;

// ── Component ───────────────────────────────────────────────────────────────

export default function PromotionPage() {
  const dispatch = useAppDispatch();

  // ── Wizard step ──
  const [step, setStep] = useState<Step>(1);

  // ── Step 1: selectors ──
  const [sourceYearId,  setSourceYearId]  = useState<string>("");
  const [sourceClassId, setSourceClassId] = useState<string>("");
  const [targetYearId,  setTargetYearId]  = useState<string>("");
  const [targetClassId, setTargetClassId] = useState<string>("");

  // ── Step 2: student table ──
  const [rows,    setRows]    = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");

  // Global "apply to all" selectors in the target config strip
  const [globalTargetClass,   setGlobalTargetClass]   = useState<string>("");
  const [globalTargetSection, setGlobalTargetSection] = useState<string>("");

  // ── Step 4: result ──
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── API data ──
  const { data: years } = useApi<AcademicYear[]>("/academic-years");

  const { data: sourceClasses } = useApi<ClassItem[]>(
    sourceYearId ? `/classes?academic_year_id=${sourceYearId}` : "",
    [sourceYearId]
  );

  const { data: targetClasses } = useApi<ClassItem[]>(
    targetYearId ? `/classes?academic_year_id=${targetYearId}` : "",
    [targetYearId]
  );

  const { data: targetSections } = useApi<SectionItem[]>(
    globalTargetClass ? `/promotion/sections?class_id=${globalTargetClass}` : "",
    [globalTargetClass]
  );

  // ── Derived ──
  const sourceYear = years?.find(y => y.id === Number(sourceYearId));
  const targetYear = years?.find(y => y.id === Number(targetYearId));

  const uniqueSections = useMemo(() => {
    const seen = new Set<string>();
    return rows.filter(r => {
      if (seen.has(r.section_name)) return false;
      seen.add(r.section_name); return true;
    });
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = !search
        || r.full_name.toLowerCase().includes(search.toLowerCase())
        || r.admission_number.toLowerCase().includes(search.toLowerCase());
      const matchSection = sectionFilter === "all" || r.section_name === sectionFilter;
      return matchSearch && matchSection;
    });
  }, [rows, search, sectionFilter]);

  const selectedRows    = rows.filter(r => !r._excluded);
  const alreadyPromoted = rows.filter(r => r.is_promoted);

  useEffect(() => {
    setGlobalTargetSection("");
  }, [globalTargetClass]);

  // ── Step 1 → 2: load students ──
  const handleLoadStudents = async () => {
    if (!sourceYearId || !sourceClassId || !targetYearId || !targetClassId) {
      dispatch(showToast({ type: "error", title: "Missing fields", message: "Please fill in all four dropdowns." }));
      return;
    }
    if (sourceYearId === targetYearId) {
      dispatch(showToast({ type: "error", title: "Invalid", message: "Source and target academic years must differ." }));
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<any>(
        `/promotion/students?academic_year_id=${sourceYearId}&class_id=${sourceClassId}`
      );
      const students: StudentRow[] = (res?.data?.students ?? res?.students ?? []).map((st: any) => ({
        ...st,
        _excluded:          st.is_promoted,
        _target_class_id:   Number(targetClassId),
        _target_section_id: undefined,
      }));
      setRows(students);
      setGlobalTargetClass(targetClassId);
      setStep(2);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed to load students", message: err.message }));
    } finally {
      setLoading(false);
    }
  };

  // ── Apply global target class/section to all rows ──
  const applyGlobal = () => {
    if (!globalTargetClass || !globalTargetSection) {
      dispatch(showToast({ type: "warning", title: "Select target class and section first", message: "" }));
      return;
    }
    setRows(prev =>
      prev.map(r => ({
        ...r,
        _target_class_id:   Number(globalTargetClass),
        _target_section_id: Number(globalTargetSection),
      }))
    );
  };

  const toggleRow = (enrollment_id: number) => {
    setRows(prev =>
      prev.map(r => r.enrollment_id === enrollment_id ? { ...r, _excluded: !r._excluded } : r)
    );
  };

  const allVisible = filteredRows.length > 0 && filteredRows.every(r => !r._excluded);
  const toggleAll  = () => {
    const ids = new Set(filteredRows.map(r => r.enrollment_id));
    setRows(prev =>
      prev.map(r => ids.has(r.enrollment_id) ? { ...r, _excluded: allVisible } : r)
    );
  };

  const setRowSection = (enrollment_id: number, section_id: number) => {
    setRows(prev =>
      prev.map(r => r.enrollment_id === enrollment_id ? { ...r, _target_section_id: section_id } : r)
    );
  };

  // ── Step 2 → 3 validation ──
  const handleToConfirm = () => {
    const valid = selectedRows.every(r => r._target_class_id && r._target_section_id);
    if (!valid) {
      dispatch(showToast({ type: "error", title: "Incomplete", message: "All selected students must have a target class and section assigned." }));
      return;
    }
    setStep(3);
  };

  // ── Step 3 → submit ──
  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const payload = {
        source_academic_year_id: Number(sourceYearId),
        target_academic_year_id: Number(targetYearId),
        rows: selectedRows.map(r => ({
          enrollment_id:     r.enrollment_id,
          student_id:        r.student_id,
          target_class_id:   r._target_class_id!,
          target_section_id: r._target_section_id!,
          stream:            r.stream,
          roll_number:       r.roll_number,
        })),
      };
      const res = await apiRequest<any>("/promotion/bulk", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(res?.data ?? res);
      setStep(4);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Promotion failed", message: err.message }));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setRows([]);
    setResult(null);
    setSearch("");
    setSectionFilter("all");
    setGlobalTargetClass("");
    setGlobalTargetSection("");
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className={s("promotion-page")}>
      <Topbar title="Student Promotion" subtitle="Bulk-promote students to the next academic year" />
      <main className={s("page-content")}>

        <section className={s("page-head")}>
          <div>
            <h1>Year-End Promotion</h1>
            <p>Select the source class, choose a target year and class, then promote in bulk.</p>
          </div>
        </section>

        {/* ── Stepper ── */}
        <div className={s("stepper")}>
          {STEP_LABELS.map((label, i) => {
            const n      = (i + 1) as Step;
            const done   = step > n;
            const active = step === n;
            return (
              <React.Fragment key={label}>
                <div className={cx(s("step"), done && s("done"), active && s("active"))}>
                  <span className={s("step-num")}>
                    {done ? <i className="fa-solid fa-check" /> : n}
                  </span>
                  {label}
                </div>
                {i < 3 && (
                  <div className={cx(s("step-connector"), done && s("done"))} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 1 — Select source + target                                    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className={cx(s("card"), s("selector-card"))}>
            <h2>
              <i className="fa-solid fa-arrow-right-arrow-left" style={{ color: "#ff9b51", marginRight: 8 }} />
              Configure Promotion
            </h2>
            <p>Choose where students are coming from and where they are going.</p>

            <div className={s("selector-grid")}>
              <div className={s("field")}>
                <label>Source Academic Year</label>
                <select value={sourceYearId} onChange={e => { setSourceYearId(e.target.value); setSourceClassId(""); }}>
                  <option value="">Select year…</option>
                  {years?.map(y => (
                    <option key={y.id} value={y.id}>{y.year_name}{y.status === "active" ? " (Active)" : ""}</option>
                  ))}
                </select>
              </div>
              <div className={s("field")}>
                <label>Source Class (from)</label>
                <select value={sourceClassId} onChange={e => setSourceClassId(e.target.value)} disabled={!sourceYearId}>
                  <option value="">Select class…</option>
                  {sourceClasses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div />

              <div className={s("field")}>
                <label>Target Academic Year</label>
                <select value={targetYearId} onChange={e => { setTargetYearId(e.target.value); setTargetClassId(""); }}>
                  <option value="">Select year…</option>
                  {years?.filter(y => y.id !== Number(sourceYearId)).map(y => (
                    <option key={y.id} value={y.id}>{y.year_name}{y.status === "active" ? " (Active)" : ""}</option>
                  ))}
                </select>
              </div>
              <div className={s("field")}>
                <label>Target Class (to)</label>
                <select value={targetClassId} onChange={e => setTargetClassId(e.target.value)} disabled={!targetYearId}>
                  <option value="">Select class…</option>
                  {targetClasses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className={cx(s("btn"), s("btn-primary"))} onClick={handleLoadStudents} disabled={loading}>
                {loading
                  ? <><Spinner size={14} color="#fff" /> Loading…</>
                  : <><i className="fa-solid fa-magnifying-glass" /> Load Students</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 2 — Review & configure                                        */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <>
            <div className={s("summary-strip")}>
              <span className={cx(s("summary-chip"), s("chip-blue"))}>
                <i className="fa-solid fa-calendar" />{sourceYear?.year_name} → {targetYear?.year_name}
              </span>
              <span className={cx(s("summary-chip"), s("chip-orange"))}>
                <i className="fa-solid fa-users" />{rows.length} students total
              </span>
              <span className={cx(s("summary-chip"), s("chip-green"))}>
                <i className="fa-solid fa-circle-check" />{selectedRows.length} selected
              </span>
              {alreadyPromoted.length > 0 && (
                <span className={cx(s("summary-chip"), s("chip-yellow"))}>
                  <i className="fa-solid fa-triangle-exclamation" />{alreadyPromoted.length} already promoted
                </span>
              )}
            </div>

            <div className={s("card")}>
              {/* Target config strip */}
              <div className={s("target-config")}>
                <div style={{ fontWeight: 900, fontSize: 13, whiteSpace: "nowrap" }}>
                  <i className="fa-solid fa-wand-magic-sparkles" style={{ color: "#ff9b51", marginRight: 7 }} />
                  Apply to all:
                </div>
                <div className={s("field")}>
                  <label>Target Class</label>
                  <select value={globalTargetClass} onChange={e => setGlobalTargetClass(e.target.value)}>
                    <option value="">Select class…</option>
                    {targetClasses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className={s("field")}>
                  <label>Target Section</label>
                  <select value={globalTargetSection} onChange={e => setGlobalTargetSection(e.target.value)} disabled={!globalTargetClass}>
                    <option value="">Select section…</option>
                    {targetSections?.map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                  </select>
                </div>
                <button className={cx(s("btn"), s("btn-soft"), s("apply-btn"))} onClick={applyGlobal}>
                  <i className="fa-solid fa-check-double" /> Apply to Selected
                </button>
              </div>

              {/* Toolbar */}
              <div className={s("step2-toolbar")}>
                <div className={s("toolbar-left")}>
                  <label className={s("search-box")}>
                    <i className="fa-solid fa-magnifying-glass" />
                    <input
                      placeholder="Search by name or admission no…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </label>
                  <select className={s("filter-select")} value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
                    <option value="all">All Sections</option>
                    {uniqueSections.map(r => (
                      <option key={r.section_name} value={r.section_name}>{r.section_name}</option>
                    ))}
                  </select>
                </div>
                <div className={s("toolbar-right")}>
                  <button className={cx(s("btn"), s("btn-outline"), s("btn-sm"))} onClick={() => setStep(1)}>
                    <i className="fa-solid fa-arrow-left" /> Back
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className={s("table-wrap")}>
                {filteredRows.length === 0 ? (
                  <div className={s("empty-state")}>
                    <i className="fa-solid fa-user-slash" />
                    No students match your filters.
                  </div>
                ) : (
                  <StudentTable
                    rows={filteredRows}
                    targetClasses={targetClasses ?? []}
                    globalTargetClass={globalTargetClass}
                    allVisible={allVisible}
                    onToggleAll={toggleAll}
                    onToggleRow={toggleRow}
                    onSetSection={setRowSection}
                    styles={styles}
                  />
                )}
              </div>
            </div>

            {/* Sticky footer bar */}
            <div className={s("sticky-bar")}>
              <div className={s("sticky-bar-left")}>
                <span className={cx(s("summary-chip"), s("chip-green"))}>
                  {selectedRows.length} student(s) will be promoted
                </span>
                {rows.length - selectedRows.length > 0 && (
                  <span className={cx(s("summary-chip"), s("chip-yellow"))}>
                    {rows.length - selectedRows.length} excluded
                  </span>
                )}
              </div>
              <div className={s("sticky-bar-right")}>
                <button
                  className={cx(s("btn"), s("btn-primary"))}
                  onClick={handleToConfirm}
                  disabled={selectedRows.length === 0}
                >
                  <i className="fa-solid fa-arrow-right" /> Review & Confirm
                </button>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 3 — Confirm                                                   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className={cx(s("card"), s("confirm-card"))}>
            <h2>
              <i className="fa-solid fa-clipboard-check" style={{ color: "#ff9b51", marginRight: 8 }} />
              Confirm Promotion
            </h2>
            <p>
              Review the summary below. This action will create new enrollments in{" "}
              <strong>{targetYear?.year_name}</strong> and mark the current enrollments as promoted.
            </p>

            <div className={s("confirm-stats")}>
              <div className={s("confirm-stat")}>
                <div className={cx(s("stat-icon"), s("green"))}><i className="fa-solid fa-user-check" /></div>
                <div><span>Promoting</span><strong>{selectedRows.length}</strong></div>
              </div>
              <div className={s("confirm-stat")}>
                <div className={cx(s("stat-icon"), s("blue"))}><i className="fa-solid fa-calendar-days" /></div>
                <div><span>From Year</span><strong>{sourceYear?.year_name}</strong></div>
              </div>
              <div className={s("confirm-stat")}>
                <div className={cx(s("stat-icon"), s("orange"))}><i className="fa-solid fa-arrow-right" /></div>
                <div><span>To Year</span><strong>{targetYear?.year_name}</strong></div>
              </div>
              <div className={s("confirm-stat")}>
                <div className={cx(s("stat-icon"), s("yellow"))}><i className="fa-solid fa-ban" /></div>
                <div><span>Excluded</span><strong>{rows.length - selectedRows.length}</strong></div>
              </div>
            </div>

            <div className={s("warning-box")}>
              <i className="fa-solid fa-triangle-exclamation" />
              <div>
                <strong>This action cannot be undone from this screen.</strong> Once promoted, students
                will have new active enrollments in <em>{targetYear?.year_name}</em>. Students already
                enrolled in the target year will be skipped automatically. Transport details from the
                current enrollment will be carried forward.
              </div>
            </div>

            <div className={s("confirm-actions")}>
              <button className={cx(s("btn"), s("btn-outline"))} onClick={() => setStep(2)} disabled={submitting}>
                <i className="fa-solid fa-arrow-left" /> Back
              </button>
              <button className={cx(s("btn"), s("btn-primary"))} onClick={handleConfirm} disabled={submitting}>
                {submitting
                  ? <><Spinner size={14} color="#fff" /> Promoting…</>
                  : <><i className="fa-solid fa-rocket" /> Promote {selectedRows.length} Student{selectedRows.length !== 1 ? "s" : ""}</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 4 — Result                                                    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 4 && result && (
          <div className={cx(s("card"), s("result-card"))}>
            <div className={cx(s("result-icon"), result.promoted > 0 ? s("success") : s("partial"))}>
              <i className={`fa-solid ${result.promoted > 0 ? "fa-circle-check" : "fa-triangle-exclamation"}`} />
            </div>
            <h2>Promotion {result.promoted > 0 ? "Complete!" : "Partially Complete"}</h2>
            <p>
              Students from <strong>{result.source_year}</strong> have been promoted to{" "}
              <strong>{result.target_year}</strong>.
            </p>
            <div className={s("result-pills")}>
              <span className={cx(s("summary-chip"), s("chip-green"))}>
                <i className="fa-solid fa-circle-check" />{result.promoted} promoted
              </span>
              {result.skipped > 0 && (
                <span className={cx(s("summary-chip"), s("chip-yellow"))}>
                  <i className="fa-solid fa-forward" />{result.skipped} skipped (already enrolled)
                </span>
              )}
              {result.errors?.length > 0 && (
                <span className={cx(s("summary-chip"), s("chip-orange"))}>
                  <i className="fa-solid fa-circle-exclamation" />{result.errors.length} error(s)
                </span>
              )}
            </div>

            {result.errors?.length > 0 && (
              <div className={s("error-list")}>
                <details>
                  <summary>Show errors ({result.errors.length})</summary>
                  <ul>
                    {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              </div>
            )}

            <div className={s("result-actions")}>
              <button className={cx(s("btn"), s("btn-soft"))} onClick={reset}>
                <i className="fa-solid fa-rotate-left" /> Promote Another Class
              </button>
              <a className={cx(s("btn"), s("btn-primary"))} href="/students">
                <i className="fa-solid fa-users" /> View Students
              </a>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ── Sub-component: student table ─────────────────────────────────────────────

interface StudentTableProps {
  rows: StudentRow[];
  targetClasses: ClassItem[];
  globalTargetClass: string;
  allVisible: boolean;
  onToggleAll: () => void;
  onToggleRow: (id: number) => void;
  onSetSection: (id: number, section_id: number) => void;
  styles: Record<string, string>;
}

function StudentTable({
  rows, targetClasses, globalTargetClass,
  allVisible, onToggleAll, onToggleRow, onSetSection, styles,
}: StudentTableProps) {
  const s  = (c: string) => styles[c] || c;
  const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

  return (
    <table className={s("promo-table")}>
      <thead>
        <tr>
          <th style={{ width: 40 }}>
            <input type="checkbox" checked={allVisible} onChange={onToggleAll} />
          </th>
          <th>Student</th>
          <th>Admission No</th>
          <th>Section</th>
          <th>Stream</th>
          <th>Status</th>
          <th>Target Class</th>
          <th>Target Section</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.enrollment_id} className={row._excluded ? s("excluded") : ""}>
            <td>
              <input
                type="checkbox"
                checked={!row._excluded}
                onChange={() => onToggleRow(row.enrollment_id)}
                disabled={row.is_promoted}
              />
            </td>
            <td>
              <div className={s("student-cell")}>
                <span className={s("avatar")}>{initials(row.full_name)}</span>
                <div>
                  <strong>{row.full_name}</strong>
                  <span>{row.gender}</span>
                </div>
              </div>
            </td>
            <td>{row.admission_number}</td>
            <td>{row.section_name}</td>
            <td style={{ textTransform: "capitalize" }}>{row.stream?.replace("_", " ")}</td>
            <td>
              {row.is_promoted
                ? <span className={cx(s("badge"), s("badge-green"))}>Promoted</span>
                : <span className={cx(s("badge"), s("badge-yellow"))}>Pending</span>
              }
            </td>
            <td>
              {targetClasses.find(c => c.id === row._target_class_id)?.name ?? (
                <span style={{ color: "#9aabb4" }}>—</span>
              )}
            </td>
            <td>
              {row._excluded ? (
                <span style={{ color: "#9aabb4", fontSize: 12 }}>—</span>
              ) : (
                <SectionSelect
                  value={row._target_section_id}
                  classId={row._target_class_id ?? Number(globalTargetClass)}
                  onChange={val => onSetSection(row.enrollment_id, val)}
                  styles={styles}
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Per-row section select ───────────────────────────────────────────────────

function SectionSelect({
  value, classId, onChange, styles,
}: { value?: number; classId: number; onChange: (v: number) => void; styles: Record<string, string> }) {
  const s  = (c: string) => styles[c] || c;
  const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

  const { data: sections } = useApi<SectionItem[]>(
    classId ? `/promotion/sections?class_id=${classId}` : "",
    [classId]
  );

  return (
    <select
      className={cx(s("inline-select"), !value ? s("error") : "")}
      value={value ?? ""}
      onChange={e => onChange(Number(e.target.value))}
    >
      <option value="">Section…</option>
      {sections?.map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
    </select>
  );
}
