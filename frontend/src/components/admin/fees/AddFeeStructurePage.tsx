"use client";

import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import styles from "./fees.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";

const s  = (cn: string) => styles[cn] || cn;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

// ── Types ─────────────────────────────────────────────────────────────────
type BillingStartPolicy = "academic_year" | "join_date";
type MonthlyBillingRule = "bill_current" | "bill_past_due";
type ScholarshipPolicy = "all" | "tuition_only" | "custom";

type FeeHead = {
  id: number;
  name: string;
  cycle: string;
  amount: string;
  due_day: string;
  billing_start_rule: string;
  scholarship_applies: boolean;
  is_tuition?: boolean;       // used to auto-set scholarship for tuition_only policy
};

const POLICY_OPTIONS: { value: ScholarshipPolicy; icon: string; title: string; desc: string; }[] = [
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
    desc:  "Scholarship applies only to the tuition fee. Store items, dress, books etc. are charged in full.",
  },
  {
    value: "custom",
    icon:  "fa-sliders",
    title: "Custom per fee head",
    desc:  "You decide individually for each fee head whether scholarship applies.",
  },
];

const CYCLE_LABELS: Record<string, string> = {
  monthly:    "Monthly",
  quarterly:  "Quarterly",
  half_yearly: "Half Yearly",
  yearly:     "Yearly",
  one_time:   "One Time",
};

// ── Helpers ─────────────────────────────────────────────────────────────────
const annualMultiplier = (cycle: string, rule: string) => {
  if (cycle === "monthly")    return rule === "skip_two_months" ? 10 : 12;
  if (cycle === "quarterly")  return 4;
  if (cycle === "half_yearly") return 2;
  return 1; // yearly / one_time
};

/** Derive scholarship_applies from policy + whether head is tuition */
const resolveScholarship = (policy: ScholarshipPolicy, head: FeeHead): boolean => {
  if (policy === "all")          return true;
  if (policy === "tuition_only") return !!head.is_tuition;
  return head.scholarship_applies; // custom = respect user's per-row toggle
};

