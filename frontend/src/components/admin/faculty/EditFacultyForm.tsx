"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import styles from "./faculty.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Loader, Spinner } from "@/components/shared/Loader";
import Topbar from "@/components/shared/Topbar";
import DateInput from "@/components/shared/DateInput";

const s = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").substring(0, 2).toUpperCase();
}

export default function EditFacultyForm() {
  const router   = useRouter();
  const params   = useParams();
  const id       = params?.facultyId as string;
  const dispatch = useAppDispatch();

  const { data: teacher, loading: fetching } = useApi<any>(`/teachers/${id}`);
  const { execute: updateTeacher, loading: saving } = useMutation(`/teachers/${id}`, "PATCH");

  /* ── photo state ── */
  const photoInputRef    = useRef<HTMLInputElement>(null);
  const [photoPreview,   setPhotoPreview]   = useState<string | null>(null);
  const [photoFile,      setPhotoFile]      = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [form, setForm] = useState({
    full_name:        "",
    email:            "",
    phone:            "",
    gender:           "male",
    date_of_birth:    "",
    qualification:    "",
    experience_years: "",
    monthly_salary:   "",
    join_date:        "",
    city:             "",
    state:            "",
    country:          "",
    status:           "active",
  });

  const [passwordSection, setPasswordSection] = useState(false);
  const [newPassword,     setNewPassword]     = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [activeTab, setActiveTab] = useState<"personal" | "professional" | "address" | "security">("personal");

  // Populate form once teacher data arrives
  useEffect(() => {
    if (!teacher) return;
    setForm({
      full_name:        teacher.full_name        ?? "",
      email:            teacher.email            ?? "",
      phone:            teacher.phone            ?? "",
      gender:           teacher.gender           ?? "male",
      date_of_birth:    teacher.date_of_birth
        ? new Date(teacher.date_of_birth).toISOString().split("T")[0] : "",
      qualification:    teacher.qualification    ?? "",
      experience_years: teacher.experience_years?.toString() ?? "",
      monthly_salary:   teacher.monthly_salary   != null ? String(teacher.monthly_salary) : "",
      join_date:        teacher.join_date
        ? new Date(teacher.join_date).toISOString().split("T")[0] : "",
      city:             teacher.city             ?? "",
      state:            teacher.state            ?? "",
      country:          teacher.country          ?? "",
      status:           teacher.status           ?? "active",
    });
    if (teacher.photo) setPhotoPreview(teacher.photo);
  }, [teacher]);

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  /* ── Photo handlers ── */
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

  const handlePhotoUpload = async () => {
    if (!photoFile || !id) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      const res = await apiRequest<any>(`/upload/teacher-photo/${id}`, {
        method: "POST",
        body:   fd,
      });
      const url = res?.url || res?.data?.url || null;
      if (url) setPhotoPreview(url);
      dispatch(showToast({ type: "success", title: "Photo Updated", message: "Teacher photo has been uploaded." }));
      setPhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Upload Failed", message: err.message || "Could not upload photo." }));
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.full_name || !form.email || !form.phone) {
      dispatch(showToast({ type: "error", title: "Missing Fields", message: "Name, email and phone are required." }));
      return;
    }
    const payload: any = {
      ...form,
      experience_years: form.experience_years ? Number(form.experience_years) : undefined,
      monthly_salary:   form.monthly_salary   ? Number(form.monthly_salary)   : undefined,
      date_of_birth:    form.date_of_birth    || undefined,
      join_date:        form.join_date        || undefined,
      city:             form.city             || undefined,
      state:            form.state            || undefined,
      country:          form.country          || undefined,
      qualification:    form.qualification    || undefined,
    };
    if (passwordSection && newPassword) {
      if (newPassword.length < 6) {
        dispatch(showToast({ type: "error", title: "Password Too Short", message: "Password must be at least 6 characters." }));
        return;
      }
      payload.password = newPassword;
    }
    try {
      await updateTeacher(payload);
      dispatch(showToast({ type: "success", title: "Saved", message: `${form.full_name}'s profile has been updated.` }));
      router.push(`/teachers/${id}`);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not update teacher. Please try again." }));
    }
  };

  if (fetching) {
    return (
      <div className={s("faculty-page")}>
        <Topbar title="Edit Teacher" subtitle="" />
        <main className={s("page-content")}>
          <div style={{ padding: "4rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading teacher details…" /></div>
        </main>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className={s("faculty-page")}>
        <Topbar title="Edit Teacher" subtitle="" />
        <main className={s("page-content")}>
          <div style={{ padding: "2rem", color: "#f43f5e" }}>Teacher not found.</div>
        </main>
      </div>
    );
  }

  const tabs = [
    { key: "personal",     icon: "fa-user",          label: "Personal"     },
    { key: "professional", icon: "fa-briefcase",     label: "Professional" },
    { key: "address",      icon: "fa-location-dot",  label: "Address"      },
    { key: "security",     icon: "fa-lock",          label: "Security"     },
  ] as const;

  return (
    <div className={s("faculty-page")}>
      <Topbar title="Edit Teacher" subtitle={`Updating profile for ${teacher.full_name}`} />

      <main className={s("page-content")}>
        {/* Page header */}
        <div className={s("page-head")}>
          <div>
            <h1>Edit Teacher</h1>
            <p>Update details for {teacher.full_name}</p>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btn-outline"))} href={`/teachers/${id}`}>
              <i className="fa-solid fa-arrow-left" /> Back to Profile
            </Link>
            <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={saving}>
              {saving ? <><Spinner size={15} /> Saving…</> : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
            </button>
          </div>
        </div>

        {/* Hero banner */}
        <div className={s("profile-hero")} style={{ marginBottom: 22 }}>
          {/* Avatar / photo */}
          <div
            className={s("profile-avatar")}
            style={{ position: "relative", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}
            onClick={() => setActiveTab("personal")}
          >
            {photoPreview
              ? <img src={photoPreview} alt={form.full_name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
              : getInitials(form.full_name || teacher.full_name)}
          </div>
          <div className={s("profile-title")}>
            <span>FACULTY ID #{teacher.id}</span>
            <h2>{form.full_name || teacher.full_name}</h2>
            <p>{form.email || teacher.email}</p>
            <div className={s("chip-row")}>
              <b className={cx(s("badge"), s(form.status === "active" ? "chip-green" : "yellow"))} style={{ textTransform: "capitalize" }}>
                {form.status}
              </b>
              <b className={cx(s("badge"), s("chip-blue"))} style={{ textTransform: "capitalize" }}>
                {form.gender}
              </b>
              {form.experience_years && (
                <b className={cx(s("badge"), s("chip-green"))}>{form.experience_years} yrs exp</b>
              )}
              {form.monthly_salary && (
                <b className={cx(s("badge"), s("chip-orange"))} style={{ background: "#fff1df", color: "#a85f12" }}>
                  ₹{Number(form.monthly_salary).toLocaleString("en-IN")}/mo
                </b>
              )}
            </div>
          </div>
          <div className={s("hero-metrics")}>
            <span>
              <b>Status</b>
              <strong style={{ fontSize: 13, textTransform: "capitalize" }}>{form.status}</strong>
            </span>
            <span>
              <b>Monthly Salary</b>
              <strong style={{ fontSize: 13, color: form.monthly_salary ? "#12805c" : "#b42318" }}>
                {form.monthly_salary ? `₹${Number(form.monthly_salary).toLocaleString("en-IN")}` : "Not set"}
              </strong>
            </span>
            <span>
              <b>Join Date</b>
              <strong style={{ fontSize: 13 }}>
                {form.join_date ? new Date(form.join_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
              </strong>
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, borderBottom: "2px solid rgba(191,201,209,0.5)", marginBottom: 20 }}>
          {tabs.map((t) => (
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
              <i className={`fa-solid ${t.icon}`} /> {t.label}
            </button>
          ))}
        </div>

        {/* ── PERSONAL TAB ── */}
        {activeTab === "personal" && (
          <div className={s("form-section")} style={{ marginBottom: 18 }}>
            <div className={s("form-section-head")}>
              <h3><i className="fa-solid fa-user" />Personal Information</h3>
              <span>Required</span>
            </div>

            {/* Photo upload */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", borderBottom: "1px solid #eef2f3" }}>
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
                <p style={{ fontSize: 12, fontWeight: 800, color: "#25343f", margin: "0 0 4px" }}>Teacher Photo</p>
                <p style={{ fontSize: 11, color: "#6b7b86", fontWeight: 600, margin: "0 0 6px" }}>JPEG / PNG / WebP · max 2 MB</p>
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
                        {photoUploading ? <><Spinner size={11} /> Uploading…</> : <><i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: 4 }} />Save Photo</>}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(teacher?.photo || null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                        style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b42318", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handlePhotoChange} />
            </div>

            <div className={s("form-grid")}>
              <label className={cx(s("field"), s("full"))}>
                <span>Full Name <em>*</em></span>
                <input name="full_name" value={form.full_name} onChange={set} placeholder="e.g. Rajesh Kumar" />
              </label>
              <label className={s("field")}>
                <span>Email <em>*</em></span>
                <input name="email" type="email" value={form.email} onChange={set} placeholder="teacher@school.edu" />
              </label>
              <label className={s("field")}>
                <span>Phone <em>*</em></span>
                <input name="phone" type="tel" value={form.phone} onChange={set} placeholder="98XXXXXXXX" />
              </label>
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
                <DateInput name="date_of_birth" value={form.date_of_birth} onChange={set} />
              </label>
              <label className={s("field")}>
                <span>Status</span>
                <select name="status" value={form.status} onChange={set}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {/* ── PROFESSIONAL TAB ── */}
        {activeTab === "professional" && (
          <div className={s("form-section")} style={{ marginBottom: 18 }}>
            <div className={s("form-section-head")}>
              <h3><i className="fa-solid fa-briefcase" />Professional Details</h3>
              <span>Optional</span>
            </div>
            <div className={s("form-grid")}>
              <label className={s("field")}>
                <span>Qualification</span>
                <input name="qualification" value={form.qualification} onChange={set} placeholder="e.g. M.Sc, B.Ed" />
              </label>
              <label className={s("field")}>
                <span>Experience (Years)</span>
                <input name="experience_years" type="number" min="0" max="60" value={form.experience_years} onChange={set} placeholder="e.g. 5" />
              </label>
              <label className={s("field")}>
                <span>Monthly Salary <em>*</em></span>
                <input
                  name="monthly_salary"
                  type="number"
                  min="0"
                  value={form.monthly_salary}
                  onChange={set}
                  placeholder="e.g. 25000"
                />
                {!form.monthly_salary && (
                  <span style={{ fontSize: 11, color: "#c46a14", fontWeight: 700 }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />
                    Required for salary calculation
                  </span>
                )}
              </label>
              <label className={s("field")}>
                <span>Join Date</span>
                <DateInput name="join_date" value={form.join_date} onChange={set} />
              </label>
            </div>
          </div>
        )}

        {/* ── ADDRESS TAB ── */}
        {activeTab === "address" && (
          <div className={s("form-section")} style={{ marginBottom: 18 }}>
            <div className={s("form-section-head")}>
              <h3><i className="fa-solid fa-location-dot" />Address</h3>
              <span>Optional</span>
            </div>
            <div className={s("form-grid")}>
              <label className={s("field")}>
                <span>City</span>
                <input name="city" value={form.city} onChange={set} placeholder="e.g. Kathmandu" />
              </label>
              <label className={s("field")}>
                <span>State / Province</span>
                <input name="state" value={form.state} onChange={set} placeholder="e.g. Bagmati" />
              </label>
              <label className={s("field")}>
                <span>Country</span>
                <input name="country" value={form.country} onChange={set} placeholder="e.g. Nepal" />
              </label>
            </div>
          </div>
        )}

        {/* ── SECURITY TAB ── */}
        {activeTab === "security" && (
          <div className={s("form-section")} style={{ marginBottom: 18 }}>
            <div className={s("form-section-head")}>
              <h3><i className="fa-solid fa-lock" />Security</h3>
              <span>Password reset</span>
            </div>
            <div style={{ padding: "14px 18px" }}>
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: 13, fontWeight: 700, color: "#c2410c", display: "flex", gap: 10, marginBottom: 16 }}>
                <i className="fa-solid fa-triangle-exclamation" />
                <span>Only fill this in if you want to reset the teacher's password. Leave blank to keep the existing one.</span>
              </div>
              <div style={{ maxWidth: 380 }}>
                <label className={s("field")}>
                  <span>New Password</span>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 44, border: "none", background: "transparent", cursor: "pointer", color: "#6b7b86", fontSize: 14 }}
                    >
                      <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                    </button>
                  </div>
                  {newPassword && newPassword.length < 6 && (
                    <span style={{ color: "#be123c", fontSize: 12, fontWeight: 700 }}>
                      <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }} />Password must be at least 6 characters
                    </span>
                  )}
                  {newPassword && newPassword.length >= 6 && (
                    <span style={{ color: "#15803d", fontSize: 12, fontWeight: 700 }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: 4 }} />Password looks good
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => { setPasswordSection(false); setNewPassword(""); }}
                  style={{ marginTop: 8, padding: "5px 12px", borderRadius: 7, border: "1px solid #d4dde2", background: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", color: "#6b7b86" }}
                >
                  <i className="fa-solid fa-xmark" style={{ marginRight: 5 }} />Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className={s("form-actions")}>
          <Link className={cx(s("btn"), s("btn-outline"))} href={`/teachers/${id}`}>
            <i className="fa-solid fa-xmark" /> Cancel
          </Link>
          <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={saving}>
            {saving ? <><Spinner size={15} /> Saving…</> : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
          </button>
        </div>
      </main>
    </div>
  );
}
