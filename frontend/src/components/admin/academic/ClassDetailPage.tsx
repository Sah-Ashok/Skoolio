"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "@/components/admin/academic/academic.module.css";
import { useApi } from "@/lib/useApi";
import { Loader } from "@/components/shared/Loader";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const SUBJECT_COLORS = [
  { bg: "#fff3e8", color: "#b45309", border: "#fdd5b0" },
  { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
  { bg: "#ccfbf1", color: "#0f766e", border: "#99f6e4" },
  { bg: "#f3e8ff", color: "#7e22ce", border: "#e9d5ff" },
  { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
  { bg: "#fef9c3", color: "#854d0e", border: "#fde68a" },
];

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: cls, loading, error } = useApi<any>(id ? `/classes/${id}` : "");

  const activeSections = cls?.sections?.filter((s: any) => s.status === "active").length ?? 0;
  const hasStream      = cls?.stream && cls.stream !== "Not Applicable";

  if (loading) return (
    <div className={s("academic-page")}>
      <main className={s("content")}>
        <div style={{ padding: "4rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading class details…" /></div>
      </main>
    </div>
  );

  return (
    <div className={s("academic-page")}>
      <main className={s("content")}>

        {/* ── Hero ── */}
        <section className={s("hero")}>
          <div>
            <div className={s("eyebrow")}>Class Details</div>
            <h1 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {cls?.name || "—"}
              {hasStream && (
                <span className={cx(s("badge"), s("badge-secondary"))} style={{ fontSize: 12, fontWeight: 800 }}>
                  {cls.stream}
                </span>
              )}
              <span
                className={s("badge")}
                style={{
                  fontSize: 11, fontWeight: 800, textTransform: "capitalize",
                  background: cls?.status === "active" ? "#dcfce7" : "#fef3c7",
                  color:      cls?.status === "active" ? "#15803d"  : "#b45309",
                }}
              >
                {cls?.status ?? "—"}
              </span>
            </h1>
            <p>{cls?.description || "No description set for this class."}</p>
          </div>
          <div className={s("hero-actions")}>
            <Link className={s("btn")} href="/classes">
              <i className="fa-solid fa-arrow-left" /> Back
            </Link>
            <Link className={cx(s("btn"), s("btn-primary"))} href={`/classes/${id}/edit`}>
              <i className="fa-solid fa-pen" /> Edit Class
            </Link>
          </div>
        </section>

        {error && (
          <div style={{ padding: "1rem 1.4rem", color: "#f43f5e", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 12, marginBottom: 16, fontWeight: 700 }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 8 }} />{error}
          </div>
        )}

        {/* ── Stats ── */}
        <div className={s("stats-grid")}>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")}><i className="fa-solid fa-people-line" /></div>
            <div><p>Total Sections</p><strong>{cls?.sections?.length ?? 0}</strong></div>
          </article>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")} style={{ background: "#dcfce7", color: "#15803d" }}>
              <i className="fa-solid fa-circle-check" />
            </div>
            <div><p>Active Sections</p><strong>{activeSections}</strong></div>
          </article>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")} style={{ background: "#dbeafe", color: "#1d4ed8" }}>
              <i className="fa-solid fa-book-open" />
            </div>
            <div><p>Subjects</p><strong>{cls?.subjects?.length ?? 0}</strong></div>
          </article>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")} style={{ background: "#f3e8ff", color: "#7e22ce" }}>
              <i className="fa-solid fa-chalkboard-user" />
            </div>
            <div>
              <p>Subjects with Teacher</p>
              <strong>{cls?.subjects?.filter((sub: any) => sub.teacher_id)?.length ?? 0}</strong>
            </div>
          </article>
        </div>

        {/* ── Sections ── */}
        <div className={s("panel")}>
          <div className={s("panel-head")}>
            <h2>
              <i className="fa-solid fa-people-line" style={{ color: "#ff9b51", marginRight: 8 }} />
              Sections
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: "#6b7b86" }}>
                {cls?.sections?.length ?? 0} total
              </span>
            </h2>
            <Link className={cx(s("btn"), s("btn-primary"))} href={`/classes/${id}/edit`} style={{ fontSize: 12 }}>
              <i className="fa-solid fa-pen" /> Manage
            </Link>
          </div>

          <div className={s("panel-body")}>
            {!cls?.sections?.length ? (
              <div style={{ textAlign: "center", padding: "2.5rem", color: "#94a3b8" }}>
                <i className="fa-solid fa-inbox" style={{ fontSize: 26, display: "block", marginBottom: 10 }} />
                No sections yet.{" "}
                <Link href={`/classes/${id}/edit`} style={{ color: "#ff9b51", fontWeight: 700 }}>
                  Add one →
                </Link>
              </div>
            ) : (
              <div className={s("program-grid")}>
                {cls.sections.map((sec: any) => (
                  <article key={sec.id} className={s("program-card")}>
                    <div className={s("program-top")}>
                      <div>
                        <h3>Section {sec.name}</h3>
                        <div className={s("program-meta")}>
                          {sec.room_no ? `Room ${sec.room_no}` : "No room"} · Cap {sec.capacity ?? "—"}
                        </div>
                      </div>
                      <span
                        className={s("badge")}
                        style={{
                          textTransform: "capitalize",
                          background: sec.status === "active" ? "#dcfce7" : "#fef3c7",
                          color:      sec.status === "active" ? "#15803d"  : "#b45309",
                        }}
                      >
                        {sec.status}
                      </span>
                    </div>
                    <div className={s("program-details")}>
                      <div className={s("detail-box")}>
                        <span>Capacity</span>
                        <strong>{sec.capacity ?? "—"}</strong>
                      </div>
                      <div className={s("detail-box")}>
                        <span>Room</span>
                        <strong>{sec.room_no ?? "—"}</strong>
                      </div>
                      <div className={s("detail-box")}>
                        <span>Status</span>
                        <strong style={{ textTransform: "capitalize" }}>{sec.status}</strong>
                      </div>
                    </div>
                    {/* Section Coordinator (renamed from Class Coordinator) */}
                    <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: sec.coordinator_name ? "#fff3e8" : "#f8fafc", border: `1px solid ${sec.coordinator_name ? "#fdd5b0" : "#e2e8f0"}` }}>
                      <i className="fa-solid fa-chalkboard-user" style={{ marginRight: 6, color: sec.coordinator_name ? "#ff9b51" : "#94a3b8", fontSize: 11 }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: sec.coordinator_name ? "#92400e" : "#94a3b8" }}>
                        {sec.coordinator_name
                          ? `Section Coordinator: ${sec.coordinator_name}`
                          : "No section coordinator assigned"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Subjects with teacher assignments ── */}
        <div className={s("panel")}>
          <div className={s("panel-head")}>
            <h2>
              <i className="fa-solid fa-book-open" style={{ color: "#ff9b51", marginRight: 8 }} />
              Subjects & Teachers
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: "#6b7b86" }}>
                {cls?.subjects?.length ?? 0} assigned
              </span>
            </h2>
            <Link className={cx(s("btn"), s("btn-primary"))} href={`/classes/${id}/edit`} style={{ fontSize: 12 }}>
              <i className="fa-solid fa-pen" /> Manage
            </Link>
          </div>

          <div className={s("panel-body")}>
            {!cls?.subjects?.length ? (
              <div style={{ textAlign: "center", padding: "2.5rem", color: "#94a3b8" }}>
                <i className="fa-solid fa-book" style={{ fontSize: 26, display: "block", marginBottom: 10 }} />
                No subjects assigned yet.{" "}
                <Link href={`/classes/${id}/edit`} style={{ color: "#ff9b51", fontWeight: 700 }}>
                  Add subjects →
                </Link>
              </div>
            ) : (
              /* Table view — shows subject + teacher clearly */
              <div style={{ overflowX: "auto" }}>
                <table className={s("subject-table")}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Subject</th>
                      <th>Code</th>
                      <th>Assigned Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cls.subjects.map((sub: any, i: number) => {
                      const c = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                      return (
                        <tr key={sub.id}>
                          <td style={{ color: "#94a3b8", fontWeight: 700, fontSize: 12 }}>{i + 1}</td>
                          <td>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 7,
                              padding: "4px 10px", borderRadius: 999,
                              background: c.bg, color: c.color,
                              border: `1px solid ${c.border}`,
                              fontSize: 12.5, fontWeight: 900,
                            }}>
                              <i className="fa-solid fa-book" style={{ fontSize: 10 }} />
                              {sub.name}
                            </span>
                          </td>
                          <td>
                            {sub.code
                              ? <code style={{ fontSize: 11.5, fontWeight: 800, color: "#6b7b86", background: "#f1f5f9", padding: "2px 8px", borderRadius: 5 }}>{sub.code}</code>
                              : <span style={{ color: "#c4cfd7", fontSize: 12 }}>—</span>
                            }
                          </td>
                          <td>
                            {sub.teacher_name ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 800, color: "#1f2d36" }}>
                                <span style={{ width: 26, height: 26, borderRadius: 8, background: "#fff3e8", color: "#ff9b51", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
                                  {sub.teacher_name.charAt(0)}
                                </span>
                                {sub.teacher_name}
                              </span>
                            ) : (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>
                                <i className="fa-solid fa-user-slash" style={{ fontSize: 10 }} />
                                Not assigned
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
