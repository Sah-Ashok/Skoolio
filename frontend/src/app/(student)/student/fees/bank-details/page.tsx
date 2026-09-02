"use client";

import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import { Spinner } from "@/components/shared/Loader";
import { useApi } from "@/lib/useApi";

/* ─────────────────────────────────────────────────────────────────────────
   Copy-to-clipboard helper
───────────────────────────────────────────────────────────────────────── */
function CopyBtn({ text }: { text: string }) {
  return (
    <button
      type="button"
      title="Copy"
      onClick={() => navigator.clipboard?.writeText(text)}
      style={{
        flexShrink: 0, padding: "3px 8px", borderRadius: 6,
        border: "1px solid #dce5e9", background: "#f8fafc",
        cursor: "pointer", fontSize: 11, color: "#6a7882",
        display: "inline-flex", alignItems: "center", gap: 4,
        fontWeight: 700,
      }}
    >
      <i className="fa-regular fa-copy" /> Copy
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Info row — label + value + optional copy button
───────────────────────────────────────────────────────────────────────── */
function InfoRow({ icon, label, value, copy }: { icon: string; label: string; value: string; copy?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f0f4f6" }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f8fafc", border: "1px solid #e8edf2", fontSize: 13, color: "#64748b",
      }}>
        <i className={`fa-solid ${icon}`} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", marginTop: 1, wordBreak: "break-all" }}>{value}</div>
      </div>
      {copy && <CopyBtn text={value} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Single bank account card
   — bank name / holder shown ONCE in the header only
   — QR section shows QR + "Scan to pay" text; no duplicate info below
───────────────────────────────────────────────────────────────────────── */
function BankAccountCard({ account, index }: { account: any; index: number }) {
  const ACCENT_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f97316", "#8b5cf6"];
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];

  return (
    <div style={{
      borderRadius: 14, background: "#fff",
      border: "1px solid #e8edf2", overflow: "hidden",
      borderLeft: `4px solid ${accent}`,
      boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
    }}>
      {/* ── Header: bank name + holder ── */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid #f0f4f6",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, background: "#f8fafc", border: `2px solid ${accent}`,
          color: accent,
        }}>
          <i className="fa-solid fa-building-columns" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", lineHeight: 1.2 }}>{account.bank_name}</div>
          {account.account_name && (
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
              <i className="fa-solid fa-user" style={{ fontSize: 10, color: accent }} />
              Account Holder: <span style={{ color: "#1e293b", marginLeft: 4 }}>{account.account_name}</span>
            </div>
          )}
        </div>
        {/* Bank type badge */}
        <span style={{
          padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 800,
          background: `${accent}15`, color: accent, border: `1px solid ${accent}30`,
          flexShrink: 0, whiteSpace: "nowrap",
        }}>Bank</span>
      </div>

      {/* ── Account details ── */}
      <div style={{ padding: "4px 20px 0" }}>
        <InfoRow icon="fa-hashtag"       label="Account Number" value={account.account_number}  copy />
        {account.branch    && <InfoRow icon="fa-location-dot"  label="Branch"         value={account.branch}                />}
        {account.ifsc_code && <InfoRow icon="fa-barcode"       label="IFSC / SWIFT Code" value={account.ifsc_code}  copy />}
        {account.upi_id    && <InfoRow icon="fa-mobile-screen" label="eSewa / Khalti / UPI" value={account.upi_id}   copy />}
        {account.notes     && <InfoRow icon="fa-circle-info"   label="Note"           value={account.notes}                 />}
      </div>

      {/* ── QR code (if present) ── */}
      {account.qr_image_url && (
        <div style={{
          margin: "14px 20px 16px",
          padding: "20px", borderRadius: 12,
          background: "#f8fafc", border: "1px solid #e8edf2",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px",
          }}>
            <i className="fa-solid fa-qrcode" style={{ fontSize: 13, color: accent }} />
            Scan to Pay
          </div>
          <div style={{
            padding: 10, background: "#fff", borderRadius: 14,
            border: `2px solid ${accent}30`, display: "inline-flex",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          }}>
            <img
              src={account.qr_image_url}
              alt={`QR code for ${account.bank_name}`}
              style={{ width: 180, height: 180, objectFit: "contain", display: "block" }}
            />
          </div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#64748b", textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
            Scan with <strong>eSewa</strong>, <strong>Khalti</strong>, <strong>UPI</strong>, or any bank app.
            For manual transfer, use the account number above.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────────────────── */
export default function BankDetailsPage() {
  const { data: bankAccounts, loading: bankLoading } = useApi<any[]>("/online-payments/active-bank-accounts");
  const accounts = bankAccounts ?? [];

  return (
    <>
      <style>{`
        .bd-wrap { min-height: 100vh; background: #f8fafc; }
        .bd-main  { padding: 20px 24px 48px; max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
        .bd-how   { padding: 16px 18px; border-radius: 12px; background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; }
        @media (max-width: 600px) {
          .bd-main { padding: 14px 12px 32px; gap: 14px; }
        }
      `}</style>

      <div className="bd-wrap">
        <Topbar title="Bank Details" subtitle="School bank accounts for fee payment" />

        <div className="bd-main">

          {/* Back button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <Link href="/student/submit-payment" style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 9, border: "1px solid #dce5e9",
              background: "#fff", color: "#475569", fontWeight: 800, fontSize: 13,
              textDecoration: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <i className="fa-solid fa-arrow-left" style={{ fontSize: 12 }} /> Back to Submit Payment
            </Link>
          </div>

          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "#fff", border: "2px solid #6366f1",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, color: "#6366f1", flexShrink: 0,
            }}>
              <i className="fa-solid fa-building-columns" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>School Bank Details</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginTop: 2 }}>
                Use these details to pay your fee, then submit the payment proof
              </div>
            </div>
          </div>

          {/* How to pay */}
          <div className="bd-how">
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <i className="fa-solid fa-circle-question" style={{ color: "#d97706", fontSize: 14 }} />
              <span style={{ fontSize: 13, fontWeight: 900, color: "#92400e" }}>How to pay</span>
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                "View the bank account details on this page.",
                "Transfer the exact fee amount from your bank, eSewa, or Khalti.",
                "Note your Transaction ID and take a screenshot.",
                "Submit payment proof using 'Submit Payment' — admin will verify within 1 business day.",
              ].map((step, i) => (
                <li key={i} style={{ fontSize: 12, fontWeight: 600, color: "#78350f", lineHeight: 1.6 }}>{step}</li>
              ))}
            </ol>
          </div>

          {/* Bank account cards */}
          {bankLoading ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <Spinner size={28} color="#6366f1" />
            </div>
          ) : accounts.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "48px 0",
              borderRadius: 14, background: "#fff", border: "1px solid #e8edf2",
            }}>
              <i className="fa-solid fa-building-columns" style={{ fontSize: 36, color: "#cbd5e1", display: "block", marginBottom: 12 }} />
              <p style={{ fontWeight: 700, fontSize: 13, color: "#94a3b8", margin: 0 }}>
                No bank accounts configured yet.<br />Please contact the school administration.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {accounts.map((acc: any, idx: number) => (
                <BankAccountCard key={acc.id} account={acc} index={idx} />
              ))}
            </div>
          )}

          {/* Footer note */}
          <div style={{
            padding: "12px 16px", borderRadius: 10,
            background: "#fff", border: "1px solid #e8edf2",
            borderLeft: "4px solid #6366f1",
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <i className="fa-solid fa-shield-halved" style={{ color: "#6366f1", fontSize: 14, marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", lineHeight: 1.6 }}>
              Always verify the account details with the school before making a transfer.
              Once submitted, contact the admin if payment is not verified within 2 business days.
            </span>
          </div>

        </div>
      </div>
    </>
  );
}
