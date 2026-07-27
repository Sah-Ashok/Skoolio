"use client";

import { useState } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./students.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

function getInitials(name: string) {
  if (!name) return "";
  return name.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

export default function StudentsPage() {
  const { data: students, loading, error } = useApi<any[]>("/students");
  const { data: activeYear }               = useApi<any>("/academic-years/active");
  const { data: classes }                  = useApi<any[]>(
    activeYear?.id ? `/classes?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classFilter,  setClassFilter]  = useState("all");

  // Filter locally — class filtering is approximate (matches class_name in future enrollment join)
  // For now filter by what the /students endpoint returns
  const filtered = students?.filter(st => {
    const q = search.toLowerCase();
    const matchSearch =
      st.full_name?.toLowerCase().includes(q) ||
      st.admission_number?.toLowerCase().includes(q) ||
      st.guardian_name?.toLowerCase().includes(q) ||
      st.phone?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || st.status === statusFilter;
    return matchSearch && matchStatus;
  }) ?? [];

  const activeCount = students?.filter(s => s.status === "active").length ?? 0;
  const newCount    = students?.filter(st => {
    if (!st.admission_date) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return new Date(st.admission_date) >= cutoff;
  }).length ?? 0;

  return (
    <div className={s("students-page")}>
      <Topbar title="Students" subtitle="Manage admissions, profiles and fee status" />

      <main className={s("page-content")}>

        {/* Page head */}
        <section className={s("page-head")}>
          <div>
            <h1>Student List</h1>
            <p>Search, filter and manage all student records.</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-primary"))} href="/students/add">
              <i className="fa-solid fa-user-plus" /> Add Student
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className={s("stats-row")}>
          {[
            ["fa-users",       "Total Students",  students?.length ?? 0, "ink"],
            ["fa-circle-check","Active Students",  activeCount,           "green"],
            ["fa-user-plus",   "New (30 days)",    newCount,              "orange"],
          ].map(([icon, label, value, tone]) => (
            <article className={s("stat-card")} key={String(label)}>
              <div className={cx(s("stat-icon"), s(String(tone)))}>
                <i className={`fa-solid ${icon}`} />
              </div>
              <div>
                <p>{label}</p>
                <strong>{value}</strong>
              </div>
            </article>
          ))}
        </section>

        {/* Toolbar */}
        <section className={cx(s("card"), s("toolbar"))}>
          <label className={s("search-field")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="search"
              placeholder="Search by name, admission no, or guardian…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <select
            className={s("filter-field")}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
            <option value="transferred">Transferred</option>
            <option value="expelled">Expelled</option>
          </select>
        </section>

        {/* Table */}
        <section className={s("card")}>
          <div className={s("card-header")}>
            <div>
              <h3>All Students</h3>
              <p>Showing {filtered.length} of {students?.length ?? 0} records</p>
            </div>
          </div>

          <div className={s("table-wrap")}>
            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center" }}>
                <Spinner size={32} color="#FF9B51" />
              </div>
            ) : error ? (
              <div style={{ color: "#be123c", padding: "1rem" }}>{error}</div>
            ) : (
              <table className={s("table")}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Admission No.</th>
                    <th>Guardian</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "#9aa7ae" }}>
                        <i className="fa-solid fa-user-slash" style={{ display: "block", fontSize: 28, marginBottom: 10, opacity: 0.3 }} />
                        No students found.
                      </td>
                    </tr>
                  ) : filtered.map(st => (
                    <tr key={st.id}>
                      <td>
                        <div className={s("student-cell")}>
                          {st.photo
                            ? <img src={st.photo} alt="" className={s("avatar")} style={{ objectFit: "cover" }} />
                            : <span className={s("avatar")}>{getInitials(st.full_name)}</span>
                          }
                          <div>
                            <strong>{st.full_name}</strong>
                            <span>{st.email || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td>{st.admission_number || "—"}</td>
                      <td>{st.guardian_name || "—"}</td>
                      <td>{st.guardian_phone || st.phone || "—"}</td>
                      <td>
                        <span
                          className={cx(s("badge"), st.status === "active" ? s("badge-green") : s("badge-yellow"))}
                          style={{ textTransform: "capitalize" }}
                        >
                          {st.status}
                        </span>
                      </td>
                      <td>
                        <div className={s("actions")}>
                          <Link
                            className={cx(s("btn"), s("btn-outline"), s("btn-sm"))}
                            href={`/students/profile?id=${st.id}`}
                          >
                            View
                          </Link>
                          <Link
                            className={cx(s("btn"), s("btn-soft"), s("btn-sm"))}
                            href={`/students/${st.id}/edit`}
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
