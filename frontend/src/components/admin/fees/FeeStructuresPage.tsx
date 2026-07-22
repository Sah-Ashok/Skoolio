"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./fees.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const formatINR = (amount: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount));

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
        badgeTone: "class-tone-blue",
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
      annualTotal: curr.frequency === 'monthly' ? curr.amount * 12 : curr.frequency === 'quarterly' ? curr.amount * 4 : curr.amount,
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
    ["fa-list-check",  "Total Structures", structures.length || 0,                                          "blue"  ],
    ["fa-calendar-days","Monthly Plans",   structures.filter(st => st.frequency === 'monthly').length || 0, "orange"],
    ["fa-calendar-check","Yearly Plans",   structures.filter(st => st.frequency === 'yearly').length || 0,  "green" ],
    ["fa-circle-dot",  "One-Time Plans",   structures.filter(st => st.frequency === 'one_time').length || 0,"rose"  ],
  ];

  return (
    <div className={s("fees-page")}>
      <Topbar title="Fee Structures" subtitle="Manage fee templates assigned to each class" />
      <main className={s("page-content")}>
        <section className={s("page-head")}>
          <div>
            <h1>Fee Structures</h1>
            <p>All fee templates by class</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/fees">
              <i className="fa-solid fa-arrow-left" /> Overview
            </Link>
            <Link className={cx(s("btn"), s("btn-primary"))} href="/fees/structures/add">
              <i className="fa-solid fa-plus" /> Add Structure
            </Link>
          </div>
        </section>

        <section className={s("summary-cards")}>
          {summaryCards.map(([icon, label, value, tone]) => (
            <article className={s("structure-stat-card")} key={label as string}>
              <div className={cx(s("structure-stat-icon"), s(tone as string))}>
                <i className={`fa-solid ${icon as string}`} />
              </div>
              <div>
                <p>{label}</p>
                <strong>{value}</strong>
              </div>
            </article>
          ))}
        </section>

        <section className={cx(s("card"), s("structure-toolbar"))}>
          <label className={s("search-field")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="search"
              placeholder="Search fee name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>
        </section>

        {loading && <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>}

        {!loading && classGroups.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            No fee structures found.
          </div>
        )}

        {classGroups.map((group: any) => (
          <section className={s("class-group")} key={group.title}>
            <div className={s("class-group-header")}>
              <h3>
                <span className={cx(s("class-badge"), s(group.badgeTone))}>{group.badge}</span>
                {group.title}
              </h3>
              <div className={s("class-group-actions")}>
                <span className={s("total-chip")}>{group.rows.length} structures</span>
                <Link className={cx(s("btn"), s("btn-soft"), s("btn-sm"))} href="/fees/structures/add">
                  <i className="fa-solid fa-plus" /> Add
                </Link>
              </div>
            </div>

            <div className={s("card")}>
              <div className={s("table-wrap")}>
                <table className={s("structure-table")}>
                  <thead>
                    <tr>
                      <th>Fee Name</th>
                      <th>Frequency</th>
                      <th>Amount</th>
                      <th>Annual Total</th>
                      <th>Scholarship</th>
                      <th>Academic Year</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row: any) => (
                      <tr key={row.id}>
                        <td><strong>{row.feeName}</strong></td>
                        <td>
                          <span className={cx(s("freq-badge"), s(frequencyClass(row.frequency)))} style={{ textTransform: 'capitalize' }}>
                            {row.frequency.replace('_', ' ')}
                          </span>
                        </td>
                        <td className={s("amount-cell")}>{formatINR(row.amount)}</td>
                        <td>{formatINR(row.annualTotal)}</td>
                        <td>
                          <span className={cx(s("badge"), row.scholarship_applies ? s("badge-green") : s("badge-gray"))} style={{ fontSize: 11 }}>
                            {row.scholarship_applies ? "Applies" : "Excluded"}
                          </span>
                        </td>
                        <td>{row.year}</td>
                        <td>
                          <div className={s("actions")}>
                            <button
                              className={cx(s("btn"), s("btn-soft"), s("btn-sm"))}
                              type="button"
                              title="Edit"
                              onClick={() => handleEditOpen(row)}
                            >
                              <i className="fa-solid fa-pen" /> Edit
                            </button>
                            <button
                              className={cx(s("btn"), s("btn-danger"), s("btn-sm"))}
                              type="button"
                              title="Delete"
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
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditState(null); }}
        >
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "2rem",
            width: "100%", maxWidth: "480px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                <i className="fa-solid fa-pen" style={{ marginRight: 8, color: "#FF9B51" }} />
                Edit Fee Structure
              </h2>
              <button
                onClick={() => setEditState(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#64748b" }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.875rem", fontWeight: 600 }}>
                Fee Name
                <input
                  value={editState.fee_name}
                  onChange={(e) => setEditState({ ...editState, fee_name: e.target.value })}
                  style={{ padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.875rem", fontWeight: 600 }}>
                Frequency
                <select
                  value={editState.frequency}
                  onChange={(e) => setEditState({ ...editState, frequency: e.target.value })}
                  style={{ padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half Yearly</option>
                  <option value="yearly">Yearly</option>
                  <option value="one_time">One Time</option>
                </select>
              </label>

              {editState.frequency === "monthly" && (
                <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.875rem", fontWeight: 600 }}>
                  Billing Start Rule
                  <select
                    value={editState.billing_start_rule}
                    onChange={(e) => setEditState({ ...editState, billing_start_rule: e.target.value })}
                    style={{ padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
                  >
                    <option value="next_month">Next Month (Default)</option>
                    <option value="skip_two_months">Skip 2 Months</option>
                    <option value="academic_year">From Academic Year</option>
                  </select>
                </label>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.875rem", fontWeight: 600 }}>
                Amount (₹)
                <input
                  type="number"
                  min={1}
                  value={editState.amount}
                  onChange={(e) => setEditState({ ...editState, amount: e.target.value })}
                  style={{ padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
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
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#1e293b" }}>
                    Apply scholarship discount to this fee
                  </p>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
                    {editState.scholarship_applies
                      ? "Scholarship % will be deducted from this fee when generating bills"
                      : "This fee will be charged in full regardless of any scholarship"}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.75rem" }}>
              <button
                onClick={handleEditSave}
                disabled={saving}
                style={{
                  flex: 1, padding: "0.7rem", borderRadius: "8px",
                  background: "#FF9B51", color: "#fff", border: "none",
                  fontWeight: 700, fontSize: "0.95rem", cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                }}
              >
                {saving ? <Spinner size={16} /> : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
              </button>
              <button
                onClick={() => setEditState(null)}
                style={{
                  padding: "0.7rem 1.2rem", borderRadius: "8px",
                  background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0",
                  fontWeight: 600, fontSize: "0.95rem", cursor: "pointer",
                }}
              >
                Cancel
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
