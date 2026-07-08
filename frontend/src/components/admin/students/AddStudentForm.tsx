"use client";

import { useState, useRef } from "react";
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

interface MiscItem {
  id:     number;
  name:   string;
  qty:    number;
  price:  number;
}

// ── How many billing periods between admission and year end ──────────────────
function calcBillingPeriods(
  frequency: string,
  admissionDate: string,
  yearEndDate: string
): number {
  if (!admissionDate || !yearEndDate) return 1;

  const start = new Date(admissionDate);
  const end   = new Date(yearEndDate);
  if (end < start) return 1;

  const totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) + 1;

  switch (frequency) {
    case "monthly":     return Math.max(1, totalMonths);
    case "quarterly":   return Math.max(1, Math.ceil(totalMonths / 3));
    case "half_yearly": return Math.max(1, Math.ceil(totalMonths / 6));
    case "yearly":
    case "one_time":
    default:            return 1;
  }
}

function calcFeeTotal(
  structure: any,
  admissionDate: string,
  yearEndDate: string
): number {
  const periods = calcBillingPeriods(structure.frequency, admissionDate, yearEndDate);
  return Math.round(Number(structure.amount) * periods * 100) / 100;
}

const FREQ_LABEL: Record<string, string> = {
  monthly:     "/month",
  quarterly:   "/quarter",
  half_yearly: "/half-year",
  yearly:      "/year",
  one_time:    "one-time",
};

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
    religion: "", ethnicity: "", previous_school: "",
    city: "", state: "", country: "", admission_date: "",
    disability: false, disability_description: "",
    guardian_name: "", guardian_phone: "", guardian_relation: "Father",
    guardian_email: "", guardian_occupation: "", guardian_address: "",
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

  /* ── photo upload ── */
  const photoInputRef  = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview]  = useState<string | null>(null);
  const [photoFile,    setPhotoFile]     = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);

  /* ── fee structures ── */
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [feesLoading,   setFeesLoading]   = useState(false);
  const [selectedFees,  setSelectedFees]  = useState<Set<number>>(new Set());
  const [assigningFees, setAssigningFees] = useState(false);

  /* ── miscellaneous items ── */
  const [miscItems,   setMiscItems]   = useState<MiscItem[]>([]);
  const [miscIdSeed,  setMiscIdSeed]  = useState(1);

  const scholarshipPct = form.scholarship_percent ? parseFloat(form.scholarship_percent) : null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleDisabilityToggle = () =>
    setForm(prev => ({ ...prev, disability: !prev.disability, disability_description: "" }));

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

  /* ── Photo file pick ── */
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      dispatch(showToast({ type: "error", title: "Invalid File", message: "Only JPEG, PNG or WebP images are allowed." }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      dispatch(showToast({ type: "error", title: "File Too Large", message: "Photo must be under 2 MB." }));
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  /* ── Upload photo after student is created ── */
  const uploadPhoto = async (studentId: number) => {
    if (!photoFile) return null;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      const res = await apiRequest<{ url: string }>(`/upload/student-photo/${studentId}`, {
        method: "POST",
        body:   fd,
        // don't set Content-Type — let browser set multipart boundary
      });
      const url = (res as any)?.url || (res as any)?.data?.url || null;
      if (url) setUploadedPhotoUrl(url);
      return url;
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Photo Upload Failed", message: err.message || "Could not upload photo. You can add it later from the student profile." }));
      return null;
    } finally {
      setPhotoUploading(false);
    }
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
      const studentPayload: Record<string, any> = {
        admission_number:   form.admission_number,
        full_name:          form.full_name,
        password:           form.password,
        gender:             form.gender,
        date_of_birth:      form.date_of_birth,
        admission_date:     form.admission_date,
        nationality:        form.nationality || undefined,
        status:             form.status,
        guardian_name:      form.guardian_name,
        guardian_phone:     form.guardian_phone,
        guardian_relation:  form.guardian_relation,
        disability:         form.disability,
        // optional strings — omit if empty
        email:                     form.email                    || undefined,
        phone:                     form.phone                    || undefined,
        blood_group:               form.blood_group              || undefined,
        city:                      form.city                     || undefined,
        state:                     form.state                    || undefined,
        country:                   form.country                  || undefined,
        religion:                  form.religion                 || undefined,
        ethnicity:                 form.ethnicity                || undefined,
        previous_school:           form.previous_school          || undefined,
        disability_description:    form.disability && form.disability_description
                                     ? form.disability_description : undefined,
        guardian_email:            form.guardian_email           || undefined,
        guardian_occupation:       form.guardian_occupation      || undefined,
        guardian_address:          form.guardian_address         || undefined,
        scholarship_type:          form.scholarship_type         || undefined,
        scholarship_percent:       scholarshipPct                ?? undefined,
        scholarship_remarks:       form.scholarship_remarks      || undefined,
      };

      const studentRes = await apiRequest<{ data: any }>("/students", {
        method: "POST",
        body: JSON.stringify(studentPayload),
      });
      const student = studentRes.data;
      if (!student?.id) throw new Error("Could not create student.");

      const enrollRes = await apiRequest<{ data: any }>("/students/enrollments", {
        method: "POST",
        body: JSON.stringify({
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

      // Upload photo now that we have the student id
      if (photoFile) {
        await uploadPhoto(student.id);
      }

      setFeesLoading(true);
      try {
        const feeRes = await apiRequest<{ data: any[] }>(
          `/fees/structures?class_id=${enrollment.class_id}&academic_year_id=${activeYear.id}`
        );
        const structures = feeRes.data || [];
        setFeeStructures(structures);
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

  /* ── Step 2: assign fees + misc ── */
  const handleAssignFees = async () => {
    if (!createdStudent || !createdEnroll) return;
    setAssigningFees(true);
    let anyError = false;
    try {
      const yearEnd = activeYear?.end_date?.split("T")[0] || activeYear?.end_date || "";

      for (const feeId of selectedFees) {
        const structure = feeStructures.find(f => f.id === feeId);
        if (!structure) continue;
        try {
          const grossTotal  = calcFeeTotal(structure, form.admission_date, yearEnd);
          const discountAmt = scholarshipPct
            ? Math.round(grossTotal * (scholarshipPct / 100) * 100) / 100
            : 0;
          const today   = new Date();
          const dueDate = structure.due_date_type === "fixed_day" && structure.due_day
            ? new Date(today.getFullYear(), today.getMonth(), structure.due_day)
            : new Date(form.admission_date);

          await apiRequest("/fees/collections", {
            method: "POST",
            body: JSON.stringify({
              student_id:       createdStudent.id,
              enrollment_id:    createdEnroll.id,
              fee_structure_id: feeId,
              academic_year_id: activeYear.id,
              due_date:         dueDate.toISOString().split("T")[0],
              total_amount:     grossTotal,
              ...(discountAmt > 0 ? {
                discount_amount: discountAmt,
                discount_reason: `${form.scholarship_type || "Scholarship"} (${scholarshipPct}%)`,
              } : {}),
            }),
          });
        } catch (feeErr: any) {
          anyError = true;
          console.error(`Fee ${feeId}:`, feeErr.message);
        }
      }

      for (const item of miscItems) {
        if (!item.name.trim() || !item.price || item.qty < 1) continue;
        try {
          const itemTotal   = Math.round(item.price * item.qty * 100) / 100;
          const discountAmt = scholarshipPct
            ? Math.round(itemTotal * (scholarshipPct / 100) * 100) / 100
            : 0;

          await apiRequest("/fees/collections", {
            method: "POST",
            body: JSON.stringify({
              student_id:       createdStudent.id,
              enrollment_id:    createdEnroll.id,
              fee_structure_id: null,
              academic_year_id: activeYear.id,
              due_date:         form.admission_date || new Date().toISOString().split("T")[0],
              total_amount:     itemTotal,
              ...(discountAmt > 0 ? {
                discount_amount: discountAmt,
                discount_reason: `${form.scholarship_type || "Scholarship"} (${scholarshipPct}%)`,
              } : {}),
            }),
          });
        } catch (err: any) {
          anyError = true;
          console.error(`Misc item "${item.name}":`, err.message);
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

  const addMiscItem = () => {
    setMiscItems(prev => [...prev, { id: miscIdSeed, name: "", qty: 1, price: 0 }]);
    setMiscIdSeed(n => n + 1);
  };
  const updateMiscItem = (id: number, field: keyof MiscItem, value: string | number) =>
    setMiscItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  const removeMiscItem = (id: number) =>
    setMiscItems(prev => prev.filter(it => it.id !== id));

  const miscTotal = miscItems.reduce((s, it) => s + it.price * it.qty, 0);

  const yearEnd            = activeYear?.end_date?.split("T")[0] || activeYear?.end_date || "";
  const selectedStructures = feeStructures.filter(f => selectedFees.has(f.id));
  const feeGrossTotal      = selectedStructures.reduce((s, f) => s + calcFeeTotal(f, form.admission_date, yearEnd), 0);
  const feeDiscountTot     = scholarshipPct
    ? Math.round(feeGrossTotal * (scholarshipPct / 100) * 100) / 100
    : 0;
  const feeNetTotal        = feeGrossTotal - feeDiscountTot;
  const miscNetTotal       = scholarshipPct
    ? Math.round(miscTotal * (1 - scholarshipPct / 100) * 100) / 100
    : miscTotal;
  const grandNetTotal      = feeNetTotal + miscNetTotal;
  const grandDiscount      = feeDiscountTot + (miscTotal - miscNetTotal);

  /* ── Step indicator ── */
  const steps = [
    { key: "details", label: "Student Details" },
    { key: "fees",    label: "Assign Fees"     },
    { key: "done",    label: "Complete"         },
  ];
  const stepIdx = steps.findIndex(s => s.key === step);

  /* ── shared field style ── */
  const inputStyle: React.CSSProperties = {
    width: "100%", minHeight: 38, border: "1px solid #d4dde2", borderRadius: 7,
    padding: "0 10px", fontSize: 13, fontWeight: 600, outline: "none", fontFamily: "inherit",
    background: "#fff",
  };
  const textareaStyle: React.CSSProperties = {
    ...inputStyle, minHeight: 72, padding: "8px 10px", resize: "vertical",
  };

  return (
    <>
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
        {steps.map((st, i) => (
          <div key={st.key} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: i < stepIdx ? "#15803d" : i === stepIdx ? "#ff9b51" : "#eaecef",
                color: i <= stepIdx ? "#fff" : "#6b7b86",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900,
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

            {/* ── Left panel: Personal Information ── */}
            <article className={s("panel")}>
              <div className={s("panel-head")}>
                <div>
                  <h2>Personal Information</h2>
                  <p className={s("muted")}>Basic details of the student</p>
                </div>
              </div>
              <div className={s("form-body")}>

                {/* Photo upload */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 4 }}>
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    style={{
                      width: 72, height: 72, borderRadius: 12, flexShrink: 0,
                      border: "2px dashed #d4dde2", background: "#f8fafc",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", overflow: "hidden", position: "relative",
                    }}
                  >
                    {photoPreview
                      ? <img src={photoPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <i className="fa-solid fa-camera" style={{ fontSize: 22, color: "#b0bec5" }} />
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: "#25343f", margin: "0 0 4px" }}>Student Photo</p>
                    <p style={{ fontSize: 11, color: "#6b7b86", fontWeight: 600, margin: "0 0 6px" }}>
                      Optional · JPEG / PNG / WebP · max 2 MB
                    </p>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      style={{
                        padding: "5px 12px", borderRadius: 7, border: "1px solid #d4dde2",
                        background: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      <i className="fa-solid fa-upload" style={{ marginRight: 5 }} />
                      {photoFile ? "Change Photo" : "Upload Photo"}
                    </button>
                    {photoFile && (
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                        style={{ marginLeft: 8, padding: "5px 10px", borderRadius: 7, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b42318", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handlePhotoChange} />
                </div>

                <div className={s("field-row")}>
                  <label className={s("field")}><span>Admission Number *</span><input name="admission_number" required value={form.admission_number} onChange={handleChange} placeholder="e.g. 2082-001" /></label>
                  <label className={s("field")}><span>Full Name *</span><input name="full_name" required value={form.full_name} onChange={handleChange} placeholder="e.g. Ram Sharma" /></label>
                </div>
                <div className={s("field-row")}>
                  <label className={s("field")}><span>Gender</span><select name="gender" value={form.gender} onChange={handleChange}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
                  <label className={s("field")}><span>Date of Birth *</span><input name="date_of_birth" required type="date" value={form.date_of_birth} onChange={handleChange} /></label>
                </div>
                <div className={s("field-row")}>
                  <label className={s("field")}>
                    <span>Blood Group</span>
                    <select name="blood_group" value={form.blood_group} onChange={handleChange}>
                      <option value="">Select</option>
                      {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </label>
                  <label className={s("field")}><span>Nationality</span><input name="nationality" value={form.nationality} onChange={handleChange} /></label>
                </div>
                <div className={s("field-row")}>
                  <label className={s("field")}><span>Religion</span><input name="religion" value={form.religion} onChange={handleChange} placeholder="Optional" /></label>
                  <label className={s("field")}><span>Ethnicity</span><input name="ethnicity" value={form.ethnicity} onChange={handleChange} placeholder="Optional" /></label>
                </div>
                <div className={s("field-row")}>
                  <label className={s("field")}><span>Email</span><input name="email" type="email" value={form.email} onChange={handleChange} placeholder="Optional" /></label>
                  <label className={s("field")}><span>Phone</span><input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="Optional" /></label>
                </div>
                <label className={s("field")}><span>Login Password *</span><input name="password" required type="password" value={form.password} onChange={handleChange} placeholder="Student portal login" /></label>
                <label className={s("field")}><span>Previous School</span><input name="previous_school" value={form.previous_school} onChange={handleChange} placeholder="Optional" /></label>
                <div className={s("field-row")}>
                  <label className={s("field")}><span>City</span><input name="city" value={form.city} onChange={handleChange} /></label>
                  <label className={s("field")}><span>State</span><input name="state" value={form.state} onChange={handleChange} /></label>
                </div>
                <div className={s("field-row")}>
                  <label className={s("field")}><span>Country</span><input name="country" value={form.country} onChange={handleChange} /></label>
                  <label className={s("field")}><span>Admission Date *</span><input name="admission_date" required type="date" value={form.admission_date} onChange={handleChange} /></label>
                </div>

                {/* Disability */}
                <div style={{ padding: "12px 14px", borderRadius: 10, background: form.disability ? "#fff7ed" : "#f8fafc", border: `1px solid ${form.disability ? "#fed7aa" : "#e2e8f0"}`, marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      onClick={handleDisabilityToggle}
                      style={{
                        width: 40, height: 22, borderRadius: 11, cursor: "pointer",
                        background: form.disability ? "#ff9b51" : "#d1d5db",
                        position: "relative", transition: "background 0.2s", flexShrink: 0,
                      }}
                    >
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%", background: "#fff",
                        position: "absolute", top: 3,
                        left: form.disability ? 21 : 3,
                        transition: "left 0.2s",
                      }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#25343f" }}>Student has a disability</span>
                  </div>
                  {form.disability && (
                    <div style={{ marginTop: 10 }}>
                      <label className={s("field")}>
                        <span>Disability Description</span>
                        <textarea
                          name="disability_description"
                          value={form.disability_description}
                          onChange={handleChange}
                          placeholder="Describe the disability (e.g. visual impairment, hearing loss, mobility aid required…)"
                          style={textareaStyle}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </article>

            {/* ── Right panel: Guardian, Scholarship, Enrollment ── */}
            <article className={s("panel")}>
              <div className={s("panel-head")}>
                <div>
                  <h2>Guardian & Enrollment</h2>
                  <p className={s("muted")}>Guardian details and class assignment</p>
                </div>
              </div>
              <div className={s("form-body")}>

                {/* Guardian */}
                <label className={s("field")}><span>Guardian Name *</span><input name="guardian_name" required value={form.guardian_name} onChange={handleChange} /></label>
                <div className={s("field-row")}>
                  <label className={s("field")}><span>Guardian Phone *</span><input name="guardian_phone" required type="tel" value={form.guardian_phone} onChange={handleChange} /></label>
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
                <div className={s("field-row")}>
                  <label className={s("field")}><span>Guardian Email</span><input name="guardian_email" type="email" value={form.guardian_email} onChange={handleChange} placeholder="Optional" /></label>
                  <label className={s("field")}><span>Guardian Occupation</span><input name="guardian_occupation" value={form.guardian_occupation} onChange={handleChange} placeholder="Optional" /></label>
                </div>
                <label className={s("field")}>
                  <span>Guardian Address</span>
                  <textarea name="guardian_address" value={form.guardian_address} onChange={handleChange} placeholder="Optional" style={textareaStyle} />
                </label>

                {/* Scholarship */}
                <div style={{ paddingTop: 12, borderTop: "1px solid #eef2f3" }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", marginBottom: 8 }}>
                    <i className="fa-solid fa-graduation-cap" style={{ marginRight: 6, color: "#ff9b51" }} />
                    Scholarship (optional — applies discount to all assigned fees)
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
                  {form.scholarship_type && (
                    <label className={s("field")} style={{ marginTop: 6 }}>
                      <span>Scholarship Remarks</span>
                      <textarea name="scholarship_remarks" value={form.scholarship_remarks} onChange={handleChange} placeholder="Optional notes on scholarship terms" style={textareaStyle} />
                    </label>
                  )}
                  {scholarshipPct && scholarshipPct > 0 && (
                    <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "#dcfce7", border: "1px solid #bbf7d0", fontSize: 12, fontWeight: 700, color: "#15803d" }}>
                      <i className="fa-solid fa-tag" style={{ marginRight: 6 }} />
                      {scholarshipPct}% discount will be auto-applied to all fee collections
                    </div>
                  )}
                </div>

                {/* Class & Section */}
                <div style={{ paddingTop: 12, borderTop: "1px solid #eef2f3" }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", marginBottom: 8 }}>
                    <i className="fa-solid fa-school" style={{ marginRight: 6, color: "#ff9b51" }} />Class & Section *
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
                    <label className={s("field")}><span>Roll Number</span><input value={enrollment.roll_number} onChange={e => setEnrollment({ ...enrollment, roll_number: e.target.value })} placeholder="Optional" /></label>
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
              {isSubmitting
                ? <><Spinner size={16} /> {photoFile ? "Saving & Uploading Photo…" : "Saving…"}</>
                : <>Next: Assign Fees <i className="fa-solid fa-arrow-right" /></>}
            </button>
          </div>
        </form>
      )}

      {/* ═══ STEP 2: Fee Assignment ═══ */}
      {step === "fees" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Student summary */}
          <div style={{ padding: "16px 20px", borderRadius: 12, background: "#fff", border: "1px solid rgba(191,201,209,0.7)", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px rgba(37,52,63,0.08)" }}>
            {/* Avatar / photo */}
            <div style={{
              width: 52, height: 52, borderRadius: 12, flexShrink: 0, overflow: "hidden",
              background: "#ff9b51", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {uploadedPhotoUrl || photoPreview
                ? <img src={uploadedPhotoUrl || photoPreview!} alt={form.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 18, fontWeight: 900, color: "#25343f" }}>{form.full_name.charAt(0)}</span>
              }
            </div>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 15, fontWeight: 900 }}>{form.full_name}</strong>
              <p style={{ fontSize: 12, color: "#6b7b86", fontWeight: 700, marginTop: 2 }}>
                {classes?.find(c => c.id.toString() === enrollment.class_id)?.name} · Section {sections.find(sec => sec.id.toString() === enrollment.section_id)?.name} · {form.admission_number}
                {form.admission_date && (
                  <span style={{ marginLeft: 8 }}>
                    · Admission: {new Date(form.admission_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
              <span style={{ padding: "4px 12px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 900 }}>
                <i className="fa-solid fa-circle-check" style={{ marginRight: 5 }} />Student Created
              </span>
              {uploadedPhotoUrl && (
                <span style={{ padding: "4px 12px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 12, fontWeight: 900 }}>
                  <i className="fa-solid fa-image" style={{ marginRight: 5 }} />Photo Uploaded
                </span>
              )}
              {scholarshipPct && scholarshipPct > 0 && (
                <span style={{ padding: "4px 12px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 12, fontWeight: 900 }}>
                  <i className="fa-solid fa-tag" style={{ marginRight: 5 }} />
                  {form.scholarship_type || "Scholarship"} {scholarshipPct}%
                </span>
              )}
            </div>
          </div>

          {/* Pro-ration info */}
          {form.admission_date && activeYear?.end_date && (
            <div style={{ padding: "10px 16px", borderRadius: 9, background: "#f0f9ff", border: "1px solid #bae6fd", fontSize: 12, fontWeight: 700, color: "#0284c7", display: "flex", alignItems: "center", gap: 8 }}>
              <i className="fa-solid fa-calendar-days" />
              Monthly fees are calculated from <strong style={{ marginLeft: 4 }}>{new Date(form.admission_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</strong>&nbsp;to&nbsp;<strong>{new Date(activeYear.end_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</strong>
              &nbsp;({calcBillingPeriods("monthly", form.admission_date, yearEnd)} month{calcBillingPeriods("monthly", form.admission_date, yearEnd) !== 1 ? "s" : ""} remaining)
            </div>
          )}

          {/* Fee structures */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(191,201,209,0.7)", overflow: "hidden", boxShadow: "0 2px 12px rgba(37,52,63,0.08)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #eef2f3", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Assign Fee Structures</h2>
                <p style={{ fontSize: 12, color: "#6b7b86", fontWeight: 700, marginTop: 3 }}>
                  Monthly fees auto-calculated for remaining months. Scholarship discount applied automatically.
                </p>
              </div>
              {feeStructures.length > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setSelectedFees(new Set(feeStructures.map(f => f.id)))} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d4dde2", background: "#fff", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>Select All</button>
                  <button onClick={() => setSelectedFees(new Set())} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d4dde2", background: "#fff", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>Deselect All</button>
                </div>
              )}
            </div>

            <div style={{ padding: "16px 20px" }}>
              {feesLoading ? (
                <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={28} color="#ff9b51" /></div>
              ) : feeStructures.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#6b7b86" }}>
                  <i className="fa-solid fa-file-invoice-dollar" style={{ fontSize: 28, display: "block", marginBottom: 10, opacity: 0.3 }} />
                  <p style={{ fontWeight: 700, fontSize: 14 }}>No fee structures defined for this class.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {feeStructures.map(fee => {
                    const selected    = selectedFees.has(fee.id);
                    const grossTotal  = calcFeeTotal(fee, form.admission_date, yearEnd);
                    const discountAmt = scholarshipPct ? Math.round(grossTotal * (scholarshipPct / 100) * 100) / 100 : 0;
                    const netTotal    = grossTotal - discountAmt;
                    const periods     = calcBillingPeriods(fee.frequency, form.admission_date, yearEnd);
                    const isMulti     = periods > 1;

                    return (
                      <div
                        key={fee.id}
                        onClick={() => toggleFee(fee.id)}
                        style={{ padding: "14px 16px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${selected ? "#ff9b51" : "#d4dde2"}`, background: selected ? "#fff7ed" : "#f8fafc", display: "flex", alignItems: "flex-start", gap: 14, transition: "all 0.15s" }}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2, border: `2px solid ${selected ? "#ff9b51" : "#c6d0d7"}`, background: selected ? "#ff9b51" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {selected && <i className="fa-solid fa-check" style={{ color: "#fff", fontSize: 10 }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: 14, fontWeight: 900 }}>{fee.fee_name}</strong>
                          <p style={{ fontSize: 12, color: "#6b7b86", fontWeight: 700, marginTop: 2 }}>
                            <span style={{ textTransform: "capitalize" }}>{fee.frequency}</span>
                            {fee.due_date_type === "fixed_day" && fee.due_day
                              ? ` · Due on day ${fee.due_day} of month`
                              : " · Due on admission date"}
                          </p>
                          {isMulti && (
                            <p style={{ fontSize: 11, color: "#6b7b86", fontWeight: 700, marginTop: 3 }}>
                              ₹{Number(fee.amount).toLocaleString()}{FREQ_LABEL[fee.frequency]} × {periods} {fee.frequency === "monthly" ? "months" : fee.frequency === "quarterly" ? "quarters" : "periods"} = ₹{grossTotal.toLocaleString()}
                            </p>
                          )}
                          {discountAmt > 0 && selected && (
                            <p style={{ fontSize: 11, color: "#15803d", fontWeight: 800, marginTop: 3 }}>
                              <i className="fa-solid fa-tag" style={{ marginRight: 4 }} />
                              Scholarship {scholarshipPct}% → −₹{discountAmt.toLocaleString()} discount
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {discountAmt > 0 ? (
                            <>
                              <div style={{ fontSize: 12, color: "#94a3b8", textDecoration: "line-through", fontWeight: 700 }}>₹{grossTotal.toLocaleString()}</div>
                              <strong style={{ fontSize: 18, fontWeight: 900, color: selected ? "#15803d" : "#25343f" }}>₹{netTotal.toLocaleString()}</strong>
                            </>
                          ) : (
                            <strong style={{ fontSize: 18, fontWeight: 900, color: selected ? "#c2410c" : "#25343f" }}>₹{grossTotal.toLocaleString()}</strong>
                          )}
                          <p style={{ fontSize: 11, color: "#6b7b86", fontWeight: 700, marginTop: 1, textTransform: "capitalize" }}>
                            {isMulti ? `${periods}× ${fee.frequency}` : fee.frequency}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Miscellaneous items */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(191,201,209,0.7)", overflow: "hidden", boxShadow: "0 2px 12px rgba(37,52,63,0.08)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #eef2f3", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
                  <i className="fa-solid fa-shirt" style={{ color: "#ff9b51", marginRight: 8 }} />
                  School Store / Miscellaneous
                </h2>
                <p style={{ fontSize: 12, color: "#6b7b86", fontWeight: 700, marginTop: 3 }}>
                  Add one-time charges for dress, tie, belt, books, ID card, etc.
                </p>
              </div>
              <button
                onClick={addMiscItem}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #ff9b51", background: "#fff7ed", color: "#c2410c", fontWeight: 900, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}
              >
                <i className="fa-solid fa-plus" /> Add Item
              </button>
            </div>

            <div style={{ padding: miscItems.length ? "12px 20px 0" : "0 20px" }}>
              {miscItems.length === 0 ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
                  <i className="fa-solid fa-bag-shopping" style={{ fontSize: 22, display: "block", marginBottom: 8, opacity: 0.35 }} />
                  No items added. Click "Add Item" to charge for school store items.
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 120px 80px auto", gap: 10, padding: "0 4px 6px", borderBottom: "1px solid #eef2f3" }}>
                    {["Item Name","Qty","Unit Price (₹)","",""].map((h, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 900, color: "#6a7882", textTransform: "uppercase" }}>{h}</span>
                    ))}
                  </div>
                  {miscItems.map(item => {
                    const lineGross = item.price * item.qty;
                    const lineDisc  = scholarshipPct ? Math.round(lineGross * (scholarshipPct / 100) * 100) / 100 : 0;
                    return (
                      <div key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 120px 80px auto", gap: 10, padding: "10px 4px", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
                        <input value={item.name} onChange={e => updateMiscItem(item.id, "name", e.target.value)} placeholder="e.g. School Dress" style={{ minHeight: 36, border: "1px solid #d4dde2", borderRadius: 7, padding: "0 10px", fontSize: 13, fontWeight: 700, outline: "none", fontFamily: "inherit" }} />
                        <input type="number" min="1" value={item.qty} onChange={e => updateMiscItem(item.id, "qty", Math.max(1, parseInt(e.target.value) || 1))} style={{ minHeight: 36, border: "1px solid #d4dde2", borderRadius: 7, padding: "0 10px", fontSize: 13, fontWeight: 700, outline: "none", textAlign: "center", fontFamily: "inherit" }} />
                        <input type="number" min="0" step="0.01" value={item.price || ""} onChange={e => updateMiscItem(item.id, "price", parseFloat(e.target.value) || 0)} placeholder="0.00" style={{ minHeight: 36, border: "1px solid #d4dde2", borderRadius: 7, padding: "0 10px", fontSize: 13, fontWeight: 700, outline: "none", fontFamily: "inherit" }} />
                        <div style={{ textAlign: "right" }}>
                          {lineDisc > 0
                            ? <><div style={{ fontSize: 10, color: "#94a3b8", textDecoration: "line-through" }}>₹{lineGross.toLocaleString()}</div><strong style={{ fontSize: 13, color: "#15803d" }}>₹{(lineGross - lineDisc).toLocaleString()}</strong></>
                            : <strong style={{ fontSize: 13 }}>₹{lineGross.toLocaleString()}</strong>}
                        </div>
                        <button onClick={() => removeMiscItem(item.id)} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b42318", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
              {miscItems.length > 0 && (
                <div style={{ padding: "12px 4px", display: "flex", justifyContent: "flex-end", gap: 8, fontSize: 13, fontWeight: 700, color: "#6a7882" }}>
                  <span>Misc subtotal:</span>
                  <strong style={{ color: "#25343f" }}>₹{miscNetTotal.toLocaleString()}</strong>
                  {scholarshipPct && scholarshipPct > 0 && (
                    <span style={{ color: "#15803d", fontSize: 11 }}>(after {scholarshipPct}% discount)</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Grand total */}
          {(selectedFees.size > 0 || miscItems.length > 0) && (
            <div style={{ padding: "16px 20px", borderRadius: 12, background: "#25343f", color: "#eaecef" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "#9db5c2", margin: 0 }}>GROSS TOTAL</p>
                  <strong style={{ fontSize: 20, fontWeight: 900 }}>₹{(feeGrossTotal + miscTotal).toLocaleString()}</strong>
                </div>
                {grandDiscount > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 800, color: "#9db5c2", margin: 0 }}>SCHOLARSHIP DISCOUNT</p>
                    <strong style={{ fontSize: 20, fontWeight: 900, color: "#4ade80" }}>−₹{Math.round(grandDiscount * 100) / 100 .toLocaleString()}</strong>
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "#9db5c2", margin: 0 }}>NET PAYABLE</p>
                  <strong style={{ fontSize: 22, fontWeight: 900, color: "#ff9b51" }}>₹{grandNetTotal.toLocaleString()}</strong>
                </div>
              </div>
              {selectedFees.size > 0 && (
                <p style={{ fontSize: 11, fontWeight: 700, color: "#7a96a6", marginTop: 10 }}>
                  {selectedFees.size} fee structure{selectedFees.size !== 1 ? "s" : ""}
                  {miscItems.filter(i => i.name && i.price > 0).length > 0
                    ? ` + ${miscItems.filter(i => i.name && i.price > 0).length} misc item(s)` : ""}
                </p>
              )}
            </div>
          )}

          <div style={{ padding: "14px 0", borderTop: "1px solid #eef2f3", display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={handleSkipFees} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Skip for now
            </button>
            <button
              onClick={handleAssignFees}
              disabled={assigningFees || (selectedFees.size === 0 && miscItems.length === 0)}
              className={cx(s("btn"), s("btn-primary"))}
            >
              {assigningFees
                ? <><Spinner size={14} /> Assigning…</>
                : <><i className="fa-solid fa-check" /> Assign {selectedFees.size} Fee{selectedFees.size !== 1 ? "s" : ""}{miscItems.filter(i => i.name && i.price > 0).length > 0 ? ` + ${miscItems.filter(i => i.name && i.price > 0).length} Item(s)` : ""}</>}
            </button>
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
            <p style={{ color: "#6b7b86", fontWeight: 700, marginTop: 6 }}>{form.full_name} has been registered and enrolled.</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <Link className={cx(s("btn"), s("btn-primary"))} href={createdStudent?.id ? `/students/profile?id=${createdStudent.id}` : "/students"}>
              <i className="fa-solid fa-user" /> View Profile
            </Link>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/students/add"><i className="fa-solid fa-plus" /> Add Another Student</Link>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/students"><i className="fa-solid fa-list" /> Back to Students</Link>
          </div>
        </div>
      )}
    </>
  );
}
