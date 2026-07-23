"use client";

import { useState, useMemo } from "react";
import { useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

// ── Utility: compute dynamic saving text ─────────────────────────────────────
export function computeSavingText(
  discountType: string,
  discountValue: number,
  plans: any[],
  planName: string | null,
  appliesToBilling: string | null,
  currency: string | null,
): string {
  if (discountType === "percent") {
    return `Save ${discountValue}% on your subscription`;
  }
  if (discountType === "free_months") {
    const targetPlan = planName
      ? plans.find(p => p.name === planName)
      : plans.find(p => p.name !== "Free");
    if (targetPlan) {
      const curr = currency || "NPR";
      const monthlyPrice = curr === "INR" ? targetPlan.price_inr_monthly : targetPlan.price_npr_monthly;
      const saved = monthlyPrice * discountValue;
      const sym = curr === "INR" ? "₹" : curr === "USD" ? "$" : "Rs.";
      return `${discountValue} month${discountValue !== 1 ? "s" : ""} free — worth ${sym}${saved.toLocaleString()}`;
    }
    return `${discountValue} month${discountValue !== 1 ? "s" : ""} free`;
  }
  if (discountType === "fixed") {
    const curr = currency || "NPR";
    const sym = curr === "INR" ? "₹" : curr === "USD" ? "$" : "Rs.";
    return `Save ${sym}${discountValue.toLocaleString()} flat`;
  }
  return "";
}

export default function OfferModal({ offer, plans, onClose, onSaved }: {
  offer: any | null; plans: any[]; onClose: () => void; onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const isEdit = !!offer;
  const { execute, loading } = useMutation(
    isEdit ? `/subscriptions/offers/${offer?.id}` : "/subscriptions/offers",
    isEdit ? "PATCH" : "POST"
  );

  const [form, setForm] = useState({
    code:                offer?.code                ?? "",
    title:               offer?.title               ?? "",
    description:         offer?.description         ?? "",
    discount_type:       offer?.discount_type       ?? "percent",
    discount_value:      offer?.discount_value      ?? "",
    applies_to_billing:  offer?.applies_to_billing  ?? "",
    plan_name:           offer?.plan_name           ?? "",
    min_months:          offer?.min_months          ?? "",
    saving_text:         offer?.saving_text         ?? "",
    currency_applies_to: offer?.currency_applies_to ?? "",
    max_uses:            offer?.max_uses            ?? "",
    valid_from:          offer?.valid_from
      ? offer.valid_from.split("T")[0]
      : new Date().toISOString().split("T")[0],
    valid_until:         offer?.valid_until ? offer.valid_until.split("T")[0] : "",
    is_active:           offer?.is_active ?? true,
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const previewSaving = useMemo(() => {
    if (!form.discount_value) return "";
    return computeSavingText(
      form.discount_type,
      parseFloat(form.discount_value as any) || 0,
      plans,
      form.plan_name || null,
      form.applies_to_billing || null,
      form.currency_applies_to || null,
    );
  }, [form.discount_type, form.discount_value, form.plan_name, form.applies_to_billing, form.currency_applies_to, plans]);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      dispatch(showToast({ type: "error", title: "Error", message: "Title is required" }));
      return;
    }
    if (!isEdit && !form.code.trim()) {
      dispatch(showToast({ type: "error", title: "Error", message: "Code is required" }));
      return;
    }
    if (!form.discount_value) {
      dispatch(showToast({ type: "error", title: "Error", message: "Discount value is required" }));
      return;
    }
    try {
      await execute({
        ...(isEdit ? {} : { code: form.code.trim().toUpperCase() }),
        title:               form.title,
        description:         form.description        || undefined,
        discount_type:       form.discount_type,
        discount_value:      parseFloat(form.discount_value as any),
        applies_to_billing:  form.applies_to_billing  || undefined,
        plan_name:           form.plan_name            || undefined,
        min_months:          form.min_months           ? parseInt(form.min_months as any) : undefined,
        saving_text:         form.saving_text          || undefined,
        currency_applies_to: form.currency_applies_to  || undefined,
        max_uses:            form.max_uses             ? parseInt(form.max_uses as any) : undefined,
        valid_from:          form.valid_from           || undefined,
        valid_until:         form.valid_until          || undefined,
        is_active:           form.is_active,
      });
      onSaved();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message ?? "Failed to save offer" }));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 9,
    border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box", background: "#fff",
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, fontWeight: 700 };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize: 11, fontWeight: 900, color: "#FF9B51", letterSpacing: ".4px", margin: "0 0 10px" }}>
      {children}
    </p>
  );
  const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <label style={{ fontSize: 11.5, fontWeight: 900, color: "#374151", display: "block", marginBottom: 5 }}>
      {children}
    </label>
  );
  const Hint = ({ children }: { children: React.ReactNode }) => (
    <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, display: "block" }}>{children}</span>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: "1rem" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 580, maxHeight: "94vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(15,23,42,.28)", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", background: "linear-gradient(135deg, #25343F, #1e2d38)", borderRadius: "18px 18px 0 0", flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "1px", color: "#FF9B51", margin: "0 0 4px" }}>
            {isEdit ? "EDIT OFFER" : "NEW OFFER"}
          </p>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: "#fff", margin: 0 }}>
            {isEdit ? offer.title : "Create Promotional Offer"}
          </h2>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.4)", margin: "2px 0 0" }}>
            Set up discounts, free trials, and special promotions for school plans
          </p>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>

          {/* Basic info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel>Offer Title *</FieldLabel>
              <input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. 1 Month Free Trial" />
            </div>
            <div>
              <FieldLabel>Promo Code *</FieldLabel>
              <input
                style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "1px", textTransform: "uppercase", background: isEdit ? "#f8fafc" : "#fff" }}
                value={form.code}
                onChange={e => set("code", e.target.value.toUpperCase())}
                placeholder="e.g. FIRST1FREE"
                disabled={isEdit}
              />
              <Hint>{isEdit ? "Code cannot be changed after creation" : "Auto-uppercased"}</Hint>
            </div>
          </div>

          <div>
            <FieldLabel>Description (optional)</FieldLabel>
            <input style={inputStyle} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Short description shown below the offer title" />
          </div>

          {/* Discount settings */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1.5px solid #e2e8f0" }}>
            <SectionLabel>DISCOUNT SETTINGS</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <FieldLabel>Discount Type *</FieldLabel>
                <select style={selectStyle} value={form.discount_type} onChange={e => set("discount_type", e.target.value)}>
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                  <option value="free_months">Free Months</option>
                </select>
              </div>
              <div>
                <FieldLabel>
                  {form.discount_type === "percent"     ? "Discount (%)" :
                   form.discount_type === "free_months" ? "Number of Free Months" :
                   "Fixed Amount"}
                </FieldLabel>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  max={form.discount_type === "percent" ? "100" : undefined}
                  value={form.discount_value as any}
                  onChange={e => set("discount_value", e.target.value)}
                  placeholder={
                    form.discount_type === "percent"     ? "0–100" :
                    form.discount_type === "free_months" ? "e.g. 2" :
                    "e.g. 500"
                  }
                />
              </div>
            </div>

            {/* Live saving preview */}
            {previewSaving && (
              <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "linear-gradient(135deg,#fff7ed,#fff)", border: "1px dashed #FF9B51", display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fa-solid fa-piggy-bank" style={{ color: "#FF9B51", fontSize: 14 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "#6b7b86" }}>Auto-computed saving label:</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1e293b" }}>{previewSaving}</p>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <FieldLabel>Saving Text Override</FieldLabel>
              <input
                style={inputStyle}
                value={form.saving_text as any}
                onChange={e => set("saving_text", e.target.value)}
                placeholder={previewSaving || "e.g. Save NPR 2,400/year vs monthly"}
              />
              <Hint>Leave blank to use the auto-computed label above</Hint>
            </div>
          </div>

          {/* Applicability */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1.5px solid #e2e8f0" }}>
            <p style={{ fontSize: 11, fontWeight: 900, color: "#6b7b86", letterSpacing: ".4px", margin: "0 0 10px" }}>APPLICABILITY</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <FieldLabel>Applies to Plan</FieldLabel>
                <select style={selectStyle} value={form.plan_name as any} onChange={e => set("plan_name", e.target.value)}>
                  <option value="">Any Plan</option>
                  {plans.filter(p => p.name !== "Free").map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <Hint>Blank = any plan</Hint>
              </div>
              <div>
                <FieldLabel>Billing Cycle</FieldLabel>
                <select style={selectStyle} value={form.applies_to_billing as any} onChange={e => set("applies_to_billing", e.target.value)}>
                  <option value="">Both</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <Hint>Blank = both</Hint>
              </div>
              <div>
                <FieldLabel>Currency</FieldLabel>
                <select style={selectStyle} value={form.currency_applies_to as any} onChange={e => set("currency_applies_to", e.target.value)}>
                  <option value="">All Currencies</option>
                  <option value="NPR">NPR (Nepal)</option>
                  <option value="INR">INR (India)</option>
                  <option value="USD">USD</option>
                </select>
                <Hint>Blank = all</Hint>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <FieldLabel>Min. Subscription Months</FieldLabel>
              <input
                style={{ ...inputStyle, maxWidth: 160 }}
                type="number" min="1"
                value={form.min_months as any}
                onChange={e => set("min_months", e.target.value)}
                placeholder="e.g. 6"
              />
              <Hint>Optional — leave blank for no minimum</Hint>
            </div>
          </div>

          {/* Validity & usage */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1.5px solid #e2e8f0" }}>
            <p style={{ fontSize: 11, fontWeight: 900, color: "#6b7b86", letterSpacing: ".4px", margin: "0 0 10px" }}>VALIDITY & USAGE</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <FieldLabel>Valid From</FieldLabel>
                <input style={inputStyle} type="date" value={form.valid_from as any} onChange={e => set("valid_from", e.target.value)} />
              </div>
              <div>
                <FieldLabel>Valid Until</FieldLabel>
                <input style={inputStyle} type="date" value={form.valid_until as any} onChange={e => set("valid_until", e.target.value)} />
                <Hint>Blank = no expiry</Hint>
              </div>
              <div>
                <FieldLabel>Max Uses</FieldLabel>
                <input
                  style={inputStyle} type="number" min="1"
                  value={form.max_uses as any}
                  onChange={e => set("max_uses", e.target.value)}
                  placeholder="∞"
                />
                <Hint>Blank = unlimited</Hint>
              </div>
            </div>
          </div>

          {/* Active toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, background: form.is_active ? "#f0fdf4" : "#f8fafc", border: `1.5px solid ${form.is_active ? "#bbf7d0" : "#e2e8f0"}` }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1e293b" }}>Offer Active</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7b86" }}>Active offers are visible to school admins on the upgrade page</p>
            </div>
            <button
              onClick={() => set("is_active", !form.is_active)}
              style={{ width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", position: "relative", background: form.is_active ? "#FF9B51" : "#cbd5e1", transition: "background .2s", flexShrink: 0 }}
            >
              <span style={{ position: "absolute", top: 3, left: form.is_active ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", display: "block" }} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px 20px", display: "flex", gap: 10, borderTop: "1px solid #eef2f3", flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ flex: 2, padding: "10px", borderRadius: 9, border: "none", background: "#FF9B51", color: "#fff", fontWeight: 800, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.75 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {loading ? <Spinner size={16} /> : <><i className="fa-solid fa-floppy-disk" /> {isEdit ? "Save Changes" : "Create Offer"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
