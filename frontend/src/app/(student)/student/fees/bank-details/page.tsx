"use client";

import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import { Spinner } from "@/components/shared/Loader";
import { useApi } from "@/lib/useApi";

function BankAccountCard({ account }: { account: any }) {
  return (
    <>
    {/* Info Banner */}
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <i className="fa-solid fa-circle-info" style={{ color: "#c2410c", fontSize: 15, marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#92400e", marginBottom: 4 }}>How to pay online</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", lineHeight: 1.7 }}>
                1. Open the bank details page to view the school account information. &nbsp;
                2. Transfer the fee amount from your bank / eSewa / Khalti. &nbsp;
                3. Fill in the form below with your transaction ID + screenshot. &nbsp;
                4. Wait for admin to verify (usually within 1 business day).
              </div>
            </div>
          </div>

    <div style={{ border: "1px solid #e1e8eb", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", background: "#1f2d36", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(255,155,81,0.18)", color: "#FF9B51", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          <i className="fa-solid fa-building-columns" />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{account.bank_name}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginTop: 2 }}>
            A/C Holder: <span style={{ color: "#FF9B51" }}>{account.account_name}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
          {[
            { label: "Account Number", val: account.account_number },
            account.branch && { label: "Branch", val: account.branch },
            account.ifsc_code && { label: "IFSC Code", val: account.ifsc_code },
            account.upi_id && { label: "eSewa / Khalti / UPI", val: account.upi_id },
            account.notes && { label: "Note", val: account.notes },
          ].filter(Boolean).map((item: any) => (
            <div key={item.label} style={{ padding: "9px 11px", borderRadius: 8, background: "#f7fbfc", border: "1px solid #e1e8eb" }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1f2d36", marginTop: 2, wordBreak: "break-all" }}>{item.val}</div>
            </div>
          ))}
        </div>

        {account.qr_image_url && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "18px 16px", borderRadius: 12, background: "#f7fbfc", border: "1px solid #e1e8eb" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 0.8 }}>Scan to Pay</div>
            <div style={{ padding: 10, background: "#fff", borderRadius: 14, boxShadow: "0 4px 20px rgba(31,45,54,0.12)", display: "inline-flex" }}>
              <img src={account.qr_image_url} alt="Payment QR" style={{ width: 200, height: 200, objectFit: "contain", display: "block" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#1f2d36" }}>{account.bank_name}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6a7882", marginTop: 2 }}>{account.account_name}</div>
              {account.upi_id && (
                <div style={{ fontSize: 12, fontWeight: 700, color: "#3b5bdb", marginTop: 4 }}>
                  <i className="fa-solid fa-mobile-screen-button" style={{ marginRight: 5 }} />{account.upi_id}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>eSewa · Khalti · UPI · Bank Transfer</div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export default function BankDetailsPage() {
  const { data: bankAccounts, loading: bankLoading } = useApi<any[]>("/online-payments/active-bank-accounts");
  const hasBankAccounts = (bankAccounts ?? []).length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
        .ssp *, .ssp *::before, .ssp *::after { box-sizing: border-box; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
        .ssp { min-height: 100vh; background: #eef2f3; }
        .ssp-main { padding: 20px; max-width: 980px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
        .ssp-card { background: #fff; border-radius: 14px; border: 1px solid #dce5e9; box-shadow: 0 2px 12px rgba(31,45,54,.05); overflow: hidden; }
        .ssp-card-head { padding: 14px 18px; border-bottom: 1px solid #eef2f3; display: flex; align-items: center; gap: 12px; }
        .ssp-card-body { padding: 18px; }
        @media (max-width: 600px) { .ssp-main { padding: 14px; } }
      `}</style>

      <div className="ssp">
        <Topbar title="Bank Details" subtitle="Transfer fees to one of the school accounts" />

        <div className="ssp-main">
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href="/student/fees/submit-pay-form" style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 9, border: "1px solid #dce5e9",
              background: "#fff", color: "#1f2d36", fontWeight: 800, fontSize: 13,
              textDecoration: "none",
            }}>
              <i className="fa-solid fa-arrow-left" /> Back to Submit Payment
            </Link>
          </div>

          <div className="ssp-card">
            <div className="ssp-card-head">
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fff7ed", color: "#FF9B51", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                <i className="fa-solid fa-building-columns" />
              </div>
              <div>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36", display: "block" }}>School Bank Accounts</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", display: "block", marginTop: 1 }}>Use these details to pay your fee and then submit the payment proof</span>
              </div>
            </div>
            <div className="ssp-card-body">
              {bankLoading ? (
                <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={24} color="#FF9B51" /></div>
              ) : !hasBankAccounts ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                  <i className="fa-solid fa-building-columns" style={{ fontSize: 28, display: "block", marginBottom: 10, opacity: 0.2 }} />
                  <p style={{ fontWeight: 700, fontSize: 13 }}>No bank accounts configured yet. Please contact admin.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(bankAccounts ?? []).map((acc: any) => <BankAccountCard key={acc.id} account={acc} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
