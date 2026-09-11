"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/lib/useCurrency";
import { useDateFormat } from "@/lib/useDateFormat";

export interface PendingFeeItem {
  id: number | string;
  fee_name?: string;
  fee_type?: string;
  due_date?: string;
  total_amount?: number | string;
  paid_amount?: number | string;
  remaining_amount?: number | string;
  status?: string;
}

interface PendingFeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingFees: PendingFeeItem[];
  totalDue: number;
}

export default function PendingFeesModal({
  isOpen,
  onClose,
  pendingFees,
  totalDue,
}: PendingFeesModalProps) {
  const router = useRouter();
  const { fmt } = useCurrency();
  const { formatDate } = useDateFormat();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || pendingFees.length === 0) return null;

  const handlePayNow = () => {
    onClose();
    router.push("/student/fees");
  };

  const formatFeeName = (name?: string) => {
    if (!name) return "Tuition / General Fee";
    return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <>
      <style>{`
        .pfm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: pfmFadeIn 0.2s ease-out;
        }

        .pfm-card {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
          max-width: 780px;
          width: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: pfmScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: 'Nunito', 'Inter', sans-serif;
          max-height: 90vh;
        }

        .pfm-header {
          padding: 20px 24px;
          background: #fff;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .pfm-head-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .pfm-icon-ring {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #fff1f2;
          border: 1.5px solid #ffe4e6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e11d48;
          font-size: 22px;
          flex-shrink: 0;
        }

        .pfm-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.2px;
        }

        .pfm-subtitle {
          font-size: 12.5px;
          font-weight: 600;
          color: #64748b;
          margin: 3px 0 0;
        }

        .pfm-close-btn {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #64748b;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .pfm-close-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .pfm-summary-bar {
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          border-top: 1px solid #fed7aa;
          border-bottom: 1px solid #fed7aa;
          padding: 14px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .pfm-summary-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pfm-summary-pill {
          background: #ea580c;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .pfm-summary-text {
          font-size: 13px;
          font-weight: 700;
          color: #9a3412;
        }

        .pfm-summary-total {
          font-size: 18px;
          font-weight: 900;
          color: #c2410c;
        }

        .pfm-table-wrap {
          overflow-y: auto;
          max-height: 340px;
          padding: 0;
        }

        .pfm-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          text-align: left;
        }

        .pfm-table th {
          position: sticky;
          top: 0;
          background: #f8fafc;
          padding: 10px 16px;
          font-weight: 800;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #475569;
          border-bottom: 1.5px solid #e2e8f0;
          z-index: 1;
        }

        .pfm-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          vertical-align: middle;
        }

        .pfm-table tr:hover td {
          background: #fcfcfd;
        }

        .pfm-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .pfm-badge-overdue {
          background: #fee2e2;
          color: #dc2626;
          border: 1px solid #fca5a5;
        }

        .pfm-badge-pending {
          background: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .pfm-badge-partial {
          background: #e0e7ff;
          color: #4338ca;
          border: 1px solid #c7d2fe;
        }

        .pfm-footer {
          padding: 16px 24px;
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .pfm-footer-note {
          font-size: 11.5px;
          color: #64748b;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pfm-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pfm-btn {
          height: 38px;
          padding: 0 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          text-decoration: none;
        }

        .pfm-btn-ghost {
          background: #fff;
          border: 1.5px solid #dce5e9;
          color: #475569;
        }

        .pfm-btn-ghost:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .pfm-btn-primary {
          background: #FF5E1E;
          border: none;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(255, 94, 30, 0.35);
        }

        .pfm-btn-primary:hover {
          background: #e04e12;
        }

        @keyframes pfmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes pfmScaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="pfm-backdrop" onClick={onClose}>
        <div className="pfm-card" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="pfm-header">
            <div className="pfm-head-left">
              <div className="pfm-icon-ring">
                <i className="fa-solid fa-file-invoice-dollar" />
              </div>
              <div>
                <h3 className="pfm-title">Outstanding Fee Notice</h3>
                <p className="pfm-subtitle">
                  You have pending dues. Please review the fee head details below.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="pfm-close-btn"
              onClick={onClose}
              title="Close and remind me later"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Summary Strip */}
          <div className="pfm-summary-bar">
            <div className="pfm-summary-left">
              <span className="pfm-summary-pill">Action Required</span>
              <span className="pfm-summary-text">
                {pendingFees.length} fee invoice{pendingFees.length > 1 ? "s" : ""} pending payment
              </span>
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#9a3412", marginRight: 8 }}>
                Total Outstanding:
              </span>
              <span className="pfm-summary-total">{fmt(totalDue)}</span>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="pfm-table-wrap">
            <table className="pfm-table">
              <thead>
                <tr>
                  <th>Fee Head</th>
                  <th>Type</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingFees.map((fee) => {
                  const remaining = Number(fee.remaining_amount || 0);
                  const paid = Number(fee.paid_amount || 0);
                  const total = Number(fee.total_amount || 0);
                  const isOverdue =
                    fee.status === "overdue" ||
                    Boolean(fee.due_date && new Date(fee.due_date) < new Date());

                  return (
                    <tr key={fee.id}>
                      <td>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>
                          {formatFeeName(fee.fee_name)}
                        </div>
                        {isOverdue && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: "#dc2626",
                              display: "block",
                              marginTop: 2,
                            }}
                          >
                            <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: 4 }} />
                            Past Due Date
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "#f1f5f9",
                            color: "#475569",
                            textTransform: "capitalize",
                          }}
                        >
                          {fee.fee_type || "General"}
                        </span>
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: isOverdue ? "#dc2626" : "#64748b",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fee.due_date ? formatDate(fee.due_date.slice(0, 10)) : "—"}
                      </td>
                      <td style={{ fontWeight: 700, color: "#334155" }}>
                        {fmt(total)}
                      </td>
                      <td style={{ fontWeight: 700, color: paid > 0 ? "#059669" : "#94a3b8" }}>
                        {paid > 0 ? fmt(paid) : "—"}
                      </td>
                      <td style={{ fontWeight: 800, color: "#dc2626" }}>
                        {fmt(remaining)}
                      </td>
                      <td>
                        {isOverdue ? (
                          <span className="pfm-badge pfm-badge-overdue">
                            <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 9 }} />
                            Overdue
                          </span>
                        ) : paid > 0 ? (
                          <span className="pfm-badge pfm-badge-partial">
                            <i className="fa-solid fa-circle-half-stroke" style={{ fontSize: 9 }} />
                            Partial
                          </span>
                        ) : (
                          <span className="pfm-badge pfm-badge-pending">
                            <i className="fa-solid fa-hourglass-start" style={{ fontSize: 9 }} />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="pfm-footer">
            <div className="pfm-footer-note">
              <i className="fa-solid fa-circle-info" style={{ color: "#3b82f6" }} />
              <span>You can pay dues or submit payment receipts online anytime.</span>
            </div>
            <div className="pfm-actions">
              <button
                type="button"
                className="pfm-btn pfm-btn-ghost"
                onClick={onClose}
              >
                Remind Me Later
              </button>
              <button
                type="button"
                className="pfm-btn pfm-btn-primary"
                onClick={handlePayNow}
              >
                <i className="fa-solid fa-credit-card" />
                Pay Fees Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
