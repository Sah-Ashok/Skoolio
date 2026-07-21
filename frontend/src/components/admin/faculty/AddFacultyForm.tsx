"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./faculty.module.css";
import { useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import DateInput from "@/components/shared/DateInput";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

export default function AddFacultyForm() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const { execute: createTeacher, loading: isSubmitting } = useMutation("/teachers", "POST");

  const [form, setForm] = useState({
    full_name:        "",
    email:            "",
    phone:            "",
    password:         "",
    gender:           "male",
    date_of_birth:    "",
    blood_group:      "",
    qualification:    "",
    experience_years: "",
    monthly_salary:   "",
    join_date:        "",
    city:             "",
    state:            "",
    country:          "",
    status:           "active",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.phone || !form.password) {
      dispatch(showToast({ type: "error", title: "Missing Fields", message: "Please fill in all required fields." }));
      return;
    }
    if (!form.join_date) {
      dispatch(showToast({ type: "error", title: "Missing Field", message: "Join date is required." }));
      return;
    }
    if (!form.monthly_salary || Number(form.monthly_salary) <= 0) {
      dispatch(showToast({ type: "error", title: "Missing Field", message: "Monthly salary is required." }));
      return;
    }
    const payload = {
      ...form,
      experience_years: form.experience_years ? Number(form.experience_years) : undefined,
      monthly_salary:   form.monthly_salary   ? Number(form.monthly_salary)   : undefined,
    };
    const res = await createTeacher(payload);
    if (res) {
      dispatch(showToast({ type: "success", title: "Teacher Added", message: `${form.full_name} has been registered successfully.` }));
      router.push("/teachers");
    } else {
      dispatch(showToast({ type: "error", title: "Failed", message: "Could not save teacher. Please try again." }));
    }
  };

  return (
    <form onSubmit={handleSave} style={{ display: "grid", gap: 18 }}>

      {/* ── Row 1: Personal + Professional ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>

        {/* Personal Information */}
        <div className={s("form-section")}>
          <div className={s("form-section-head")}>
            <h3><i className="fa-solid fa-user" />Personal Information</h3>
            <span>Required</span>
          </div>
          <div className={s("form-grid")}>
            <label className={cx(s("field"), s("full"))}>
              <span>Full Name <em>*</em></span>
              <input name="full_name" required value={form.full_name} onChange={handleChange} placeholder="e.g. Rajesh Kumar" />
            </label>
            <label className={s("field")}>
              <span>Gender</span>
              <select name="gender" value={form.gender} onChange={handleChange}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className={s("field")}>
              <span>Date of Birth</span>
              <DateInput name="date_of_birth" value={form.date_of_birth} onChange={handleChange} />
            </label>
            <label className={s("field")}>
              <span>Blood Group</span>
              <select name="blood_group" value={form.blood_group} onChange={handleChange}>
                <option value="">— Select —</option>
                {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </label>
            <label className={s("field")}>
              <span>Phone <em>*</em></span>
              <input name="phone" required type="tel" value={form.phone} onChange={handleChange} placeholder="98XXXXXXXX" />
            </label>
            <label className={s("field")}>
              <span>Email <em>*</em></span>
              <input name="email" required type="email" value={form.email} onChange={handleChange} placeholder="teacher@school.edu" />
            </label>
            <label className={cx(s("field"), s("full"))}>
              <span>Login Password <em>*</em></span>
              <input name="password" required type="password" value={form.password} onChange={handleChange} placeholder="Min. 6 characters" />
            </label>
          </div>
        </div>

        {/* Professional & Address */}
        <div className={s("form-section")}>
          <div className={s("form-section-head")}>
            <h3><i className="fa-solid fa-briefcase" />Professional & Address</h3>
            <span>Optional</span>
          </div>
          <div className={s("form-grid")}>
            <label className={s("field")}>
              <span>Qualification</span>
              <input name="qualification" value={form.qualification} onChange={handleChange} placeholder="e.g. M.Sc, B.Ed" />
            </label>
            <label className={s("field")}>
              <span>Experience (Years)</span>
              <input name="experience_years" type="number" min="0" max="60" value={form.experience_years} onChange={handleChange} placeholder="e.g. 5" />
            </label>
            <label className={s("field")}>
              <span>Monthly Salary <em>*</em></span>
              <input name="monthly_salary" required type="number" min="0" value={form.monthly_salary} onChange={handleChange} placeholder="e.g. 25000" />
            </label>
            <label className={s("field")}>
              <span>Join Date <em>*</em></span>
              <DateInput name="join_date" required value={form.join_date} onChange={handleChange} />
            </label>
            <label className={s("field")}>
              <span>Status</span>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className={s("field")}>
              <span>City</span>
              <input name="city" value={form.city} onChange={handleChange} placeholder="e.g. Kathmandu" />
            </label>
            <label className={s("field")}>
              <span>State / Province</span>
              <input name="state" value={form.state} onChange={handleChange} placeholder="e.g. Bagmati" />
            </label>
            <label className={cx(s("field"), s("full"))}>
              <span>Country</span>
              <input name="country" value={form.country} onChange={handleChange} placeholder="e.g. Nepal" />
            </label>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className={s("form-actions")}>
        <Link className={cx(s("btn"), s("btn-outline"))} href="/teachers">
          <i className="fa-solid fa-arrow-left" /> Cancel
        </Link>
        <button type="submit" className={cx(s("btn"), s("btn-primary"))} disabled={isSubmitting}>
          {isSubmitting ? <><Spinner size={16} /> Saving…</> : <><i className="fa-solid fa-check" /> Save Teacher</>}
        </button>
      </div>
    </form>
  );
}
