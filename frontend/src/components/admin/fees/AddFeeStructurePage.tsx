"use client";

import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./fees.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";

const s  = (cn: string) => styles[cn] || cn;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

// ── Types ─────────────────────────────────────────────────────────────────
type ScholarshipPolicy = "all" | "tuition_only" | "custom";

type FeeHead = {
  id: number;
  name: string;
  cycle: string;
  amount: string;
  due_day: string;
  billing_start_rule: string;
  scholarship_applies: boolean;
  is_tuition?: boolean;
};

const POLICY_OPTIONS: { value: ScholarshipPolicy; icon: string; title: string; desc: string }[] = [
  {
    value: "all",
    icon:  "fa-graduation-cap",
    title: "Apply to all fees",
    desc:  "Scholarship discount is deducted from every fee head (tuition, transport, books, etc.)",
  },
  {
    value: "tuition_only",
    icon:  "fa-chalkboard",
    title: "Tuition fee only",
    desc:  "Scholarship applies only to tuition fee. Store items, uniform, books etc. are charged in full.",
  },
  {
    value: "custom",
    icon:  "fa-sliders",
    title: "Custom per fee head",
    desc:  "You decide individually for each fee head whether scholarship applies.",
  },
];

const CYCLE_LABELS: Record<string, string> = {
  monthly:     "Monthly",
  quarterly:   "Quarterly",
  half_yearly: "Half Yearly",
  yearly:      "Yearly",
  one_time:    "One Time",
};

const annualMultiplier = (cycle: string, rule: string) => {
  if (cycle === "monthly")     return rule === "skip_two_months" ? 10 : 12;
  if (cycle === "quarterly")   return 4;
  if (cycle === "half_yearly") return 2;
  return 1;
};

const resolveScholarship = (policy: ScholarshipPolicy, head: FeeHead): boolean => {
  if (policy === "all")          return true;
  if (policy === "tuition_only") return !!head.is_tuition;
  return head.scholarship_applies;
};

