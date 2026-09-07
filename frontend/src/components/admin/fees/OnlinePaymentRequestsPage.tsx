"use client";

import { useState, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./fees.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import Loader, { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const fmt = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));

const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

type Status = "pending" | "verified" | "rejected";

const TAB_LABELS: Record<Status, string> = {
  pending:  "Pending Verification",
  verified: "Verified",
  rejected: "Rejected",
};

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  pending:  { bg: "#fff1df", color: "#a85f12" },
  verified: { bg: "#e2f6ee", color: "#12805c" },
  rejected: { bg: "#fde7e7", color: "#b42318" },
};

// ── Detail Modal ──────────────────────────────────────────────────────────────
function RequestDetailModal({
  req,
  onClose,
  onVerify,
  onReject,
}: {
  req:      any;
  onClose:  () => void;
  onVerify: (id: number, notes: string)             => Promise<void>;
  onReject: (id: number, rejection_reason: string)  => Promise<void>;
}) {
  const [notes,  setNotes]  = useState("");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"verify" | "reject" | null>(null);
  const [busy,   setBusy]   = useState(false);

  const handleVerify = async () => {
    setBusy(true);
    await onVerify(req.id, notes);
    setBusy(false);
    onClose();
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    await onReject(req.id, reason);
    setBusy(false);
    onClose();
  };

  const isPending = req.status === "pending";

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Head */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #e8eef0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#ff9b51", textTransform: "uppercase", letterSpacing: 1 }}>Payment Request</p>
            <h2 style={{ margin: "4px 0 0", fontSize: 17, fontWeight: 900 }}>{req.full_name}</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6a7882", fontWeight: 700 }}>{req.admission_number} · {req.class_name} {req.section_name}</p>
          </div>
          <span
            style={{ padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 900, background: STATUS_STYLE[req.status as Status]?.bg, color: STATUS_STYLE[req.status as Status]?.color }}
          >
            {req.status}
          </span>
        </div>

        <div style={{ padding: "18px 22px" }}>
          {/* Payment details */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            {[
              ["Amount Submitted",  fmt(req.amount)],
              ["Payment Date",      fmtDate(req.payment_date)],
              ["Bank Account",      req.bank_name ?? "—"],
              ["Transaction Ref",   req.transaction_ref || "Not provided"],
              ["Fee Head",          req.fee_name || "—"],
              ["Outstanding Before", fmt(req.collection_remaining_amount ?? 0)],
            ].map(([label, val]) => (
              <div key={label} style={{ padding: "10px 12px", borderRadius: 9, background: "#f7fbfc", border: "1px solid #e1e8eb" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#6a7882" }}>{label}</p>
                <strong style={{ fontSize: 13, color: "#1f2d36", fontWeight: 900 }}>{val}</strong>
              </div>
            ))}
          </div>

          {/* Screenshot */}
          {req.screenshot_url && (
            <div style={{ marginBottom: 18 }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 900, color: "#6a7882" }}>Payment Screenshot</p>
              <a href={req.screenshot_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={req.screenshot_url}
                  alt="Payment screenshot"
                  style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 10, border: "1px solid #e1e8eb", cursor: "pointer" }}
                />
              </a>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#6a7882" }}>Click image to open full size</p>
            </div>
          )}

          {/* Student note */}
          {req.notes && (
            <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 9, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 900, color: "#0369a1" }}>Student's Note</p>
              <p style={{ margin: 0, fontSize: 13, color: "#1f2d36", fontWeight: 700 }}>{req.notes}</p>
            </div>
          )}

          {/* Rejection reason (if rejected) */}
          {req.status === "rejected" && req.rejection_reason && (
            <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 9, background: "#fde7e7", border: "1px solid #fecaca" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 900, color: "#b42318" }}>Rejection Reason</p>
              <p style={{ margin: 0, fontSize: 13, color: "#1f2d36", fontWeight: 700 }}>{req.rejection_reason}</p>
            </div>
          )}

          {/* Actions for pending requests */}
          {isPending && (
            <>
              {action === null && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    style={{ minHeight: 44, borderRadius: 9, border: "none", background: "#e2f6ee", color: "#12805c", fontWeight: 900, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    onClick={() => setAction("verify")}
                  >
                    <i className="fa-solid fa-circle-check" /> Verify Payment
                  </button>
                  <button
                    style={{ minHeight: 44, borderRadius: 9, border: "none", background: "#fde7e7", color: "#b42318", fontWeight: 900, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    onClick={() => setAction("reject")}
                  >
                    <i className="fa-solid fa-circle-xmark" /> Reject
                  </button>
                </div>
              )}

              {action === "verify" && (
                <div style={{ padding: "14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 900, color: "#12805c" }}>
                    <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
                    Verifying will mark {fmt(req.amount)} as paid against this fee.
                  </p>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 900 }}>Admin Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. Verified via bank statement…"
                      style={{ minHeight: 72, padding: "10px 12px", borderRadius: 8, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700, resize: "vertical", fontFamily: "inherit" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleVerify}
                        disabled={busy}
                        style={{ flex: 1, minHeight: 42, borderRadius: 8, border: "none", background: "#12805c", color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        {busy ? <Spinner size={14} color="#fff" /> : <><i className="fa-solid fa-check" /> Confirm Verification</>}
                      </button>
                      <button onClick={() => setAction(null)} style={{ padding: "0 16px", borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", color: "#6a7882", fontWeight: 700, cursor: "pointer" }}>
                        Back
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {action === "reject" && (
                <div style={{ padding: "14px", borderRadius: 10, background: "#fff5f5", border: "1px solid #fecaca" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 900, color: "#b42318" }}>
                    <i className="fa-solid fa-circle-xmark" style={{ marginRight: 6 }} />
                    Please provide a reason so the student knows what to fix.
                  </p>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 900 }}>Rejection Reason *</label>
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="e.g. Screenshot unclear, transaction ID missing…"
                      style={{ minHeight: 72, padding: "10px 12px", borderRadius: 8, border: "1px solid #fecaca", fontSize: 13, fontWeight: 700, resize: "vertical", fontFamily: "inherit" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleReject}
                        disabled={busy || !reason.trim()}
                        style={{ flex: 1, minHeight: 42, borderRadius: 8, border: "none", background: "#b42318", color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: !reason.trim() ? 0.6 : 1 }}
                      >
                        {busy ? <Spinner size={14} color="#fff" /> : <><i className="fa-solid fa-xmark" /> Reject Request</>}
                      </button>
                      <button onClick={() => setAction(null)} style={{ padding: "0 16px", borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", color: "#6a7882", fontWeight: 700, cursor: "pointer" }}>
                        Back
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid #e8eef0" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", color: "#6a7882", fontWeight: 700, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OnlinePaymentRequestsPage() {
  const dispatch = useAppDispatch();
  const [tab,      setTab]      = useState<Status>("pending");
  const [selected, setSelected] = useState<any | null>(null);
  const [search,   setSearch]   = useState("");

  const { data: requests, loading, refetch } = useApi<any[]>(
    `/online-payments/requests?status=${tab}`,
    [tab]
  );

  const { data: countData, refetch: refetchCount } = useApi<{ count: number }>("/online-payments/requests/pending-count");
  const pendingCount = countData?.count ?? 0;

  const filtered = useMemo(() => {
    if (!search.trim()) return requests ?? [];
    const q = search.toLowerCase();
    return (requests ?? []).filter(r =>
      r.full_name?.toLowerCase().includes(q) ||
      r.admission_number?.toLowerCase().includes(q) ||
      r.transaction_ref?.toLowerCase().includes(q)
    );
  }, [requests, search]);

  const handleVerify = async (id: number, notes: string) => {
    try {
      await apiRequest(`/online-payments/requests/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
      dispatch(showToast({ type: "success", title: "Verified", message: "Payment verified and fee record updated." }));
      refetch(); refetchCount();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Error", message: e.message || "Verification failed." }));
    }
  };

  const handleReject = async (id: number, rejection_reason: string) => {
    try {
      await apiRequest(`/online-payments/requests/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejection_reason }),
      });
      dispatch(showToast({ type: "success", title: "Rejected", message: "Payment request has been rejected." }));
      refetch(); refetchCount();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Error", message: e.message || "Rejection failed." }));
    }
  };

  return (
    <div className={s("fees-page")}>
      <Topbar title="Online Payment Requests" subtitle="Verify or reject student payment submissions" />
      <main className={s("page-content")}>

        <section className={s("page-head")}>
          <div>
            <h1>Online Payment Requests</h1>
            <p>Students submit payment proof here — verify to auto-update their fee record</p>
          </div>
          {pendingCount > 0 && (
            <div style={{ padding: "10px 16px", borderRadius: 10, background: "#fff1df", border: "1px solid #fdd5b0", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 900, color: "#a85f12" }}>
              <i className="fa-solid fa-bell" />
              {pendingCount} pending verification{pendingCount !== 1 ? "s" : ""}
            </div>
          )}
        </section>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["pending", "verified", "rejected"] as Status[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch(""); }}
              style={{
                minHeight: 36, padding: "0 16px", borderRadius: 8, border: "none", cursor: "pointer",
                fontWeight: 900, fontSize: 13,
                background: tab === t ? "#1f2d36" : "#e8eef0",
                color:      tab === t ? "#fff"    : "#6a7882",
              }}
            >
              {TAB_LABELS[t]}
              {t === "pending" && pendingCount > 0 && (
                <span style={{ marginLeft: 7, padding: "2px 8px", borderRadius: 99, background: "#ff9b51", color: "#fff", fontSize: 11, fontWeight: 900 }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 14, display: "flex", gap: 10 }}>
          <label className={s("search-field")} style={{ flex: 1 }}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="search"
              placeholder="Search by name, admission no, transaction ref…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <button
            style={{ padding: "0 14px", borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", color: "#6a7882", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
            onClick={() => { refetch(); refetchCount(); }}
          >
            <i className="fa-solid fa-rotate" /> Refresh
          </button>
        </div>

        {/* Table */}
        <section className={s("card")}>
          <div className={s("table-wrap")}>
            {loading ? (
              <Loader fullScreen={false} size="md" text="Loading payment requests…" />
            ) : filtered.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#6a7882" }}>
                <i className="fa-solid fa-inbox" style={{ fontSize: 28, display: "block", marginBottom: 10, opacity: 0.25 }} />
                <p style={{ fontWeight: 700 }}>
                  {tab === "pending" ? "No pending requests — you're all caught up!" : `No ${tab} requests.`}
                </p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Fee Head</th>
                    <th>Amount</th>
                    <th>Transaction Ref</th>
                    <th>Payment Date</th>
                    <th>Screenshot</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(req => (
                    <tr key={req.id} style={{ cursor: "pointer" }} onClick={() => setSelected(req)}>
                      <td>
                        <strong style={{ display: "block" }}>{req.full_name}</strong>
                        <small style={{ color: "#6a7882" }}>{req.admission_number}</small>
                      </td>
                      <td style={{ fontWeight: 700 }}>{req.fee_name || "—"}</td>
                      <td><strong style={{ color: "#12805c", fontSize: 14 }}>{fmt(req.amount)}</strong></td>
                      <td style={{ fontSize: 12, color: "#6a7882", fontWeight: 700 }}>{req.transaction_ref || "—"}</td>
                      <td style={{ fontSize: 12, color: "#6a7882" }}>{fmtDate(req.payment_date)}</td>
                      <td>
                        {req.screenshot_url ? (
                          <img
                            src={req.screenshot_url}
                            alt="screenshot"
                            style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid #e1e8eb" }}
                            onClick={e => { e.stopPropagation(); setSelected(req); }}
                          />
                        ) : (
                          <span style={{ fontSize: 11, color: "#aab5bb" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 900, background: STATUS_STYLE[req.status as Status]?.bg, color: STATUS_STYLE[req.status as Status]?.color }}>
                          {req.status}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {req.status === "pending" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#e2f6ee", color: "#12805c", fontWeight: 900, fontSize: 12, cursor: "pointer" }}
                              onClick={() => setSelected(req)}
                            >
                              <i className="fa-solid fa-check" /> Verify
                            </button>
                            <button
                              style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: "#fde7e7", color: "#b42318", fontWeight: 900, fontSize: 12, cursor: "pointer" }}
                              onClick={() => setSelected(req)}
                            >
                              <i className="fa-solid fa-xmark" />
                            </button>
                          </div>
                        ) : (
                          <button
                            style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d4dde2", background: "#fff", color: "#6a7882", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                            onClick={() => setSelected(req)}
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {selected && (
        <RequestDetailModal
          req={selected}
          onClose={() => setSelected(null)}
          onVerify={handleVerify}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
