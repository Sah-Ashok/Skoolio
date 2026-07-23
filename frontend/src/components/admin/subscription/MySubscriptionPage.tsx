"use client";

import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active:       { bg: "#dcfce7", color: "#15803d", label: "Active"       },
  grace_period: { bg: "#fef3c7", color: "#b45309", label: "Grace Period" },
  expired:      { bg: "#ffe4e6", color: "#be123c", label: "Expired"      },
  cancelled:    { bg: "#ffe4e6", color: "#be123c", label: "Cancelled"    },
};

// ── ProgressBar ───────────────────────────────────────────────────────────────
function ProgressBar({ value, max }: { value: number; max: number | null }) {
  const pct        = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const isWarning  = max ? value / max >= 0.8 : false;
  const isCritical = max ? value / max >= 0.95 : false;
  const color      = isCritical ? "#ef4444" : isWarning ? "#f59e0b" : "#FF9B51";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 6, borderRadius: 999, background: "#eef2f3", overflow: "hidden" }}>
        <div style={{ height: "100%", width: max ? `${pct}%` : "4%", background: color, borderRadius: 999, transition: "width .4s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
        <span>{value} used</span>
        <span>{max ? `${max - value} remaining` : "Unlimited"}</span>
      </div>
    </div>
  );
}

// ── Feature row ───────────────────────────────────────────────────────────────
function FeatureRow({ icon, label, value, enabled, tip }: {
  icon: string; label: string; value?: string; enabled: boolean; tip?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid #f0f4f5" }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: enabled ? "#fff7ed" : "#f1f5f9", flexShrink: 0 }}>
        <i className={`fa-solid ${icon}`} style={{ fontSize: 13, color: enabled ? "#FF9B51" : "#94a3b8" }} />
      </div>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{label}</span>
        {tip && <span style={{ display: "block", fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{tip}</span>}
      </div>
      {value ? (
        <span style={{ fontSize: 13, fontWeight: 800, color: "#1e293b" }}>{value}</span>
      ) : (
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
          background: enabled ? "#dcfce7" : "#fee2e2",
          color: enabled ? "#15803d" : "#be123c",
        }}>
          {enabled ? "Enabled" : "Locked"}
        </span>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MySubscriptionPage() {
  const { data: status,  loading: sL } = useApi<any>("/subscriptions/me/status");
  const { data: history, loading: hL } = useApi<any[]>("/subscriptions/me/history");

  const sub  = status?.subscription;
  const plan = status?.plan;
  const st   = STATUS_STYLE[sub?.status] ?? STATUS_STYLE.active;

  const daysLeft = sub?.end_date
    ? Math.ceil((new Date(sub.end_date).getTime() - Date.now()) / 86400000)
    : null;

  const isPaid = sub?.billing_cycle !== "free";

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
      <Topbar title="My Subscription" subtitle="Current plan, usage limits, and billing history" />

      <main style={{ padding: "20px", maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        {sL ? (
          <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <>
            {/* ── Hero plan card ── */}
            <section style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(31,45,54,.10)", border: "1px solid #dce5e9" }}>
              {/* Dark header */}
              <div style={{ background: "linear-gradient(135deg, #1e2d38 0%, #25343F 100%)", padding: "28px 28px 24px", color: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "1.2px", color: "#FF9B51", marginBottom: 6 }}>CURRENT PLAN</p>
                    <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>{plan?.name ?? "—"}</h1>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,.55)", marginTop: 4 }}>
                      {plan?.name === "Free"
                        ? "Basic access — upgrade to unlock all features"
                        : plan?.name === "Pro"
                          ? "Full fee management + online payments"
                          : "Unlimited capacity — everything included"}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span style={{ padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                    {daysLeft !== null && daysLeft > 0 && (
                      <span style={{ fontSize: 11, color: daysLeft <= 7 ? "#fca5a5" : "rgba(255,255,255,.5)", fontWeight: 700 }}>
                        <i className="fa-solid fa-clock" style={{ marginRight: 4 }} />
                        {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
                      </span>
                    )}
                  </div>
                </div>

                {/* Grace period warning */}
                {status?.is_in_grace_period && (
                  <div style={{ marginTop: 16, padding: "11px 14px", borderRadius: 10, background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)", display: "flex", gap: 10, alignItems: "center" }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ color: "#fbbf24", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#fef3c7" }}>
                      Plan expired — <strong>{status.days_until_lock} day{status.days_until_lock !== 1 ? "s" : ""}</strong> left before downgrade to Free.
                    </span>
                  </div>
                )}

                {/* Billing info row */}
                {isPaid && (
                  <div style={{ display: "flex", gap: 28, marginTop: 20, flexWrap: "wrap" }}>
                    {[
                      { label: "Billing", value: sub?.billing_cycle === "monthly" ? "Monthly" : "Yearly" },
                      { label: "Started",  value: fmt(sub?.start_date) },
                      { label: "Renews",   value: sub?.end_date ? fmt(sub.end_date) : "—" },
                      ...(Number(sub?.amount_paid) > 0 ? [{ label: "Amount Paid", value: `${sub.currency ?? ""} ${sub.amount_paid}` }] : []),
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,.45)", fontWeight: 800, letterSpacing: ".4px" }}>{label.toUpperCase()}</p>
                        <strong style={{ fontSize: 14 }}>{value}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CTA footer */}
              <div style={{ background: "#fff", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <p style={{ fontSize: 12, color: "#6a7882", fontWeight: 600, margin: 0 }}>
                  {plan?.name === "Plus"
                    ? "You're on the highest plan."
                    : "Upgrade to unlock more students, teachers, and features."}
                </p>
                <Link
                  href="/upgrade"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 20px", borderRadius: 9, background: "#FF9B51", color: "#fff", fontWeight: 800, fontSize: 13, textDecoration: "none" }}
                >
                  <i className="fa-solid fa-rocket" />
                  {plan?.name === "Plus" ? "View Plans" : "Upgrade Plan"}
                </Link>
              </div>
            </section>

            {/* ── Usage cards ── */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {/* Students */}
              <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid #dce5e9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className="fa-solid fa-user-graduate" style={{ color: "#FF9B51", fontSize: 15 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", letterSpacing: ".4px" }}>STUDENTS</p>
                    <strong style={{ fontSize: 20, fontWeight: 900 }}>
                      {status?.student_count ?? 0}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}> / {plan?.max_students ?? "∞"}</span>
                    </strong>
                  </div>
                </div>
                <ProgressBar value={status?.student_count ?? 0} max={plan?.max_students ?? null} />
                {!status?.can_add_student && (
                  <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8, fontWeight: 700 }}>
                    <i className="fa-solid fa-lock" style={{ marginRight: 4 }} /> Limit reached — upgrade to add more
                  </p>
                )}
              </div>

              {/* Teachers */}
              <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid #dce5e9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className="fa-solid fa-chalkboard-user" style={{ color: "#FF9B51", fontSize: 15 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", letterSpacing: ".4px" }}>TEACHERS</p>
                    <strong style={{ fontSize: 20, fontWeight: 900 }}>
                      {status?.teacher_count ?? 0}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}> / {plan?.max_teachers ?? "∞"}</span>
                    </strong>
                  </div>
                </div>
                <ProgressBar value={status?.teacher_count ?? 0} max={plan?.max_teachers ?? null} />
                {!status?.can_add_teacher && (
                  <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8, fontWeight: 700 }}>
                    <i className="fa-solid fa-lock" style={{ marginRight: 4 }} /> Limit reached — upgrade to add more
                  </p>
                )}
              </div>
            </section>

            {/* ── Features breakdown ── */}
            <section style={{ background: "#fff", borderRadius: 14, border: "1px solid #dce5e9", overflow: "hidden" }}>
              <div style={{ padding: "16px 22px", borderBottom: "1px solid #f0f4f5", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fa-solid fa-layer-group" style={{ color: "#FF9B51", fontSize: 13 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Plan Features</h3>
                  <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>What's included in your {plan?.name} plan</p>
                </div>
              </div>
              <div style={{ padding: "4px 22px 12px" }}>
                <FeatureRow icon="fa-user-graduate"        label="Students"             value={plan?.max_students ? `Up to ${plan.max_students}` : "Unlimited"} enabled tip="Active enrolled students" />
                <FeatureRow icon="fa-chalkboard-user"      label="Teachers / Faculty"   value={plan?.max_teachers ? `Up to ${plan.max_teachers}` : "Unlimited"} enabled tip="Teaching and staff accounts" />
                <FeatureRow icon="fa-file-invoice-dollar"  label="Fee Management"       enabled={!!plan?.fee_management_enabled}    tip="Collect fees, generate bills, track payments" />
                <FeatureRow icon="fa-mobile-screen-button" label="Online Payments"      enabled={!!plan?.online_payment_enabled}    tip="Students submit bank transfer proof online" />
                <FeatureRow icon="fa-clipboard-check"      label="Attendance"           enabled tip="Mark & track daily attendance" />
                <FeatureRow icon="fa-pen-to-square"        label="Exams & Results"      enabled tip="Schedule exams, enter and publish marks" />
                <FeatureRow icon="fa-bus"                  label="Transport & Hostel"   enabled tip="Manage routes, stops, and room assignments" />
                <FeatureRow icon="fa-bullhorn"             label="Notice Board"         enabled tip="Post school-wide and section notices" />
                <FeatureRow icon="fa-calendar-days"        label="Academic Calendar"    enabled tip="Holidays, exams, and events" />
              </div>
            </section>

            {/* ── Billing history ── */}
            <section style={{ background: "#fff", borderRadius: 14, border: "1px solid #dce5e9", overflow: "hidden" }}>
              <div style={{ padding: "16px 22px", borderBottom: "1px solid #f0f4f5" }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Billing History</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                {hL ? (
                  <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={22} color="#FF9B51" /></div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f7fafb" }}>
                        {["Plan", "Cycle", "Amount", "Period", "Status"].map(h => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 900, color: "#94a3b8", letterSpacing: ".4px", borderBottom: "1px solid #eef2f3" }}>{h.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(history ?? []).map((h: any) => {
                        const hst = STATUS_STYLE[h.status] ?? STATUS_STYLE.active;
                        return (
                          <tr key={h.id} style={{ borderBottom: "1px solid #f5f7f8" }}>
                            <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: 13 }}>{h.plan_name}</td>
                            <td style={{ padding: "12px 16px", fontSize: 13, textTransform: "capitalize", color: "#6a7882" }}>{h.billing_cycle}</td>
                            <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700 }}>
                              {Number(h.amount_paid) > 0 ? `${h.currency ?? ""} ${h.amount_paid}` : <span style={{ color: "#94a3b8" }}>Free</span>}
                            </td>
                            <td style={{ padding: "12px 16px", fontSize: 12, color: "#6a7882" }}>
                              {fmt(h.start_date)}{h.end_date ? ` → ${fmt(h.end_date)}` : " (ongoing)"}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: hst.bg, color: hst.color }}>
                                {hst.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {!history?.length && (
                        <tr>
                          <td colSpan={5} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                            No billing history yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
