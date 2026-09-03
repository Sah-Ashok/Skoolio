"use client";

import Link from "next/link";
import styles from "./subscription.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  active:       { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0", label: "Active" },
  grace_period: { bg: "#fef3c7", color: "#b45309", border: "#fde68a", label: "Grace Period" },
  expired:      { bg: "#ffe4e6", color: "#be123c", border: "#fecdd3", label: "Expired" },
  cancelled:    { bg: "#ffe4e6", color: "#be123c", border: "#fecdd3", label: "Cancelled" },
};

// ── ProgressBar ───────────────────────────────────────────────────────────────
function ProgressBar({ value, max }: { value: number; max: number | null }) {
  const pct        = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const isWarning  = max ? value / max >= 0.8 : false;
  const isCritical = max ? value / max >= 0.95 : false;
  const color      = isCritical ? "#ef4444" : isWarning ? "#f59e0b" : "#ff9b51";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 7, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }}>
        <div style={{ height: "100%", width: max ? `${pct}%` : "4%", background: color, borderRadius: 999, transition: "width .4s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, fontWeight: 800, color: "#64748b" }}>
        <span>{value} used ({pct}%)</span>
        <span>{max ? `${max - value} remaining` : "Unlimited"}</span>
      </div>
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
    <div className={s("pageWrap")}>
      <main className={s("mainContainer")}>
        {sL ? (
          <div style={{ padding: "6rem", textAlign: "center" }}><Spinner size={36} color="#ff9b51" /></div>
        ) : (
          <>
            {/* ── 1. Hero Plan Banner ── */}
            <section className={s("heroCard")}>
              <div className={s("heroTop")}>
                <div className={s("heroLeft")}>
                  <div className={s("planIconBox")}>
                    <i className="fa-solid fa-crown" />
                  </div>
                  <div>
                    <p className={s("planEyebrow")}>Current Subscription</p>
                    <h1 className={s("planTitle")}>
                      {plan?.name ?? "—"}
                      <span style={{
                        fontSize: 11.5,
                        fontWeight: 900,
                        padding: "3px 10px",
                        borderRadius: 999,
                        background: st.bg,
                        color: st.color,
                        border: `1px solid ${st.border}`,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        textTransform: "uppercase",
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color }} />
                        {st.label}
                      </span>
                    </h1>
                    <p className={s("planDesc")}>
                      {plan?.name === "Ultra"
                        ? "Enterprise tier — unlimited students & faculty with 24/7 priority support"
                        : plan?.name === "Plus"
                          ? "Scaling institution tier — transport, hostel, fee management and payments"
                          : "Core school management tier with online fee collection and exams"}
                    </p>
                  </div>
                </div>

                <div className={s("heroRight")}>
                  {daysLeft !== null && daysLeft > 0 && (
                    <div className={s("daysBadge")}>
                      <i className="fa-solid fa-clock" style={{ color: "#ff9b51" }} />
                      <span><strong>{daysLeft} days</strong> remaining</span>
                    </div>
                  )}
                  <Link href="/upgrade" className={s("btnUpgrade")}>
                    <i className="fa-solid fa-rocket" />
                    {plan?.name === "Ultra" ? "Manage Plan" : "Upgrade Plan"}
                  </Link>
                </div>
              </div>

              {/* Grace period warning */}
              {status?.is_in_grace_period && (
                <div style={{ padding: "12px 28px", background: "#fef3c7", borderBottom: "1px solid #fde68a", display: "flex", gap: 10, alignItems: "center", color: "#92400e", fontSize: 13, fontWeight: 700 }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ color: "#d97706", fontSize: 15 }} />
                  <span>
                    Plan expired — <strong>{status.days_until_lock} day{status.days_until_lock !== 1 ? "s" : ""}</strong> left in grace period before access is locked.
                  </span>
                </div>
              )}

              {/* Bottom billing spec strip */}
              <div className={s("heroBottom")}>
                <div className={s("billingSpecs")}>
                  <div className={s("specItem")}>
                    <span className={s("specLabel")}>Billing Cycle</span>
                    <span className={s("specValue")}>{sub?.billing_cycle === "monthly" ? "Monthly" : sub?.billing_cycle === "yearly" ? "Yearly" : "14-Day Trial"}</span>
                  </div>
                  <div className={s("specItem")}>
                    <span className={s("specLabel")}>Cycle Started</span>
                    <span className={s("specValue")}>{fmt(sub?.start_date)}</span>
                  </div>
                  <div className={s("specItem")}>
                    <span className={s("specLabel")}>Renews On</span>
                    <span className={s("specValue")}>{sub?.end_date ? fmt(sub.end_date) : "—"}</span>
                  </div>
                  {isPaid && (
                    <div className={s("specItem")}>
                      <span className={s("specLabel")}>Amount Paid</span>
                      <span className={s("specValue")} style={{ color: "#059669" }}>
                        {sub?.currency ?? "NPR"} {sub?.amount_paid || "0.00"}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                  <i className="fa-solid fa-shield-halved" style={{ marginRight: 6, color: "#10b981" }} />
                  Active Protected License
                </div>
              </div>
            </section>

            {/* ── 2. Two-Column Dashboard Layout ── */}
            <div className={s("dashboardGrid")}>
              {/* ── Left Column: Usage & Billing History ── */}
              <div className={s("leftCol")}>
                {/* Usage Cards Grid */}
                <div className={s("usageGrid")}>
                  {/* Students Card */}
                  <div className={s("usageCard")}>
                    <div className={s("usageHead")}>
                      <div className={cx(s("usageIconBox"), s("usageIconStudents"))}>
                        <i className="fa-solid fa-user-graduate" />
                      </div>
                      <div className={s("usageInfo")}>
                        <p>STUDENTS ENROLLED</p>
                        <strong>
                          {status?.student_count ?? 0}
                          <span> / {plan?.max_students ? plan.max_students : "∞"}</span>
                        </strong>
                      </div>
                    </div>
                    <ProgressBar value={status?.student_count ?? 0} max={plan?.max_students ?? null} />
                    {!status?.can_add_student && (
                      <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8, fontWeight: 800, margin: "8px 0 0" }}>
                        <i className="fa-solid fa-lock" style={{ marginRight: 4 }} /> Student capacity reached
                      </p>
                    )}
                  </div>

                  {/* Teachers Card */}
                  <div className={s("usageCard")}>
                    <div className={s("usageHead")}>
                      <div className={cx(s("usageIconBox"), s("usageIconTeachers"))}>
                        <i className="fa-solid fa-chalkboard-user" />
                      </div>
                      <div className={s("usageInfo")}>
                        <p>TEACHERS & STAFF</p>
                        <strong>
                          {status?.teacher_count ?? 0}
                          <span> / {plan?.max_teachers ? plan.max_teachers : "∞"}</span>
                        </strong>
                      </div>
                    </div>
                    <ProgressBar value={status?.teacher_count ?? 0} max={plan?.max_teachers ?? null} />
                    {!status?.can_add_teacher && (
                      <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8, fontWeight: 800, margin: "8px 0 0" }}>
                        <i className="fa-solid fa-lock" style={{ marginRight: 4 }} /> Faculty limit reached
                      </p>
                    )}
                  </div>
                </div>

                {/* Billing History Card */}
                <div className={s("sectionCard")}>
                  <div className={s("sectionHead")}>
                    <div className={s("sectionHeadLeft")}>
                      <div className={s("sectionIcon")}>
                        <i className="fa-solid fa-receipt" />
                      </div>
                      <div>
                        <h3>Billing & Invoices</h3>
                        <p>Payment history and subscription receipts</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", background: "#edf2f7", padding: "3px 10px", borderRadius: 999 }}>
                      {history?.length || 0} records
                    </span>
                  </div>

                  <div className={s("tableWrap")}>
                    {hL ? (
                      <div style={{ padding: "2.5rem", textAlign: "center" }}><Spinner size={24} color="#ff9b51" /></div>
                    ) : (
                      <table className={s("billingTable")}>
                        <thead>
                          <tr>
                            <th>Plan</th>
                            <th>Cycle</th>
                            <th>Amount</th>
                            <th>Period</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(history ?? []).map((h: any) => {
                            const hst = STATUS_STYLE[h.status] ?? STATUS_STYLE.active;
                            return (
                              <tr key={h.id}>
                                <td style={{ fontWeight: 800 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <i className="fa-solid fa-cube" style={{ color: "#ff9b51", fontSize: 12 }} />
                                    <span>{h.plan_name}</span>
                                  </div>
                                </td>
                                <td style={{ textTransform: "capitalize", color: "#64748b", fontWeight: 700 }}>
                                  {h.billing_cycle}
                                </td>
                                <td style={{ fontWeight: 800 }}>
                                  {Number(h.amount_paid) > 0 ? (
                                    <span style={{ color: "#0f172a" }}>{h.currency ?? "NPR"} {h.amount_paid}</span>
                                  ) : (
                                    <span style={{ color: "#94a3b8" }}>14-Day Trial</span>
                                  )}
                                </td>
                                <td style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                                  {fmt(h.start_date)}{h.end_date ? ` – ${fmt(h.end_date)}` : " (ongoing)"}
                                </td>
                                <td>
                                  <span style={{
                                    padding: "3px 10px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 900,
                                    background: hst.bg,
                                    color: hst.color,
                                    border: `1px solid ${hst.border}`,
                                    textTransform: "uppercase",
                                  }}>
                                    {hst.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {!history?.length && (
                            <tr>
                              <td colSpan={5} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
                                <i className="fa-solid fa-file-invoice" style={{ fontSize: 24, display: "block", marginBottom: 8, color: "#cbd5e1" }} />
                                No billing records found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Right Column: Features Grid & Support Card ── */}
              <div className={s("rightCol")}>
                {/* Plan Features Card */}
                <div className={s("sectionCard")}>
                  <div className={s("sectionHead")}>
                    <div className={s("sectionHeadLeft")}>
                      <div className={s("sectionIcon")} style={{ background: "#ecfdf5", color: "#059669" }}>
                        <i className="fa-solid fa-circle-check" />
                      </div>
                      <div>
                        <h3>Included Features</h3>
                        <p>Active entitlements in your {plan?.name} plan</p>
                      </div>
                    </div>
                  </div>

                  <div className={s("featuresGrid")}>
                    <div className={s("featureChip")}>
                      <i className={cx("fa-solid fa-circle-check", s("chipCheck"))} />
                      <span>{plan?.max_students ? `Up to ${plan.max_students} Students` : "Unlimited Students"}</span>
                    </div>

                    <div className={s("featureChip")}>
                      <i className={cx("fa-solid fa-circle-check", s("chipCheck"))} />
                      <span>{plan?.max_teachers ? `Up to ${plan.max_teachers} Teachers` : "Unlimited Teachers"}</span>
                    </div>

                    <div className={cx(s("featureChip"), !plan?.fee_management_enabled && s("featureChipLocked"))}>
                      <i className={cx("fa-solid", plan?.fee_management_enabled ? "fa-circle-check" : "fa-lock", plan?.fee_management_enabled ? s("chipCheck") : s("chipLock"))} />
                      <span>Fee Management</span>
                    </div>

                    <div className={cx(s("featureChip"), !plan?.online_payment_enabled && s("featureChipLocked"))}>
                      <i className={cx("fa-solid", plan?.online_payment_enabled ? "fa-circle-check" : "fa-lock", plan?.online_payment_enabled ? s("chipCheck") : s("chipLock"))} />
                      <span>Online Payments</span>
                    </div>

                    <div className={s("featureChip")}>
                      <i className={cx("fa-solid fa-circle-check", s("chipCheck"))} />
                      <span>Daily Attendance</span>
                    </div>

                    <div className={s("featureChip")}>
                      <i className={cx("fa-solid fa-circle-check", s("chipCheck"))} />
                      <span>Exams & Results</span>
                    </div>

                    <div className={s("featureChip")}>
                      <i className={cx("fa-solid fa-circle-check", s("chipCheck"))} />
                      <span>Notice Board</span>
                    </div>

                    <div className={s("featureChip")}>
                      <i className={cx("fa-solid fa-circle-check", s("chipCheck"))} />
                      <span>Academic Calendar</span>
                    </div>

                    <div className={s("featureChip")}>
                      <i className={cx("fa-solid fa-circle-check", s("chipCheck"))} />
                      <span>Transport & Hostel</span>
                    </div>

                    <div className={s("featureChip")}>
                      <i className={cx("fa-solid fa-circle-check", s("chipCheck"))} />
                      <span>Class Timetables</span>
                    </div>
                  </div>
                </div>

                {/* Support Card */}
                <div className={s("supportCard")}>
                  <div className={s("supportLeft")}>
                    <div className={s("supportIcon")}>
                      <i className="fa-solid fa-headset" />
                    </div>
                    <div>
                      <h4>Need Higher Limits?</h4>
                      <p>Contact support for custom capacity or multi-branch setups.</p>
                    </div>
                  </div>
                  <Link href="/contact" className={s("btnContact")}>
                    <i className="fa-solid fa-envelope" /> Contact Us
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
