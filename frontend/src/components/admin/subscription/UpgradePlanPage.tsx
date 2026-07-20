"use client";

import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useState } from "react";
import { getPlanPrice } from "@/lib/currency";

// ─── feature row ─────────────────────────────────────────────────────────────
function Feature({ text, included, featured }: { text: string; included: boolean; featured: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, opacity: included ? 1 : 0.45 }}>
      <i
        className={`fa-solid ${included ? "fa-check" : "fa-xmark"}`}
        style={{ fontSize: 11, color: included ? (featured ? "#FF9B51" : "#16a34a") : "#ef4444", flexShrink: 0 }}
      />
      <span>{text}</span>
    </div>
  );
}

// ─── billing cycle toggle ─────────────────────────────────────────────────────
function CycleToggle({
  cycle, onChange,
}: { cycle: "monthly" | "yearly"; onChange: (c: "monthly" | "yearly") => void }) {
  const btn = (c: "monthly" | "yearly", label: React.ReactNode) => (
    <button
      onClick={() => onChange(c)}
      style={{
        padding: "8px 20px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13,
        cursor: "pointer", fontFamily: "inherit",
        background: cycle === c ? "#fff" : "transparent",
        color: cycle === c ? "#1e293b" : "#64748b",
        boxShadow: cycle === c ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
        transition: "all .15s",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
      <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: 10, padding: 4, gap: 2 }}>
        {btn("monthly", "Monthly")}
        {btn("yearly", <>Yearly <span style={{ color: "#16a34a", fontWeight: 800, marginLeft: 4 }}>Save 20%</span></>)}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function UpgradePlanPage() {
  const { data: status, loading: statusLoading } = useApi<any>("/subscriptions/me/status");
  const { data: plans,  loading: plansLoading  } = useApi<any[]>("/subscriptions/plans");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  const loading = statusLoading || plansLoading;
  const currentPlanName = status?.plan?.name;

  // resolved_pricing comes from the backend — currency is already chosen based
  // on the school's country. The frontend needs zero country/currency logic.
  const currencyLabel = plans?.[0]?.resolved_pricing
    ? `${plans[0].resolved_pricing.currency} pricing`
    : "";

  return (
    <div className="main-wrapper">
      <Topbar title="Upgrade Plan" subtitle="Choose the plan that fits your school" />
      <main className="page-content">
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <>
            {/* ── current plan banner ── */}
            {status && (
              <section className="card" style={{ marginBottom: 22 }}>
                <div
                  className="card-body"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}
                >
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 4 }}>
                      Current Plan
                    </p>
                    <h2 style={{ fontSize: 20, fontWeight: 900, color: "#1e293b" }}>{currentPlanName}</h2>
                  </div>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    {[
                      { label: "Students",       value: `${status.student_count} / ${status.plan.max_students ?? "∞"}` },
                      { label: "Teachers",       value: `${status.teacher_count} / ${status.plan.max_teachers ?? "∞"}` },
                      { label: "Fee Management", value: status.plan.fee_management_enabled ? "Enabled" : "Locked" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{label}</p>
                        <strong style={{ fontSize: 14 }}>{value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* currency context line */}
            {currencyLabel && (
              <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", fontWeight: 700, marginBottom: 16 }}>
                <i className="fa-solid fa-location-dot" style={{ marginRight: 6 }} />
                Showing {currencyLabel} based on your school's region
              </p>
            )}

            {/* ── billing cycle toggle ── */}
            <CycleToggle cycle={cycle} onChange={setCycle} />

            {/* ── plan cards ── */}
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
                gap: 20,
                marginBottom: 28,
              }}
            >
              {(plans ?? []).map((plan) => {
                const isCurrent  = plan.name === currentPlanName;
                const isFeatured = plan.name === "Pro";
                const isFree     = plan.name === "Free";
                const pricing    = getPlanPrice(plan, cycle);
                const rp         = plan.resolved_pricing;

                return (
                  <article
                    key={plan.id}
                    style={{
                      borderRadius: 16,
                      padding: "28px 24px",
                      border: isFeatured ? "2px solid #FF9B51" : "1px solid #e2e8f0",
                      background: isFeatured
                        ? "linear-gradient(145deg,#25343F,#1a2630)"
                        : "#fff",
                      color: isFeatured ? "#eaefef" : "#1e293b",
                      boxShadow: isFeatured
                        ? "0 8px 32px rgba(37,52,63,0.28)"
                        : "0 2px 12px rgba(37,52,63,0.07)",
                      position: "relative",
                    }}
                  >
                    {isFeatured && (
                      <span
                        style={{
                          position: "absolute", top: -12, right: 20,
                          background: "#FF9B51", color: "#25343F",
                          fontSize: 10, fontWeight: 900, padding: "4px 10px", borderRadius: 999,
                          letterSpacing: ".5px",
                        }}
                      >
                        MOST POPULAR
                      </span>
                    )}

                    {/* plan name */}
                    <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", marginBottom: 8, color: isFeatured ? "#FF9B51" : "#94a3b8" }}>
                      {plan.name.toUpperCase()}
                    </p>

                    {/* price */}
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }}>
                        {isFree ? "Free" : pricing.display}
                      </span>
                      {!isFree && (
                        <span style={{ fontSize: 13, fontWeight: 500, opacity: .65, marginLeft: 4 }}>
                          /{cycle === "monthly" ? "mo" : "yr"}
                        </span>
                      )}
                    </div>

                    {/* currency note */}
                    {!isFree && rp && (
                      <p style={{ fontSize: 11, color: isFeatured ? "rgba(234,239,239,.5)" : "#94a3b8", marginBottom: 20, fontWeight: 600 }}>
                        {rp.currency} · billed {cycle}
                        {cycle === "yearly" && rp.price_monthly > 0 && (
                          <span style={{ marginLeft: 6 }}>
                            (vs {pricing.symbol || rp.symbol}{Math.round(rp.price_monthly)}/mo)
                          </span>
                        )}
                      </p>
                    )}
                    {isFree && <p style={{ fontSize: 12, opacity: .5, marginBottom: 20 }}>No credit card needed</p>}

                    {/* features */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                      <Feature featured={isFeatured} included text={`Up to ${plan.max_students ?? "unlimited"} students`} />
                      <Feature featured={isFeatured} included text={`Up to ${plan.max_teachers ?? "unlimited"} teachers`} />
                      <Feature featured={isFeatured} included={plan.fee_management_enabled} text="Fee Management" />
                      <Feature featured={isFeatured} included text="Attendance & Exams" />
                      <Feature featured={isFeatured} included text="Transport & Hostel" />
                      <Feature featured={isFeatured} included text="Calendar & Notices" />
                    </div>

                    {/* CTA */}
                    {isCurrent ? (
                      <div
                        style={{
                          textAlign: "center", padding: "10px 0", borderRadius: 9, fontWeight: 800, fontSize: 13,
                          background: isFeatured ? "rgba(255,255,255,.1)" : "#f1f5f9",
                          color: isFeatured ? "#eaefef" : "#64748b",
                        }}
                      >
                        ✓ Your Current Plan
                      </div>
                    ) : (
                      <div
                        style={{
                          textAlign: "center", padding: "10px 0", borderRadius: 9, fontWeight: 800, fontSize: 13,
                          background: isFeatured ? "#FF9B51" : "#1e293b",
                          color: isFeatured ? "#25343F" : "#FF9B51",
                          cursor: "default",
                        }}
                      >
                        Contact us to upgrade
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
              To upgrade or renew, contact your CampusPOS account manager with your payment details.
              <br />Online self-checkout is coming soon.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