export default function AddFeeStructurePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const dispatch     = useAppDispatch();
  const { activeYear, academicYearId } = useAcademicYear();
  const { data: classes } = useApi<any[]>(
    academicYearId ? `/classes?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );
  const { execute: saveStructure, loading: saving } = useMutation("/fees/structures", "POST");

  const [classId, setClassId] = useState("");
  const [policy, setPolicy]   = useState<ScholarshipPolicy>("tuition_only");
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([
    {
      id: 1,
      name: "Tuition Fee",
      cycle: "monthly",
      amount: "",
      due_day: "10",
      billing_start_rule: "next_month",
      scholarship_applies: true,
      is_tuition: true,
    },
  ]);

  useEffect(() => {
    const preselectedClass = searchParams.get("class_id");
    if (preselectedClass) {
      setClassId(preselectedClass);
    } else if (classes && classes.length > 0 && !classId) {
      setClassId(classes[0].id.toString());
    }
  }, [classes, classId, searchParams]);

  const updateHead = (id: number, key: keyof FeeHead, value: any) =>
    setFeeHeads(hs => hs.map(h => h.id === id ? { ...h, [key]: value } : h));

  const addFeeHead = (isTuition = false, isStore = false) => {
    setFeeHeads(hs => [
      ...hs,
      {
        id: Date.now(),
        name: isTuition ? "Tuition Fee" : isStore ? "Uniform & Books" : "",
        cycle: isStore ? "one_time" : "monthly",
        amount: "",
        due_day: "10",
        billing_start_rule: "next_month",
        scholarship_applies: !isStore,
        is_tuition: isTuition,
      },
    ]);
  };

  const removeHead = (id: number) =>
    setFeeHeads(hs => hs.length === 1 ? hs : hs.filter(h => h.id !== id));

  const estimatedTotal = feeHeads.reduce((sum, h) => {
    const amt = Number(h.amount || 0);
    return sum + amt * annualMultiplier(h.cycle, h.billing_start_rule);
  }, 0);

  const handleSave = async () => {
    if (!activeYear || !academicYearId || !classId)
      return dispatch(showToast({ type: "error", title: "Missing info", message: "Select an academic year and class." }));

    for (const h of feeHeads) {
      if (!h.name.trim() || !h.amount || Number(h.amount) <= 0)
        return dispatch(showToast({ type: "error", title: "Incomplete", message: "Fill in name and amount for all fee heads." }));
    }

    try {
      for (const h of feeHeads) {
        await saveStructure({
          academic_year_id:    academicYearId,
          class_id:            parseInt(classId),
          fee_name:            h.name.trim(),
          amount:              parseFloat(h.amount),
          frequency:           h.cycle,
          due_date_type:       "fixed_day",
          due_day:             Math.min(Math.max(parseInt(h.due_day || "10", 10), 1), 28),
          billing_start_rule:  h.billing_start_rule,
          scholarship_applies: resolveScholarship(policy, h),
        });
      }
      dispatch(showToast({ type: "success", title: "Saved", message: "Fee structures created successfully." }));
      router.push("/fees/structures?saved=1");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to save fee structures." }));
    }
  };

  const selectedClass = classes?.find(c => c.id.toString() === classId);

  return (
    <div className={s("feesPage")}>
      <main className={s("pageContent")}>

        {/* ── Page Header ── */}
        <section className={s("pageHead")}>
          <div className={s("headLeft")}>
            <div className={s("headIcon")}>
              <i className="fa-solid fa-plus" />
            </div>
            <div>
              <h1>Create Fee Structure</h1>
              <p>Define class-wise fee plans and configure scholarship discount policy.</p>
            </div>
          </div>
          <div className={s("headActions")}>
            <Link className={cx(s("btn"), s("btnOutline"))} href="/fees/structures">
              <i className="fa-solid fa-arrow-left" /> Back to Structures
            </Link>
          </div>
        </section>

        {/* ── Form Layout (2 Columns) ── */}
        <div className={s("formLayout")}>
          <div className={s("formStack")}>

            {/* ── Step 01: Structure Details ── */}
            <article className={s("formCard")}>
              <div className={s("formCardHead")}>
                <h2>
                  <i className="fa-solid fa-school" /> Structure Details
                </h2>
                <span>01</span>
              </div>
              <div className={s("formCardBody")}>
                <div className={s("formGrid")}>
                  <label className={s("field")}>
                    <span>Academic Year</span>
                    <input value={activeYear?.year_name || "Active Session"} readOnly disabled />
                  </label>
                  <label className={s("field")}>
                    <span>Class <b>*</b></span>
                    <select value={classId} onChange={e => setClassId(e.target.value)}>
                      {classes && classes.length > 0 ? (
                        classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                      ) : (
                        <option value="">No classes found</option>
                      )}
                    </select>
                  </label>
                </div>
              </div>
            </article>

            {/* ── Step 02: Scholarship Policy ── */}
            <article className={s("formCard")}>
              <div className={s("formCardHead")}>
                <h2>
                  <i className="fa-solid fa-graduation-cap" /> Scholarship Policy
                </h2>
                <span>02</span>
              </div>
              <div className={s("formCardBody")}>
                <p style={{ fontSize: 13, color: "#475569", fontWeight: 600, margin: "0 0 14px" }}>
                  When a student has an active scholarship concession, which fees should the discount apply to?
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {POLICY_OPTIONS.map(opt => {
                    const active = policy === opt.value;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => setPolicy(opt.value)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 14,
                          padding: "14px 16px",
                          borderRadius: 12,
                          cursor: "pointer",
                          border: `1.5px solid ${active ? "#FF9B51" : "#e2e8f0"}`,
                          background: active ? "#fff7ed" : "#ffffff",
                          transition: "all 0.16s ease",
                        }}
                      >
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          flexShrink: 0,
                          background: active ? "#FF9B51" : "#f1f5f9",
                          color: active ? "#ffffff" : "#64748b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                        }}>
                          <i className={`fa-solid ${opt.icon}`} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: active ? "#ea580c" : "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                            {opt.title}
                            {active && (
                              <span style={{ fontSize: 10.5, fontWeight: 900, background: "#FF9B51", color: "#fff", padding: "1px 8px", borderRadius: 99 }}>
                                SELECTED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 500, marginTop: 3, lineHeight: 1.4 }}>
                            {opt.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Policy reminder banner */}
                <div style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: policy === "all" ? "#ecfdf5" : policy === "tuition_only" ? "#eff6ff" : "#faf5ff",
                  border: `1px solid ${policy === "all" ? "#a7f3d0" : policy === "tuition_only" ? "#bfdbfe" : "#e9d5ff"}`,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: policy === "all" ? "#059669" : policy === "tuition_only" ? "#2563eb" : "#9333ea",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}>
                  <i className={`fa-solid ${policy === "all" ? "fa-circle-check" : policy === "tuition_only" ? "fa-chalkboard" : "fa-sliders"}`} />
                  <span>
                    {policy === "all" && "All fee heads below will have scholarship discount applied automatically."}
                    {policy === "tuition_only" && 'Only fee heads marked as "Tuition" will get the scholarship discount.'}
                    {policy === "custom" && "Use the individual toggle switch on each fee head to assign scholarship."}
                  </span>
                </div>
              </div>
            </article>

            {/* ── Step 03: Fee Heads ── */}
            <article className={s("formCard")}>
              <div className={s("formCardHead")}>
                <h2>
                  <i className="fa-solid fa-list-check" /> Fee Heads & Pricing
                </h2>
                <span>03</span>
              </div>
              <div className={s("formCardBody")}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {feeHeads.map((head, idx) => {
                    const scholarshipForHead = resolveScholarship(policy, head);
                    const showCustomToggle   = policy === "custom";
                    const showTuitionToggle  = policy === "tuition_only";

                    return (
                      <div
                        key={head.id}
                        style={{
                          border: "1.5px solid #e2e8f0",
                          borderRadius: 12,
                          background: "#ffffff",
                          overflow: "hidden",
                          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
                        }}
                      >
                        {/* Header bar of head card */}
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          background: "#f8fafc",
                          borderBottom: "1px solid #f1f5f9",
                        }}>
                          <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b" }}>
                            Fee Head #{idx + 1}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: scholarshipForHead ? "#ecfdf5" : "#f1f5f9",
                              color: scholarshipForHead ? "#059669" : "#64748b",
                              border: `1px solid ${scholarshipForHead ? "#a7f3d0" : "#e2e8f0"}`,
                            }}>
                              <i className={`fa-solid fa-${scholarshipForHead ? "graduation-cap" : "ban"}`} style={{ marginRight: 4, fontSize: 9 }} />
                              {scholarshipForHead ? "Scholarship Discount" : "No Discount"}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeHead(head.id)}
                              disabled={feeHeads.length === 1}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: "1px solid #fecaca",
                                background: "#fef2f2",
                                color: "#dc2626",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                opacity: feeHeads.length === 1 ? 0.35 : 1,
                              }}
                              title="Remove Fee Head"
                            >
                              <i className="fa-solid fa-trash" />
                            </button>
                          </div>
                        </div>

                        {/* Fields row */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                          gap: 12,
                          padding: "14px",
                        }}>
                          <label className={s("field")}>
                            <span>Fee Name <b>*</b></span>
                            <input
                              value={head.name}
                              onChange={e => updateHead(head.id, "name", e.target.value)}
                              placeholder="e.g. Tuition, Exam, Transport"
                            />
                          </label>

                          <label className={s("field")}>
                            <span>Frequency <b>*</b></span>
                            <select
                              value={head.cycle}
                              onChange={e => updateHead(head.id, "cycle", e.target.value)}
                            >
                              {Object.entries(CYCLE_LABELS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </label>

                          {(["monthly", "quarterly", "half_yearly"] as const).includes(head.cycle as any) && (
                            <label className={s("field")}>
                              <span>Billing Start</span>
                              <select
                                value={head.billing_start_rule}
                                onChange={e => updateHead(head.id, "billing_start_rule", e.target.value)}
                              >
                                <option value="next_month">Next Cycle</option>
                                <option value="skip_two_months">Skip 2 Months</option>
                                <option value="academic_year">From Year Start</option>
                              </select>
                            </label>
                          )}

                          <label className={s("field")}>
                            <span>Amount (₹) <b>*</b></span>
                            <input
                              type="number"
                              min={1}
                              value={head.amount}
                              onChange={e => updateHead(head.id, "amount", e.target.value)}
                              placeholder="0"
                            />
                          </label>

                          <label className={s("field")}>
                            <span>Due Day (1-28)</span>
                            <input
                              type="number"
                              min={1}
                              max={28}
                              value={head.due_day}
                              onChange={e => updateHead(head.id, "due_day", e.target.value)}
                              placeholder="10"
                            />
                          </label>
                        </div>

                        {/* Policy toggles */}
                        {(showCustomToggle || showTuitionToggle) && (
                          <div style={{ padding: "0 14px 14px" }}>
                            {showTuitionToggle && (
                              <label style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 12.5,
                                fontWeight: 700,
                                cursor: "pointer",
                                padding: "6px 12px",
                                borderRadius: 8,
                                background: head.is_tuition ? "#eff6ff" : "#f8fafc",
                                border: `1px solid ${head.is_tuition ? "#bfdbfe" : "#e2e8f0"}`,
                                color: head.is_tuition ? "#1d4ed8" : "#64748b",
                              }}>
                                <input
                                  type="checkbox"
                                  checked={!!head.is_tuition}
                                  onChange={e => updateHead(head.id, "is_tuition", e.target.checked)}
                                  style={{ accentColor: "#3b82f6", width: 15, height: 15 }}
                                />
                                Mark as Tuition Fee (Scholarship Discount Applies)
                              </label>
                            )}
                            {showCustomToggle && (
                              <label style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 12.5,
                                fontWeight: 700,
                                cursor: "pointer",
                                padding: "6px 12px",
                                borderRadius: 8,
                                background: head.scholarship_applies ? "#ecfdf5" : "#f8fafc",
                                border: `1px solid ${head.scholarship_applies ? "#a7f3d0" : "#e2e8f0"}`,
                                color: head.scholarship_applies ? "#059669" : "#64748b",
                              }}>
                                <input
                                  type="checkbox"
                                  checked={head.scholarship_applies}
                                  onChange={e => updateHead(head.id, "scholarship_applies", e.target.checked)}
                                  style={{ accentColor: "#10b981", width: 15, height: 15 }}
                                />
                                Scholarship Discount Applies to This Fee
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quick Add Buttons */}
                <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => addFeeHead()}
                    className={cx(s("btn"), s("btnSoft"))}
                  >
                    <i className="fa-solid fa-plus" /> Add Fee Head
                  </button>
                  <button
                    type="button"
                    onClick={() => addFeeHead(true)}
                    className={cx(s("btn"), s("btnSoft"))}
                    style={{ borderColor: "#bfdbfe", background: "#eff6ff", color: "#2563eb" }}
                  >
                    <i className="fa-solid fa-chalkboard" /> Add Tuition Fee
                  </button>
                  <button
                    type="button"
                    onClick={() => addFeeHead(false, true)}
                    className={cx(s("btn"), s("btnOutline"))}
                  >
                    <i className="fa-solid fa-cart-shopping" /> Store / Uniform Item
                  </button>
                </div>
              </div>
            </article>

          </div>

          {/* ── Right Column: Sticky Summary ── */}
          <aside className={s("sidePanel")}>
            <div className={s("summaryBox")}>
              <div className={s("summaryTop")}>
                <div className={s("summaryIcon")}>
                  <i className="fa-solid fa-receipt" />
                </div>
                <div>
                  <h3>Plan Summary</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                    Live structure preview
                  </p>
                </div>
              </div>

              <div className={s("summaryLines")}>
                <div className={s("summaryLine")}>
                  <b>Class</b>
                  <strong>{selectedClass?.name || "Select class"}</strong>
                </div>
                <div className={s("summaryLine")}>
                  <b>Academic Year</b>
                  <strong>{activeYear?.year_name || "Active Year"}</strong>
                </div>
                <div className={s("summaryLine")}>
                  <b>Scholarship Policy</b>
                  <strong style={{ color: "#ea580c", textTransform: "capitalize" }}>
                    {policy === "all" ? "All Fees" : policy === "tuition_only" ? "Tuition Only" : "Custom"}
                  </strong>
                </div>
                <div className={s("summaryLine")}>
                  <b>Discount Heads</b>
                  <strong style={{ color: "#059669" }}>
                    {feeHeads.filter(h => resolveScholarship(policy, h)).length} / {feeHeads.length}
                  </strong>
                </div>
                <div className={s("summaryLine")} style={{ borderTop: "1.5px dashed #e2e8f0", marginTop: 6, paddingTop: 10 }}>
                  <b style={{ fontSize: 13, color: "#0f172a", fontWeight: 800 }}>Est. Annual Total</b>
                  <strong style={{ fontSize: 15, color: "#0f172a", fontWeight: 900 }}>
                    ₹{estimatedTotal.toLocaleString("en-IN")} <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>/ student</span>
                  </strong>
                </div>
              </div>
            </div>

            {/* Scholarship Preview Badge Box */}
            <div className={s("summaryBox")}>
              <h4 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Scholarship Preview
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {feeHeads.map(h => {
                  const applies = resolveScholarship(policy, h);
                  return (
                    <div
                      key={h.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 0",
                        borderBottom: "1px solid #f1f5f9",
                        fontSize: 12.5,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#334155" }}>
                        {h.name || "Untitled Head"}
                      </span>
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: "2px 7px",
                        borderRadius: 6,
                        background: applies ? "#ecfdf5" : "#f1f5f9",
                        color: applies ? "#059669" : "#94a3b8",
                        border: `1px solid ${applies ? "#a7f3d0" : "#e2e8f0"}`,
                      }}>
                        {applies ? "✓ Discount" : "— Full"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Save Buttons */}
            <div className={s("savePanel")}>
              <button
                className={cx(s("btn"), s("btnPrimary"))}
                type="button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <><Spinner size={14} color="#fff" /> Saving Structures…</>
                ) : (
                  <><i className="fa-solid fa-floppy-disk" /> Save Structure</>
                )}
              </button>
              <Link className={cx(s("btn"), s("btnOutline"))} href="/fees/structures">
                Cancel
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
