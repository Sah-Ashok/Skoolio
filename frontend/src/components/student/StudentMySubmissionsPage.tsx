"use client";

import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Loader } from "@/components/shared/Loader";
import Link from "next/link";

import { useCurrency } from "@/lib/useCurrency";
import { useDateFormat } from "@/lib/useDateFormat";

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: "#fff1df", color: "#a85f12", label: "Pending Verification" },
  verified: { bg: "#e2f6ee", color: "#12805c", label: "Verified" },
  rejected: { bg: "#fde7e7", color: "#b42318", label: "Rejected" },
};

export default function StudentMySubmissionsPage() {
  const { fmt } = useCurrency();
  const { formatDate } = useDateFormat();
  const { data: myRequests, loading, refetch } = useApi<any[]>("/online-payments/my-requests");

  return (
    <>
      <style>{`
        .smsp { min-height: 100vh; background: #f8fafc; }
        .smsp-main { padding: 20px 24px 48px; max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
        .smsp-card { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.02); overflow: hidden; }
        .smsp-card-head { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; }
        .smsp-card-body { padding: 18px; }
        @media (max-width: 600px) { .smsp-main { padding: 14px 12px 32px; } }
      `}</style>

      <div className="smsp">
        <Topbar title="My Submissions" subtitle="Track the status of your submitted payments" />

        <div className="smsp-main">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/student/fees/submit-pay-form" style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 9, border: "none",
              background: "#FF9B51", color: "#fff", fontWeight: 800, fontSize: 13,
              textDecoration: "none",
            }}>
              <i className="fa-solid fa-paper-plane" /> Submit New Payment
            </Link>
            <button onClick={refetch} style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid #dce5e9", background: "#fff", color: "#6a7882", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <i className="fa-solid fa-rotate" /> Refresh
            </button>
          </div>

          <div className="smsp-card">
            <div className="smsp-card-head">
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#f0f9ff", color: "#0369a1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                <i className="fa-solid fa-clock-rotate-left" />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36", display: "block" }}>Payment Submissions</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", display: "block", marginTop: 1 }}>
                  {loading ? "Loading…" : `${(myRequests ?? []).length} submission${(myRequests ?? []).length !== 1 ? "s" : ""}`}
                </span>
              </div>
            </div>
            <div className="smsp-card-body">
              {loading ? (
                <div style={{ padding: "2rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading submissions…" /></div>
              ) : !(myRequests ?? []).length ? (
                <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>
                  <i className="fa-solid fa-inbox" style={{ fontSize: 28, display: "block", marginBottom: 10, opacity: 0.2 }} />
                  <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 16 }}>No payment submissions yet.</p>
                  <Link href="/student/fees/submit-pay-form" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 9, border: "none", background: "#FF9B51", color: "#fff", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
                    <i className="fa-solid fa-paper-plane" /> Submit Your First Payment
                  </Link>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(myRequests ?? []).map((r: any) => {
                    const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
                    return (
                      <div key={r.id} style={{ padding: "14px 16px", borderRadius: 11, border: "1px solid #e1e8eb", background: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>{r.fee_name || "Fee Payment"}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6a7882", marginTop: 2 }}>
                              {r.bank_name} · Submitted {formatDate(r.created_at || r.payment_date)}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 16, fontWeight: 900, color: "#12805c" }}>{fmt(r.amount)}</span>
                            <span style={{ padding: "4px 11px", borderRadius: 999, fontSize: 11, fontWeight: 900, background: st.bg, color: st.color, whiteSpace: "nowrap" }}>
                              {st.label}
                            </span>
                          </div>
                        </div>

                        {r.transaction_ref && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#6a7882" }}>
                            <i className="fa-solid fa-hashtag" style={{ marginRight: 5, fontSize: 10 }} />Ref: {r.transaction_ref}
                          </div>
                        )}

                        {r.status === "rejected" && r.rejection_reason && (
                          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fde7e7", border: "1px solid #fecaca" }}>
                            <div style={{ fontSize: 11, fontWeight: 900, color: "#b42318", marginBottom: 3 }}>Rejection Reason:</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2d36" }}>{r.rejection_reason}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#b42318", marginTop: 6 }}>Please correct the issue and submit again.</div>
                          </div>
                        )}

                        {r.status === "verified" && r.admin_notes && (
                          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#e2f6ee", border: "1px solid #bbf7d0" }}>
                            <div style={{ fontSize: 11, fontWeight: 900, color: "#12805c", marginBottom: 3 }}>Admin Notes:</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2d36" }}>{r.admin_notes}</div>
                          </div>
                        )}

                        {r.screenshot_url && (
                          <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "#3b5bdb", textDecoration: "none" }}>
                            <i className="fa-solid fa-image" /> View screenshot
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
