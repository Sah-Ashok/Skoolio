"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useApi } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import styles from "./sa.module.css";
import { apiRequest } from "@/lib/api";

const s  = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

// ── helpers ────────────────────────────────────────────────────────────────

function calcYearlyFromDiscount(monthly: string | number, pct: number): number {
  const m = parseFloat(monthly as any);
  if (!m || isNaN(m) || m <= 0) return 0;
  return Math.round(m * 12 * (1 - pct / 100));
}

function calcDiscountFromYearly(monthly: string | number, yearly: string | number): number {
  const m = parseFloat(monthly as any);
  const y = parseFloat(yearly  as any);
  if (!m || !y || isNaN(m) || isNaN(y) || m <= 0 || y <= 0) return 0;
  const pct = ((m * 12 - y) / (m * 12)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10)); // 1 decimal
}

// ── PricingSection ─────────────────────────────────────────────────────────

type YearlyMode = "discount" | "manual";

interface PricingSectionState {
  discount:    number;        // % (used when mode === "discount")
  manualYearly: string;       // raw string (used when mode === "manual")
  mode:        YearlyMode;
}

interface PricingSectionProps {
  label:            string;
  currency:         string;
  monthly:          string | number;
  onMonthlyChange:  (v: string) => void;
  state:            PricingSectionState;
  onStateChange:    (s: PricingSectionState) => void;
  /** Final resolved yearly price to be saved */
  resolvedYearly:   number;
}

