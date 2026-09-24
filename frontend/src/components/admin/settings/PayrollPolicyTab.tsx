"use client";

import { useState, useEffect } from "react";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useCurrency, CurrencyAmount } from "@/lib/useCurrency";
import styles from "./settings.module.css";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

function Field({ label, hint, children, full }: {
  label: string; hint?: string; children: React.ReactNode; full?: boolean;
}) {
  return (
    <div className={cx(s("field"), full ? s("full") : undefined)}>
      <label>
        {label}
        {hint && <span className={s("field-hint")}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className={s("info-note")}>
      <i className="fa-solid fa-circle-info" />
      <span>{children}</span>
    </div>
  );
}

export default function PayrollPolicyTab() {
  const dispatch = useAppDispatch();
  const { symbol, fmt } = useCurrency();

  const { data: policy, loading, refetch } = useApi<any>("/payroll-policy");
  const { execute: savePolicy, loading: saving } = useMutation("/payroll-policy", "PUT");

  const [form, setForm] = useState({
    paid_leave_days_per_month: "0",
    half_day_pay_percent: "50",
    default_tax_percent: "0",
    default_pf_percent: "0",
    working_days_basis: "manual",
  });

  useEffect(() => {
    if (!policy) return;
    setForm({
      paid_leave_days_per_month: String(policy.paid_leave_days_per_month ?? 0),
      half_day_pay_percent:      String(policy.half_day_pay_percent      ?? 50),
      default_tax_percent:       String(policy.default_tax_percent       ?? 0),
      default_pf_percent:        String(policy.default_pf_percent        ?? 0),
      working_days_basis:        policy.working_days_basis               ?? "manual",
    });
  }, [policy]);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    const res = await savePolicy({
      paid_leave_days_per_month: Number(form.paid_leave_days_per_month),
      half_day_pay_percent:      Number(form.half_day_pay_percent),
      default_tax_percent:       Number(form.default_tax_percent),
      default_pf_percent:        Number(form.default_pf_percent),
      working_days_basis:        form.working_days_basis,
    });
    if (res !== null) {
      dispatch(showToast({ type: "success", title: "Saved", message: "Payroll policy updated." }));
      refetch();
    }
  };

  // Live preview — what happens to a 30,000 salary with these settings
  const previewBasic   = 30000;
  const previewWorking = 26;
  const previewAbsent  = 2;
  const previewHalf    = 1;
  const previewLeave   = 1; // 1 leave taken

  const paidLeaveQuota = Number(form.paid_leave_days_per_month) || 0;
  const halfPayPct     = Number(form.half_day_pay_percent)      / 100;
  const taxPct         = Number(form.default_tax_percent)       / 100;
  const pfPct          = Number(form.default_pf_percent)        / 100;

  const perDay             = previewBasic / previewWorking;
  const unpaidLeave        = Math.max(0, previewLeave - paidLeaveQuota);
  const halfDeduction      = perDay * (1 - halfPayPct) * previewHalf;
  const absentDeduction    = perDay * previewAbsent;
  const leaveDeduction     = perDay * unpaidLeave;
  const attendanceDeduct   = absentDeduction + halfDeduction + leaveDeduction;
  const tax                = previewBasic * taxPct;
  const pf                 = previewBasic * pfPct;
  const net                = Math.max(0, previewBasic - attendanceDeduct - tax - pf);

  if (loading) {
    return (
      <div className={s("loading")}>
        <Loader fullScreen={false} size="md" text="Loading payroll policy…" />
      </div>
    );
  }

  return (
    <>
      <div className={s("panel-head")}>
        <div className={cx(s("ph-icon"))} style={{ background: "#fff3e0" }}>
          <i className="fa-solid fa-money-check-dollar" style={{ color: "#FF9B51" }} />
        </div>
        <div>
          <h2>Payroll Policy</h2>
          <p>Configure how faculty salaries are calculated — leave quotas, half-day pay, and default deductions</p>
        </div>
        <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size={14} /> : <i className="fa-solid fa-floppy-disk" />} Save Policy
        </button>
      </div>

      {/* ── Leave Rules ──────────────────────────────────────────────────── */}
      <div className={s("section-group")}>
        <div className={s("section-label")}>
          <i className="fa-solid fa-calendar-xmark" /> Leave Rules
        </div>

        <div className={s("grid")}>
          <Field
            label="Paid Leave Days / Month"
            hint="Leaves within this quota are not salary-deducted"
          >
            <input
              type="number"
              min={0}
              max={31}
              value={form.paid_leave_days_per_month}
              onChange={(e) => set("paid_leave_days_per_month")(e.target.value)}
              placeholder="e.g. 2"
            />
          </Field>

          <div /> {/* spacer */}
        </div>

        <InfoNote>
          Example: if quota is 2 and a teacher takes 3 leave days, only 1 day is deducted.
          Absent days (no leave applied) are always deducted regardless of quota.
        </InfoNote>
      </div>

      {/* ── Half-Day Rule ────────────────────────────────────────────────── */}
      <div className={s("section-group")}>
        <div className={s("section-label")}>
          <i className="fa-solid fa-circle-half-stroke" /> Half-Day Pay Rule
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: "#6a7882", marginBottom: 16 }}>
          When a teacher marks a half-day, how much of their per-day salary do they earn?
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { value: "100", label: "Full Pay",  sub: "No deduction for half-days",        icon: "fa-circle-check",       color: "#16a34a" },
            { value: "50",  label: "Half Pay",  sub: "Deduct 50% of per-day salary",      icon: "fa-circle-half-stroke", color: "#c46a14" },
            { value: "0",   label: "No Pay",    sub: "Full per-day salary deducted",       icon: "fa-circle-xmark",       color: "#b42318" },
          ].map((opt) => (
            <div
              key={opt.value}
              onClick={() => set("half_day_pay_percent")(opt.value)}
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                cursor: "pointer",
                border: `2px solid ${form.half_day_pay_percent === opt.value ? "#FF9B51" : "#dce5e9"}`,
                background: form.half_day_pay_percent === opt.value ? "#fff7ed" : "#fff",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${form.half_day_pay_percent === opt.value ? "#FF9B51" : "#c8d6de"}`,
                  background: form.half_day_pay_percent === opt.value ? "#FF9B51" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {form.half_day_pay_percent === opt.value && (
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#25343f" }}>
                  <i className={`fa-solid ${opt.icon}`} style={{ color: opt.color, marginRight: 6 }} />
                  {opt.label}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6a7882", marginTop: 2 }}>
                  {opt.sub}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Custom % input */}
        <div style={{ marginTop: 16 }}>
          <Field label="Custom Half-Day Pay %" hint="Or type any value between 0–100">
            <input
              type="number"
              min={0}
              max={100}
              value={form.half_day_pay_percent}
              onChange={(e) => set("half_day_pay_percent")(e.target.value)}
              placeholder="50"
              style={{ maxWidth: 180 }}
            />
          </Field>
        </div>
      </div>

      {/* ── Default Deductions ───────────────────────────────────────────── */}
      <div className={s("section-group")}>
        <div className={s("section-label")}>
          <i className="fa-solid fa-percent" /> Default Deductions (% of Basic Salary)
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: "#6a7882", marginBottom: 16 }}>
          These percentages pre-fill the Tax and PF fields in the Pay Salary page.
          Admin can still override them per payment.
        </p>

        <div className={s("grid")}>
          <Field label="Income Tax / TDS (%)" hint="e.g. 10 for 10%">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={form.default_tax_percent}
              onChange={(e) => set("default_tax_percent")(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Provident Fund / PF (%)" hint="e.g. 10 for 10%">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={form.default_pf_percent}
              onChange={(e) => set("default_pf_percent")(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>

        <InfoNote>
          Setting Tax to 15% on a <CurrencyAmount amount={30000} /> salary pre-fills <CurrencyAmount amount={4500} /> in the Tax field.
          The admin can adjust it before finalizing payment.
        </InfoNote>
      </div>

      {/* ── Working Days Basis ───────────────────────────────────────────── */}
      <div className={s("section-group")}>
        <div className={s("section-label")}>
          <i className="fa-solid fa-calendar-days" /> Working Days Basis
        </div>
        <div className={s("grid")}>
          <Field label="How to determine working days per month">
            <select
              value={form.working_days_basis}
              onChange={(e) => set("working_days_basis")(e.target.value)}
            >
              <option value="manual">Manual — Admin types each month</option>
              <option value="calendar">Calendar — Auto from weekly offs &amp; holidays (coming soon)</option>
            </select>
          </Field>
        </div>
      </div>

      {/* ── Live Preview ─────────────────────────────────────────────────── */}
      <div className={s("section-group")}>
        <div className={s("section-label")}>
          <i className="fa-solid fa-calculator" /> Live Calculation Preview
        </div>

        <div style={{
          background: "#f8fafc",
          border: "1px solid #dce5e9",
          borderRadius: 12,
          padding: "18px 20px",
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6a7882", marginBottom: 14 }}>
            Example: Basic <CurrencyAmount amount={previewBasic} /> · 26 working days · 2 absent · 1 half-day · 1 leave taken
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
            {[
              { label: "Basic Salary",                                                value: <CurrencyAmount amount={previewBasic} />,                                   color: "#25343f" },
              { label: "Per-day Rate",                                                value: <CurrencyAmount amount={perDay} />,                                         color: "#25343f" },
              { label: `Absent Deduction (×${previewAbsent})`,                        value: <>-<CurrencyAmount amount={absentDeduction} /></>,                          color: "#b42318" },
              { label: `Half-Day Deduction (×${previewHalf})`,                        value: <>-<CurrencyAmount amount={halfDeduction} /></>,                            color: "#c46a14" },
              { label: `Leave Deduction (${unpaidLeave} unpaid of ${previewLeave})`,  value: <>-<CurrencyAmount amount={leaveDeduction} /></>,                           color: unpaidLeave > 0 ? "#b42318" : "#16a34a" },
              { label: "Tax Deduction",                                               value: <>-<CurrencyAmount amount={tax} /></>,                                      color: "#b42318" },
              { label: "PF Deduction",                                                value: <>-<CurrencyAmount amount={pf} /></>,                                       color: "#b42318" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, paddingBottom: 6, borderBottom: "1px solid #eef2f5" }}>
                <span style={{ color: "#6a7882" }}>{row.label}</span>
                <span style={{ color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 14,
            padding: "12px 16px",
            background: "#ecfdf5",
            borderRadius: 8,
            border: "1px solid #bbf7d0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: 8 }} />
              Net Pay
            </span>
            <strong style={{ fontSize: 18, color: "#059669" }}><CurrencyAmount amount={net} /></strong>
          </div>
        </div>
      </div>

      <div className={s("panel-footer")}>
        <button className={cx(s("btn"), s("btn-ghost"))} onClick={() => refetch()}>
          <i className="fa-solid fa-rotate-left" /> Reset
        </button>
        <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size={14} /> : <i className="fa-solid fa-floppy-disk" />} Save Policy
        </button>
      </div>
    </>
  );
}
