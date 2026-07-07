"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import Topbar from "@/components/shared/Topbar";
import AddClassForm from "./AddClassForm";
import styles from "./academic.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";

const s = (className: string) => styles[className];
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

function AcademicShell({
  title,
  subtitle,
  eyebrow,
  description,
  children,
}: {
  title: string;
  subtitle: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className={s("academic-page")}>
      <Topbar title={title} subtitle={subtitle} />
      <main className={s("content")}>
        <section className={s("hero")}>
          <div>
            <div className={s("eyebrow")}>{eyebrow}</div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className={s("hero-actions")}>
            <Link className={cx(s("btn"), s("btn-primary"))} href="/classes/add">
              <i className="fa-solid fa-plus" /> Add Class
            </Link>
          </div>
        </section>
        {children}
      </main>
    </div>
  );
}

function AcademicStats() {
  const { data: years } = useApi('/academic-years');
  const { data: activeYear } = useApi<{id: number}>('/academic-years/active');
  const { data: classes } = useApi(activeYear?.id ? `/classes?academic_year_id=${activeYear.id}` : '', [activeYear?.id]);
  const { data: subjects } = useApi('/classes/subjects');

  const stats = [
    ["Academic Years", years?.length || 0, "Total academic years", "fa-calendar"],
    ["Classes", classes?.length || 0, "Class 1 to Class 12", "fa-layer-group"],
    ["Subjects", subjects?.length || 0, "Mapped with books and faculty", "fa-book-open"],
  ];

  return (
    <section className={s("stats-grid")}>
      {stats.map(([label, value, helper, icon]) => (
        <article className={s("stat-card")} key={label as string}>
          <div className={s("stat-icon")}>
            <i className={`fa-solid ${icon}`} />
          </div>
          <div>
            <p>{label as string}</p>
            <strong>{value as number}</strong>
            <p>{helper as string}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function ProgramCards() {
  const { data: activeYear } = useApi<{id: number}>('/academic-years/active');
  const { data: classes, loading, error, refetch } = useApi<any[]>(activeYear?.id ? `/classes?academic_year_id=${activeYear.id}` : '', [activeYear?.id]);
  const dispatch = useAppDispatch();
  const { execute: patchClass, loading: saving } = useMutation('/classes', 'PATCH');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', room_no: '', status: 'active', description: '' });

  if (!activeYear?.id) return <div style={{ padding: "2rem", color: "#64748b" }}>No active academic year found. Please create and activate an academic year first.</div>;
  if (loading) return <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>;
  if (error) return <div style={{ color: "red", padding: "1rem" }}>{error}</div>;

  const startEdit = (program: any) => {
    setEditingId(program.id);
    setEditForm({
      name: program.name,
      room_no: program.room_no || '',
      status: program.status,
      description: program.description || '',
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: number) => {
    if (!editForm.name.trim()) {
      dispatch(showToast({ type: 'error', title: 'Error', message: 'Class name is required' }));
      return;
    }
    const res = await patchClass(
      {
        name: editForm.name,
        room_no: editForm.room_no || undefined,
        status: editForm.status,
        description: editForm.description || undefined,
      } as any,
      `/classes/${id}`
    );
    if (res) {
      dispatch(showToast({ type: 'success', title: 'Updated', message: 'Class details saved.' }));
      setEditingId(null);
      refetch();
    } else {
      dispatch(showToast({ type: 'error', title: 'Could not update', message: 'Please try again.' }));
    }
  };

  return (
    <section className={s("program-grid")}>
      {classes?.map((program) => {
        if (editingId === program.id) {
          return (
            <article className={s("program-card")} key={program.id}>
              <div style={{ display: 'grid', gap: 12 }}>
                <label className={s("field")}>
                  <span>Class Name</span>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </label>
                <label className={s("field")}>
                  <span>Room No (optional)</span>
                  <input value={editForm.room_no} onChange={(e) => setEditForm({ ...editForm, room_no: e.target.value })} placeholder="e.g. 204" />
                </label>
                <label className={s("field")}>
                  <span>Status</span>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className={s("field")}>
                  <span>Description</span>
                  <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                </label>
              </div>
              <div className={s("form-actions")} style={{ paddingTop: 14 }}>
                <button type="button" className={s("btn")} onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
                <button type="button" className={cx(s("btn"), s("btn-primary"))} onClick={() => saveEdit(program.id)} disabled={saving}>
                  {saving ? <Spinner size={14} /> : <><i className="fa-solid fa-check" /> Save</>}
                </button>
              </div>
            </article>
          );
        }

        return (
          <article className={s("program-card")} key={program.id}>
            <div className={s("program-top")}>
              <div>
                <h3>{program.name}</h3>
                <div className={s("program-meta")}>
                  {program.room_no ? `Room ${program.room_no}` : "No room assigned"} · Section based
                </div>
              </div>
              <span className={cx(s("badge"), s(`badge-primary`))} style={{ background: program.status === 'active' ? '#e0f2fe' : '#fef3c7', color: program.status === 'active' ? '#0369a1' : '#b45309' }}>
                {program.status}
              </span>
            </div>

            <div className={s("program-details")}>
              <div className={s("detail-box")}>
                <span>Status</span>
                <strong>{program.status}</strong>
              </div>
              <div className={s("detail-box")}>
                <span>Created</span>
                <strong>{new Date(program.created_at).toLocaleDateString()}</strong>
              </div>
            </div>

            <p className={s("row-sub")}>{program.description || 'No description'}</p>

            <div className={s("row-actions")} style={{ marginTop: 14 }}>
              <Link className={s("btn")} href={`/classes/${program.id}`}>
                <i className="fa-solid fa-eye" /> View
              </Link>
              <button type="button" className={s("btn")} onClick={() => startEdit(program)}>
                <i className="fa-solid fa-pen" /> Edit
              </button>
            </div>
          </article>
        );
      })}
      {classes?.length === 0 && (
        <p className={s("muted")} style={{ padding: "1rem 0" }}>No classes yet. Add one to get started.</p>
      )}
    </section>
  );
}

export function AcademicManagePage() {
  const { data: years, loading, refetch } = useApi<any[]>('/academic-years');
  const dispatch = useAppDispatch();
  const { execute: createYear, loading: creating, error: createError } = useMutation('/academic-years', 'POST');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ year_name: '', start_date: '', end_date: '', status: 'upcoming' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(form.start_date) >= new Date(form.end_date)) {
      dispatch(showToast({ type: 'error', title: 'Error', message: 'Start date must be before end date' }));
      return;
    }
    const res = await createYear(form);
    if (res) {
      dispatch(showToast({ type: 'success', title: 'Success', message: 'Academic year created successfully' }));
      setShowForm(false);
      setForm({ year_name: '', start_date: '', end_date: '', status: 'upcoming' });
      refetch();
    } else {
      dispatch(showToast({ type: 'error', title: 'Error', message: createError || 'Failed to create academic year' }));
    }
  };

  return (
    <AcademicShell
      title="Academic Management"
      subtitle="Manage Academic Years, Class 1 to 12, sections, streams, subjects, and books"
      eyebrow="Setup"
      description="Stage 1 is focused on schools only. Manage Class 1 to Class 12, create sections, assign senior secondary streams, and map the right subjects and books."
    >
      <AcademicStats />
      
      <section className={s("card")} style={{ marginTop: '2rem', background: '#fff', borderRadius: '16px', border: '1px solid #e8edf2' }}>
        <div className={s("card-head")} style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5rem', borderBottom: '1px solid #eee' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Academic Years</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Manage school academic periods</p>
          </div>
          <button className={cx(s("btn"), s("btn-primary"))} onClick={() => setShowForm(!showForm)}>
            <i className="fa-solid fa-plus" /> Add Year
          </button>
        </div>
        
        {showForm && (
          <form onSubmit={handleSubmit} style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
              <label className={s("field")}>
                <span>Year Name</span>
                <input required value={form.year_name} onChange={e => setForm({...form, year_name: e.target.value})} placeholder="e.g. 2025-2026" />
              </label>
              <label className={s("field")}>
                <span>Start Date</span>
                <input type="date" required value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
              </label>
              <label className={s("field")}>
                <span>End Date</span>
                <input type="date" required value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
              </label>
              <label className={s("field")}>
                <span>Status</span>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <button type="submit" disabled={creating} className={cx(s("btn"), s("btn-primary"))} style={{ height: '42px' }}>
                {creating ? <Spinner size={16} /> : 'Save'}
              </button>
            </div>
          </form>
        )}

        <div className={s("table-wrap")} style={{ padding: '0 1.5rem 1.5rem' }}>
          {loading ? <div style={{ padding: '2rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51" /></div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 0' }}>Year Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {years?.map(year => (
                  <tr key={year.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 0' }}><strong>{year.year_name}</strong></td>
                    <td>{new Date(year.start_date).toLocaleDateString()}</td>
                    <td>{new Date(year.end_date).toLocaleDateString()}</td>
                    <td>
                      <span className={cx(s("badge"))} style={{
                        background: year.status === 'active' ? '#dcfce7' : year.status === 'upcoming' ? '#e0f2fe' : '#f1f5f9',
                        color: year.status === 'active' ? '#166534' : year.status === 'upcoming' ? '#0369a1' : '#475569',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize'
                      }}>
                        {year.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className={s("pathway-grid")} style={{ marginTop: '2rem' }}>
        <Link href="/classes" style={{ textDecoration: 'none' }}>
          <article className={s("pathway-card")}>
            <i className="fa-solid fa-school" />
            <h3>Classes</h3>
            <p>Create Class 1 to 12 records with sections and senior secondary streams.</p>
          </article>
        </Link>
        <Link href="/sections" style={{ textDecoration: 'none' }}>
          <article className={s("pathway-card")}>
            <i className="fa-solid fa-people-line" />
            <h3>Sections / Streams</h3>
            <p>Split classes into sections and manage Commerce, Science, Arts, or other senior streams.</p>
          </article>
        </Link>
        <Link href="/subjects" style={{ textDecoration: 'none' }}>
          <article className={s("pathway-card")}>
            <i className="fa-solid fa-book" />
            <h3>Subjects</h3>
            <p>Map different books and subjects for each class, section, and stream.</p>
          </article>
        </Link>
      </section>
    </AcademicShell>
  );
}

export function AcademicClassesPage() {
  return (
    <AcademicShell
      title="Classes"
      subtitle="Create and manage Class 1 to Class 12"
      eyebrow="Classes"
      description="Manage each school class separately. Senior classes can be organized by stream, so Class 12 Commerce and Class 12 Science can have different subjects, books, sections, and teachers."
    >
      <AcademicStats />
      <ProgramCards />
    </AcademicShell>
  );
}


export function AddClassPage() {
  return (
    <AcademicShell
      title="Add Class"
      subtitle="Create a class with sections and subjects"
      eyebrow="Class Setup"
      description="Create one class record, define section name and capacity, then select existing subjects or create a new subject by name."
    >
      <AddClassForm />
    </AcademicShell>
  );
}
