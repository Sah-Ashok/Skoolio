"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../faculty/faculty.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import DateInput from "@/components/shared/DateInput";
import { useCurrency } from "@/lib/useCurrency";

const s  = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

type StaffRole = { id: number; role_name: string };

export default function AddStaffPage() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const { symbol, fmt } = useCurrency();

  const { data: roles, loading: loadingRoles } = useApi<StaffRole[]>("/staff/roles");

  const { execute: createStaff,  loading: savingStaff  } = useMutation("/staff", "POST");
  const { execute: setSalary,    loading: savingSalary  } = useMutation("/staff/salary/structure", "POST");

  const isSubmitting = savingStaff || savingSalary;

  const [form, setForm] = useState({
    full_name:      "",
    staff_role_id:  "",
    phone:          "",
    gender:         "",
    joined_date:    new Date().toISOString().split("T")[0],
    date_of_birth:  "",
    status:         "active",
    monthly_salary: "",
    effective_from: new Date().toISOString().split("T")[0],
    citizen_id:     "",
    license_number: "",
    address:        "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
      | { target: { name: string; value: string } }
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.full_name.trim()) {
      dispatch(showToast({ type: "error", title: "Missing Field", message: "Full name is required." }));
      return;
    }
    if (!form.staff_role_id) {
      dispatch(showToast({ type: "error", title: "Missing Field", message: "Please select a role." }));
      return;
    }
    if (!form.joined_date) {
      dispatch(showToast({ type: "error", title: "Missing Field", message: "Joined date is required." }));
      return;
    }
    if (!form.monthly_salary || Number(form.monthly_salary) <= 0) {
      dispatch(showToast({ type: "error", title: "Missing Field", message: "Monthly salary is required and must be greater than 0." }));
      return;
    }

    try {
      // Step 1 — create the staff member
      const staffPayload = {
        full_name:      form.full_name.trim(),
        staff_role_id:  Number(form.staff_role_id),
        phone:          form.phone          || undefined,
        gender:         form.gender         || undefined,
        joined_date:    form.joined_date,
        date_of_birth:  form.date_of_birth  || undefined,
        status:         form.status,
        citizen_id:     form.citizen_id     || undefined,
        license_number: form.license_number || undefined,
        address:        form.address        || undefined,
      };

      const created: any = await createStaff(staffPayload);
      if (!created || !created.id) {
        dispatch(showToast({ type: "error", title: "Failed", message: "Could not create staff member. Please try again." }));
        return;
      }

      // Step 2 — set salary structure (same as teacher monthly_salary flow)
      const salaryPayload = {
        staff_id:       created.id,
        basic_salary:   Number(form.monthly_salary),
        effective_from: form.effective_from || form.joined_date,
      };

      try {
        await setSalary(salaryPayload);
      } catch (salaryErr: any) {
        console.warn("Salary setup notice:", salaryErr);
        dispatch(showToast({
          type: "warning",
          title: "Staff Created",
          message: `${form.full_name} was added. Please verify their salary in the staff list.`,
        }));
        router.push("/staff");
        return;
      }

      dispatch(showToast({
        type: "success",
        title: "Staff Member Added",
        message: `${form.full_name} has been registered successfully with a monthly salary of ${fmt(form.monthly_salary)}.`,
      }));
      router.push("/staff");
    } catch (err: any) {
      dispatch(showToast({
        type: "error",
        title: "Failed to Add Staff",
        message: err?.message || "Failed to create staff member. Please check details and try again.",
      }));
    }
  };

  return (
    <div className={s("faculty-page")}>
      <div className={s("page-content")}>

        {/* ── Page head ── */}
        <div className={s("page-head")}>
          <div>
            <h1>Add Staff Member</h1>
            <p>Fill in the details below to register a new non-teaching staff member.</p>
          </div>
          <div className={s("actions")}>
            <Link href="/staff" className={cx(s("btn"), s("btn-outline"))}>
              <i className="fa-solid fa-arrow-left" /> Back to Staff
            </Link>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: "grid", gap: 18 }}>

          {/* ── Row 1: Personal + Role/Status ── */}
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
                  <input
                    name="full_name"
                    required
                    value={form.full_name}
                    onChange={handleChange}
                    placeholder="e.g. Ram Bahadur Thapa"
                  />
                </label>

                <label className={s("field")}>
                  <span>Gender</span>
                  <select name="gender" value={form.gender} onChange={handleChange}>
                    <option value="">Select…</option>
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
                  <span>Phone</span>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="98XXXXXXXX"
                  />
                </label>

                <label className={s("field")}>
                  <span>Status</span>
                  <select name="status" value={form.status} onChange={handleChange}>
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Role & Employment */}
            <div className={s("form-section")}>
              <div className={s("form-section-head")}>
                <h3><i className="fa-solid fa-briefcase" />Role &amp; Employment</h3>
                <span>Required</span>
              </div>
              <div className={s("form-grid")}>
                <label className={cx(s("field"), s("full"))}>
                  <span>Staff Role <em>*</em></span>
                  <select name="staff_role_id" required value={form.staff_role_id} onChange={handleChange}>
                    <option value="">Select role…</option>
                    {loadingRoles ? (
                      <option disabled>Loading roles…</option>
                    ) : (
                      (roles ?? []).map(r => (
                        <option key={r.id} value={r.id}>{r.role_name}</option>
                      ))
                    )}
                  </select>
                  {!loadingRoles && (roles ?? []).length === 0 && (
                    <small style={{ color: "#c46a14", fontSize: 11, fontWeight: 800 }}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />
                      No roles defined. <Link href="/staff" style={{ color: "#3b5bdb" }}>Create a role first.</Link>
                    </small>
                  )}
                </label>

                <label className={s("field")}>
                  <span>Joined Date <em>*</em></span>
                  <DateInput name="joined_date" required value={form.joined_date} onChange={handleChange} />
                </label>

                <label className={s("field")}>
                  <span>Monthly Salary (NPR) <em>*</em></span>
                  <input
                    name="monthly_salary"
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.monthly_salary}
                    onChange={handleChange}
                    placeholder="e.g. 15000"
                  />
                </label>

                <label className={s("field")}>
                  <span>Salary Effective From</span>
                  <DateInput name="effective_from" value={form.effective_from} onChange={handleChange} />
                </label>

                {/* Salary preview */}
                {form.monthly_salary && Number(form.monthly_salary) > 0 && (
                  <div
                    className={s("full")}
                    style={{
                      padding: "12px 14px",
                      border: "1px solid #a7e1c8",
                      borderRadius: 9,
                      background: "#f0fdf8",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <i className="fa-solid fa-money-bill-wave" style={{ color: "#12805c", fontSize: 15 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#6a7882" }}>Monthly Salary</p>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#12805c" }}>
                        {fmt(form.monthly_salary)}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: "#6a7882", fontWeight: 700 }}>
                        ≈ {fmt(Math.round(Number(form.monthly_salary) / 30))} / day
                        &nbsp;·&nbsp;
                        {fmt(Math.round(Number(form.monthly_salary) * 12))} / year
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Row 2: Documents (Optional) ── */}
          <div className={s("form-section")}>
            <div className={s("form-section-head")}>
              <h3>
                <i className="fa-solid fa-id-card" style={{ color: "#ff9b51" }} />
                Documents &amp; Address
              </h3>
              <span>Optional</span>
            </div>
            <div style={{ padding: "18px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 15 }}>
              <label className={s("field")}>
                <span>
                  <i className="fa-solid fa-id-card" style={{ marginRight: 5, color: "#3b5bdb", fontSize: 11 }} />
                  Citizenship / National ID No.
                </span>
                <input
                  name="citizen_id"
                  value={form.citizen_id}
                  onChange={handleChange}
                  placeholder="e.g. 12-34-56-78901"
                />
              </label>

              <label className={s("field")}>
                <span>
                  <i className="fa-solid fa-car" style={{ marginRight: 5, color: "#7c3aed", fontSize: 11 }} />
                  Driving Licence No.
                </span>
                <input
                  name="license_number"
                  value={form.license_number}
                  onChange={handleChange}
                  placeholder="e.g. 03-01-0123456"
                />
              </label>

              <label className={cx(s("field"), s("full"))} style={{ gridColumn: "1 / -1" }}>
                <span>Home Address</span>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Home address…"
                  style={{ minHeight: 72 }}
                />
              </label>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className={s("form-actions")}>
            <Link href="/staff" className={cx(s("btn"), s("btn-outline"))}>
              <i className="fa-solid fa-xmark" /> Cancel
            </Link>
            <button
              type="submit"
              className={cx(s("btn"), s("btn-primary"))}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <><Spinner size={16} /> Saving…</>
                : <><i className="fa-solid fa-user-plus" /> Add Staff Member</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