function PricingSection({
  label, currency, monthly, onMonthlyChange,
  state, onStateChange, resolvedYearly,
}: PricingSectionProps) {
  const { discount, manualYearly, mode } = state;

  const monthlyNum = parseFloat(monthly as any) || 0;
  const hasMonthly = monthlyNum > 0;

  const saving = hasMonthly && resolvedYearly > 0
    ? Math.round(monthlyNum * 12 - resolvedYearly)
    : 0;
  const discountPct = hasMonthly && resolvedYearly > 0
    ? calcDiscountFromYearly(monthly, resolvedYearly)
    : 0;

  // ── mode toggle ──────────────────────────────────────────────────────────
  const switchMode = (next: YearlyMode) => {
    if (next === mode) return;
    if (next === "manual") {
      // pre-fill manual box with current computed yearly so admin can tweak it
      const computed = calcYearlyFromDiscount(monthly, discount);
      onStateChange({ ...state, mode: "manual", manualYearly: computed > 0 ? String(computed) : "" });
    } else {
      // switching back to discount — infer % from whatever manual value is set
      const inferred = Math.round(calcDiscountFromYearly(monthly, manualYearly));
      onStateChange({ ...state, mode: "discount", discount: inferred });
    }
  };

  // ── discount handlers ────────────────────────────────────────────────────
  const handleDiscountInput = (raw: string) => {
    if (raw === "") { onStateChange({ ...state, discount: 0 }); return; }
    const n = parseFloat(raw);
    if (isNaN(n)) return;
    onStateChange({ ...state, discount: Math.max(0, Math.min(100, n)) });
  };

  const handleSlider = (raw: string) => {
    onStateChange({ ...state, discount: parseInt(raw) });
  };

  // ── manual yearly handler ────────────────────────────────────────────────
  const handleManualYearly = (raw: string) => {
    onStateChange({ ...state, manualYearly: raw });
  };

  // ── computed display values ──────────────────────────────────────────────
  const previewYearly = mode === "discount"
    ? calcYearlyFromDiscount(monthly, discount)
    : (parseFloat(manualYearly) || 0);

  const previewSaving  = hasMonthly && previewYearly > 0 ? Math.round(monthlyNum * 12 - previewYearly) : 0;
  const previewPct     = hasMonthly && previewYearly > 0 ? calcDiscountFromYearly(monthly, previewYearly) : 0;
  const hasDiscount    = previewPct > 0 && previewSaving > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Section title + mode toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 12, fontWeight: 900, color: "#6b7b86", margin: 0 }}>{label}</p>

        {/* Toggle pill */}
        <div style={{
          display: "inline-flex", borderRadius: 99,
          border: "1px solid #dce5e9", overflow: "hidden",
          fontSize: 11, fontWeight: 700,
        }}>
          <button
            onClick={() => switchMode("discount")}
            style={{
              padding: "4px 12px", border: "none", cursor: "pointer",
              background: mode === "discount" ? "#25343F" : "#f8fafc",
              color:      mode === "discount" ? "#FF9B51" : "#6b7b86",
              transition: "all .15s",
            }}
          >
            <i className="fa-solid fa-percent" style={{ marginRight: 5, fontSize: 10 }} />
            Discount %
          </button>
          <button
            onClick={() => switchMode("manual")}
            style={{
              padding: "4px 12px", border: "none", cursor: "pointer",
              background: mode === "manual" ? "#25343F" : "#f8fafc",
              color:      mode === "manual" ? "#FF9B51" : "#6b7b86",
              transition: "all .15s",
            }}
          >
            <i className="fa-solid fa-pencil" style={{ marginRight: 5, fontSize: 10 }} />
            Manual
          </button>
        </div>
      </div>

      {/* ── Row: Monthly + Yearly input (mode-dependent) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* Monthly */}
        <div className={s("field")} style={{ margin: 0 }}>
          <label>Monthly ({currency})</label>
          <input
            type="number"
            value={monthly as any}
            onChange={e => onMonthlyChange(e.target.value)}
            placeholder="0"
            min={0}
          />
        </div>

        {/* DISCOUNT MODE: % input */}
        {mode === "discount" && (
          <div className={s("field")} style={{ margin: 0 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Yearly Discount</span>
              {discount > 0 && (
                <span style={{
                  background: "#FF9B51", color: "#fff",
                  borderRadius: 99, padding: "1px 8px",
                  fontSize: 11, fontWeight: 800,
                }}>
                  {discount}% OFF
                </span>
              )}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                min={0} max={100}
                value={discount === 0 ? "" : discount}
                onChange={e => handleDiscountInput(e.target.value)}
                placeholder="e.g. 20"
                disabled={!hasMonthly}
                style={{ paddingRight: 32 }}
              />
              <span style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                fontSize: 13, fontWeight: 700, color: "#94a3b8", pointerEvents: "none",
              }}>%</span>
            </div>
          </div>
        )}

        {/* MANUAL MODE: direct yearly amount input */}
        {mode === "manual" && (
          <div className={s("field")} style={{ margin: 0 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Yearly ({currency})</span>
              {previewPct > 0 && (
                <span style={{
                  background: "#FF9B51", color: "#fff",
                  borderRadius: 99, padding: "1px 8px",
                  fontSize: 11, fontWeight: 800,
                }}>
                  {Math.round(previewPct)}% OFF
                </span>
              )}
            </label>
            <input
              type="number"
              value={manualYearly}
              onChange={e => handleManualYearly(e.target.value)}
              placeholder="e.g. 39999"
              disabled={!hasMonthly}
              min={0}
            />
          </div>
        )}
      </div>

      {/* Slider — discount mode only */}
      {mode === "discount" && hasMonthly && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, whiteSpace: "nowrap" }}>0%</span>
          <input
            type="range"
            min={0} max={50} step={1}
            value={Math.min(discount, 50)}
            onChange={e => handleSlider(e.target.value)}
            style={{ flex: 1, accentColor: "#FF9B51", cursor: "pointer", height: 4 }}
          />
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, whiteSpace: "nowrap" }}>50%</span>
        </div>
      )}

      {/* Preview card */}
      {hasMonthly ? (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", borderRadius: 10,
          background: hasDiscount ? "#f0fdf4" : "#f8fafc",
          border:     `1px solid ${hasDiscount ? "#bbf7d0" : "#e2e8f0"}`,
          transition: "all .2s",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i
              className={`fa-solid ${mode === "manual" ? "fa-pen-to-square" : "fa-calendar-check"}`}
              style={{ color: hasDiscount ? "#16a34a" : "#94a3b8", fontSize: 13 }}
            />
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: hasDiscount ? "#15803d" : "#475569" }}>
                Yearly Price →&nbsp;
                <strong>{currency} {previewYearly > 0 ? previewYearly.toLocaleString() : "—"}</strong>
                {mode === "manual" && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>(manual)</span>
                )}
              </p>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: hasDiscount ? "#15803d" : "#94a3b8" }}>
                {hasDiscount
                  ? `Customers save ${currency} ${previewSaving.toLocaleString()} (${Math.round(previewPct)}% off) vs paying monthly`
                  : mode === "manual"
                    ? "Enter an amount less than 12 × monthly to show a discount"
                    : "Set a discount % above to offer a yearly deal"}
              </p>
            </div>
          </div>
          {hasDiscount && (
            <span style={{
              background: "#16a34a", color: "#fff",
              borderRadius: 99, padding: "3px 10px",
              fontSize: 11, fontWeight: 800, whiteSpace: "nowrap",
            }}>
              {Math.round(previewPct)}% OFF
            </span>
          )}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>
          Enter a monthly price first to configure yearly pricing.
        </p>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

