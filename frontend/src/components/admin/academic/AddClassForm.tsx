"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./academic.module.css";
import { useApi } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import { apiRequest } from "@/lib/api";

const s = (className: string) => styles[className];
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const classOptions = Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`);
const streamOptions = ["Not Applicable", "Commerce", "Science - PCM", "Science - PCB", "Arts"];

// Each selected subject carries its own teacher assignment
type SelectedSubject = {
  id:       number;
  name:     string;
  teacherId: string; // "" means no teacher assigned
};

export default function AddClassForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const { data: activeYear }  = useApi<{ id: number }>("/academic-years/active");
  const { data: dbSubjects }  = useApi<any[]>("/classes/subjects");
  const { data: teachers }    = useApi<any[]>("/teachers");

  const [sections,             setSections]            = useState([{ name: "A", capacity: "40" }]);
  const [selectedSubjects,     setSelectedSubjects]    = useState<SelectedSubject[]>([]);
  const [availableClasses,     setAvailableClasses]    = useState(classOptions);
  const [availableStreams,     setAvailableStreams]     = useState(streamOptions);
  const [selectedClass,        setSelectedClass]       = useState("Class 1");
  const [selectedStream,       setSelectedStream]      = useState("Not Applicable");
  const [newClass,             setNewClass]            = useState("");
  const [newStream,            setNewStream]           = useState("");
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState<string>("");
  const [isSubmitting,         setIsSubmitting]        = useState(false);

  const activeTeachers = (teachers || []).filter((t) => t.status === "active");

  // ── Sections helpers ──────────────────────────────────────────────────────
  const addSection = () => setSections((curr) => [...curr, { name: "", capacity: "" }]);

  const updateSection = (index: number, key: "name" | "capacity", value: string) =>
    setSections((curr) => curr.map((sec, i) => (i === index ? { ...sec, [key]: value } : sec)));

  // ── Subject helpers ───────────────────────────────────────────────────────
  const addSubjectById = (subjectId: string) => {
    if (!subjectId) return;
    const sub = dbSubjects?.find((s) => String(s.id) === subjectId);
    if (!sub) return;
    if (selectedSubjects.some((s) => s.id === sub.id)) return; // already added
    setSelectedSubjects((curr) => [...curr, { id: sub.id, name: sub.name, teacherId: "" }]);
  };

  const removeSubject = (subjectId: number) =>
    setSelectedSubjects((curr) => curr.filter((s) => s.id !== subjectId));

  const updateSubjectTeacher = (subjectId: number, teacherId: string) =>
    setSelectedSubjects((curr) =>
      curr.map((s) => (s.id === subjectId ? { ...s, teacherId } : s))
    );

  // ── Class / stream option creators ───────────────────────────────────────
  const createClassOption = () => {
    const cls = newClass.trim();
    if (!cls) return;
    setAvailableClasses((curr) => (curr.includes(cls) ? curr : [...curr, cls]));
    setSelectedClass(cls);
    setNewClass("");
  };

  const createStreamOption = () => {
    const stream = newStream.trim();
    if (!stream) return;
    setAvailableStreams((curr) => (curr.includes(stream) ? curr : [...curr, stream]));
    setSelectedStream(stream);
    setNewStream("");
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!activeYear?.id) {
      dispatch(showToast({ type: "error", title: "Error", message: "No active academic year found." }));
      return;
    }

    const trimmedSections = sections.map((sec) => ({ ...sec, name: sec.name.trim() }));
    if (trimmedSections.some((sec) => !sec.name)) {
      dispatch(showToast({ type: "error", title: "Error", message: "Every section needs a name." }));
      return;
    }
    const sectionNames = trimmedSections.map((sec) => sec.name.toLowerCase());
    if (new Set(sectionNames).size !== sectionNames.length) {
      dispatch(showToast({ type: "error", title: "Error", message: "Section names must be unique within this class." }));
      return;
    }

    try {
      setIsSubmitting(true);

      const className =
        selectedStream !== "Not Applicable"
          ? `${selectedClass} - ${selectedStream}`
          : selectedClass;

      // 1. Create class with sections
      const classRes = await apiRequest<{ data: any }>("/classes", {
        method: "POST",
        body: JSON.stringify({
          academic_year_id: activeYear.id,
          name:    className,
          status:  "active",
          sections: trimmedSections.map((sec) => ({
            name:     sec.name,
            capacity: parseInt(sec.capacity) || 40,
            status:   "active",
          })),
        }),
      });

      const classId = classRes.data.id;

      // 2. Assign subjects — call assign-subject first, then assign-subject-teacher
      for (const sub of selectedSubjects) {
        // Assign subject to class (creates class_subjects row)
        await apiRequest("/classes/assign-subject", {
          method: "POST",
          body: JSON.stringify({
            class_id:   classId,
            subject_id: sub.id,
          }),
        });

        // Assign teacher to this subject in this class (creates class_subject_teachers row)
        // This is what the P1 exam result guard checks — without this, faculty get 403
        if (sub.teacherId && activeYear?.id) {
          await apiRequest("/classes/assign-subject-teacher", {
            method: "POST",
            body: JSON.stringify({
              class_id:         classId,
              subject_id:       sub.id,
              teacher_id:       Number(sub.teacherId),
              academic_year_id: activeYear.id,
            }),
          });
        }
      }

      // 3. Assign coordinator to all sections if selected
      if (selectedCoordinatorId) {
        const createdSections = classRes.data.sections || [];
        for (const section of createdSections) {
          await apiRequest(`/classes/sections/${section.id}`, {
            method: "PATCH",
            body: JSON.stringify({ coordinator_id: Number(selectedCoordinatorId) }),
          });
        }
      }

      dispatch(showToast({ type: "success", title: "Success", message: "Class created successfully." }));
      router.push("/classes");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not save class." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className={s("form-grid")}>
        {/* ── Class Details ── */}
        <article className={s("panel")}>
          <div className={s("panel-head")}>
            <div>
              <h2>Class Details</h2>
              <p className={s("muted")}>Basic academic information for this class</p>
            </div>
          </div>
          <div className={s("form-body")}>

            <label className={s("field")}>
              <span>Class</span>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                {availableClasses.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>

            <label className={s("field")}>
              <span>Stream</span>
              <select value={selectedStream} onChange={(e) => setSelectedStream(e.target.value)}>
                {availableStreams.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>

            <div className={s("inline-create")}>
              <label className={s("field")}>
                <span>Create Class</span>
                <input value={newClass} onChange={(e) => setNewClass(e.target.value)} placeholder="Example: Class 13" />
              </label>
              <button className={cx(s("btn"), s("btn-primary"))} type="button" onClick={createClassOption}>
                <i className="fa-solid fa-plus" /> Add
              </button>
            </div>

            <div className={s("inline-create")}>
              <label className={s("field")}>
                <span>Create Stream</span>
                <input value={newStream} onChange={(e) => setNewStream(e.target.value)} placeholder="Example: Vocational" />
              </label>
              <button className={cx(s("btn"), s("btn-primary"))} type="button" onClick={createStreamOption}>
                <i className="fa-solid fa-plus" /> Add
              </button>
            </div>

            {/* ── Task 5: renamed "Class Coordinator" → "Section Coordinator" ── */}
            <label className={cx(s("field"), s("wide"))}>
              <span>
                Section Coordinator{" "}
                <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span>
              </span>
              <select value={selectedCoordinatorId} onChange={(e) => setSelectedCoordinatorId(e.target.value)}>
                <option value="">— Select a faculty member —</option>
                {activeTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}{t.email ? ` (${t.email})` : ""}
                  </option>
                ))}
              </select>
              <small style={{ color: "#94a3b8", fontSize: 12 }}>
                Selected coordinator will be assigned to all sections of this class.
                You can change it per section later from the Sections page.
              </small>
            </label>

          </div>
        </article>

        {/* ── Sections ── */}
        <article className={s("panel")}>
          <div className={s("panel-head")}>
            <div>
              <h2>Sections Inside Class</h2>
              <p className={s("muted")}>Add section name and capacity only</p>
            </div>
            <button className={cx(s("btn"), s("btn-primary"))} type="button" onClick={addSection}>
              <i className="fa-solid fa-plus" /> Add Section
            </button>
          </div>
          <div className={s("section-form-list")}>
            {sections.map((section, index) => (
              <div className={s("section-form-row")} key={index}>
                <label className={s("field")}>
                  <span>Section Name</span>
                  <input
                    value={section.name}
                    onChange={(e) => updateSection(index, "name", e.target.value)}
                    placeholder="A"
                  />
                </label>
                <label className={s("field")}>
                  <span>Capacity</span>
                  <input
                    value={section.capacity}
                    onChange={(e) => updateSection(index, "capacity", e.target.value)}
                    type="number"
                    placeholder="40"
                  />
                </label>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* ── Subjects ── */}
      <section className={s("panel")}>
        <div className={s("panel-head")}>
          <div>
            <h2>Subjects Taught In This Class</h2>
            <p className={s("muted")}>
              Select subjects and optionally assign a teacher to each.
              To add new subjects, visit the{" "}
              <Link href="/subjects" style={{ color: "#FF9B51", fontWeight: 600 }}>Subjects page</Link>.
            </p>
          </div>
        </div>

        <div className={s("subject-manager")}>

          {/* Subject picker */}
          <div className={s("subject-create-row")}>
            <label className={s("field")}>
              <span>Add Subject</span>
              <select
                defaultValue=""
                onChange={(e) => { addSubjectById(e.target.value); e.target.value = ""; }}
              >
                <option value="">— Select subject to add —</option>
                {(dbSubjects || [])
                  .filter((sub) => !selectedSubjects.some((s) => s.id === sub.id))
                  .map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}{sub.code ? ` (${sub.code})` : ""}
                    </option>
                  ))}
              </select>
            </label>
            <Link
              href="/subjects"
              className={cx(s("btn"), s("btn-primary"), s("subject-add-btn"))}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-end" }}
            >
              <i className="fa-solid fa-arrow-up-right-from-square" /> Manage Subjects
            </Link>
          </div>

          {/* Selected subjects — each with optional teacher dropdown */}
          {selectedSubjects.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              {/* Column headers */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "minmax(160px, 1fr) minmax(200px, 1.2fr) 36px",
                gap: 10,
                padding: "0 4px",
              }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Subject
                </span>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Assigned Teacher <em style={{ fontStyle: "normal", color: "#94a3b8" }}>(optional)</em>
                </span>
                <span />
              </div>

              {selectedSubjects.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(160px, 1fr) minmax(200px, 1.2fr) 36px",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    background: "#fafcfc",
                  }}
                >
                  {/* Subject name chip */}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "6px 12px", borderRadius: 999,
                    background: "#fff3e8", color: "#b45309",
                    fontSize: 13, fontWeight: 900, width: "fit-content",
                  }}>
                    <i className="fa-solid fa-book" style={{ fontSize: 10 }} />
                    {sub.name}
                  </span>

                  {/* Teacher dropdown */}
                  <select
                    value={sub.teacherId}
                    onChange={(e) => updateSubjectTeacher(sub.id, e.target.value)}
                    style={{
                      height: 36, border: "1px solid #c6d0d7", borderRadius: 8,
                      padding: "0 10px", fontSize: 13, fontWeight: 700,
                      color: "#1f2d36", background: "#fff", outline: "none",
                      fontFamily: "inherit",
                    }}
                  >
                    <option value="">— No teacher assigned —</option>
                    {activeTeachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeSubject(sub.id)}
                    title="Remove subject"
                    style={{
                      width: 32, height: 32, border: "1px solid #fecdd3",
                      borderRadius: 8, background: "#fff1f2", color: "#b42318",
                      cursor: "pointer", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 12,
                    }}
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedSubjects.length === 0 && (
            <p style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700, padding: "8px 0" }}>
              No subjects added yet. Use the dropdown above to add subjects.
            </p>
          )}

          <div className={s("form-actions")}>
            <Link className={s("btn")} href="/classes">Cancel</Link>
            <button
              className={cx(s("btn"), s("btn-primary"))}
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <><Spinner size={16} /> Saving…</>
                : "Save Class"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
