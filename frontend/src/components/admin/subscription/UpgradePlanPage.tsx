"use client";

import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useState } from "react";
import { getPlanPrice } from "@/lib/currency";
import { computeSavingText } from "@/components/super-admin/OfferModal";

// ─────────────────────────────────────────────────────────────────────────────
// Plan order for upgrade/downgrade logic (index = tier level)
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_ORDER = ["Pro", "Plus", "Ultra"];

function getPlanTier(name: string): number {
  const idx = PLAN_ORDER.indexOf(name);
  return idx === -1 ? 0 : idx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build feature list DYNAMICALLY from actual plan DB data
// ─────────────────────────────────────────────────────────────────────────────
function buildFeatures(plan: any): { text: string; included: boolean }[] {
  const features: { text: string; included: boolean }[] = [];

  // Students limit — from DB, never hardcoded
  if (plan.max_students === null || plan.max_students === undefined) {
    features.push({ text: "Unlimited students", included: true });
  } else {
    features.push({ text: `Up to ${plan.max_students.toLocaleString()} students`, included: true });
  }

  // Teachers limit — from DB
  if (plan.max_teachers === null || plan.max_teachers === undefined) {
    features.push({ text: "Unlimited teachers", included: true });
  } else {
    features.push({ text: `Up to ${plan.max_teachers.toLocaleString()} teachers`, included: true });
  }

  // Feature flags from DB
  features.push({ text: "Fee Management",        included: !!plan.fee_management_enabled });
  features.push({ text: "Online Payment module", included: !!plan.online_payment_enabled });

  // Always-on features for all plans
  features.push({ text: "Attendance & Exams",  included: true });
  features.push({ text: "Transport & Hostel",  included: true });
  features.push({ text: "Calendar & Notices",  included: true });

  // Priority support — only for Plus (highest tier, no max_students cap)
  if (plan.max_students === null && plan.max_teachers === null) {
    features.push({ text: "Priority support", included: true });
  }

  return features;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature row
// ─────────────────────────────────────────────────────────────────────────────
function Feature({ text, included, dark }: { text: string; included: boolean; dark?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9, fontSize: 13,
      color: dark
        ? (included ? "#e2e8f0" : "rgba(255,255,255,.3)")
        : (included ? "#1e293b"  : "#94a3b8"),
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: included
          ? (dark ? "rgba(255,155,81,.2)" : "#fff7ed")
          : (dark ? "rgba(255,255,255,.06)" : "#f1f5f9"),
      }}>
        <i
          className={`fa-solid ${included ? "fa-check" : "fa-xmark"}`}
          style={{ fontSize: 9, color: included ? "#FF9B51" : (dark ? "rgba(255,255,255,.25)" : "#cbd5e1") }}
        />
      </div>
      <span style={{ fontWeight: included ? 600 : 400 }}>{text}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing toggle
// ─────────────────────────────────────────────────────────────────────────────
function CycleToggle({
  cycle, onChange, yearlySavingPct,
}: {
  cycle: "monthly" | "yearly";
  onChange: (c: "monthly" | "yearly") => void;
  yearlySavingPct: number;
}) {
  const btn = (c: "monthly" | "yearly", label: React.ReactNode) => (
    <button
      onClick={() => onChange(c)}
      style={{
        padding: "8px 22px", borderRadius: 8, border: "none", cursor: "pointer",
        fontWeight: 800, fontSize: 13, fontFamily: "inherit",
        background: cycle === c ? "#fff" : "transparent",
        color:      cycle === c ? "#1e293b" : "#64748b",
        boxShadow:  cycle === c ? "0 1px 4px rgba(0,0,0,.1)" : "none",
        transition: "all .15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
      <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: 10, padding: 4, gap: 2 }}>
        {btn("monthly", "Monthly")}
        {btn("yearly", (
          <span>
            Yearly{" "}
            {yearlySavingPct > 0 && (
              <span style={{ color: "#16a34a", fontWeight: 900, marginLeft: 4, fontSize: 11 }}>
                SAVE {yearlySavingPct}%
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Offer banner — with free_months price strikethrough
// ─────────────────────────────────────────────────────────────────────────────
function OfferBanner({ offer, plans }: { offer: any; plans: any[] }) {
  const dynamicSaving = computeSavingText(
    offer.discount_type, offer.discount_value,
    plans, offer.plan_name ?? null,
    offer.applies_to_billing ?? null,
    offer.currency_applies_to ?? null,
  );
  const savingDisplay = offer.saving_text || dynamicSaving;
  const isExpiring = offer.valid_until &&
    Math.ceil((new Date(offer.valid_until).getTime() - Date.now()) / 86400000) <= 7;

  return (
    <div style={{
      marginBottom: 16, padding: "14px 20px", borderRadius: 12,
      border: "1.5px dashed #FF9B51",
      background: "linear-gradient(135deg, #fff7ed 0%, #fff 100%)",
      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: "#FF9B51", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(255,155,81,.35)" }}>
        <i className={`fa-solid ${offer.discount_type === "free_months" ? "fa-calendar-check" : "fa-tag"}`} style={{ color: "#fff", fontSize: 16 }} />
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#1e293b" }}>{offer.title}</p>
        {offer.description && (
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6a7882" }}>{offer.description}</p>
        )}
        {savingDisplay && (
          <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 5, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 999, padding: "3px 10px" }}>
            <i className="fa-solid fa-piggy-bank" style={{ fontSize: 10, color: "#15803d" }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#15803d" }}>{savingDisplay}</span>
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#FF9B51", letterSpacing: ".5px", marginBottom: 3 }}>PROMO CODE</span>
        <code style={{ fontSize: 15, fontWeight: 900, color: "#1e293b", letterSpacing: "1.5px", background: "#fff7ed", padding: "4px 10px", borderRadius: 7, border: "1px solid #ffedd5" }}>
          {offer.code}
        </code>
      </div>
      {offer.valid_until && (
        <div style={{ padding: "4px 12px", borderRadius: 999, background: isExpiring ? "#fef3c7" : "#f1f5f9", color: isExpiring ? "#b45309" : "#6b7b86", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <i className="fa-solid fa-clock" style={{ fontSize: 10 }} />
          Ends {new Date(offer.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function UpgradePlanPage() {
  const { data: status, loading: sL } = useApi<any>("/subscriptions/me/status");
  const { data: plans,  loading: pL } = useApi<any[]>("/subscriptions/plans");
  const { data: offers              } = useApi<any[]>("/subscriptions/offers");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  const loading         = sL || pL;
  const currentPlanName = status?.plan?.name ?? "Pro";
  const currentTier     = getPlanTier(currentPlanName);
  const activeOffers    = (offers ?? []).filter((o: any) => o.is_active);

  // Compute yearly saving % from first paid plan for the toggle label
  const repPlan = (plans ?? []).find((p: any) => p.name !== "Free") || (plans ?? [])[0];
  const repYearlySavingPct = repPlan?.price_npr_monthly && repPlan?.price_npr_yearly
    ? Math.round(((repPlan.price_npr_monthly * 12 - repPlan.price_npr_yearly) / (repPlan.price_npr_monthly * 12)) * 100)
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
      <Topbar title="Upgrade Plan" subtitle="Choose the plan that fits your school" />

      <main style={{ padding: "20px", maxWidth: 1040, margin: "0 auto" }}>
        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <>
            {/* ── Active offer banners ── */}
            {activeOffers.map((offer: any) => (
              <OfferBanner key={offer.id} offer={offer} plans={plans ?? []} />
            ))}

            {/* ── Current plan status bar ── */}
            {status && (
              <section style={{
                background: "#fff", borderRadius: 14, border: "1px solid #dce5e9",
                padding: "16px 22px", marginBottom: 24,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                flexWrap: "wrap", gap: 14,
              }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", letterSpacing: ".5px", marginBottom: 4 }}>YOUR CURRENT PLAN</p>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: "#1e293b", margin: 0 }}>{currentPlanName}</h2>
                </div>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  {[
                    { label: "Students",   val: `${status.student_count} / ${status.plan.max_students ?? "∞"}` },
                    { label: "Teachers",   val: `${status.teacher_count} / ${status.plan.max_teachers ?? "∞"}` },
                    { label: "Fee Mgmt",   val: status.plan.fee_management_enabled ? "✓ On" : "✗ Off" },
                    { label: "Online Pay", val: status.plan.online_payment_enabled  ? "✓ On" : "✗ Off" },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <p style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{label.toUpperCase()}</p>
                      <strong style={{ fontSize: 13 }}>{val}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Billing toggle ── */}
            <CycleToggle cycle={cycle} onChange={setCycle} yearlySavingPct={repYearlySavingPct} />

            {/* ── Plan cards ── */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 32 }}>
              {(plans ?? []).filter((plan: any) => plan.name !== "Free").map((plan: any) => {
                const isCurrent  = plan.name === currentPlanName;
                const planTier   = getPlanTier(plan.name);
                const isUpgrade  = planTier > currentTier;
                const isDowngrade= planTier < currentTier;
                const isPro      = plan.name === "Pro";
                const isFree     = plan.name === "Free";
                const pricing    = getPlanPrice(plan, cycle);
                const rp         = plan.resolved_pricing;

                // Dynamic features — always from DB, never hardcoded
                const features = buildFeatures(plan);

                // Yearly saving for this plan
                const monthlyPrice    = rp?.price_monthly ?? 0;
                const yearlyPrice     = rp?.price_yearly  ?? 0;
                const yearlyVsMonthly = monthlyPrice > 0 && yearlyPrice > 0
                  ? monthlyPrice * 12 - yearlyPrice : 0;
                const yearlySavingPct = monthlyPrice > 0 && yearlyVsMonthly > 0
                  ? Math.round((yearlyVsMonthly / (monthlyPrice * 12)) * 100) : 0;
                const currSym = rp?.symbol ?? "Rs.";

                // Check for a free_months offer on this plan — to show strikethrough price
                const planOffer = activeOffers.find((o: any) =>
                  o.discount_type === "free_months" &&
                  (!o.plan_name || o.plan_name === plan.name) &&
                  (!o.applies_to_billing || o.applies_to_billing === cycle)
                );
                const hasFreeOffer = !isFree && !!planOffer;
                const freeMonths   = hasFreeOffer ? planOffer.discount_value : 0;

                return (
                  <article
                    key={plan.id}
                    style={{
                      borderRadius: 16, padding: "28px 24px",
                      border: isCurrent
                        ? "2px solid #FF9B51"
                        : isPro && isUpgrade
                          ? "2px solid #FF9B51"
                          : "1px solid #e2e8f0",
                      background: isPro && !isCurrent
                        ? "linear-gradient(160deg, #25343F 0%, #1a2630 100%)"
                        : "#fff",
                      color: isPro && !isCurrent ? "#e2e8f0" : "#1e293b",
                      boxShadow: isPro && !isCurrent
                        ? "0 12px 40px rgba(37,52,63,.25)"
                        : "0 2px 12px rgba(37,52,63,.06)",
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      // Dim lower-tier plans when user is already above them
                      opacity: isDowngrade ? 0.72 : 1,
                    }}
                  >
                    {/* ── Top badges ── */}
                    {isPro && isUpgrade && (
                      <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#FF9B51", color: "#25343F", fontSize: 10, fontWeight: 900, padding: "4px 14px", borderRadius: 999, letterSpacing: ".6px", whiteSpace: "nowrap" }}>
                        MOST POPULAR
                      </span>
                    )}
                    {isCurrent && (
                      <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#FF9B51", color: "#fff", fontSize: 10, fontWeight: 900, padding: "4px 14px", borderRadius: 999, letterSpacing: ".6px", whiteSpace: "nowrap" }}>
                        YOUR PLAN
                      </span>
                    )}
                    {isDowngrade && (
                      <span style={{ position: "absolute", top: -12, right: 16, background: "#f1f5f9", color: "#64748b", fontSize: 10, fontWeight: 900, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
                        LOWER TIER
                      </span>
                    )}

                    {/* ── Plan name ── */}
                    <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: "1.2px", marginBottom: 10, color: isPro && !isCurrent ? "#FF9B51" : "#94a3b8" }}>
                      {plan.name.toUpperCase()}
                    </p>

                    {/* ── Price — strikethrough + Rs. 0 when free_months offer applies ── */}
                    <div style={{ marginBottom: isFree ? 6 : 2 }}>
                      {hasFreeOffer ? (
                        <div>
                          {/* Strikethrough original price */}
                          <span style={{ fontSize: 20, fontWeight: 700, color: "#94a3b8", textDecoration: "line-through", marginRight: 8 }}>
                            {pricing.display}
                          </span>
                          {/* Free for N months */}
                          <span style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, color: isPro && !isCurrent ? "#fff" : "#1e293b" }}>
                            Free
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#15803d", marginLeft: 6 }}>
                            for {freeMonths} month{freeMonths !== 1 ? "s" : ""}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 36, fontWeight: 900, lineHeight: 1 }}>
                          {isFree ? "Free" : pricing.display}
                        </span>
                      )}
                      {!isFree && !hasFreeOffer && (
                        <span style={{ fontSize: 13, fontWeight: 500, opacity: .6, marginLeft: 5 }}>
                          /{cycle === "monthly" ? "mo" : "yr"}
                        </span>
                      )}
                    </div>

                    {/* ── Currency & billing label ── */}
                    {!isFree && rp && (
                      <p style={{
                        fontSize: 11, fontWeight: 600, marginBottom: cycle === "yearly" && yearlySavingPct > 0 ? 6 : 20,
                        color: isPro && !isCurrent ? "rgba(255,255,255,.4)" : "#94a3b8",
                      }}>
                        {rp.currency} · billed {cycle}
                      </p>
                    )}

                    {/* ── Yearly saving chip ── */}
                    {!isFree && cycle === "yearly" && yearlySavingPct > 0 && (
                      <div style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 5, background: isPro && !isCurrent ? "rgba(22,163,74,.15)" : "#f0fdf4", borderRadius: 999, padding: "4px 10px", alignSelf: "flex-start" }}>
                        <i className="fa-solid fa-piggy-bank" style={{ fontSize: 10, color: isPro && !isCurrent ? "#86efac" : "#15803d" }} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: isPro && !isCurrent ? "#86efac" : "#15803d" }}>
                          Save {yearlySavingPct}% · {currSym}{yearlyVsMonthly.toLocaleString()} off vs monthly
                        </span>
                      </div>
                    )}

                    {isFree && <p style={{ fontSize: 12, opacity: .45, marginBottom: 20 }}>No credit card required</p>}

                    {/* ── Dynamic features from DB ── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28, flex: 1 }}>
                      {features.map(f => (
                        <Feature
                          key={f.text}
                          text={f.text}
                          included={f.included}
                          dark={isPro && !isCurrent}
                        />
                      ))}
                    </div>

                    {/* ── Offer tag on card ── */}
                    {!isFree && planOffer && (
                      <div style={{ marginBottom: 10, padding: "6px 12px", borderRadius: 8, background: isPro && !isCurrent ? "rgba(255,155,81,.1)" : "#fff7ed", border: isPro && !isCurrent ? "1px solid rgba(255,155,81,.3)" : "1px solid #ffedd5", display: "flex", alignItems: "center", gap: 6 }}>
                        <i className="fa-solid fa-gift" style={{ fontSize: 11, color: "#FF9B51" }} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: isPro && !isCurrent ? "#FF9B51" : "#c2410c" }}>
                          {planOffer.saving_text || computeSavingText(planOffer.discount_type, planOffer.discount_value, plans ?? [], planOffer.plan_name ?? null, planOffer.applies_to_billing ?? null, planOffer.currency_applies_to ?? null)}
                        </span>
                      </div>
                    )}

                    {/* ── CTA — depends on tier relationship ── */}
                    {isCurrent ? (
                      // Current plan
                      <div style={{ textAlign: "center", padding: "11px", borderRadius: 10, fontWeight: 800, fontSize: 13, background: "#fff7ed", color: "#FF9B51", border: "2px solid #FF9B51" }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} /> Your Current Plan
                      </div>
                    ) : isDowngrade ? (
                      // Lower-tier plan — don't show an action button, just a muted label
                      <div style={{ textAlign: "center", padding: "11px", borderRadius: 10, fontWeight: 700, fontSize: 12, background: "#f8fafc", color: "#94a3b8", border: "1px solid #e2e8f0" }}>
                        <i className="fa-solid fa-arrow-down" style={{ marginRight: 6, fontSize: 11 }} />
                        Lower than your current plan
                      </div>
                    ) : (
                      // Upgrade path
                      <div style={{ textAlign: "center", padding: "11px", borderRadius: 10, fontWeight: 800, fontSize: 13, background: isPro ? "#FF9B51" : "#1e293b", color: isPro ? "#25343F" : "#FF9B51", cursor: "default", letterSpacing: ".2px" }}>
                        <i className="fa-solid fa-envelope" style={{ marginRight: 6 }} />
                        Contact us to upgrade
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            {/* ── How to upgrade ── */}
            <div style={{ background: "#fff", borderRadius: 12, padding: "18px 22px", border: "1px solid #dce5e9", display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <i className="fa-solid fa-circle-info" style={{ color: "#FF9B51", fontSize: 14 }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1e293b" }}>How to upgrade</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6a7882", lineHeight: 1.6 }}>
                  Contact your Skoolio account manager with your school name and preferred plan. Share your payment reference after bank transfer and your plan will be activated within 24 hours. Online self-checkout is coming soon.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