interface Props {
  planId?: number | null;
}

export default function EditPlanPage({ planId }: Props) {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const isEdit   = !!planId;

  const { data: existing, loading: fetchLoading } = useApi<any>(
    isEdit ? `/subscriptions/plans/${planId}` : ""
  );

  const [form, setForm] = useState({
    name:                   "",
    max_students:           "" as string | number,
    max_teachers:           "" as string | number,
    fee_management_enabled: true,
    online_payment_enabled: false,
    price_npr_monthly:      "" as string | number,
    price_inr_monthly:      "" as string | number,
    is_active:              true,
  });

  const [nprState, setNprState] = useState<{ discount: number; manualYearly: string; mode: "discount" | "manual" }>({
    discount: 0, manualYearly: "", mode: "discount",
  });
  const [inrState, setInrState] = useState<{ discount: number; manualYearly: string; mode: "discount" | "manual" }>({
    discount: 0, manualYearly: "", mode: "discount",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        name:                   existing.name                   ?? "",
        max_students:           existing.max_students           ?? "",
        max_teachers:           existing.max_teachers           ?? "",
        fee_management_enabled: existing.fee_management_enabled ?? true,
        online_payment_enabled: existing.online_payment_enabled ?? false,
        price_npr_monthly:      existing.price_npr_monthly      ?? "",
        price_inr_monthly:      existing.price_inr_monthly      ?? "",
        is_active:              existing.is_active              ?? true,
      });

      // Infer NPR discount from stored yearly
      const nprPct = Math.round(calcDiscountFromYearly(existing.price_npr_monthly, existing.price_npr_yearly));
      setNprState({ discount: nprPct, manualYearly: String(existing.price_npr_yearly ?? ""), mode: "discount" });

      const inrPct = Math.round(calcDiscountFromYearly(existing.price_inr_monthly, existing.price_inr_yearly));
      setInrState({ discount: inrPct, manualYearly: String(existing.price_inr_yearly ?? ""), mode: "discount" });
    }
  }, [existing]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Resolve the final yearly value for each currency
  const resolveYearly = (
    monthly: string | number,
    st: { discount: number; manualYearly: string; mode: "discount" | "manual" },
  ): number => {
    if (st.mode === "manual") return parseFloat(st.manualYearly) || 0;
    return calcYearlyFromDiscount(monthly, st.discount);
  };

  const nprYearly = resolveYearly(form.price_npr_monthly, nprState);
  const inrYearly = resolveYearly(form.price_inr_monthly, inrState);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Plan name is required." }));
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        max_students:      form.max_students !== "" ? parseInt(form.max_students as any) : null,
        max_teachers:      form.max_teachers !== "" ? parseInt(form.max_teachers as any) : null,
        price_npr_monthly: parseFloat(form.price_npr_monthly as any) || 0,
        price_npr_yearly:  nprYearly,
        price_inr_monthly: parseFloat(form.price_inr_monthly as any) || 0,
        price_inr_yearly:  inrYearly,
      };

      if (isEdit) {
        await apiRequest(`/subscriptions/plans/${planId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiRequest("/subscriptions/plans", { method: "POST", body: JSON.stringify(body) });
      }

      dispatch(showToast({ type: "success", title: isEdit ? "Updated" : "Created", message: `Plan "${form.name}" saved.` }));
      router.push("/super-admin/subscriptions");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message ?? "Failed to save plan." }));
    } finally {
      setSaving(false);
    }
  };

  const toggles = [
    { key: "fee_management_enabled", label: "Fee Management Enabled",  desc: "Schools on this plan can collect fees" },
    { key: "online_payment_enabled", label: "Online Payments Enabled", desc: "Students can submit bank transfer proof online" },
    { key: "is_active",              label: "Plan Active",              desc: "Inactive plans are hidden from school admins" },
  ];

  if (isEdit && fetchLoading) {
    return (
      <div className={s("sa-page")}>
        <Topbar title="Edit Plan" subtitle="Configure plan limits and pricing" />
        <main className={s("page-content")}>
          <div style={{ padding: "4rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading plan details…" /></div>
        </main>
      </div>
    );
  }

  return (
    <div className={s("sa-page")}>
      <Topbar
        title={isEdit ? `Edit Plan: ${existing?.name ?? ""}` : "New Plan"}
        subtitle="Configure plan limits and pricing"
      />
      <main className={s("page-content")}>

        <div className={s("page-head")}>
          <div>
            <button
              onClick={() => router.back()}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, background: "none", border: "none", cursor: "pointer", color: "#6b7b86", fontSize: 13, fontWeight: 700, padding: 0 }}
            >
              <i className="fa-solid fa-arrow-left" style={{ fontSize: 11 }} /> Back to Subscriptions
            </button>
            <h1>{isEdit ? "Edit Plan" : "Create New Plan"}</h1>
            <p style={{ color: "#6b7b86", fontSize: 13 }}>
              {isEdit
                ? "Changes apply immediately to all schools on this plan."
                : "Fill in plan details. Pricing and limits can be changed later."}
            </p>
          </div>
        </div>

        <div style={{ maxWidth: 620, display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #dce5e9", overflow: "hidden" }}>

            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", background: "linear-gradient(135deg,#25343F,#1e2d38)" }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 900, letterSpacing: "1px", color: "#FF9B51", marginBottom: 4 }}>
                {isEdit ? "EDIT PLAN" : "NEW PLAN"}
              </p>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#fff" }}>
                {isEdit ? existing?.name ?? "Plan" : "Plan Details"}
              </h2>
            </div>

            <div className={s("form-body")}>

              {!isEdit && (
                <div className={s("field")}>
                  <label>Plan Name</label>
                  <input
                    value={form.name as string}
                    onChange={e => set("name", e.target.value)}
                    placeholder="e.g. Pro"
                  />
                </div>
              )}

              <div className={s("form-grid-2")}>
                <div className={s("field")}>
                  <label>Max Students <span style={{ color: "#94a3b8", fontWeight: 600 }}>(blank&nbsp;=&nbsp;∞)</span></label>
                  <input type="number" value={form.max_students as any} onChange={e => set("max_students", e.target.value)} placeholder="e.g. 300" />
                </div>
                <div className={s("field")}>
                  <label>Max Teachers <span style={{ color: "#94a3b8", fontWeight: 600 }}>(blank&nbsp;=&nbsp;∞)</span></label>
                  <input type="number" value={form.max_teachers as any} onChange={e => set("max_teachers", e.target.value)} placeholder="e.g. 20" />
                </div>
              </div>

              <PricingSection
                label="NPR PRICING (Nepal)"
                currency="NPR"
                monthly={form.price_npr_monthly}
                onMonthlyChange={v => set("price_npr_monthly", v)}
                state={nprState}
                onStateChange={setNprState}
                resolvedYearly={nprYearly}
              />

              <PricingSection
                label="INR PRICING (India)"
                currency="INR"
                monthly={form.price_inr_monthly}
                onMonthlyChange={v => set("price_inr_monthly", v)}
                state={inrState}
                onStateChange={setInrState}
                resolvedYearly={inrYearly}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {toggles.map(t => (
                  <div key={t.key} className={s("toggle-row")}>
                    <div className={s("toggle-info")}>
                      <p>{t.label}</p>
                      <span>{t.desc}</span>
                    </div>
                    <button
                      className={cx(s("toggle"), (form as any)[t.key] ? s("toggle-on") : s("toggle-off"))}
                      onClick={() => set(t.key, !(form as any)[t.key])}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className={s("form-actions")}>
              <button className={cx(s("btn"), s("btn-soft"))} onClick={() => router.back()} disabled={saving}>
                Cancel
              </button>
              <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSubmit} disabled={saving}>
                {saving
                  ? <><Spinner size={16} />&nbsp;Saving…</>
                  : <><i className="fa-solid fa-floppy-disk" />&nbsp;{isEdit ? "Save Changes" : "Create Plan"}</>}
              </button>
            </div>
          </div>

          {isEdit && (
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 12, textAlign: "center" }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />
              Changes apply immediately — all schools on this plan will see updated limits and prices.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
