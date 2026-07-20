"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./academic.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { fetchActiveAcademicYear } from "@/store/academicYearSlice";
import { Spinner } from "@/components/shared/Loader";
import DateInput from "@/components/shared/DateInput";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

type AcademicYearStatus = "upcoming" | "active" | "completed";

type AcademicYear = {
  id: number;
  school_id: number;
  year_name: string;
  start_date: string;
  end_date: string;
  status: AcademicYearStatus;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

type YearFormState = {
  year_name: string;
  start_date: string;
  end_date: string;
  status: AcademicYearStatus;
  description: string;
};

const emptyForm: YearFormState = {
  year_name: "",
  start_date: "",
  end_date: "",
  status: "upcoming",
  description: "",
};

const formatDate = (value: string) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const statusBadgeStyle = (status: AcademicYearStatus) => {
  if (status === "active") return { background: "#dcfce7", color: "#166534" };
  if (status === "upcoming") return { background: "#e0f2fe", color: "#0369a1" };
  return { background: "#f1f5f9", color: "#475569" };
};

function YearFields({
  form,
  onChange,
}: {
  form: YearFormState;
  onChange: (next: YearFormState) => void;
}) {
  return (
    <div className={s("form-body")}>
      <label className={s("field")}>
        <span>Year Name</span>
        <input
          required
          placeholder="e.g. 2026-2027"
          value={form.year_name}
          onChange={(e) => onChange({ ...form, year_name: e.target.value })}
        />
      </label>
      <label className={s("field")}>
        <span>Status</span>
        <select
          value={form.status}
          onChange={(e) => onChange({ ...form, status: e.target.value as AcademicYearStatus })}
        >
          <option value="upcoming">Upcoming</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      <label className={s("field")}>
        <span>Start Date</span>
        <DateInput
          required
          value={form.start_date}
          onChange={(e) => onChange({ ...form, start_date: e.target.value })}
        />
      </label>
      <label className={s("field")}>
        <span>End Date</span>
        <DateInput
          required
          value={form.end_date}
          onChange={(e) => onChange({ ...form, end_date: e.target.value })}
        />
      </label>
      <label className={cx(s("field"), s("wide"))}>
        <span>Description (optional)</span>
        <textarea
          rows={2}
          placeholder="Notes about this academic year"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
      </label>
    </div>
  );
}

export default function AcademicYearsPage() {
  const { data: years, loading, error: loadError, refetch } = useApi<AcademicYear[]>("/academic-years");
  const dispatch = useAppDispatch();

  const { execute: createYear, loading: creating } = useMutation<YearFormState>("/academic-years", "POST");
  const { execute: patchYear, loading: patching } = useMutation<Partial<YearFormState>>("/academic-years", "PATCH");
  const { execute: deleteYear, loading: deleting } = useMutation("/academic-years", "DELETE");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<YearFormState>(emptyForm);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<YearFormState>(emptyForm);
  const [busyId, setBusyId] = useState<number | null>(null);

  const hasActiveYear = (years || []).some((y) => y.status === "active");
  const activeYear = (years || []).find((y) => y.status === "active");
  const upcomingCount = (years || []).filter((y) => y.status === "upcoming").length;
  const completedCount = (years || []).filter((y) => y.status === "completed").length;

  const validDates = (start: string, end: string) => {
    if (!start || !end) return true;
    return new Date(start) < new Date(end);
  };

  // ── Create ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validDates(form.start_date, form.end_date)) {
      dispatch(showToast({ type: "error", title: "Invalid dates", message: "Start date must be before end date." }));
      return;
    }
    const res = await createYear({ ...form, description: form.description || undefined } as any);
    if (res) {
      dispatch(showToast({ type: "success", title: "Created", message: `"${form.year_name}" has been added.` }));
      setShowForm(false);
      setForm(emptyForm);
      refetch();
      // Sync Redux so NoActiveYearGuard and all pages pick up the new active year
      if (form.status === "active") dispatch(fetchActiveAcademicYear());
    } else {
      dispatch(showToast({ type: "error", title: "Could not create", message: "Check the form and try again." }));
    }
  };

  // ── Edit ──
  const startEdit = (year: AcademicYear) => {
    setEditingId(year.id);
    setEditForm({
      year_name: year.year_name,
      start_date: year.start_date,
      end_date: year.end_date,
      status: year.status,
      description: year.description || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const saveEdit = async (id: number) => {
    if (!validDates(editForm.start_date, editForm.end_date)) {
      dispatch(showToast({ type: "error", title: "Invalid dates", message: "Start date must be before end date." }));
      return;
    }
    setBusyId(id);
    const res = await patchYear(
      { ...editForm, description: editForm.description || undefined },
      `/academic-years/${id}`
    );
    setBusyId(null);
    if (res) {
      dispatch(showToast({ type: "success", title: "Updated", message: "Academic year saved." }));
      cancelEdit();
      refetch();
      // If status changed to/from active, sync Redux
      dispatch(fetchActiveAcademicYear());
    } else {
      dispatch(showToast({ type: "error", title: "Could not update", message: "That change isn't allowed - check status rules." }));
    }
  };

  // ── Activate ──
  const handleActivate = async (year: AcademicYear) => {
    setBusyId(year.id);
    const res = await patchYear({ status: "active" }, `/academic-years/${year.id}`);
    setBusyId(null);
    if (res) {
      dispatch(showToast({ type: "success", title: "Activated", message: `"${year.year_name}" is now the active year.` }));
      refetch();
      // Sync Redux so NoActiveYearGuard and all pages pick up the new active year immediately
      dispatch(fetchActiveAcademicYear());
    } else {
      dispatch(showToast({ type: "error", title: "Could not activate", message: "Complete the currently active year first." }));
    }
  };

  // ── Delete ──
  const handleDelete = async (year: AcademicYear) => {
    if (year.status === "active") return;
    const ok = window.confirm(`Delete "${year.year_name}"? This cannot be undone.`);
    if (!ok) return;
    setBusyId(year.id);
    const res = await deleteYear(undefined, `/academic-years/${year.id}`);
    setBusyId(null);
    if (res !== null) {
      dispatch(showToast({ type: "success", title: "Deleted", message: `"${year.year_name}" was removed.` }));
      refetch();
    } else {
      dispatch(showToast({ type: "error", title: "Could not delete", message: "Please try again." }));
    }
  };

  return (
    <div className={s("academic-page")}>
      <Topbar title="Academic Years" subtitle="Manage your school's academic year cycles" />
      <main className={s("content")}>
        <section className={s("hero")}>
          <div>
            <div className={s("eyebrow")}>Setup</div>
            <h1>Academic Years</h1>
            <p>
              Only one academic year can be active at a time - every class, attendance record, and exam is scoped
              to the active year. Mark a year as completed before activating the next one.
            </p>
          </div>
          <div className={s("hero-actions")}>
            <button
              type="button"
              className={cx(s("btn"), s("btn-primary"))}
              onClick={() => {
                setShowForm((v) => !v);
                setForm(emptyForm);
              }}
            >
              <i className="fa-solid fa-plus" /> {showForm ? "Close" : "Add Academic Year"}
            </button>
          </div>
        </section>

        <section className={s("stats-grid")}>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")}>
              <i className="fa-solid fa-calendar-days" />
            </div>
            <div>
              <p>Total Years</p>
              <strong>{years?.length || 0}</strong>
            </div>
          </article>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")}>
              <i className="fa-solid fa-circle-check" />
            </div>
            <div>
              <p>Active Year</p>
              <strong style={{ fontSize: 15 }}>{activeYear?.year_name || "None set"}</strong>
            </div>
          </article>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")}>
              <i className="fa-solid fa-hourglass-half" />
            </div>
            <div>
              <p>Upcoming</p>
              <strong>{upcomingCount}</strong>
            </div>
          </article>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")}>
              <i className="fa-solid fa-box-archive" />
            </div>
            <div>
              <p>Completed</p>
              <strong>{completedCount}</strong>
            </div>
          </article>
        </section>

        {showForm && (
          <section className={cx(s("panel"), s("single-form"))}>
            <div className={s("panel-head")}>
              <h2>New Academic Year</h2>
            </div>
            <form onSubmit={handleCreate}>
              <YearFields form={form} onChange={setForm} />
              {form.status === "active" && hasActiveYear && (
                <div className={s("panel-body")} style={{ paddingTop: 0, color: "#b45309", fontSize: 12, fontWeight: 700 }}>
                  <i className="fa-solid fa-triangle-exclamation" /> "{activeYear?.year_name}" is already active - creating
                  this as active will be rejected until it's completed.
                </div>
              )}
              <div className={s("form-actions")} style={{ padding: "0 18px 18px" }}>
                <button
                  type="button"
                  className={s("btn")}
                  onClick={() => {
                    setShowForm(false);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={cx(s("btn"), s("btn-primary"))} disabled={creating}>
                  {creating ? <Spinner size={16} /> : <><i className="fa-solid fa-check" /> Save Year</>}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className={s("panel")}>
          <div className={s("panel-head")}>
            <h2>All Academic Years</h2>
            <span className={s("muted")}>{years?.length || 0} total</span>
          </div>

          <div className={s("panel-body")}>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <Spinner size={28} color="#FF9B51" />
              </div>
            ) : loadError ? (
              <p style={{ color: "#dc2626", padding: "1rem 0" }}>{loadError}</p>
            ) : !years || years.length === 0 ? (
              <p className={s("muted")} style={{ padding: "1rem 0" }}>
                No academic years yet. Add one to get started.
              </p>
            ) : (
              years.map((year) => {
                const isEditing = editingId === year.id;
                const isBusy = busyId === year.id || (isEditing && patching);

                if (isEditing) {
                  return (
                    <div key={year.id} className={s("data-row")}>
                      <YearFields form={editForm} onChange={setEditForm} />
                      <div className={s("form-actions")}>
                        <button type="button" className={s("btn")} onClick={cancelEdit} disabled={isBusy}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          className={cx(s("btn"), s("btn-primary"))}
                          onClick={() => saveEdit(year.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? <Spinner size={16} /> : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={year.id} className={cx(s("data-row"), s("row-main"))}>
                    <div>
                      <div className={s("row-title")}>{year.year_name}</div>
                      <div className={s("row-sub")}>
                        {formatDate(year.start_date)} – {formatDate(year.end_date)}
                        {year.description ? ` · ${year.description}` : ""}
                      </div>
                    </div>
                    <div className={s("row-actions")} style={{ alignItems: "center" }}>
                      <span className={s("badge")} style={statusBadgeStyle(year.status)}>
                        {year.status}
                      </span>
                      {year.status !== "active" && (
                        <button
                          type="button"
                          className={s("btn")}
                          onClick={() => handleActivate(year)}
                          disabled={busyId === year.id}
                          title="Make this the active academic year"
                        >
                          {busyId === year.id ? <Spinner size={14} /> : <><i className="fa-solid fa-bolt" /> Set Active</>}
                        </button>
                      )}
                      <button type="button" className={s("btn")} onClick={() => startEdit(year)} disabled={isBusy}>
                        <i className="fa-solid fa-pen" /> Edit
                      </button>
                      <button
                        type="button"
                        className={s("btn")}
                        onClick={() => handleDelete(year)}
                        disabled={year.status === "active" || busyId === year.id}
                        title={year.status === "active" ? "An active year can't be deleted - complete it first" : "Delete"}
                        style={year.status === "active" ? { opacity: 0.5, cursor: "not-allowed" } : { color: "#dc2626" }}
                      >
                        {busyId === year.id && deleting ? <Spinner size={14} /> : <i className="fa-solid fa-trash" />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
