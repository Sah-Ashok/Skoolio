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
import { showToast } from "@/store/toastSlice";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const formatINR = (amount: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount));

export default function FeeStructuresPage() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const { data: activeYear } = useApi<any>('/academic-years/active');
  const { data: classes } = useApi<any[]>(activeYear?.id ? `/classes?academic_year_id=${activeYear.id}` : '', [activeYear?.id]);
  const { execute: deleteStructure } = useMutation('/fees/structures', 'DELETE');

  const [searchTerm, setSearchTerm] = useState("");
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadTick, setLoadTick] = useState(0);

  const loadAllStructures = async () => {
    if (!classes || !activeYear?.id) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        classes.map((c) =>
          apiRequest<{ data: any[] }>(`/fees/structures?class_id=${c.id}&academic_year_id=${activeYear.id}`)
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

  // When navigating back from AddFeeStructurePage with ?saved=1, force a reload
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

  const summaryCards = [
    ["fa-list-check", "Total Structures", structures.length || 0, "blue"],
    ["fa-calendar-days", "Monthly Plans", structures.filter(st => st.frequency === 'monthly').length || 0, "orange"],
    ["fa-calendar-check", "Yearly Plans", structures.filter(st => st.frequency === 'yearly').length || 0, "green"],
    ["fa-circle-dot", "One-Time Plans", structures.filter(st => st.frequency === 'one_time').length || 0, "rose"],
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
                      <th>Academic Year</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row: any) => (
                      <tr key={row.id}>
                        <td><strong>{row.feeName}</strong></td>
                        <td><span className={cx(s("freq-badge"), s(frequencyClass(row.frequency)))} style={{textTransform: 'capitalize'}}>{row.frequency}</span></td>
                        <td className={s("amount-cell")}>{formatINR(row.amount)}</td>
                        <td>{formatINR(row.annualTotal)}</td>
                        <td>{row.year}</td>
                        <td>
                          <div className={s("actions")}>
                            <button className={cx(s("btn"), s("btn-danger"), s("btn-sm"))} type="button" onClick={() => handleDelete(row.id)}>
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
    </div>
  );
}

function frequencyClass(frequency: string) {
  if (frequency === "yearly")   return "freq-yearly";
  if (frequency === "one_time") return "freq-onetime";
  if (frequency === "quarterly") return "freq-semester";
  return "freq-monthly";
}
