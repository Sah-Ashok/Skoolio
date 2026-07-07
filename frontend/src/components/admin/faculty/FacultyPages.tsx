"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./faculty.module.css";
import AddFacultyForm from "./AddFacultyForm";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").substring(0, 2).toUpperCase();
}

function FacultyShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={s("faculty-page")}>
      <Topbar title={title} subtitle={subtitle} />
      <main className={s("page-content")}>
        <div className={s("page-head")}>
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {actions && <div className={s("actions")}>{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}

// ── FACULTY LIST PAGE ──────────────────────────────────────────────────────────
export function FacultyPage() {
  const { data: faculty, loading, error, refetch } = useApi<any[]>("/teachers");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");

  const filtered = (faculty || []).filter((f) => {
    const matchSearch =
      f.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.email && f.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.phone && f.phone.includes(searchTerm));
    const matchStatus = statusFilter === "all" || f.status === statusFilter;
    const matchGender = genderFilter === "all" || f.gender === genderFilter;
    return matchSearch && matchStatus && matchGender;
  });

  const total    = faculty?.length || 0;
  const active   = faculty?.filter((f) => f.status === "active").length || 0;
  const inactive = faculty?.filter((f) => f.status === "inactive").length || 0;
  const avgExp   = faculty?.length
    ? Math.round(faculty.reduce((acc, f) => acc + (Number(f.experience_years) || 0), 0) / faculty.length)
    : 0;

  return (
    <FacultyShell
      title="Teachers & Faculty"
      subtitle="Manage all teaching staff, roles, and subjects"
      actions={
        <Link className={cx(s("btn"), s("btn-primary"))} href="/teachers/add">
          <i className="fa-solid fa-plus" /> Add Teacher
        </Link>
      }
    >
      {/* ── Stats ── */}
      <section className={s("stats-row")}>
        <article>
          <i className="fa-solid fa-chalkboard-user" />
          <span>Total Faculty</span>
          <strong>{total}</strong>
        </article>
        <article>
          <i className="fa-solid fa-circle-check" style={{ color: "#15803d" }} />
          <span>Active</span>
          <strong>{active}</strong>
        </article>
        <article>
          <i className="fa-solid fa-circle-pause" style={{ color: "#b45309" }} />
          <span>Inactive</span>
          <strong>{inactive}</strong>
        </article>
        <article>
          <i className="fa-solid fa-briefcase" style={{ color: "#1d4ed8" }} />
          <span>Avg Experience</span>
          <strong>{avgExp} yrs</strong>
        </article>
      </section>

      {/* ── Toolbar ── */}
      <div className={s("toolbar")}>
        <div className={s("search")}>
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
          <option value="all">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <button
          className={cx(s("btn"), s("btn-outline"))}
          onClick={refetch}
          title="Refresh"
        >
          <i className="fa-solid fa-rotate-right" /> Refresh
        </button>
      </div>

      {/* ── Table ── */}
      <section className={s("card")}>
        <div className={s("card-head")}>
          <h2>
            <i className="fa-solid fa-users" style={{ color: "#ff9b51", marginRight: 8 }} />
            Faculty List
          </h2>
          <span style={{ fontSize: 12, color: "#6b7b86", fontWeight: 700 }}>
            {filtered.length} of {total} teacher{total !== 1 ? "s" : ""}
          </span>
        </div>

        <div className={s("table-wrap")}>
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <Spinner size={32} color="#FF9B51" />
            </div>
          ) : error ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#f43f5e" }}>
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 8 }} />
              {error}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Contact</th>
                  <th>Qualification</th>
                  <th>Experience</th>
                  <th>Join Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ textAlign: "center", padding: "3rem", color: "#6b7b86" }}
                    >
                      <i className="fa-solid fa-inbox" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                      No teachers found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((person) => (
                    <tr key={person.id}>
                      <td>
                        <div className={s("faculty-cell")}>
                          <span>{getInitials(person.full_name)}</span>
                          <div>
                            <strong>{person.full_name}</strong>
                            <small style={{ textTransform: "capitalize" }}>{person.gender || "—"}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "grid", gap: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{person.phone || "—"}</span>
                          <span style={{ fontSize: 11, color: "#6b7b86", fontWeight: 600 }}>{person.email || "—"}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 13 }}>{person.qualification || "—"}</td>
                      <td style={{ fontWeight: 700, fontSize: 13 }}>
                        {person.experience_years ? `${person.experience_years} yrs` : "—"}
                      </td>
                      <td style={{ color: "#6b7b86", fontSize: 13 }}>
                        {person.join_date
                          ? new Date(person.join_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td>
                        <span
                          className={cx(
                            s("badge"),
                            s(person.status === "active" ? "green" : "yellow")
                          )}
                          style={{ textTransform: "capitalize" }}
                        >
                          {person.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          className={cx(s("btn"), s("btn-sm"), s("btn-soft"))}
                          href={`/teachers/${person.id}`}
                        >
                          <i className="fa-solid fa-eye" /> View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </FacultyShell>
  );
}

// ── VIEW FACULTY PROFILE PAGE ──────────────────────────────────────────────────
export function ViewFacultyPage() {
  const params  = useParams();
  const id      = params?.facultyId;

  const { data: faculty,       loading }       = useApi<any>(`/teachers/${id}`);
  const { data: salaryHistory, loading: salaryLoading } = useApi<any[]>(`/teachers/${id}/salary`);

  if (loading) {
    return (
      <FacultyShell title="Loading…" subtitle="">
        <div style={{ padding: "4rem", textAlign: "center" }}>
          <Spinner size={36} color="#FF9B51" />
        </div>
      </FacultyShell>
    );
  }

  if (!faculty) {
    return (
      <FacultyShell title="Not Found" subtitle="Teacher record could not be loaded">
        <div style={{ padding: "2rem", color: "#f43f5e" }}>Teacher not found.</div>
      </FacultyShell>
    );
  }

  return (
    <FacultyShell
      title="Teacher Profile"
      subtitle={`Viewing details for ${faculty.full_name}`}
      actions={
        <Link className={cx(s("btn"), s("btn-primary"))} href={`/teachers/${id}/edit`}>
          <i className="fa-solid fa-pen" /> Edit Profile
        </Link>
      }
    >
      {/* ── Hero banner ── */}
      <div className={s("profile-hero")}>
        <div className={s("profile-avatar")}>{getInitials(faculty.full_name)}</div>
        <div className={s("profile-title")}>
          <span>FACULTY ID #{faculty.id}</span>
          <h2>{faculty.full_name}</h2>
          <p>{faculty.qualification || "Teacher"} &nbsp;·&nbsp; {faculty.email}</p>
          <div className={s("chip-row")}>
            <b className={cx(s("badge"), s(faculty.status === "active" ? "chip-green" : "yellow"))}
               style={{ textTransform: "capitalize" }}>
              {faculty.status}
            </b>
            <b className={cx(s("badge"), s("chip-blue"))} style={{ textTransform: "capitalize" }}>
              {faculty.gender}
            </b>
            {faculty.experience_years && (
              <b className={cx(s("badge"), s("chip-green"))}>
                {faculty.experience_years} yrs exp
              </b>
            )}
          </div>
        </div>
        <div className={s("hero-metrics")}>
          <span>
            <b>Join Date</b>
            <strong style={{ fontSize: 13 }}>
              {faculty.join_date
                ? new Date(faculty.join_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                : "—"}
            </strong>
          </span>
          <span>
            <b>Phone</b>
            <strong style={{ fontSize: 13 }}>{faculty.phone || "—"}</strong>
          </span>
          <span>
            <b>City</b>
            <strong style={{ fontSize: 13 }}>{faculty.city || "—"}</strong>
          </span>
        </div>
      </div>

      {/* ── Quick cards ── */}
      <div className={s("quick-cards")}>
        <article>
          <i className="fa-solid fa-envelope" />
          <span>Email</span>
          <strong style={{ fontSize: 13 }}>{faculty.email || "—"}</strong>
        </article>
        <article>
          <i className="fa-solid fa-phone" />
          <span>Phone</span>
          <strong style={{ fontSize: 13 }}>{faculty.phone || "—"}</strong>
        </article>
        <article>
          <i className="fa-solid fa-location-dot" />
          <span>Location</span>
          <strong style={{ fontSize: 13 }}>
            {[faculty.city, faculty.state, faculty.country].filter(Boolean).join(", ") || "—"}
          </strong>
        </article>
        <article>
          <i className="fa-solid fa-graduation-cap" />
          <span>Qualification</span>
          <strong style={{ fontSize: 13 }}>{faculty.qualification || "—"}</strong>
        </article>
      </div>

      {/* ── Details + Salary ── */}
      <div className={s("profile-grid")}>
        {/* Personal info */}
        <section className={s("card")}>
          <div className={s("card-head")}>
            <h2><i className="fa-solid fa-id-badge" style={{ color: "#ff9b51", marginRight: 8 }} />Personal Information</h2>
          </div>
          <div className={s("info-grid")}>
            {[
              ["Full Name",    faculty.full_name],
              ["Email",        faculty.email],
              ["Phone",        faculty.phone],
              ["Gender",       faculty.gender],
              ["Date of Birth", faculty.date_of_birth ? new Date(faculty.date_of_birth).toLocaleDateString() : "—"],
              ["Blood Group",  faculty.blood_group || "—"],
              ["Qualification", faculty.qualification || "—"],
              ["Experience",   faculty.experience_years ? `${faculty.experience_years} years` : "—"],
              ["Join Date",    faculty.join_date ? new Date(faculty.join_date).toLocaleDateString() : "—"],
              ["City",         faculty.city || "—"],
              ["State",        faculty.state || "—"],
              ["Country",      faculty.country || "—"],
            ].map(([label, value]) => (
              <div className={s("info-item")} key={label}>
                <span>{label}</span>
                <strong style={{ textTransform: label === "Gender" ? "capitalize" : "none" }}>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        {/* Salary History */}
        <section className={s("card")}>
          <div className={s("card-head")}>
            <h2><i className="fa-solid fa-money-bill-wave" style={{ color: "#ff9b51", marginRight: 8 }} />Salary History</h2>
            <Link className={cx(s("btn"), s("btn-sm"), s("btn-primary"))} href={`/salary`}>
              Manage
            </Link>
          </div>

          {salaryLoading ? (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <Spinner size={24} color="#FF9B51" />
            </div>
          ) : !salaryHistory?.length ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6b7b86", fontSize: 13 }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: 22, display: "block", marginBottom: 8 }} />
              No salary records found.
            </div>
          ) : (
            <div className={s("history-list")}>
              {salaryHistory.map((rec) => {
                const net =
                  parseFloat(rec.basic_salary || 0) +
                  parseFloat(rec.bonus || 0) -
                  parseFloat(rec.deduction || 0);
                const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                return (
                  <div key={rec.id}>
                    <span>
                      <b>{monthNames[(rec.month || 1) - 1]} {rec.year}</b>
                      <em style={{
                        background: rec.status === "paid" ? "#dcfce7" : "#fef3c7",
                        color: rec.status === "paid" ? "#15803d" : "#b45309",
                      }}>
                        {rec.status}
                      </em>
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "#6b7b86", fontWeight: 700 }}>Basic: ₹{rec.basic_salary}</div>
                      <div style={{ fontSize: 13, fontWeight: 900 }}>Net: ₹{net.toFixed(0)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </FacultyShell>
  );
}

// ── ADD FACULTY PAGE ───────────────────────────────────────────────────────────
export function AddFacultyPage() {
  return (
    <FacultyShell title="Add Teacher" subtitle="Register a new faculty member to your school">
      <AddFacultyForm />
    </FacultyShell>
  );
}
