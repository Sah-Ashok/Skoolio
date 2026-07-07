"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import styles from "./faculty.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import Topbar from "@/components/shared/Topbar";

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

  const [form, setForm] = useState({
    full_name:        "",
    email:            "",
    phone:            "",
    gender:           "male",
    date_of_birth:    "",
    blood_group:      "",
    qualification:    "",
    experience_years: "",
    join_date:        "",
    city:             "",
    state:            "",
    country:          "",
    status:           "active",
  });

  const [passwordSection, setPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"personal" | "professional" | "address">("personal");

  // Populate form once teacher data arrives
  useEffect(() => {
    if (!teacher) return;
    setForm({
      full_name:        teacher.full_name        ?? "",
      email:            teacher.email            ?? "",
      phone:            teacher.phone            ?? "",
      gender:           teacher.gender           ?? "male",
      date_of_birth:    teacher.date_of_birth
        ? new Date(teacher.date_of_birth).toISOString().split("T")[0]
        : "",
      blood_group:      teacher.blood_group      ?? "",
      qualification:    teacher.qualification    ?? "",
      experience_years: teacher.experience_years?.toString() ?? "",
      join_date:        teacher.join_date
        ? new Date(teacher.join_date).toISOString().split("T")[0]
        : "",
      city:             teacher.city             ?? "",
      state:            teacher.state            ?? "",
      country:          teacher.country          ?? "",
      status:           teacher.status           ?? "active",
    });
  }, [teacher]);

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!form.full_name || !form.email || !form.phone) {
      dispatch(showToast({ type: "error", title: "Missing Fields", message: "Name, email and phone are required." }));
      return;
    }
    const payload: any = {
      ...form,
      experience_years: form.experience_years ? Number(form.experience_years) : undefined,
      date_of_birth:    form.date_of_birth    || undefined,
      join_date:        form.join_date        || undefined,
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
          <div style={{ padding: "4rem", textAlign: "center" }}>
            <Spinner size={36} color="#FF9B51" />
          </div>
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
    { key: "personal",     icon: "fa-user",      label: "Personal" },
    { key: "professional", icon: "fa-briefcase", label: "Professional" },
    { key: "address",      icon: "fa-location-dot", label: "Address" },
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
            <button
              className={cx(s("btn"), s("btn-primary"))}
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? <><Spinner size={15} /> Saving…</>
                : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
            </button>
          </div>
        </div>

        {/* Hero banner */}
        <div className={s("profile-hero")} style={{ marginBottom: 22 }}>
          <div className={s("profile-avatar")}>{getInitials(form.full_name || teacher.full_name)}</div>
          <div className={s("profile-title")}>
            <span>FACULTY ID #{teacher.id}</span>
            <h2>{form.full_name || teacher.full_name}</h2>
            <p>{form.email || teacher.email}</p>
            <div className={s("chip-row")}>
              <b className={cx(s("badge"), s(form.status === "active" ? "chip-green" : "yellow"))}
                style={{ textTransform: "capitalize" }}>
                {form.status}
              </b>
              <b className={cx(s("badge"), s("chip-blue"))} style={{ textTransform: "capitalize" }}>
                {form.gender}
              </b>
              {form.experience_years && (
                <b className={cx(s("badge"), s("chip-green"))}>
                  {form.experience_years} yrs exp
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
              <b>Experience</b>
              <strong style={{ fontSize: 13 }}>{form.experience_years ? `${form.experience_years} yrs` : "—"}</strong>
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
                <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={set} />
              </label>
              <label className={s("field")}>
                <span>Blood Group</span>
                <select name="blood_group" value={form.blood_group} onChange={set}>
                  <option value="">— Select —</option>
                  {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </label>
              <label className={s("field")}>
                <span>Status</span>
                <select name="status" value={form.status} onChange={set}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            {/* Password section toggle */}
            <div style={{ padding: "0 18px 18px" }}>
              <button
                type="button"
                className={cx(s("btn"), s("btn-outline"), s("btn-sm"))}
                onClick={() => { setPasswordSection((v) => !v); setNewPassword(""); }}
              >
                <i className={`fa-solid ${passwordSection ? "fa-eye-slash" : "fa-lock"}`} />
                {passwordSection ? "Cancel Password Change" : "Change Password"}
              </button>

              {passwordSection && (
                <div style={{ marginTop: 14, maxWidth: 340 }}>
                  <label className={s("field")}>
                    <span>New Password <em>*</em></span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                    />
                  </label>
                  <p style={{ marginTop: 6, fontSize: 11.5, color: "#6b7b86", fontWeight: 700 }}>
                    <i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />
                    Leave blank to keep the existing password.
                  </p>
                </div>
              )}
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
                <span>Join Date</span>
                <input name="join_date" type="date" value={form.join_date} onChange={set} />
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

        {/* Bottom actions */}
        <div className={s("form-actions")}>
          <Link className={cx(s("btn"), s("btn-outline"))} href={`/teachers/${id}`}>
            <i className="fa-solid fa-xmark" /> Cancel
          </Link>
          <button
            className={cx(s("btn"), s("btn-primary"))}
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? <><Spinner size={15} /> Saving…</>
              : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
          </button>
        </div>
      </main>
    </div>
  );
}
