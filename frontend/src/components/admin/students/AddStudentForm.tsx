"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./students.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

type Step = "details" | "fees" | "done";

export default function AddStudentForm() {
  const router   = useRouter();
  const dispatch = useAppDispatch();

  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: classes }    = useApi<any[]>(
    activeYear?.id ? `/classes?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );

  /* ── form state ── */
  const [form, setForm] = useState({
    admission_number: "", full_name: "", email: "", phone: "", password: "",
    gender: "male", date_of_birth: "", blood_group: "", nationality: "Nepali",
    city: "", state: "", country: "", admission_date: "",
    guardian_name: "", guardian_phone: "", guardian_relation: "Father", guardian_email: "",
    scholarship_type: "", scholarship_percent: "", scholarship_remarks: "", status: "active",
  });

  const [enrollment, setEnrollment] = useState({
    class_id: "", section_id: "", roll_number: "", stream: "not_applicable",
  });

  const [sections,         setSections]         = useState<any[]>([]);
  const [sectionsLoading,  setSectionsLoading]  = useState(false);

  /* ── multi-step wizard ── */
  const [step,           setStep]           = useState<Step>("details");
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [createdStudent, setCreatedStudent] = useState<any>(null);
  const [createdEnroll,  setCreatedEnroll]  = useState<any>(null);

  /* ── fee structures for selected class ── */
  const [feeStructures,   setFeeStructures]   = useState<any[]>([]);
  const [feesLoading,     setFeesLoading]     = useState(false);
  const [selectedFees,    setSelectedFees]    = useState<Set<number>>(new Set());
  const [assigningFees,   setAssigningFees]   = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleClassChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const class_id = e.target.value;
    setEnrollment({ ...enrollment, class_id, section_id: "" });
    setSections([]);
    if (!class_id) return;
    try {
      setSectionsLoading(true);
      const res = await apiRequest<{ data: any[] }>(`/classes/${class_id}/sections`);
      setSections(res.data || []);
    } catch { setSections([]); }
    finally { setSectionsLoading(false); }
  };

  /* ── Step 1: create student + enrollment ── */
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.admission_number || !form.full_name || !form.password || !form.date_of_birth || !form.admission_date) {
      dispatch(showToast({ type: "error", title: "Missing Fields", message: "Please fill all required student fields." }));
      return;
    }
    if (!form.guardian_name || !form.guardian_phone || !form.guardian_relation) {
      dispatch(showToast({ type: "error", title: "Missing Fields", message: "Guardian name, phone and relation are required." }));
      return;
    }
    if (!enrollment.class_id || !enrollment.section_id) {
      dispatch(showToast({ type: "error", title: "Missing Fields", message: "Please select a class and section." }));
      return;
    }
    if (!activeYear?.id) {
      dispatch(showToast({ type: "error", title: "No Active Year", message: "No active academic year found." }));
      return;
    }

    setIsSubmitting(true);
    try {
      /* 1. Create student */
      const studentPayload = {
        ...form,
        email:               form.email               || undefined,
        phone:               form.phone               || undefined,
        blood_group:         form.blood_group         || undefined,
        city:                form.city                || undefined,
        state:               form.state               || undefined,
        country:             form.country             || undefined,
        guardian_email:      form.guardian_email      || undefined,
        scholarship_type:    form.scholarship_type    || undefined,
        scholarship_percent: form.scholarship_percent
          ? parseFloat(form.scholarship_percent) : undefined,
        scholarship_remarks: form.scholarship_remarks || undefined,
      };

      const studentRes = await apiRequest<{ data: any }>("/students", {
        method: "POST",
        body:   JSON.stringify(studentPayload),
      });
      const student = studentRes.data;
      if (!student?.id) throw new Error("Could not create student.");

      /* 2. Enroll student */
      const enrollRes = await apiRequest<{ data: any }>("/students/enrollments", {
        method: "POST",
        body:   JSON.stringify({
          student_id:       student.id,
          academic_year_id: activeYear.id,
          class_id:         Number(enrollment.class_id),
          section_id:       Number(enrollment.section_id),
          roll_number:      enrollment.roll_number || undefined,
          stream:           enrollment.stream,
          status:           "active",
        }),
      });
      const enroll = enrollRes.data;

      setCreatedStudent(student);
      setCreatedEnroll(enroll);

      /* 3. Load fee structures for the selected class */
      setFeesLoading(true);
      try {
        const feeRes = await apiRequest<{ data: any[] }>(
          `/fees/structures?class_id=${enrollment.class_id}&academic_year_id=${activeYear.id}`
        );
        const structures = feeRes.data || [];
        setFeeStructures(structures);
        // Pre-select all fee structures by default
        setSelectedFees(new Set(structures.map((f: any) => f.id)));
      } catch { setFeeStructures([]); }
      finally { setFeesLoading(false); }

      setStep("fees");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not save student." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Step 2: assign selected fee structures ── */
  const handleAssignFees = async () => {
    if (!createdStudent || !createdEnroll) return;
    setAssigningFees(true);
    let anyError = false;
    try {
      for (const feeId of selectedFees) {
        const structure = feeStructures.find(f => f.id === feeId);
        if (!structure) continue;
        try {
          // Calculate due_date from structure rules
          const today = new Date();
          const dueDate = structure.due_date_type === 'fixed_day' && structure.due_day
            ? new Date(today.getFullYear(), today.getMonth(), structure.due_day)
            : new Date(form.admission_date || today);

          await apiRequest("/fees/collections", {
            method: "POST",
            body:   JSON.stringify({
              student_id:       createdStudent.id,
              enrollment_id:    createdEnroll.id,
              fee_structure_id: feeId,
              academic_year_id: activeYear.id,
              fee_name:         structure.fee_name,
              due_date:         dueDate.toISOString().split('T')[0],
              total_amount:     structure.amount,
            }),
          });
        } catch (feeErr: any) {
          anyError = true;
          console.error(`Failed to assign fee ${feeId}:`, feeErr.message);
        }
      }
      if (anyError) {
        dispatch(showToast({ type: "error", title: "Partial", message: "Some fees could not be assigned. You can add them manually from Fee Management." }));
      } else {
        dispatch(showToast({ type: "success", title: "Done", message: "Student admitted and fees assigned successfully." }));
      }
    } finally {
      setAssigningFees(false);
      setStep("done");
    }
  };

  const handleSkipFees = () => {
    dispatch(showToast({ type: "success", title: "Student Created", message: "Fees can be assigned later from Fee Management." }));
    setStep("done");
  };

  const toggleFee = (id: number) => {
    setSelectedFees(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /* ── Step indicator ── */
  const steps = [
    { key: "details", label: "Student Details" },
    { key: "fees",    label: "Assign Fees"     },
    { key: "done",    label: "Complete"         },
  ];
  const stepIdx = steps.findIndex(s => s.key === step);

  return (
    <>
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
        {steps.map((st, i) => (
          <div key={st.key} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: i < stepIdx ? "#15803d" : i === stepIdx ? "#ff9b51" : "#eaecef",
                color: i <= stepIdx ? "#fff" : "#6b7b86",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 900,
              }}>
                {i < stepIdx ? <i className="fa-solid fa-check" /> : i + 1}
              </div>
              <span style={{ fontSize: 13, fontWeight: 900, color: i === stepIdx ? "#ff9b51" : i < stepIdx ? "#15803d" : "#6b7b86", whiteSpace: "nowrap" }}>
                {st.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < stepIdx ? "#15803d" : "#eaecef", margin: "0 12px" }} />
            )}
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: Student Details ═══ */}
      {step === "details" && (
        <form onSubmit={handleSaveDetails}>
          <section className={s("form-grid")}>
            {/* Personal info */}
            <article className={s("panel")}>
              <div className={s("panel-head")}>
                <div>
                  <h2>Personal Information</h2>
                  <p className={s("muted")}>Basic details of the student</p>
                </div>
              </div>
              <div className={s("form-body")}>
                <div className={s("field-row")}>
                  <label className={s("field")}>
                    <span>Admission Number *</span>
                    <input name="admission_number" required value={form.admission_number} onChange={handleChange} placeholder="e.g. 2082-001" />
                  </label>
                  <label className={s("field")}>
                    <span>Full Name *</span>
                    <input name="full_name" required value={form.full_name} onChange={handleChange} placeholder="e.g. Ram Sharma" />
                  </label>
                </div>
                <div className={s("field-row")}>
                  <label className={s("field")}>
                    <span>Gender</span>
                    <select name="gender" value={form.gender} onChange={handleChange}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className={s("field")}>
                    <span>Date of Birth *</span>
                    <input name="date_of_birth" required type="date" value={form.date_of_birth} onChange={handleChange} />
                  </label>
                </div>
                <div className={s("field-row")}>
                  <label className={s("field")}>
                    <span>Blood Group</span>
                    <select name="blood_group" value={form.blood_group} onChange={handleChange}>
                      <option value="">Select</option>
                      {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </label>
                  <label className={s("field")}>
                    <span>Nationality</span>
                    <input name="nationality" value={form.nationality} onChange={handleChange} />
                  </label>
                </div>
                <div className={s("field-row")}>
                  <label className={s("field")}>
                    <span>Email</span>
                    <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="optional@email.com" />
                  </label>
                  <label className={s("field")}>
                    <span>Phone</span>
                    <input name="phone" type="tel" value={form.phone} onChange={handleChange} />
                  </label>
                </div>
                <label className={s("field")}>
                  <span>Login Password *</span>
                  <input name="password" required type="password" value={form.password} onChange={handleChange} placeholder="Used for student portal login" />
                </label>
                <div className={s("field-row")}>
                  <label className={s("field")}>
                    <span>City</span>
                    <input name="city" value={form.city} onChange={handleChange} />
                  </label>
                  <label className={s("field")}>
                    <span>State</span>
                    <input name="state" value={form.state} onChange={handleChange} />
                  </label>
                </div>
                <div className={s("field-row")}>
                  <label className={s("field")}>
                    <span>Country</span>
                    <input name="country" value={form.country} onChange={handleChange} />
                  </label>
                  <label className={s("field")}>
                    <span>Admission Date *</span>
                    <input name="admission_date" required type="date" value={form.admission_date} onChange={handleChange} />
                  </label>
                </div>
              </div>
            </article>

            {/* Guardian + Enrollment */}
            <article className={s("panel")}>
              <div className={s("panel-head")}>
                <div>
                  <h2>Guardian & Enrollment</h2>
                  <p className={s("muted")}>Guardian details and class assignment</p>
                </div>
              </div>
              <div className={s("form-body")}>
                <label className={s("field")}>
                  <span>Guardian Name *</span>
                  <input name="guardian_name" required value={form.guardian_name} onChange={handleChange} />
                </label>
                <div className={s("field-row")}>
                  <label className={s("field")}>
                    <span>Guardian Phone *</span>
                    <input name="guardian_phone" required type="tel" value={form.guardian_phone} onChange={handleChange} />
                  </label>
                  <label className={s("field")}>
                    <span>Relation *</span>
                    <select name="guardian_relation" value={form.guardian_relation} onChange={handleChange}>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                </div>
                <label className={s("field")}>
                  <span>Guardian Email</span>
                  <input name="guardian_email" type="email" value={form.guardian_email} onChange={handleChange} placeholder="Optional" />
                </label>

                <div style={{ paddingTop: 4, borderTop: "1px solid #eef2f3" }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", marginBottom: 8 }}>
                    <i className="fa-solid fa-graduation-cap" style={{ marginRight: 6, color: "#ff9b51" }} />
                    Scholarship (optional)
                  </p>
                  <div className={s("field-row")}>
                    <label className={s("field")}>
                      <span>Scholarship Type</span>
                      <select name="scholarship_type" value={form.scholarship_type} onChange={handleChange}>
                        <option value="">None</option>
                        <option value="merit">Merit</option>
                        <option value="need_based">Need Based</option>
                        <option value="sports">Sports</option>
                        <option value="staff_child">Staff Child</option>
                        <option value="government">Government</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    <label className={s("field")}>
                      <span>Scholarship %</span>
                      <input
                        name="scholarship_percent"
                        type="number" min="0" max="100" step="0.01"
                        value={form.scholarship_percent}
                        onChange={handleChange}
                        placeholder="e.g. 25"
                        disabled={!form.scholarship_type}
                      />
                    </label>
                  </div>
                </div>

                <div style={{ paddingTop: 4, borderTop: "1px solid #eef2f3" }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", marginBottom: 8 }}>
                    <i className="fa-solid fa-school" style={{ marginRight: 6, color: "#ff9b51" }} />
                    Class & Section *
                  </p>
                  <div className={s("field-row")}>
                    <label className={s("field")}>
                      <span>Class *</span>
                      <select value={enrollment.class_id} onChange={handleClassChange}>
                        <option value="">Select class</option>
                        {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className={s("field")}>
                      <span>Section *</span>
                      <select
                        value={enrollment.section_id}
                        onChange={e => setEnrollment({ ...enrollment, section_id: e.target.value })}
                        disabled={!enrollment.class_id || sectionsLoading}
                      >
                        <option value="">{sectionsLoading ? "Loading…" : "Select section"}</option>
                        {sections.map(sec => <option key={sec.id} value={sec.id}>Section {sec.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className={s("field-row")} style={{ marginTop: 8 }}>
                    <label className={s("field")}>
                      <span>Roll Number</span>
                      <input value={enrollment.roll_number} onChange={e => setEnrollment({ ...enrollment, roll_number: e.target.value })} placeholder="Optional" />
                    </label>
                    <label className={s("field")}>
                      <span>Stream</span>
                      <select value={enrollment.stream} onChange={e => setEnrollment({ ...enrollment, stream: e.target.value })}>
                        <option value="not_applicable">Not Applicable</option>
                        <option value="science">Science</option>
                        <option value="commerce">Commerce</option>
                        <option value="arts">Arts</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <div className={s("form-actions")} style={{ marginTop: "1.5rem", padding: "1rem 0", borderTop: "1px solid #eee" }}>
            <Link className={s("btn")} href="/students">Cancel</Link>
            <button type="submit" className={cx(s("btn"), s("btn-primary"))} disabled={isSubmitting}>
              {isSubmitting ? <><Spinner size={16} /> Saving…</> : <>Next: Assign Fees <i className="fa-solid fa-arrow-right" /></>}
            </button>
          </div>
        </form>
      )}

      {/* ═══ STEP 2: Fee Assignment ═══ */}
      {step === "fees" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Student summary */}
          <div style={{
            padding: "16px 20px", borderRadius: 12, background: "#fff",
            border: "1px solid rgba(191,201,209,0.7)", display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 2px 12px rgba(37,52,63,0.08)",
          }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: "#ff9b51", color: "#25343f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, flexShrink: 0 }}>
              {form.full_name.charAt(0)}
            </div>
            <div>
              <strong style={{ fontSize: 15, fontWeight: 900 }}>{form.full_name}</strong>
              <p style={{ fontSize: 12, color: "#6b7b86", fontWeight: 700, marginTop: 2 }}>
                {classes?.find(c => c.id.toString() === enrollment.class_id)?.name} · Section {sections.find(s => s.id.toString() === enrollment.section_id)?.name} · {form.admission_number}
              </p>
            </div>
            <span style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 900 }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: 5 }} />Student Created
            </span>
          </div>

          {/* Fee structures */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(191,201,209,0.7)", overflow: "hidden", boxShadow: "0 2px 12px rgba(37,52,63,0.08)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #eef2f3", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Assign Fee Structures</h2>
                <p style={{ fontSize: 12, color: "#6b7b86", fontWeight: 700, marginTop: 3 }}>
                  Select which fees apply to this student. Pre-selected based on class.
                </p>
              </div>
              {feeStructures.length > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setSelectedFees(new Set(feeStructures.map(f => f.id)))}
                    style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d4dde2", background: "#fff", fontSize: 12, fontWeight: 900, cursor: "pointer" }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedFees(new Set())}
                    style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d4dde2", background: "#fff", fontSize: 12, fontWeight: 900, cursor: "pointer" }}
                  >
                    Deselect All
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: "16px 20px" }}>
              {feesLoading ? (
                <div style={{ padding: "2rem", textAlign: "center" }}>
                  <Spinner size={28} color="#ff9b51" />
                </div>
              ) : feeStructures.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#6b7b86" }}>
                  <i className="fa-solid fa-file-invoice-dollar" style={{ fontSize: 28, display: "block", marginBottom: 10, opacity: 0.3 }} />
                  <p style={{ fontWeight: 700, fontSize: 14 }}>No fee structures defined for this class.</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>
                    You can add fee structures from{" "}
                    <Link href="/fees" style={{ color: "#ff9b51", fontWeight: 900 }}>Fee Management</Link>{" "}
                    and assign them later.
                  </p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {feeStructures.map(fee => {
                    const selected = selectedFees.has(fee.id);
                    return (
                      <div
                        key={fee.id}
                        onClick={() => toggleFee(fee.id)}
                        style={{
                          padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                          border: `1.5px solid ${selected ? "#ff9b51" : "#d4dde2"}`,
                          background: selected ? "#fff7ed" : "#f8fafc",
                          display: "flex", alignItems: "center", gap: 14,
                          transition: "all 0.15s",
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          border: `2px solid ${selected ? "#ff9b51" : "#c6d0d7"}`,
                          background: selected ? "#ff9b51" : "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {selected && <i className="fa-solid fa-check" style={{ color: "#fff", fontSize: 10 }} />}
                        </div>

                        {/* Fee info */}
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: 14, fontWeight: 900 }}>{fee.fee_name}</strong>
                          <p style={{ fontSize: 12, color: "#6b7b86", fontWeight: 700, marginTop: 2 }}>
                            <span style={{ textTransform: "capitalize" }}>{fee.frequency}</span>
                            {fee.due_date_type === "fixed_day" && fee.due_day
                              ? ` · Due on day ${fee.due_day} of month`
                              : " · Due on admission date"}
                          </p>
                        </div>

                        {/* Amount */}
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <strong style={{ fontSize: 18, fontWeight: 900, color: selected ? "#c2410c" : "#25343f" }}>
                            ₹{Number(fee.amount).toLocaleString()}
                          </strong>
                          <p style={{ fontSize: 11, color: "#6b7b86", fontWeight: 700, marginTop: 1, textTransform: "capitalize" }}>
                            {fee.frequency}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total summary */}
              {selectedFees.size > 0 && (
                <div style={{
                  marginTop: 14, padding: "12px 16px", borderRadius: 10,
                  background: "#fff7ed", border: "1px solid #fed7aa",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#92400e" }}>
                    {selectedFees.size} fee structure{selectedFees.size !== 1 ? "s" : ""} selected
                  </span>
                  <strong style={{ fontSize: 18, fontWeight: 900, color: "#c2410c" }}>
                    Total: ₹{feeStructures
                      .filter(f => selectedFees.has(f.id))
                      .reduce((sum, f) => sum + Number(f.amount), 0)
                      .toLocaleString()}
                  </strong>
                </div>
              )}
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid #eef2f3", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={handleSkipFees}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
              >
                Skip for now
              </button>
              <button
                onClick={handleAssignFees}
                disabled={assigningFees || selectedFees.size === 0}
                className={cx(s("btn"), s("btn-primary"))}
              >
                {assigningFees
                  ? <><Spinner size={14} /> Assigning…</>
                  : <><i className="fa-solid fa-check" /> Assign {selectedFees.size} Fee{selectedFees.size !== 1 ? "s" : ""}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Done ═══ */}
      {step === "done" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4rem 2rem", gap: 20, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: 36, color: "#15803d" }} />
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Student Admitted Successfully!</h2>
            <p style={{ color: "#6b7b86", fontWeight: 700, marginTop: 6 }}>
              {form.full_name} has been registered and enrolled.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              className={cx(s("btn"), s("btn-primary"))}
              href={createdStudent?.id ? `/students/profile?id=${createdStudent.id}` : "/students"}
            >
              <i className="fa-solid fa-user" /> View Profile
            </Link>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/students/add">
              <i className="fa-solid fa-plus" /> Add Another Student
            </Link>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/students">
              <i className="fa-solid fa-list" /> Back to Students
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
