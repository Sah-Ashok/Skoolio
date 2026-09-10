"use client";

import { useApi } from "@/lib/useApi";
import { Loader } from "@/components/shared/Loader";
import { useState } from "react";
import { getPlanPrice } from "@/lib/currency";
import { computeSavingText } from "@/components/super-admin/OfferModal";
import { useDateFormat } from "@/lib/useDateFormat";
import styles from "./subscription.module.css";

const s = (n: string) => styles[n];

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
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
      <div className={s("motionToggleWrap")} role="tablist" aria-label="Billing cycle">
        {/* Animated sliding dark capsule indicator */}
        <div
          className={`${s("motionTogglePill")} ${cycle === "yearly" ? s("motionTogglePillYearly") : ""}`}
        />
        <button
          type="button"
          role="tab"
          aria-selected={cycle === "monthly"}
          onClick={() => onChange("monthly")}
          className={`${s("motionToggleBtn")} ${cycle === "monthly" ? s("motionToggleBtnActive") : ""}`}
        >
          Monthly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={cycle === "yearly"}
          onClick={() => onChange("yearly")}
          className={`${s("motionToggleBtn")} ${cycle === "yearly" ? s("motionToggleBtnActive") : ""}`}
        >
          <span>Yearly</span>
          {yearlySavingPct > 0 && (
            <span className={s("motionSavingBadge")}>
              SAVE {yearlySavingPct}%
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Offer banner — with free_months price strikethrough
// ─────────────────────────────────────────────────────────────────────────────
function OfferBanner({ offer, plans }: { offer: any; plans: any[] }) {
  const { formatDate } = useDateFormat();
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
          Ends {formatDate(offer.valid_until)}
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
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <main style={{ padding: "40px 24px 60px", maxWidth: 1060, margin: "0 auto" }}>
        {loading ? (
          <div style={{ padding: "4rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading plans…" /></div>
        ) : (
          <>
            {/* ── Active offer banners ── */}
            {activeOffers.map((offer: any) => (
              <OfferBanner key={offer.id} offer={offer} plans={plans ?? []} />
            ))}

            {/* ── Page Centered Header (motion.dev style) ── */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{ fontSize: 32, fontWeight: 900, color: "#0f172a", margin: "0 0 10px", letterSpacing: "-0.6px" }}>
                Choose the right plan for your school
              </h1>
              <p style={{ fontSize: 14, color: "#64748b", margin: 0, fontWeight: 600 }}>
                Transparent pricing with no hidden fees. Upgrade or switch cycles anytime.
              </p>
            </div>

            {/* ── Billing toggle ── */}
            <CycleToggle cycle={cycle} onChange={setCycle} yearlySavingPct={repYearlySavingPct} />

            {/* ── Plan cards ── */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 24, marginBottom: 36 }}>
              {(plans ?? []).filter((plan: any) => plan.name !== "Free").map((plan: any) => {
                const isCurrent   = plan.name === currentPlanName;
                const planTier    = getPlanTier(plan.name);
                const isUpgrade   = planTier > currentTier;
                const isDowngrade = planTier < currentTier;
                const isPro       = plan.name === "Pro";
                const isPlus      = plan.name === "Plus";
                const isUltra     = plan.name === "Ultra";
                const isFree      = plan.name === "Free";
                const pricing     = getPlanPrice(plan, cycle);
                const rp          = plan.resolved_pricing;

                // Dynamic features — always from DB, never hardcoded
                const features = buildFeatures(plan);

                // Yearly saving calculation
                const monthlyPrice    = rp?.price_monthly ?? 0;
                const yearlyPrice     = rp?.price_yearly  ?? 0;
                const yearlyVsMonthly = monthlyPrice > 0 && yearlyPrice > 0
                  ? monthlyPrice * 12 - yearlyPrice : 0;
                const yearlySavingPct = monthlyPrice > 0 && yearlyVsMonthly > 0
                  ? Math.round((yearlyVsMonthly / (monthlyPrice * 12)) * 100) : 0;
                const currSym = rp?.symbol ?? "Rs.";

                // Monthly-equivalent price when yearly is selected (motion.dev pattern)
                const displayPrice = isFree
                  ? "Free"
                  : cycle === "yearly" && yearlyPrice > 0
                    ? `${currSym}${Math.round(yearlyPrice / 12).toLocaleString("en-IN")}`
                    : pricing.display;

                // Check for a free_months offer on this plan
                const planOffer = activeOffers.find((o: any) =>
                  o.discount_type === "free_months" &&
                  (!o.plan_name || o.plan_name === plan.name) &&
                  (!o.applies_to_billing || o.applies_to_billing === cycle)
                );
                const hasFreeOffer = !isFree && !!planOffer;
                const freeMonths   = hasFreeOffer ? planOffer.discount_value : 0;

                const cardTintClass = isPro
                  ? s("motionPricingCardPro")
                  : isPlus
                    ? s("motionPricingCardPlus")
                    : s("motionPricingCardUltra");

                return (
                  <article
                    key={plan.id}
                    className={`${s("motionPricingCard")} ${cardTintClass} ${isCurrent ? s("motionPricingCardCurrent") : ""}`}
                    style={{
                      opacity: isDowngrade ? 0.72 : 1,
                    }}
                  >
                    {/* ── 1. Header: Plan Name + Badge ── */}
                    <div className={s("motionCardHeader")}>
                      <h3 className={s("motionPlanName")}>{plan.name}</h3>
                      {isCurrent ? (
                        <span className={s("motionBadgeDark")}>Your Plan</span>
                      ) : isPlus && isUpgrade ? (
                        <span className={s("motionBadgeDark")}>Recommended</span>
                      ) : isDowngrade ? (
                        <span className={s("motionBadgeLight")}>Lower Tier</span>
                      ) : null}
                    </div>

                    {/* ── 2. Plan Subtitle / Description ── */}
                    <p className={s("motionPlanDesc")}>
                      {plan.name === "Ultra"
                        ? "For large multi-branch institutions needing enterprise capacity & priority support."
                        : plan.name === "Plus"
                          ? "For scaling schools adding transport, hostel, and digital payment modules."
                          : "Core school management tier with attendance, exams, and notice board."}
                    </p>

                    {/* ── 3. Price Block with Vertical Number Roll ── */}
                    <div key={cycle} className={s("motionPriceWrap")}>
                      {hasFreeOffer ? (
                        <div>
                          <span style={{ fontSize: 20, fontWeight: 700, color: "#94a3b8", textDecoration: "line-through", marginRight: 8 }}>
                            {pricing.display}
                          </span>
                          <span className={s("motionPriceNumber")}>Free</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#15803d", marginLeft: 6 }}>
                            for {freeMonths} mo
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className={s("motionPriceNumber")}>
                            {displayPrice}
                          </span>
                          {!isFree && (
                            <span className={s("motionPricePeriod")}>
                              /mo
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* ── 4. Billed Annually Subtitle (motion.dev signature line) ── */}
                    <div className={s("motionBilledLine")}>
                      {!isFree && rp && cycle === "yearly" && yearlyPrice > 0 ? (
                        <span>
                          Billed annually at {currSym}{yearlyPrice.toLocaleString("en-IN")}
                          {yearlySavingPct > 0 && (
                            <span style={{ color: "#16a34a", fontWeight: 800, marginLeft: 6 }}>
                              (Save {yearlySavingPct}%)
                            </span>
                          )}
                        </span>
                      ) : !isFree && rp ? (
                        <span>Billed monthly</span>
                      ) : (
                        <span>No credit card required</span>
                      )}
                    </div>

                    {/* ── 5. Full-width Pill CTA Button (Directly below price) ── */}
                    {isCurrent ? (
                      <div className={s("motionCtaBtnCurrent")}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: 8, color: "#16a34a" }} />
                        Current Plan
                      </div>
                    ) : isDowngrade ? (
                      <div className={s("motionCtaBtnMuted")}>
                        <i className="fa-solid fa-arrow-down" style={{ marginRight: 6, fontSize: 11 }} />
                        Lower than current plan
                      </div>
                    ) : (
                      <a
                        href={`mailto:support@skoolio.com?subject=Upgrade%20to%20${plan.name}%20Plan`}
                        className={s("motionCtaBtnPrimary")}
                      >
                        {plan.name === "Ultra" ? "Talk to sales" : `Start with ${plan.name}`}
                      </a>
                    )}

                    {/* ── 6. Soft Divider ── */}
                    <div className={s("motionDivider")} />

                    {/* ── 7. Feature Checklist ── */}
                    <div className={s("motionFeatureList")}>
                      {features.map((f: any) => (
                        <div key={f.text} className={s("motionFeatureItem")}>
                          <i
                            className={`fa-solid ${f.included ? "fa-check" : "fa-xmark"}`}
                            style={{
                              fontSize: 11,
                              color: f.included ? "#0f172a" : "#cbd5e1",
                              width: 16,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{
                            fontWeight: f.included ? 600 : 400,
                            color: f.included ? "#1e293b" : "#94a3b8",
                          }}>
                            {f.text}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Offer chip if active */}
                    {!isFree && planOffer && (
                      <div style={{ marginTop: 14, padding: "6px 12px", borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", alignItems: "center", gap: 6 }}>
                        <i className="fa-solid fa-gift" style={{ fontSize: 11, color: "#ea580c" }} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#c2410c" }}>
                          {planOffer.saving_text || computeSavingText(planOffer.discount_type, planOffer.discount_value, plans ?? [], planOffer.plan_name ?? null, planOffer.applies_to_billing ?? null, planOffer.currency_applies_to ?? null)}
                        </span>
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