// ── Page ────────────────────────────────────────────────────────────────────────
export default function AddFeeStructurePage() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const { activeYear, academicYearId } = useAcademicYear();
  const { data: classes } = useApi<any[]>(
    academicYearId ? `/classes?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );
  const { execute: saveStructure, loading: saving } = useMutation("/fees/structures", "POST");

  const [classId,          setClassId]          = useState("");
  const [policy,           setPolicy]           = useState<ScholarshipPolicy>("tuition_only");
  const [billingStart,     setBillingStart]     = useState<BillingStartPolicy>("academic_year");
  const [monthlyBillRule,  setMonthlyBillRule]  = useState<MonthlyBillingRule>("bill_current");
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([
    { id: 1, name: "Tuition Fee", cycle: "monthly", amount: "", due_day: "10",
      billing_start_rule: "next_month", scholarship_applies: true, is_tuition: true },
  ]);

  useEffect(() => {
    if (classes && classes.length > 0 && !classId)
      setClassId(classes[0].id.toString());
  }, [classes, classId]);

  const updateHead = (id: number, key: keyof FeeHead, value: any) =>
    setFeeHeads(hs => hs.map(h => h.id === id ? { ...h, [key]: value } : h));

  const addFeeHead = (isTuition = false, isStore = false) => {
    setFeeHeads(hs => [
      ...hs,
      {
        id: Date.now(), name: isTuition ? "Tuition Fee" : isStore ? "" : "",
        cycle: isStore ? "one_time" : "monthly",
        amount: "", due_day: "10",
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
        return dispatch(showToast({ type: "error", title: "Incomplete", message: `Fill in name and amount for all fee heads.` }));
    }

    try {
      for (const h of feeHeads) {
        await saveStructure({
          academic_year_id:    academicYearId,
          class_id:            parseInt(classId),
          fee_name:            h.name,
          amount:              parseFloat(h.amount),
          frequency:           h.cycle,
          due_date_type:       "fixed_day",
          due_day:             Math.min(Math.max(parseInt(h.due_day || "10", 10), 1), 28),
          billing_start_rule:  h.billing_start_rule,
          scholarship_applies: resolveScholarship(policy, h),
        });
      }
      dispatch(showToast({ type: "success", title: "Saved", message: "Fee structures saved successfully." }));
      router.push("/fees/structures?saved=1");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to save." }));
    }
  };

  const selectedClass = classes?.find(c => c.id.toString() === classId);

  return (
    <div style={{ minHeight: "100vh", background: "#EAEFEF" }}>
      <main style={{ padding: "28px 32px 64px", maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", color: "#FF9B51", margin: 0 }}>
              {activeYear?.year_name ?? "…"}
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#25343F", letterSpacing: -0.5, margin: "4px 0 0" }}>
              Create Fee Structure
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", fontWeight: 500, marginTop: 3 }}>
              Define class-wise fee plans with scholarship policy
            </p>
          </div>
          <Link className={cx(s("btn"), s("btn-outline"))} href="/fees/structures">
            <i className="fa-solid fa-arrow-left" /> Back
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── Step 1: Details ── */}
            <FormCard icon="fa-school" title="Structure Details" step="01">
              <div className={s("form-grid")}>
                <Field label="Academic Year">
                  <input value={activeYear?.year_name || "Loading…"} readOnly disabled />
                </Field>
                <Field label="Class" required>
                  <select value={classId} onChange={e => setClassId(e.target.value)}>
                    {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              </div>
            </FormCard>

            {/* ── Step 2: Scholarship Policy ── */}
            <FormCard icon="fa-graduation-cap" title="Scholarship Policy" step="02">
              <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 13, color: "#475569", fontWeight: 600, margin: "0 0 10px" }}>
                  When a student has a scholarship, which fees should the discount apply to?
                </p>
                {POLICY_OPTIONS.map(opt => {
                  const active = policy === opt.value;
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setPolicy(opt.value)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 14,
                        padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                        border: `2px solid ${active ? "#FF9B51" : "#e2e8f0"}`,
                        background: active ? "#fff7ed" : "#fff",
                        textAlign: "left", width: "100%",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{
                        width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                        background: active ? "#FF9B51" : "#f1f5f9",
                        color: active ? "#fff" : "#64748b",
                        display: "grid", placeItems: "center", fontSize: 15,
                        transition: "all 0.15s",
                      }}>
                        <i className={`fa-solid ${opt.icon}`} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13.5, color: active ? "#c2410c" : "#1e293b", marginBottom: 3 }}>
                          {opt.title}
                          {active && (
                            <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 900, background: "#FF9B51", color: "#fff", padding: "1px 8px", borderRadius: 99 }}>
                              SELECTED
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 500, lineHeight: 1.5 }}>
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Policy reminder banner */}
                <div style={{
                  marginTop: 6, padding: "10px 14px", borderRadius: 8,
                  background: policy === "all"          ? "#f0fdf4"
                            : policy === "tuition_only" ? "#eff6ff"
                            : "#faf5ff",
                  border: `1px solid ${
                    policy === "all"          ? "#bbf7d0"
                    : policy === "tuition_only" ? "#bfdbfe"
                    : "#e9d5ff"}`,
                  fontSize: 12.5, fontWeight: 700,
                  color: policy === "all"          ? "#15803d"
                       : policy === "tuition_only" ? "#1d4ed8"
                       : "#7c3aed",
                  display: "flex", gap: 8, alignItems: "center",
                }}>
                  <i className={`fa-solid ${
                    policy === "all"          ? "fa-circle-check"
                    : policy === "tuition_only" ? "fa-chalkboard"
                    : "fa-sliders"}`} />
                  {policy === "all" &&
                    "All fee heads below will have scholarship applied automatically."}
                  {policy === "tuition_only" &&
                    'Only fee heads marked as “Tuition” will get the scholarship discount. Store items, books, dress etc. will be full price.'}
                  {policy === "custom" &&
                    "Use the toggle on each fee head below to control scholarship individually."}
                </div>
              </div>
            </FormCard>

            {/* ── Step 3: Fee Heads ── */}
            <FormCard icon="fa-list-check" title="Fee Heads" step="03">
              <div style={{ padding: "0 20px 6px", display: "flex", flexDirection: "column", gap: 12 }}>
                {feeHeads.map((head, idx) => {
                  const scholarshipForHead = resolveScholarship(policy, head);
                  const showCustomToggle   = policy === "custom";
                  const showTuitionToggle  = policy === "tuition_only";

                  return (
                    <div key={head.id} style={{
                      border: "1.5px solid #e2e8f0",
                      borderRadius: 10, overflow: "hidden",
                      background: "#fafbfc",
                    }}>
                      {/* Row header */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px 0",
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                          letterSpacing: 0.6, color: "#94a3b8" }}>
                          Fee head {idx + 1}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* Scholarship badge */}
                          <span style={{
                            fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 99,
                            background: scholarshipForHead ? "#dcfce7" : "#f1f5f9",
                            color:      scholarshipForHead ? "#15803d" : "#64748b",
                            border: `1px solid ${scholarshipForHead ? "#bbf7d0" : "#e2e8f0"}`,
                          }}>
                            <i className={`fa-solid fa-${ scholarshipForHead ? "graduation-cap" : "ban" }`}
                              style={{ marginRight: 4, fontSize: 9 }} />
                            {scholarshipForHead ? "Scholarship applies" : "No scholarship"}
                          </span>
                          <button type="button"
                            onClick={() => removeHead(head.id)}
                            disabled={feeHeads.length === 1}
                            style={{
                              width: 26, height: 26, borderRadius: 6, border: "1px solid #fecaca",
                              background: "#fff1f2", color: "#dc2626", cursor: "pointer",
                              fontSize: 11, display: "grid", placeItems: "center",
                              opacity: feeHeads.length === 1 ? 0.35 : 1,
                            }}
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      </div>

                      {/* Fields */}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 140px 140px 90px 90px",
                        gap: 10, padding: "10px 14px 14px", alignItems: "end",
                      }}>
                        {/* Name */}
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#374151" }}>
                          Fee Name <span style={{ color: "#ef4444" }}>*</span>
                          <input
                            value={head.name}
                            onChange={e => updateHead(head.id, "name", e.target.value)}
                            placeholder="e.g. Tuition, Dress, Transport"
                            style={INP}
                          />
                        </label>
                        {/* Frequency */}
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#374151" }}>
                          Frequency
                          <select value={head.cycle}
                            onChange={e => updateHead(head.id, "cycle", e.target.value)}
                            style={INP}>
                            {Object.entries(CYCLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </label>
                        {/* Billing start */}
                        {(["monthly", "quarterly", "half_yearly"] as const).includes(head.cycle as any) ? (
                          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#374151" }}>
                            Billing start
                            <select value={head.billing_start_rule}
                              onChange={e => updateHead(head.id, "billing_start_rule", e.target.value)}
                              style={INP}>
                              <option value="next_month">Next Cycle</option>
                              <option value="skip_two_months">Skip 2 Months</option>
                              <option value="academic_year">From Year Start</option>
                            </select>
                          </label>
                        ) : <div />}
                        {/* Amount */}
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#374151" }}>
                          Amount ₹ <span style={{ color: "#ef4444" }}>*</span>
                          <input type="number" min={1}
                            value={head.amount}
                            onChange={e => updateHead(head.id, "amount", e.target.value)}
                            placeholder="0"
                            style={INP}
                          />
                        </label>
                        {/* Due day */}
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#374151" }}>
                          Due day
                          <input type="number" min={1} max={28}
                            value={head.due_day}
                            onChange={e => updateHead(head.id, "due_day", e.target.value)}
                            placeholder="10"
                            style={INP}
                          />
                        </label>
                      </div>

                      {/* Policy-specific controls */}
                      {(showCustomToggle || showTuitionToggle) && (
                        <div style={{
                          padding: "0 14px 14px",
                          display: "flex", alignItems: "center", gap: 10,
                        }}>
                          {showTuitionToggle && (
                            <label style={{
                              display: "flex", alignItems: "center", gap: 8,
                              fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                              padding: "6px 12px", borderRadius: 7,
                              background: head.is_tuition ? "#eff6ff" : "#f8fafc",
                              border: `1px solid ${head.is_tuition ? "#bfdbfe" : "#e2e8f0"}`,
                              color: head.is_tuition ? "#1d4ed8" : "#64748b",
                              transition: "all 0.15s",
                            }}>
                              <input type="checkbox"
                                checked={!!head.is_tuition}
                                onChange={e => updateHead(head.id, "is_tuition", e.target.checked)}
                                style={{ accentColor: "#3b82f6", width: 15, height: 15 }}
                              />
                              This is a tuition fee (scholarship applies)
                            </label>
                          )}
                          {showCustomToggle && (
                            <label style={{
                              display: "flex", alignItems: "center", gap: 8,
                              fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                              padding: "6px 12px", borderRadius: 7,
                              background: head.scholarship_applies ? "#f0fdf4" : "#f8fafc",
                              border: `1px solid ${head.scholarship_applies ? "#bbf7d0" : "#e2e8f0"}`,
                              color: head.scholarship_applies ? "#15803d" : "#64748b",
                              transition: "all 0.15s",
                            }}>
                              <input type="checkbox"
                                checked={head.scholarship_applies}
                                onChange={e => updateHead(head.id, "scholarship_applies", e.target.checked)}
                                style={{ accentColor: "#16a34a", width: 15, height: 15 }}
                              />
                              Scholarship applies to this fee
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add buttons */}
              <div style={{ padding: "0 20px 20px", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => addFeeHead()}
                  className={cx(s("btn"), s("btn-soft"), s("add-line-btn"))}>
                  <i className="fa-solid fa-plus" /> Add Fee Head
                </button>
                <button type="button" onClick={() => addFeeHead(true)}
                  className={cx(s("btn"), s("btn-soft"), s("add-line-btn"))}
                  style={{ borderColor: "#bfdbfe", background: "#eff6ff", color: "#1d4ed8" }}>
                  <i className="fa-solid fa-chalkboard" /> Add Tuition Fee
                </button>
                <button type="button" onClick={() => addFeeHead(false, true)}
                  className={cx(s("btn"), s("btn-outline"), s("add-line-btn"))}>
                  <i className="fa-solid fa-cart-shopping" /> Miscellaneous / Store Item
                </button>
              </div>
            </FormCard>

          </div>{/* end left col */}

          {/* ── Sidebar ── */}
          <aside style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Summary */}
            <div className={s("summary-card")}>
              <div className={s("summary-icon")}><i className="fa-solid fa-file-invoice-dollar" /></div>
              <h3>Plan Summary</h3>
              <div className={s("summary-lines")}>
                <span><b>Class</b><strong>{selectedClass?.name || "…"}</strong></span>
                <span><b>Academic Year</b><strong>{activeYear?.year_name || "…"}</strong></span>
                <span><b>Scholarship policy</b>
                  <strong style={{ color: "#c2410c", textTransform: "capitalize" }}>
                    {policy === "all" ? "All fees" : policy === "tuition_only" ? "Tuition only" : "Custom"}
                  </strong>
                </span>
                <span>
                  <b>Scholarship fees</b>
                  <strong style={{ color: "#15803d" }}>
                    {feeHeads.filter(h => resolveScholarship(policy, h)).length} / {feeHeads.length}
                  </strong>
                </span>
                <span><b>Est. Annual Total</b><strong>&#x20B9;{estimatedTotal.toLocaleString("en-IN")} / student</strong></span>
              </div>
            </div>

            {/* Scholarship preview */}
            <div style={{
              background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
              padding: "14px 16px",
            }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>
                Scholarship preview
              </p>
              {feeHeads.map(h => {
                const applies = resolveScholarship(policy, h);
                return (
                  <div key={h.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 0", borderBottom: "1px solid #f1f5f9", gap: 8,
                  }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.name || `Fee head`}
                    </span>
                    <span style={{
                      fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 99, flexShrink: 0,
                      background: applies ? "#dcfce7" : "#f1f5f9",
                      color:      applies ? "#15803d" : "#94a3b8",
                    }}>
                      {applies ? "✓ Discount" : "— Full"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Save */}
            <div className={s("save-panel")}>
              <button className={cx(s("btn"), s("btn-primary"))} type="button"
                onClick={handleSave} disabled={saving}>
                {saving
                  ? <Spinner size={16} />
                  : <><i className="fa-solid fa-floppy-disk" /> Save Structure</>}
              </button>
              <Link className={cx(s("btn"), s("btn-outline"))} href="/fees/structures">
                Cancel
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ── Shared input style ─────────────────────────────────────────────────────────────────
const INP: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0",
  fontFamily: "inherit", fontSize: 13.5, color: "#1e293b",
  background: "#fff", width: "100%", outline: "none",
};

// ── Sub-components ─────────────────────────────────────────────────────────────────
function FormCard({ icon, title, step, children }: {
  icon: string; title: string; step: string; children: ReactNode;
}) {
  return (
    <article className={s("form-card")}>
      <div className={s("form-card-head")}>
        <h2><i className={`fa-solid ${icon}`} /> {title}</h2>
        <span>{step}</span>
      </div>
      <div className={s("form-card-body")} style={{ padding: 0 }}>
        {children}
      </div>
    </article>
  );
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: ReactNode;
}) {
  return (
    <label className={s("field")}>
      <span>{label}{required && <b style={{ color: "#ef4444" }}>*</b>}</span>
      {children}
    </label>
  );
}
