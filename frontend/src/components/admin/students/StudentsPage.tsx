"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import styles from "./students.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { SkeletonStatRow, SkeletonTable } from "@/components/shared/Skeleton";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDebounce } from "@/hooks/useDebounce";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const PAGE_SIZE = 15;

export default function StudentsPage() {
  const { data: students, loading, error } = useApi<any[]>("/students");
  const { activeYear, academicYearId }     = useAcademicYear();
  const { data: classes }                  = useApi<any[]>(
    academicYearId ? `/classes?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );

  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [classFilter,   setClassFilter]   = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [sections,      setSections]      = useState<any[]>([]);
  const [page,          setPage]          = useState(1);

  // Fetch sections when a specific class is selected
  useEffect(() => {
    if (!classFilter || classFilter === "all") {
      setSections([]);
      setSectionFilter("all");
      return;
    }
    apiRequest<any>(`/classes/${classFilter}/sections`)
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        setSections(list);
      })
      .catch(() => setSections([]));
  }, [classFilter]);

  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    return (students || []).filter(st => {
      const q = debouncedSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (st.full_name && st.full_name.toLowerCase().includes(q)) ||
        (st.admission_number && st.admission_number.toLowerCase().includes(q)) ||
        (st.guardian_name && st.guardian_name.toLowerCase().includes(q)) ||
        (st.phone && st.phone.toLowerCase().includes(q)) ||
        (st.class_name && st.class_name.toLowerCase().includes(q));

      const matchStatus = statusFilter === "all" || st.status === statusFilter;

      const matchClass =
        classFilter === "all" ||
        String(st.class_id) === String(classFilter) ||
        (st.class_name && classes?.find(c => String(c.id) === String(classFilter))?.name === st.class_name);

      const matchSection =
        sectionFilter === "all" ||
        String(st.section_id) === String(sectionFilter) ||
        (st.section_name && sections?.find(sec => String(sec.id) === String(sectionFilter))?.name === st.section_name);

      return matchSearch && matchStatus && matchClass && matchSection;
    });
  }, [students, debouncedSearch, statusFilter, classFilter, sectionFilter, classes, sections]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageSlice   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeCount = students?.filter(s => s.status === "active").length ?? 0;
  const newCount    = students?.filter(st => {
    if (!st.admission_date) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return new Date(st.admission_date) >= cutoff;
  }).length ?? 0;

  return (
    <div className={s("students-page")}>
      <main className={s("page-content")}>

        {/* Page head */}
        <section className={s("page-head")}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#ea580c", textTransform: "uppercase", letterSpacing: 0.8, display: "inline-block", marginBottom: 3 }}>
              Academic Year {activeYear?.year_name ? `· ${activeYear.year_name}` : ""} · Admissions
            </span>
            <h1>Students Directory</h1>
            <p>Search, filter, and manage student admissions, profiles, and fee records.</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-primary"))} href="/students/add">
              <i className="fa-solid fa-user-plus" /> Add Student
            </Link>
          </div>
        </section>

        {/* Stats */}
        {loading && !students ? (
          <SkeletonStatRow count={3} />
        ) : (
          <section className={s("stats-row")}>
            {[
              ["fa-users",        "Total Students",   students?.length ?? 0, "ink"],
              ["fa-circle-check", "Active Students",  activeCount,           "green"],
              ["fa-user-plus",    "New (30 days)",     newCount,              "orange"],
            ].map(([icon, label, value, tone]) => (
              <article className={s("stat-card")} key={String(label)}>
                <div className={cx(s("stat-icon"), s(String(tone)))}>
                  <i className={`fa-solid ${icon}`} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, gap: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
                  <strong style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>{value}</strong>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* Toolbar */}
        <section className={cx(s("card"), s("toolbar"))} style={{ gridTemplateColumns: "minmax(220px, 1fr) repeat(3, minmax(140px, 200px))" }}>
          <label className={s("search-field")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="search"
              placeholder="Search by name, admission no, class, guardian…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </label>
          <select
            className={s("filter-field")}
            value={classFilter}
            onChange={e => { setClassFilter(e.target.value); setSectionFilter("all"); setPage(1); }}
          >
            <option value="all">All Classes</option>
            {classes?.map(c => (
              <option key={c.id} value={c.id}>{c.name || `Class ${c.id}`}</option>
            ))}
          </select>
          <select
            className={s("filter-field")}
            value={sectionFilter}
            disabled={classFilter === "all"}
            onChange={e => { setSectionFilter(e.target.value); setPage(1); }}
            style={{ opacity: classFilter === "all" ? 0.6 : 1 }}
          >
            <option value="all">All Sections</option>
            {sections?.map(sec => (
              <option key={sec.id} value={sec.id}>{sec.name || `Section ${sec.id}`}</option>
            ))}
          </select>
          <select
            className={s("filter-field")}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
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
            {loading && !students ? (
              <SkeletonTable rows={7} columns={8} />
            ) : error ? (
              <div style={{ color: "#be123c", padding: "1rem" }}>{error}</div>
            ) : (
              <table className={s("table")}>
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: "center" }}>#</th>
                    <th>Student Name</th>
                    <th>Admission No.</th>
                    <th>Class & Section</th>
                    <th>Guardian</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "2.5rem", color: "#9aa7ae" }}>
                        <i className="fa-solid fa-user-slash" style={{ display: "block", fontSize: 28, marginBottom: 10, opacity: 0.3 }} />
                        No students found.
                      </td>
                    </tr>
                  ) : pageSlice.map((st, idx) => (
                    <tr key={st.id}>
                      <td style={{ textAlign: "center", fontWeight: 800, color: "#94a3b8", fontSize: 12 }}>
                        {(currentPage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td>
                        <div className={s("student-cell")}>
                          <div>
                            <strong style={{ fontSize: 13.5, fontWeight: 800, color: "#1e293b" }}>{st.full_name}</strong>
                            <span style={{ fontSize: 11.5, color: "#64748b", display: "block", marginTop: 2 }}>{st.email || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={s("admission-badge")}>{st.admission_number || "—"}</span>
                      </td>
                      <td>
                        {st.class_name ? (
                          <span className={s("class-badge")}>
                            <i className="fa-solid fa-graduation-cap" />
                            {st.class_name}{st.section_name ? ` - ${st.section_name}` : ""}
                          </span>
                        ) : (
                          <span className={cx(s("class-badge"), s("class-badge-unassigned"))}>
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td style={{ color: "#334155", fontWeight: 600 }}>{st.guardian_name || "—"}</td>
                      <td style={{ color: "#475569", fontSize: 12.5 }}>{st.guardian_phone || st.phone || "—"}</td>
                      <td>
                        <span
                          className={cx(s("badge"), st.status === "active" ? s("badge-green") : s("badge-yellow"))}
                          style={{ textTransform: "capitalize" }}
                        >
                          {st.status}
                        </span>
                      </td>
                      <td>
                        <div className={s("actions")} style={{ justifyContent: "flex-end" }}>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  className={s("pg-btn")}
                  disabled={currentPage === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p); return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…"
                      ? <span key={`e${i}`} style={{ width: 32, height: 32, display: "grid", placeItems: "center", fontSize: 12, color: "#94a3b8" }}>…</span>
                      : (
                        <button
                          key={p}
                          className={cx(s("pg-btn"), p === currentPage && s("pg-btn-active"))}
                          onClick={() => setPage(p as number)}
                        >
                          {p}
                        </button>
                      )
                  )}
                <button
                  className={s("pg-btn")}
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
