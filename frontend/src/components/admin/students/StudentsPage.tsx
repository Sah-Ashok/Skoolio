"use client";

import { useState } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./students.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const feeBadge = (status: string) => {
  if (status === "Paid") return "badge-green";
  if (status === "Pending") return "badge-red";
  if (status === "Advance") return "badge-blue";
  return "badge-yellow";
};

const statusBadge = (status: string) => (status === "active" ? "badge-green" : "badge-yellow");

function getInitials(name: string) {
  if (!name) return "";
  const parts = name.split(" ");
  return parts.map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

export default function StudentsPage() {
  const { data: students, loading, error } = useApi<any[]>('/students');
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const filteredStudents = students?.filter(st => {
    const matchesSearch = st.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          st.admission_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          st.guardian_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "All Status" || 
                          st.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const activeCount = students?.filter(st => st.status === 'active').length || 0;
  const newAdmissions = students?.filter(st => {
    // Arbitrary metric for 'new' - let's say joined within last 30 days
    if (!st.admission_date) return false;
    const admissionDate = new Date(st.admission_date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return admissionDate >= thirtyDaysAgo;
  }).length || 0;

  const stats = [
    ["fa-users", "Total Students", students?.length || 0, "ink"],
    ["fa-circle-check", "Active Students", activeCount, "green"],
    ["fa-user-plus", "New Admissions", newAdmissions, "orange"],
    ["fa-clock", "Pending Fees", "?", "rose"], // Requires fee API to fully calculate
  ];

  return (
    <div className={s("students-page")}>
      <Topbar title="Students" subtitle="Manage admissions, profiles, classes, and fee status" />

      <main className={s("page-content")}>
        <section className={s("page-head")}>
          <div>
            <h1>Student List</h1>
            <p>Quickly search, filter, view, and add student records.</p>
          </div>
          <div className={s("head-actions")}>
            <button className={cx(s("btn"), s("btn-outline"))}>
              <i className="fa-solid fa-file-export" /> Export
            </button>
            <Link className={cx(s("btn"), s("btn-primary"))} href="/students/add">
              <i className="fa-solid fa-user-plus" /> Add Student
            </Link>
          </div>
        </section>

        <section className={s("stats-row")}>
          {stats.map(([icon, label, value, tone]) => (
            <article className={s("stat-card")} key={label}>
              <div className={cx(s("stat-icon"), s(tone as string))}>
                <i className={`fa-solid ${icon as string}`} />
              </div>
              <div>
                <p>{label}</p>
                <strong>{value}</strong>
              </div>
            </article>
          ))}
        </section>

        <section className={cx(s("card"), s("toolbar"))} aria-label="Student filters">
          <label className={s("search-field")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input 
              type="search" 
              placeholder="Search by name, roll no, or parent" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>
          <select className={s("filter-field")} aria-label="Filter by class">
            <option>All Classes</option>
          </select>
          <select className={s("filter-field")} aria-label="Filter by section">
            <option>All Sections</option>
          </select>
          <select 
            className={s("filter-field")} 
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
            <option>Graduated</option>
          </select>
        </section>

        <section className={s("card")}>
          <div className={s("card-header")}>
            <div>
              <h3>All Students</h3>
              <p>Showing {filteredStudents?.length || 0} of {students?.length || 0} student records</p>
            </div>
            <button className={cx(s("btn"), s("btn-soft"), s("btn-sm"))}>
              <i className="fa-solid fa-sliders" /> Columns
            </button>
          </div>
          <div className={s("table-wrap")}>
            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
            ) : error ? (
              <div style={{ color: "red", padding: "1rem" }}>{error}</div>
            ) : (
              <table className={s("table")}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Admission No</th>
                    <th>Parent</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents?.map((st) => (
                    <tr key={st.id}>
                      <td>
                        <div className={s("student-cell")}>
                          <span className={cx(s("avatar"))}>{getInitials(st.full_name)}</span>
                          <div>
                            <strong>{st.full_name}</strong>
                            <span>{st.email || '-'}</span>
                          </div>
                        </div>
                      </td>
                      <td>{st.admission_number || '-'}</td>
                      <td>
                        <div style={{display: 'flex', flexDirection: 'column'}}>
                          <span>{st.guardian_name || '-'}</span>
                          <span style={{fontSize: '12px', color: '#64748b'}}>{st.guardian_phone}</span>
                        </div>
                      </td>
                      <td>
                        <span className={cx(s("badge"), s(statusBadge(st.status)))} style={{textTransform: 'capitalize'}}>{st.status}</span>
                      </td>
                      <td>
                        <div className={s("actions")}>
                          <Link className={cx(s("btn"), s("btn-outline"), s("btn-sm"))} href={`/students/profile?id=${st.id}`}>
                            View
                          </Link>
                          <button className={cx(s("btn"), s("btn-soft"), s("btn-sm"))}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents?.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>No students found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
