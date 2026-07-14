"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./students.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import { uploadChunked } from "@/lib/uploadChunked";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

type Tab = "personal" | "guardian" | "enrollment" | "security";

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: "personal",   icon: "fa-user",           label: "Personal"   },
  { key: "guardian",   icon: "fa-people-roof",    label: "Guardian"   },
  { key: "enrollment", icon: "fa-graduation-cap", label: "Enrollment" },
  { key: "security",   icon: "fa-lock",           label: "Security"   },
];

const textareaStyle: React.CSSProperties = {
  width: "100%", minHeight: 72, border: "1px solid #d4dde2", borderRadius: 7,
  padding: "8px 10px", fontSize: 13, fontWeight: 600, outline: "none",
  fontFamily: "inherit", background: "#fff", resize: "vertical",
};

export default function EditStudentForm() {
  const router   = useRouter();
  const params   = useParams();
  const id       = params?.id as string;
  const dispatch = useAppDispatch();

  const [activeTab, setActiveTab] = useState<Tab>("personal");
  const [saving,    setSaving]    = useState(false);
  const [newPass,   setNewPass]   = useState("");
  const [showPass,  setShowPass]  = useState(false);

  const { data: student,     loading }  = useApi<any>(id ? `/students/${id}` : "");
  const { data: enrollments }           = useApi<any[]>(id ? `/students/${id}/enrollments` : "");

  /* ── photo state ── */
  const photoInputRef    = useRef<HTMLInputElement>(null);
  const [photoPreview,   setPhotoPreview]   = useState<string | null>(null);
  const [photoFile,      setPhotoFile]      = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState(0);

  const [form, setForm] = useState({
    full_name:              "",
    email:                  "",
    phone:                  "",
    gender:                 "male",
    date_of_birth:          "",
    blood_group:            "",
    nationality:            "Nepali",
    religion:               "",
    ethnicity:              "",
    previous_school:        "",
    city:                   "",
    state:                  "",
    country:                "",
    admission_date:         "",
    admission_number:       "",
    status:                 "active",
    disability:             false,
    disability_description: "",
    guardian_name:          "",
    guardian_phone:         "",
    guardian_relation:      "Father",
    guardian_email:         "",
    guardian_occupation:    "",
    guardian_address:       "",
    scholarship_type:       "",
    scholarship_percent:    "",
    scholarship_remarks:    "",
  });

  // Populate form once student data arrives
  useEffect(() => {
    if (!student) return;
    setForm({
      full_name:              student.full_name              ?? "",
      email:                  student.email                  ?? "",
      phone:                  student.phone                  ?? "",
      gender:                 student.gender                 ?? "male",
      date_of_birth:          student.date_of_birth
        ? new Date(student.date_of_birth).toISOString().split("T")[0] : "",
      blood_group:            student.blood_group            ?? "",
      nationality:            student.nationality            ?? "Nepali",
      religion:               student.religion               ?? "",
      ethnicity:              student.ethnicity              ?? "",
      previous_school:        student.previous_school        ?? "",
      city:                   student.city                   ?? "",
      state:                  student.state                  ?? "",
      country:                student.country                ?? "",
      admission_date:         student.admission_date
        ? new Date(student.admission_date).toISOString().split("T")[0] : "",
      admission_number:       student.admission_number       ?? "",
      status:                 student.status                 ?? "active",
      disability:             student.disability             ?? false,
      disability_description: student.disability_description ?? "",
      guardian_name:          student.guardian_name          ?? "",
      guardian_phone:         student.guardian_phone         ?? "",
      guardian_relation:      student.guardian_relation      ?? "Father",
      guardian_email:         student.guardian_email         ?? "",
      guardian_occupation:    student.guardian_occupation    ?? "",
      guardian_address:       student.guardian_address       ?? "",
      scholarship_type:       student.scholarship_type       ?? "",
      scholarship_percent:    student.scholarship_percent?.toString() ?? "",
      scholarship_remarks:    student.scholarship_remarks    ?? "",
    });
    // Set existing photo as preview
    if (student.photo) setPhotoPreview(student.photo);
  }, [student]);

  const set = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleDisabilityToggle = () =>
    setForm(f => ({ ...f, disability: !f.disability, disability_description: "" }));

  /* ── Photo handlers ── */
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      dispatch(showToast({ type: "error", title: "Invalid File", message: "Only JPEG, PNG or WebP images are allowed." }));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      dispatch(showToast({ type: "error", title: "File Too Large", message: "Photo must be under 4 MB." }));
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async () => {
    if (!photoFile || !id) return;
    setPhotoUploading(true);
    setUploadProgress(0);
    try {
      const res = await uploadChunked(
        photoFile,
        `/upload/student-photo/${id}/chunk`,
        (pct) => setUploadProgress(pct),
      );
      const url = res?.data?.url || res?.url || null;
      if (url) setPhotoPreview(url);
      dispatch(showToast({ type: "success", title: "Photo Updated", message: "Student photo has been uploaded." }));
      setPhotoFile(null);
      setUploadProgress(0);
      if (photoInputRef.current) photoInputRef.current.value = "";
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Upload Failed", message: err.message || "Could not upload photo." }));
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.full_name || !form.admission_number) {
      dispatch(showToast({ type: "error", title: "Required", message: "Full name and admission number are required." }));
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        blood_group:            form.blood_group            || undefined,
        email:                  form.email                  || undefined,
        phone:                  form.phone                  || undefined,
        city:                   form.city                   || undefined,
        state:                  form.state                  || undefined,
        country:                form.country                || undefined,
        religion:               form.religion               || undefined,
        ethnicity:              form.ethnicity              || undefined,
        previous_school:        form.previous_school        || undefined,
        disability_description: form.disability && form.disability_description
                                  ? form.disability_description : undefined,
        guardian_email:         form.guardian_email         || undefined,
        guardian_occupation:    form.guardian_occupation    || undefined,
        guardian_address:       form.guardian_address       || undefined,
        scholarship_type:       form.scholarship_type       || undefined,
        scholarship_percent:    form.scholarship_percent
                                  ? parseFloat(form.scholarship_percent) : undefined,
        scholarship_remarks:    form.scholarship_remarks    || undefined,
      };
      if (newPass) {
        if (newPass.length < 6) {
          dispatch(showToast({ type: "error", title: "Too Short", message: "Password must be at least 6 characters." }));
          setSaving(false);
          return;
        }
        payload.password = newPass;
      }

      await apiRequest(`/students/${id}`, {
        method: "PATCH",
        body:   JSON.stringify(payload),
      });

      dispatch(showToast({ type: "success", title: "Saved", message: `${form.full_name}'s record has been updated.` }));
      router.push(`/students/profile?id=${id}`);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not update student." }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className={s("students-page")}>
      <Topbar title="Edit Student" subtitle="" />
      <main className={s("page-content")}>
        <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={36} color="#FF9B51" /></div>
      </main>
    </div>
  );

  if (!student) return (
    <div className={s("students-page")}>
      <Topbar title="Edit Student" subtitle="" />
      <main className={s("page-content")}>
        <div style={{ padding: "2rem", color: "#be123c" }}>Student not found.</div>
      </main>
    </div>
  );

  const initials     = getInitials(form.full_name);
  const latestEnroll = enrollments?.[0];

  return (
    <div className={s("students-page")}>
      <Topbar title="Edit Student" subtitle={`Updating record for ${student.full_name}`} />

      <main className={s("page-content")}>
        {/* Page head */}
        <div className={s("page-head")}>
          <div>
            <h1>Edit Student</h1>
            <p>Update details for {student.admission_number}</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-outline"))} href={`/students/profile?id=${id}`}>
              <i className="fa-solid fa-arrow-left" /> Back to Profile
            </Link>
            <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={saving}>
              {saving ? <><Spinner size={14} /> Saving…</> : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
            </button>
          </div>
        </div>

        {/* Hero identity banner */}
        <section className={cx(s("profile-hero"), s("profile-hero-polished"))} style={{ marginBottom: 20 }}>
          <div className={s("profile-main")}>
            {/* Avatar / photo */}
            <div
              className={s("profile-avatar")}
              style={{ position: "relative", overflow: "hidden", cursor: "pointer" }}
              onClick={() => setActiveTab("personal")}
            >
              {photoPreview
                ? <img src={photoPreview} alt={form.full_name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
                : initials}
            </div>
            <div>
              <div className={s("profile-kicker")}>
                {form.status === "active" ? "Active Student" : "Inactive Student"}
              </div>
              <h1>{form.full_name || student.full_name}</h1>
              <p>
                {latestEnroll
                  ? `Class ${latestEnroll.class_name || latestEnroll.class_id} — Section ${latestEnroll.section_name || latestEnroll.section_id} | `
                  : ""}
                {form.admission_number}
              </p>
              <div className={s("profile-meta")}>
                <span className={cx(s("badge"), s(form.status === "active" ? "badge-green" : "badge-yellow"))} style={{ textTransform: "capitalize" }}>
                  {form.status}
                </span>
                {form.scholarship_type && (
                  <span className={cx(s("badge"), s("badge-blue"))}>
                    {form.scholarship_type} scholarship
                    {form.scholarship_percent ? ` (${form.scholarship_percent}%)` : ""}
                  </span>
                )}
                {form.disability && (
                  <span className={cx(s("badge"), s("badge-yellow"))}>
                    <i className="fa-solid fa-wheelchair" style={{ marginRight: 4 }} />Disability
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={s("profile-score-panel")}>
            <div><span>Admission No.</span><strong style={{ fontSize: 15 }}>{form.admission_number}</strong></div>
            <div><span>Gender</span><strong style={{ fontSize: 15, textTransform: "capitalize" }}>{form.gender}</strong></div>
            <div><span>Nationality</span><strong style={{ fontSize: 15 }}>{form.nationality}</strong></div>
          </div>
        </section>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, borderBottom: "2px solid rgba(191,201,209,0.5)", marginBottom: 20 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "10px 20px", fontSize: 13.5, fontWeight: 800,
                border: "none", background: "none", cursor: "pointer",
                color: activeTab === t.key ? "#ff9b51" : "#6b7b86",
                borderBottom: activeTab === t.key ? "2px solid #ff9b51" : "2px solid transparent",
                marginBottom: -2,
                display: "flex", alignItems: "center", gap: 8,
                fontFamily: "inherit",
              }}
            >
              <i className={`fa-solid ${t.icon}`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── PERSONAL TAB ── */}
        {activeTab === "personal" && (
          <section className={s("panel")} style={{ marginBottom: 18 }}>
            <div className={s("panel-head")}>
              <div>
                <h2><i className="fa-solid fa-user" style={{ color: "#ff9b51", marginRight: 8 }} />Personal Information</h2>
                <p className={s("muted")}>Core student identity details</p>
              </div>
            </div>
            <div className={s("form-body")}>

              {/* Photo upload */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "4px 0 12px", borderBottom: "1px solid #eef2f3", marginBottom: 4 }}>
                <div
                  onClick={() => photoInputRef.current?.click()}
                  style={{
                    width: 72, height: 72, borderRadius: 12, flexShrink: 0,
                    border: "2px dashed #d4dde2", background: "#f8fafc",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", overflow: "hidden",
                  }}
                >
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <i className="fa-solid fa-camera" style={{ fontSize: 22, color: "#b0bec5" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: "#25343f", margin: "0 0 4px" }}>Student Photo</p>
                  <p style={{ fontSize: 11, color: "#6b7b86", fontWeight: 600, margin: "0 0 6px" }}>JPEG / PNG / WebP · max 4 MB</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d4dde2", background: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      <i className="fa-solid fa-upload" style={{ marginRight: 5 }} />
                      {photoFile ? "Change" : "Upload Photo"}
                    </button>
                    {photoFile && (
                      <>
                        <button
                          type="button"
                          onClick={handlePhotoUpload}
                          disabled={photoUploading}
                          style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #bbf7d0", background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          {photoUploading
                            ? <><Spinner size={11} /> {uploadProgress}%</>
                            : <><i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: 4 }} />Save Photo</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPhotoFile(null); setPhotoPreview(student?.photo || null); setUploadProgress(0); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                          disabled={photoUploading}
                          style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b42318", fontSize: 12, fontWeight: 800, cursor: photoUploading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: photoUploading ? 0.5 : 1 }}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {/* Progress bar — only visible while uploading */}
                    {photoUploading && (
                      <div style={{ width: "100%", marginTop: 6 }}>
                        <div style={{ height: 5, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${uploadProgress}%`,
                              background: "#22c55e",
                              borderRadius: 99,
                              transition: "width 0.2s ease",
                            }}
                          />
                        </div>
                        <p style={{ fontSize: 10, color: "#6b7b86", fontWeight: 700, marginTop: 3 }}>
                          Uploading… {uploadProgress}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handlePhotoChange} />
              </div>

              <div className={s("field-row")}>
                <label className={s("field")}>
                  <span>Full Name <em style={{ color: "#be123c", fontStyle: "normal" }}>*</em></span>
                  <input name="full_name" value={form.full_name} onChange={set} placeholder="e.g. Ram Sharma" />
                </label>
                <label className={s("field")}>
                  <span>Admission Number <em style={{ color: "#be123c", fontStyle: "normal" }}>*</em></span>
                  <input name="admission_number" value={form.admission_number} onChange={set} placeholder="e.g. 2082-001" />
                </label>
              </div>
              <div className={s("field-row")}>
                <label className={s("field")}>
                  <span>Email</span>
                  <input name="email" type="email" value={form.email} onChange={set} placeholder="student@email.com" />
                </label>
                <label className={s("field")}>
                  <span>Phone</span>
                  <input name="phone" type="tel" value={form.phone} onChange={set} placeholder="9841XXXXXX" />
                </label>
              </div>
              <div className={s("field-row")}>
                <label className={s("field")}>
                  <span>Gender</span>
                  <select name="gender" value={form.gender} onChange={set}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className={s("field")}>
                  <span>Date of Birth</span>
                  <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={set} />
                </label>
              </div>
              <div className={s("field-row")}>
                <label className={s("field")}>
                  <span>Blood Group</span>
                  <select name="blood_group" value={form.blood_group} onChange={set}>
                    <option value="">Select</option>
                    {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </label>
                <label className={s("field")}>
                  <span>Nationality</span>
                  <input name="nationality" value={form.nationality} onChange={set} placeholder="e.g. Nepali" />
                </label>
              </div>
              <div className={s("field-row")}>
                <label className={s("field")}>
                  <span>Religion</span>
                  <input name="religion" value={form.religion} onChange={set} placeholder="Optional" />
                </label>
                <label className={s("field")}>
                  <span>Ethnicity</span>
                  <input name="ethnicity" value={form.ethnicity} onChange={set} placeholder="Optional" />
                </label>
              </div>
              <label className={s("field")}>
                <span>Previous School</span>
                <input name="previous_school" value={form.previous_school} onChange={set} placeholder="Optional" />
              </label>
              <div className={s("field-row")}>
                <label className={s("field")}>
                  <span>City</span>
                  <input name="city" value={form.city} onChange={set} placeholder="e.g. Kathmandu" />
                </label>
                <label className={s("field")}>
                  <span>State</span>
                  <input name="state" value={form.state} onChange={set} placeholder="e.g. Bagmati" />
                </label>
              </div>
              <div className={s("field-row")}>
                <label className={s("field")}>
                  <span>Country</span>
                  <input name="country" value={form.country} onChange={set} placeholder="e.g. Nepal" />
                </label>
                <label className={s("field")}>
                  <span>Admission Date</span>
                  <input name="admission_date" type="date" value={form.admission_date} onChange={set} />
                </label>
              </div>
              <label className={s("field")}>
                <span>Status</span>
                <select name="status" value={form.status} onChange={set}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="transferred">Transferred</option>
                  <option value="graduated">Graduated</option>
                </select>
              </label>

              {/* Disability toggle */}
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
                        onChange={set}
                        placeholder="Describe the disability (e.g. visual impairment, hearing loss, mobility aid required…)"
                        style={textareaStyle}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Scholarship */}
              <div style={{ padding: "14px 0 0", borderTop: "1px solid #eef2f3" }}>
                <p style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", marginBottom: 10 }}>
                  <i className="fa-solid fa-graduation-cap" style={{ marginRight: 6, color: "#ff9b51" }} />
                  Scholarship (optional)
                </p>
                <div className={s("field-row")}>
                  <label className={s("field")}>
                    <span>Scholarship Type</span>
                    <select name="scholarship_type" value={form.scholarship_type} onChange={set}>
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
                    <span>Scholarship % (fee discount)</span>
                    <input
                      name="scholarship_percent"
                      type="number" min="0" max="100" step="0.01"
                      value={form.scholarship_percent}
                      onChange={set}
                      placeholder="e.g. 25"
                      disabled={!form.scholarship_type}
                    />
                  </label>
                </div>
                {form.scholarship_type && (
                  <label className={s("field")} style={{ marginTop: 8 }}>
                    <span>Scholarship Remarks</span>
                    <textarea
                      name="scholarship_remarks"
                      value={form.scholarship_remarks}
                      onChange={set}
                      placeholder="Any notes about scholarship terms…"
                      style={textareaStyle}
                    />
                  </label>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── GUARDIAN TAB ── */}
        {activeTab === "guardian" && (
          <section className={s("panel")} style={{ marginBottom: 18 }}>
            <div className={s("panel-head")}>
              <div>
                <h2><i className="fa-solid fa-people-roof" style={{ color: "#ff9b51", marginRight: 8 }} />Guardian Details</h2>
                <p className={s("muted")}>Parent or guardian contact information</p>
              </div>
            </div>
            <div className={s("form-body")}>
              <label className={s("field")}>
                <span>Guardian Name <em style={{ color: "#be123c", fontStyle: "normal" }}>*</em></span>
                <input name="guardian_name" value={form.guardian_name} onChange={set} placeholder="e.g. Hari Sharma" />
              </label>
              <div className={s("field-row")}>
                <label className={s("field")}>
                  <span>Guardian Phone <em style={{ color: "#be123c", fontStyle: "normal" }}>*</em></span>
                  <input name="guardian_phone" type="tel" value={form.guardian_phone} onChange={set} placeholder="9841XXXXXX" />
                </label>
                <label className={s("field")}>
                  <span>Relation <em style={{ color: "#be123c", fontStyle: "normal" }}>*</em></span>
                  <select name="guardian_relation" value={form.guardian_relation} onChange={set}>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
              </div>
              <div className={s("field-row")}>
                <label className={s("field")}>
                  <span>Guardian Email</span>
                  <input name="guardian_email" type="email" value={form.guardian_email} onChange={set} placeholder="Optional" />
                </label>
                <label className={s("field")}>
                  <span>Guardian Occupation</span>
                  <input name="guardian_occupation" value={form.guardian_occupation} onChange={set} placeholder="Optional" />
                </label>
              </div>
              <label className={s("field")}>
                <span>Guardian Address</span>
                <textarea name="guardian_address" value={form.guardian_address} onChange={set} placeholder="Optional" style={textareaStyle} />
              </label>
            </div>
          </section>
        )}

        {/* ── ENROLLMENT TAB ── */}
        {activeTab === "enrollment" && (
          <section className={s("panel")} style={{ marginBottom: 18 }}>
            <div className={s("panel-head")}>
              <div>
                <h2><i className="fa-solid fa-graduation-cap" style={{ color: "#ff9b51", marginRight: 8 }} />Enrollment History</h2>
                <p className={s("muted")}>Read-only — manage enrollments from the student record directly</p>
              </div>
            </div>
            <div style={{ padding: "18px" }}>
              {!enrollments?.length ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "#6b7b86" }}>
                  <i className="fa-solid fa-folder-open" style={{ fontSize: 28, display: "block", marginBottom: 8, opacity: 0.4 }} />
                  No enrollments found.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {enrollments.map((en, idx) => (
                    <div key={en.id} style={{
                      padding: "14px 16px",
                      border: "1px solid rgba(191,201,209,0.6)",
                      borderRadius: 10,
                      background: idx === 0 ? "#fff7ed" : "#f8fafc",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: idx === 0 ? "#ff9b51" : "#eaecef",
                          color: idx === 0 ? "#fff" : "#6b7b86",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 900,
                        }}>{idx + 1}</div>
                        <div>
                          <strong style={{ fontSize: 14 }}>
                            Class {en.class_name || en.class_id} — Section {en.section_name || en.section_id}
                          </strong>
                          <p style={{ fontSize: 12, color: "#6b7b86", fontWeight: 700, marginTop: 2 }}>
                            {en.academic_year_name || `Year #${en.academic_year_id}`}
                            {en.roll_number ? ` · Roll ${en.roll_number}` : ""}
                          </p>
                        </div>
                      </div>
                      <span style={{
                        padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 900,
                        background: en.status === "active" ? "#dcfce7" : "#f1f5f9",
                        color: en.status === "active" ? "#15803d" : "#6a7882",
                        textTransform: "capitalize",
                      }}>{en.status}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 13, fontWeight: 700, color: "#1e40af", display: "flex", gap: 10 }}>
                <i className="fa-solid fa-circle-info" />
                <span>To change a student's class or section for this year, use the enrollment update feature in Fee Management.</span>
              </div>
            </div>
          </section>
        )}

        {/* ── SECURITY TAB ── */}
        {activeTab === "security" && (
          <section className={s("panel")} style={{ marginBottom: 18 }}>
            <div className={s("panel-head")}>
              <div>
                <h2><i className="fa-solid fa-lock" style={{ color: "#ff9b51", marginRight: 8 }} />Security</h2>
                <p className={s("muted")}>Reset the student's login password</p>
              </div>
            </div>
            <div className={s("form-body")}>
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: 13, fontWeight: 700, color: "#c2410c", display: "flex", gap: 10 }}>
                <i className="fa-solid fa-triangle-exclamation" />
                <span>Only fill this in if you want to reset the student's password. Leave blank to keep the existing one.</span>
              </div>
              <div style={{ maxWidth: 400 }}>
                <label className={s("field")}>
                  <span>New Password</span>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPass ? "text" : "password"}
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="Min. 6 characters"
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 44, border: "none", background: "transparent", cursor: "pointer", color: "#6b7b86", fontSize: 14 }}
                    >
                      <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`} />
                    </button>
                  </div>
                  {newPass && newPass.length < 6 && (
                    <span style={{ color: "#be123c", fontSize: 12, fontWeight: 700 }}>
                      <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }} />Password must be at least 6 characters
                    </span>
                  )}
                  {newPass && newPass.length >= 6 && (
                    <span style={{ color: "#15803d", fontSize: 12, fontWeight: 700 }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: 4 }} />Password looks good
                    </span>
                  )}
                </label>
              </div>
            </div>
          </section>
        )}

        {/* Bottom action bar */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 0", borderTop: "1px solid rgba(191,201,209,0.5)" }}>
          <Link className={cx(s("btn"), s("btn-outline"))} href={`/students/profile?id=${id}`}>
            <i className="fa-solid fa-xmark" /> Cancel
          </Link>
          <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={saving}>
            {saving ? <><Spinner size={14} /> Saving…</> : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
          </button>
        </div>
      </main>
    </div>
  );
}
