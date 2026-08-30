"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./fees.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";

import { useCurrency } from "@/lib/useCurrency";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

// ── Types ──
type EditState = {
  id: number;
  fee_name: string;
  amount: string;
  frequency: string;
  billing_start_rule: string;
  scholarship_applies: boolean;
};

type FeeStructureRow = {
  id: number;
  feeName: string;
  amount: number | string;
  frequency: string;
  billing_start_rule: string;
  scholarship_applies: boolean;
};

export default function FeeStructuresPage() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const { fmt: formatCurrency } = useCurrency();
  const { activeYear, academicYearId } = useAcademicYear();
  const { data: classes } = useApi<any[]>(academicYearId ? `/classes?academic_year_id=${academicYearId}` : '', [academicYearId]);
  const { execute: deleteStructure } = useMutation('/fees/structures', 'DELETE');

  const [searchTerm, setSearchTerm] = useState("");
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadTick, setLoadTick] = useState(0);

  // ── Edit modal state ──
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAllStructures = async () => {
    if (!classes || !academicYearId) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        classes.map((c) =>
          apiRequest<{ data: any[] }>(`/fees/structures?class_id=${c.id}&academic_year_id=${academicYearId}`)
            .then((res) => (res.data || []).map((st: any) => ({ ...st, class_name: c.name })))
            .catch(() => [])
        )
      );
      setStructures(results.flat());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllStructures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, activeYear?.id, loadTick]);

  useEffect(() => {
    if (searchParams.get('saved') === '1') {
      setLoadTick((t) => t + 1);
    }
  }, [searchParams]);

  const filteredStructures = structures.filter((st) =>
    st.fee_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedByClass = filteredStructures.reduce((acc: any, curr: any) => {
    const className = curr.class_name || `Class ${curr.class_id}`;
    if (!acc[className]) {
      acc[className] = {
        title: className,
        badge: className.replace('Class ', '').substring(0, 2),
        classId: curr.class_id,
        rows: []
      };
    }
    acc[className].rows.push({
      id: curr.id,
      feeName: curr.fee_name,
      frequency: curr.frequency,
      amount: curr.amount,
      billing_start_rule: curr.billing_start_rule || 'next_month',
      scholarship_applies: curr.scholarship_applies !== false,
      annualTotal: curr.frequency === 'monthly' ? curr.amount * 12
        : curr.frequency === 'quarterly'  ? curr.amount * 4
        : curr.frequency === 'half_yearly' ? curr.amount * 2
        : curr.amount,  // yearly / one_time
      year: activeYear?.year_name || curr.academic_year_id
    });
    return acc;
  }, {});

  const classGroups = Object.values(groupedByClass);

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this fee structure?")) {
      try {
        await deleteStructure(undefined, `/fees/structures/${id}`);
        dispatch(showToast({ type: "success", title: "Deleted", message: "Fee structure deleted" }));
        loadAllStructures();
      } catch (err: any) {
        dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to delete" }));
      }
    }
  };

  // ── Open edit modal ──
  const handleEditOpen = (row: FeeStructureRow) => {
    setEditState({
      id: row.id,
      fee_name: row.feeName,
      amount: String(row.amount),
      frequency: row.frequency,
      billing_start_rule: row.billing_start_rule,
      scholarship_applies: row.scholarship_applies,
    });
  };

  // ── Save edited structure ──
  const handleEditSave = async () => {
    if (!editState) return;
    if (!editState.fee_name.trim() || !editState.amount || Number(editState.amount) <= 0) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Please fill in all fields correctly." }));
      return;
    }
    setSaving(true);
    try {
      await apiRequest(`/fees/structures/${editState.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fee_name: editState.fee_name,
          amount: parseFloat(editState.amount),
          frequency: editState.frequency,
          billing_start_rule: editState.billing_start_rule,
          scholarship_applies: editState.scholarship_applies,
        }),
      });
      dispatch(showToast({ type: "success", title: "Updated", message: "Fee structure updated successfully" }));
      setEditState(null);
      loadAllStructures();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update";
      dispatch(showToast({ type: "error", title: "Error", message }));
    } finally {
      setSaving(false);
    }
  };

  const summaryCards = [
    ["fa-list-check",   "Total Structures", structures.length || 0,                                          "blue",   "Active plans"   ],
    ["fa-calendar-days", "Monthly Plans",   structures.filter(st => st.frequency === 'monthly').length || 0, "orange", "Billed monthly" ],
    ["fa-calendar-check","Yearly Plans",   structures.filter(st => st.frequency === 'yearly').length || 0,  "green",  "Billed annually"],
    ["fa-circle-dot",   "One-Time Plans",   structures.filter(st => st.frequency === 'one_time').length || 0,"purple", "Single payment" ],
  ];

  return (
    <div className={s("feesPage")}>
      <main className={s("pageContent")}>

        {/* ── Page Head ── */}
        <section className={s("pageHead")}>
          <div className={s("headLeft")}>
            <div className={s("headIcon")}>
              <i className="fa-solid fa-layer-group" />
            </div>
            <div>
              <h1>Fee Structures</h1>
              <p>Manage standard fee templates and recurring billing rules assigned to each class.</p>
            </div>
          </div>
          <div className={s("headActions")}>
            <Link className={cx(s("btn"), s("btnOutline"))} href="/fees">
              <i className="fa-solid fa-arrow-left" /> Fee Overview
            </Link>
            <Link className={cx(s("btn"), s("btnPrimary"))} href="/fees/structures/add">
              <i className="fa-solid fa-plus" /> Add Fee Structure
            </Link>
          </div>
        </section>

        {/* ── 4 Compact Stat Cards (~75px) ── */}
        <section className={s("heroCards")}>
          {summaryCards.map(([icon, label, value, tone, sub]) => (
            <article className={cx(s("heroCard"), s(tone as string))} key={label as string}>
              <div className={s("hcInfo")}>
                <span className={s("hcLabel")}>{label}</span>
                <strong className={s("hcValue")}>{value}</strong>
                <span className={s("hcSub")}>{sub}</span>
              </div>
              <div className={s("hcIcon")}>
                <i className={`fa-solid ${icon as string}`} />
              </div>
            </article>
          ))}
        </section>

        {/* ── Search Toolbar ── */}
        <section className={s("structureToolbar")}>
          <div className={s("searchField")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="search"
              placeholder="Search fee structures by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </section>

        {loading && (
          <div style={{ padding: "4rem", textAlign: "center" }}>
            <Spinner size={32} color="#FF9B51" />
            <p style={{ marginTop: 10, color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Loading fee structures…</p>
          </div>
        )}

        {!loading && classGroups.length === 0 && (
          <div className={s("card")} style={{ padding: "4rem 2rem", textAlign: "center" }}>
            <div className={s("emptyIcon")}>
              <i className="fa-solid fa-layer-group" />
            </div>
            <h3 style={{ margin: "8px 0 4px", fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
              No Fee Structures Found
            </h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
              {searchTerm ? `No plans match "${searchTerm}"` : "Get started by adding fee structures for your classes."}
            </p>
            <div style={{ marginTop: 16 }}>
              <Link className={cx(s("btn"), s("btnPrimary"))} href="/fees/structures/add">
                <i className="fa-solid fa-plus" /> Create First Fee Structure
              </Link>
            </div>
          </div>
        )}

        {!loading && classGroups.map((group: any) => (
          <section className={s("classGroup")} key={group.title}>
            <div className={s("classGroupHeader")}>
              <h3>
                <span className={s("classBadge")}>{group.badge}</span>
                {group.title}
              </h3>
              <div className={s("classGroupActions")}>
                <span className={s("totalChip")}>{group.rows.length} structures</span>
                <Link className={cx(s("btn"), s("btnSoft"), s("btnSm"))} href={`/fees/structures/add?class_id=${group.classId || ''}`}>
                  <i className="fa-solid fa-plus" /> Add Fee for {group.title}
                </Link>
              </div>
            </div>

            <div className={s("card")}>
              <div className={s("tableWrap")}>
                <table className={s("table")}>
                  <thead>
                    <tr>
                      <th>Fee Name</th>
                      <th>Frequency</th>
                      <th>Amount</th>
                      <th>Annual Total</th>
                      <th>Scholarship</th>
                      <th>Academic Year</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row: any) => (
                      <tr key={row.id}>
                        <td>
                          <span className={s("feeTitle")}>{row.feeName}</span>
                        </td>
                        <td>
                          <span className={cx(s("freq-badge"), s(frequencyClass(row.frequency)))} style={{ textTransform: 'capitalize' }}>
                            {row.frequency.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span className={s("amountCell")}>{formatCurrency(row.amount)}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>{formatCurrency(row.annualTotal)}</span>
                        </td>
                        <td>
                          <span className={cx(s("badge"), row.scholarship_applies ? s("badgeGreen") : s("badgeGray"))}>
                            {row.scholarship_applies ? "Applies" : "Excluded"}
                          </span>
                        </td>
                        <td>
                          <span className={s("dateCell")}>{row.year}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className={s("actions")} style={{ justifyContent: "flex-end" }}>
                            <button
                              className={cx(s("btn"), s("btnSoft"), s("btnSm"))}
                              type="button"
                              title="Edit Structure"
                              onClick={() => handleEditOpen(row)}
                            >
                              <i className="fa-solid fa-pen" /> Edit
                            </button>
                            <button
                              className={cx(s("btn"), s("btnDanger"), s("btnSm"))}
                              type="button"
                              title="Delete Structure"
                              onClick={() => handleDelete(row.id)}
                            >
                              <i className="fa-solid fa-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))}
      </main>

      {/* ── Edit Modal ── */}
      {editState && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditState(null); }}
        >
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "24px",
            width: "100%", maxWidth: "480px", boxShadow: "0 16px 40px rgba(15, 23, 42, 0.16)",
            border: "1px solid #e2e8f0",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fa-solid fa-pen" style={{ color: "#FF9B51" }} />
                Edit Fee Structure
              </h2>
              <button
                onClick={() => setEditState(null)}
                style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "#64748b" }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                Fee Name *
                <input
                  value={editState.fee_name}
                  onChange={(e) => setEditState({ ...editState, fee_name: e.target.value })}
                  style={{ height: 40, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13.5, fontWeight: 600 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                Frequency *
                <select
                  value={editState.frequency}
                  onChange={(e) => setEditState({ ...editState, frequency: e.target.value })}
                  style={{ height: 40, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13.5, fontWeight: 600, background: "#fff" }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half Yearly</option>
                  <option value="yearly">Yearly</option>
                  <option value="one_time">One Time</option>
                </select>
              </label>

              {(editState.frequency === "monthly" || editState.frequency === "quarterly" || editState.frequency === "half_yearly") && (
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                  Billing Start Rule
                  <select
                    value={editState.billing_start_rule}
                    onChange={(e) => setEditState({ ...editState, billing_start_rule: e.target.value })}
                    style={{ height: 40, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13.5, fontWeight: 600, background: "#fff" }}
                  >
                    <option value="next_month">Next Cycle (Default)</option>
                    <option value="skip_two_months">Skip 2 Months</option>
                    <option value="academic_year">From Academic Year Start</option>
                  </select>
                </label>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                Amount (₹) *
                <input
                  type="number"
                  min={1}
                  value={editState.amount}
                  onChange={(e) => setEditState({ ...editState, amount: e.target.value })}
                  style={{ height: 40, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13.5, fontWeight: 600 }}
                />
              </label>

              {/* ── Scholarship toggle ── */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 10,
                background: editState.scholarship_applies ? "#f0fdf4" : "#f8fafc",
                border: `1px solid ${editState.scholarship_applies ? "#bbf7d0" : "#e2e8f0"}`,
                cursor: "pointer",
              }}
                onClick={() => setEditState({ ...editState, scholarship_applies: !editState.scholarship_applies })}
              >
                <input
                  type="checkbox"
                  checked={editState.scholarship_applies}
                  onChange={(e) => setEditState({ ...editState, scholarship_applies: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#16a34a" }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                    Apply scholarship discount to this fee
                  </p>
                  <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b", marginTop: 2 }}>
                    {editState.scholarship_applies
                      ? "Scholarship % will be deducted when generating bills"
                      : "Charged in full regardless of any scholarship"}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                className={cx(s("btn"), s("btnOutline"))}
                onClick={() => setEditState(null)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className={cx(s("btn"), s("btnPrimary"))}
                onClick={handleEditSave}
                disabled={saving}
                style={{ flex: 1 }}
              >
                {saving ? <Spinner size={16} color="#fff" /> : <><i className="fa-solid fa-check" /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function frequencyClass(frequency: string) {
  if (frequency === "yearly")     return "freq-yearly";
  if (frequency === "one_time")   return "freq-onetime";
  if (frequency === "quarterly")  return "freq-semester";
  return "freq-monthly";
}
