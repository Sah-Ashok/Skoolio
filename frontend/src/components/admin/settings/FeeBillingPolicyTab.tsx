"use client";

import { useState, useEffect } from "react";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Loader, Spinner } from "@/components/shared/Loader";
import styles from "./settings.module.css";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className={s("info-note")}>
      <i className="fa-solid fa-circle-info" />
      <span>{children}</span>
    </div>
  );
}

type RadioOption = { value: string; label: string; sub: string; icon: string; color: string };

function RadioCards({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: RadioOption[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {options.map((opt) => (
        <div
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            cursor: "pointer",
            border: `2px solid ${value === opt.value ? "#FF9B51" : "#dce5e9"}`,
            background: value === opt.value ? "#fff7ed" : "#fff",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            transition: "all 0.15s",
          }}
        >
          {/* radio dot */}
          <div
            style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 2,
              border: `2px solid ${value === opt.value ? "#FF9B51" : "#c8d6de"}`,
              background: value === opt.value ? "#FF9B51" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {value === opt.value && (
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
            )}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#25343f" }}>
              <i className={`fa-solid ${opt.icon}`} style={{ color: opt.color, marginRight: 7 }} />
              {opt.label}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6a7882", marginTop: 4, lineHeight: 1.5 }}>
              {opt.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Scenario preview ─────────────────────────────────────────────────────────
function ScenarioPreview({
  billingStartFrom,
  monthlyBillWindow,
}: {
  billingStartFrom: string;
  monthlyBillWindow: string;
}) {
  // Example: AY starts Shrawan 2081 (≈ July 2024), student joins Falgun 2081 (≈ Feb 2025).
  // Admin generates bill for Bhadra 2081 (≈ Aug 2025, month 2 of AY).
  const joinMonth = "Feb 2025";
  const currentMonth = "Aug 2025";
  const ayStart = "July 2024";

  let billsGenerated: string[];
  let explanation: string;

  if (billingStartFrom === "academic_year" && monthlyBillWindow === "bill_current") {
    billsGenerated = [`${currentMonth} (for all enrolled students from ${ayStart})`];
    explanation = `Admin clicks "Generate August Bills." Every enrolled student gets an August bill regardless of when they joined.`;
  } else if (billingStartFrom === "academic_year" && monthlyBillWindow === "bill_past_due") {
    billsGenerated = [`${ayStart} → ${currentMonth} (all months, school-wide catch-up)`];
    explanation = `Admin generates once. System creates bills for all past months (July 2024 – Aug 2025) for every student in the academic year.`;
  } else if (billingStartFrom === "join_date" && monthlyBillWindow === "bill_current") {
    billsGenerated = [`${currentMonth} only (students joined before Aug see an Aug bill; student who joined Feb sees their first bill for Aug)`];
    explanation = `Student joined Feb 2025. Admin generates for Aug 2025 — only Aug is created now. Feb–Jul show as "not billed" in history. Admin must generate each month manually.`;
  } else {
    // join_date + bill_past_due
    billsGenerated = [
      `Feb 2025 (join month)`,
      `Mar · Apr · May · Jun · Jul · Aug 2025`,
    ];
    explanation = `Student joined Feb 2025. Admin generates for Aug 2025. System auto-creates Feb, Mar, Apr, May, Jun, Jul, Aug — all unpaid months since join date — in one shot.`;
  }

  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #dce5e9",
        borderRadius: 12,
        padding: "18px 20px",
        marginTop: 4,
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
        <i className="fa-solid fa-flask" style={{ marginRight: 6, color: "#FF9B51" }} />
        Live Scenario — Student joined {joinMonth}, current month {currentMonth}
      </p>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10, lineHeight: 1.6 }}>
        {explanation}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {billsGenerated.map((b, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 12px", borderRadius: 8,
              background: "#ecfdf5", border: "1px solid #bbf7d0",
              fontSize: 12, fontWeight: 800, color: "#166534",
            }}
          >
            <i className="fa-solid fa-circle-check" style={{ fontSize: 10 }} />
            {b}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FeeBillingPolicyTab() {
  const dispatch = useAppDispatch();

  const { data: policy, loading, refetch } = useApi<any>("/fee-billing-policy");
  const { execute: savePolicy, loading: saving } = useMutation("/fee-billing-policy", "PUT");

  const [form, setForm] = useState({
    billing_start_from:  "academic_year",
    monthly_bill_window: "bill_current",
    overdue_grace_days:  "0",
  });

  useEffect(() => {
    if (!policy) return;
    // API wraps in { data: ... } — unwrap
    const p = (policy as any).data ?? policy;
    setForm({
      billing_start_from:  p.billing_start_from  ?? "academic_year",
      monthly_bill_window: p.monthly_bill_window  ?? "bill_current",
      overdue_grace_days:  String(p.overdue_grace_days ?? 0),
    });
  }, [policy]);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    const grace = Number(form.overdue_grace_days);
    if (!Number.isInteger(grace) || grace < 0 || grace > 90) {
      dispatch(showToast({ type: "error", title: "Invalid", message: "Grace days must be 0–90." }));
      return;
    }
    const res = await savePolicy({
      billing_start_from:  form.billing_start_from,
      monthly_bill_window: form.monthly_bill_window,
      overdue_grace_days:  grace,
    });
    if (res !== null) {
      dispatch(showToast({ type: "success", title: "Saved", message: "Fee billing policy updated." }));
      refetch();
    }
  };

  if (loading) {
    return (
      <div className={s("loading")}>
        <Loader fullScreen={false} size="md" text="Loading fee billing policy…" />
      </div>
    );
  }

  const startFromOptions: RadioOption[] = [
    {
      value: "academic_year",
      label: "Academic Year Start",
      icon:  "fa-calendar-star",
      color: "#3b5bdb",
      sub:   "All students are billed from the AY start date regardless of when they joined. Simplest for schools with a fixed intake.",
    },
    {
      value: "join_date",
      label: "Student Join Date",
      icon:  "fa-user-clock",
      color: "#059669",
      sub:   "Billing starts from the month the student was admitted. A mid-year joiner is only billed from their join month onward.",
    },
  ];

  const billWindowOptions: RadioOption[] = [
    {
      value: "bill_current",
      label: "Current Month Only",
      icon:  "fa-calendar-day",
      color: "#c46a14",
      sub:   "When admin generates bills, only the selected month is created. Admin must run generation each month manually.",
    },
    {
      value: "bill_past_due",
      label: "Catch-Up All Unbilled Months",
      icon:  "fa-calendar-check",
      color: "#7c3aed",
      sub:   "On each run the system also creates any past months (since billing start) that were never billed. One click covers all arrears.",
    },
  ];

  return (
    <>
      {/* ── Header ── */}
      <div className={s("panel-head")}>
        <div className={cx(s("ph-icon"))} style={{ background: "#e8edff" }}>
          <i className="fa-solid fa-file-invoice-dollar" style={{ color: "#3b5bdb" }} />
        </div>
        <div>
          <h2>Fee Billing Policy</h2>
          <p>Control how monthly bills are generated — when billing starts and how past months are handled</p>
        </div>
        <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size={14} /> : <i className="fa-solid fa-floppy-disk" />} Save Policy
        </button>
      </div>

      {/* ── Billing Start From ── */}
      <div className={s("section-group")}>
        <div className={s("section-label")}>
          <i className="fa-solid fa-flag-checkered" /> When Does Billing Start?
        </div>
        <RadioCards
          value={form.billing_start_from}
          onChange={set("billing_start_from")}
          options={startFromOptions}
        />
        <InfoNote>
          This controls the effective billing start for monthly and recurring fees.
          Yearly and one-time fees are always billed at enrollment regardless of this setting.
        </InfoNote>
      </div>

      {/* ── Monthly Bill Window ── */}
      <div className={s("section-group")}>
        <div className={s("section-label")}>
          <i className="fa-solid fa-layer-group" /> How Many Months Per Generation Run?
        </div>
        <RadioCards
          value={form.monthly_bill_window}
          onChange={set("monthly_bill_window")}
          options={billWindowOptions}
        />
        <InfoNote>
          "Catch-Up" mode is useful when you missed several months or onboard a mid-year student.
          Bills are never double-created — the system skips any month that already has a bill.
        </InfoNote>
      </div>

      {/* ── Overdue Grace Days ── */}
      <div className={s("section-group")}>
        <div className={s("section-label")}>
          <i className="fa-solid fa-hourglass-half" /> Overdue Grace Period
        </div>
        <div className={s("grid")}>
          <div className={s("field")}>
            <label>
              Grace Days After Due Date
              <span className={s("field-hint")}>0 = overdue immediately on due date</span>
            </label>
            <input
              type="number"
              min={0}
              max={90}
              value={form.overdue_grace_days}
              onChange={(e) => set("overdue_grace_days")(e.target.value)}
              placeholder="e.g. 5"
              style={{ maxWidth: 180 }}
            />
          </div>
          <div />
        </div>
        <InfoNote>
          A bill due on the 10th with 5 grace days turns "overdue" only after the 15th.
          This affects the overdue badge shown in fee history — it does not extend the due date itself.
        </InfoNote>
      </div>

      {/* ── Live Scenario Preview ── */}
      <div className={s("section-group")}>
        <div className={s("section-label")}>
          <i className="fa-solid fa-calculator" /> Scenario Preview
        </div>
        <ScenarioPreview
          billingStartFrom={form.billing_start_from}
          monthlyBillWindow={form.monthly_bill_window}
        />
      </div>

      {/* ── Yearly Fee Note ── */}
      <div className={s("section-group")}>
        <div className={s("section-label")}>
          <i className="fa-solid fa-circle-info" /> Yearly & One-Time Fee Behaviour
        </div>
        <div
          style={{
            padding: "16px 18px", borderRadius: 12,
            background: "#fff7ed", border: "1.5px solid #fed7aa",
            fontSize: 13, fontWeight: 700, color: "#92400e", lineHeight: 1.7,
          }}
        >
          <strong style={{ display: "block", marginBottom: 6 }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 7, color: "#ea580c" }} />
            Yearly and one-time fees (e.g. Tuition Rs 40,000/year) are handled separately:
          </strong>
          <ul style={{ margin: "0 0 0 20px", padding: 0 }}>
            <li>They are created <em>once per academic year</em> at enrollment time (or on the first billing run).</li>
            <li>Students can pay in instalments — each payment reduces the remaining balance on that single bill.</li>
            <li>The <strong>Fee History page</strong> shows a banner: "All yearly fees cleared" once the bill is fully paid or waived.</li>
            <li>Monthly fees (e.g. Computer Lab Rs 500/month) generate a <em>separate</em> bill each month and do not interfere.</li>
          </ul>
        </div>
      </div>

      {/* ── Footer ── */}
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
