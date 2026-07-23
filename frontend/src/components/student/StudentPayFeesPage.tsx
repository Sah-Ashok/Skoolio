"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const fmt = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));

const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: "#fff1df", color: "#a85f12", label: "Pending Verification" },
  verified: { bg: "#e2f6ee", color: "#12805c", label: "Verified" },
  rejected: { bg: "#fde7e7", color: "#b42318", label: "Rejected" },
};

// ── Bank Account Card ─────────────────────────────────────────────────────────
function BankAccountCard({ account }: { account: any }) {
  return (
    <div style={{
      border: "1px solid #e1e8eb", borderRadius: 14, background: "#fff",
      overflow: "hidden",
    }}>
      {/* Header: bank name + account holder */}
      <div style={{
        padding: "14px 18px", background: "#1f2d36",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11, background: "rgba(255,155,81,0.18)",
          color: "#FF9B51", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, flexShrink: 0,
        }}>
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
        {/* Account details grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
          {[
            { label: "Account Number",    val: account.account_number },
            account.branch    && { label: "Branch",              val: account.branch },
            account.ifsc_code && { label: "IFSC Code",           val: account.ifsc_code },
            account.upi_id    && { label: "eSewa / Khalti / UPI", val: account.upi_id },
            account.notes     && { label: "Note",                val: account.notes },
          ].filter(Boolean).map((item: any) => (
            <div key={item.label} style={{ padding: "9px 11px", borderRadius: 8, background: "#f7fbfc", border: "1px solid #e1e8eb" }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1f2d36", marginTop: 2, wordBreak: "break-all" }}>{item.val}</div>
            </div>
          ))}
        </div>

        {/* QR Code — large, PhonePe/eSewa style */}
        {account.qr_image_url && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            padding: "18px 16px", borderRadius: 12, background: "#f7fbfc", border: "1px solid #e1e8eb",
          }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 0.8 }}>
              Scan to Pay
            </div>
            <div style={{
              padding: 10, background: "#fff", borderRadius: 14,
              boxShadow: "0 4px 20px rgba(31,45,54,0.12)",
              display: "inline-flex",
            }}>
              <img
                src={account.qr_image_url}
                alt="Payment QR"
                style={{ width: 200, height: 200, objectFit: "contain", display: "block" }}
              />
            </div>
            {/* Bank + holder below QR for sender to verify */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#1f2d36" }}>{account.bank_name}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6a7882", marginTop: 2 }}>
                {account.account_name}
              </div>
              {account.upi_id && (
                <div style={{ fontSize: 12, fontWeight: 700, color: "#3b5bdb", marginTop: 4 }}>
                  <i className="fa-solid fa-mobile-screen-button" style={{ marginRight: 5 }} />
                  {account.upi_id}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
              eSewa · Khalti · UPI · Bank Transfer
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Submit Payment Form ───────────────────────────────────────────────────────
function SubmitPaymentForm({
  collections,
  bankAccounts,
  onSuccess,
}: {
  collections: any[];
  bankAccounts: any[];
  onSuccess:   () => void;
}) {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState({
    fee_collection_id: "",
    bank_account_id:   "",
    amount:            "",
    payment_date:      new Date().toISOString().slice(0, 10),
    transaction_ref:   "",
    notes:             "",
  });
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      dispatch(showToast({ type: "error", title: "Invalid File", message: "Please select an image file (JPG, PNG, etc)." }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      dispatch(showToast({ type: "error", title: "Too Large", message: "Screenshot must be under 5MB." }));
      return;
    }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!form.fee_collection_id) { dispatch(showToast({ type: "error", title: "Required", message: "Please select a fee to pay." })); return; }
    if (!form.bank_account_id)   { dispatch(showToast({ type: "error", title: "Required", message: "Please select the bank account you paid to." })); return; }
    if (!form.amount || Number(form.amount) <= 0) { dispatch(showToast({ type: "error", title: "Required", message: "Please enter the amount you paid." })); return; }
    if (!form.payment_date) { dispatch(showToast({ type: "error", title: "Required", message: "Please enter the payment date." })); return; }

    setSubmitting(true);
    try {
      let screenshot_url = "";

      if (screenshotFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append("screenshot", screenshotFile);
        const uploadRes = await fetch(`${API_BASE_URL}/api/upload/payment-screenshot`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!uploadRes.ok) {
          const errJson = await uploadRes.json().catch(() => ({}));
          throw new Error(errJson?.message || "Screenshot upload failed");
        }
        const uploadJson = await uploadRes.json();
        screenshot_url = uploadJson?.data?.url || uploadJson?.url || "";
        setUploading(false);
      }

      await apiRequest("/online-payments/requests", {
        method: "POST",
        body: JSON.stringify({
          fee_collection_id: Number(form.fee_collection_id),
          bank_account_id:   Number(form.bank_account_id),
          amount:            Number(form.amount),
          payment_date:      form.payment_date,
          transaction_ref:   form.transaction_ref.trim() || undefined,
          screenshot_url:    screenshot_url || undefined,
          notes:             form.notes.trim() || undefined,
        }),
      });

      dispatch(showToast({ type: "success", title: "Submitted!", message: "Your payment request has been sent to the admin for verification." }));
      setForm({ fee_collection_id: "", bank_account_id: "", amount: "", payment_date: new Date().toISOString().slice(0, 10), transaction_ref: "", notes: "" });
      setScreenshotFile(null);
      setScreenshotPreview(null);
      onSuccess();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Submission Failed", message: e.message || "Could not submit payment request." }));
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const unpaidCollections = collections.filter(c => c.status !== "paid" && c.status !== "waived" && Number(c.remaining_amount) > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Fee selection */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
          Select Fee to Pay <span style={{ color: "#e53e3e" }}>*</span>
        </label>
        <select
          value={form.fee_collection_id}
          onChange={e => {
            const col = collections.find(c => String(c.id) === e.target.value);
            setForm(f => ({ ...f, fee_collection_id: e.target.value, amount: col ? String(col.remaining_amount) : "" }));
          }}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700, color: "#1f2d36", background: "#fff", appearance: "none" }}
        >
          <option value="">— Select fee —</option>
          {unpaidCollections.map(c => (
            <option key={c.id} value={c.id}>
              {c.fee_name} · Due {fmtDate(c.due_date?.slice(0, 10))} · {fmt(c.remaining_amount)} remaining
            </option>
          ))}
        </select>
        {unpaidCollections.length === 0 && (
          <p style={{ fontSize: 12, fontWeight: 700, color: "#12805c", marginTop: 6 }}>
            <i className="fa-solid fa-circle-check" style={{ marginRight: 5 }} />
            All your fees are paid up!
          </p>
        )}
      </div>

      {/* Bank account selection */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
          Bank Account You Paid To <span style={{ color: "#e53e3e" }}>*</span>
        </label>
        <select
          value={form.bank_account_id}
          onChange={e => setForm(f => ({ ...f, bank_account_id: e.target.value }))}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700, color: "#1f2d36", background: "#fff", appearance: "none" }}
        >
          <option value="">— Select bank account —</option>
          {bankAccounts.map(b => (
            <option key={b.id} value={b.id}>{b.bank_name} · {b.account_name}</option>
          ))}
        </select>
      </div>

      {/* Amount + Date row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
            Amount Paid <span style={{ color: "#e53e3e" }}>*</span>
          </label>
          <input
            type="number"
            min="1"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="e.g. 5000"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
            Payment Date <span style={{ color: "#e53e3e" }}>*</span>
          </label>
          <input
            type="date"
            value={form.payment_date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700 }}
          />
        </div>
      </div>

      {/* Transaction ref */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
          Transaction / Reference ID
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", marginLeft: 6 }}>(Highly recommended)</span>
        </label>
        <input
          type="text"
          value={form.transaction_ref}
          onChange={e => setForm(f => ({ ...f, transaction_ref: e.target.value }))}
          placeholder="e.g. TXN123456789 or eSewa transaction ID"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700 }}
        />
      </div>

      {/* Screenshot upload */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
          Payment Screenshot
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", marginLeft: 6 }}>(Strongly recommended for faster approval)</span>
        </label>
        {screenshotPreview ? (
          <div style={{ position: "relative", display: "inline-block" }}>
            <img src={screenshotPreview} alt="Screenshot preview" style={{ width: "100%", maxWidth: 320, maxHeight: 200, objectFit: "contain", borderRadius: 10, border: "1px solid #e1e8eb" }} />
            <button
              onClick={() => { setScreenshotFile(null); setScreenshotPreview(null); }}
              style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", border: "none", background: "#b42318", color: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        ) : (
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "24px 16px", borderRadius: 10, border: "2px dashed #c6d0d7", background: "#f7fbfc", cursor: "pointer" }}>
            <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 24, color: "#6a7882" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#6a7882" }}>Click to upload screenshot</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#aab5bb" }}>JPG, PNG up to 5MB</span>
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          </label>
        )}
      </div>

      {/* Notes */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
          Additional Note <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882" }}>(optional)</span>
        </label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="e.g. Paid via eSewa mobile banking. Please check and confirm."
          rows={2}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700, resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || unpaidCollections.length === 0}
        style={{
          minHeight: 46, borderRadius: 10, border: "none", background: "#FF9B51", color: "#fff",
          fontWeight: 900, fontSize: 14, cursor: (submitting || unpaidCollections.length === 0) ? "not-allowed" : "pointer",
          opacity: (submitting || unpaidCollections.length === 0) ? 0.6 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {submitting ? (
          <><Spinner size={16} color="#fff" /> {uploading ? "Uploading screenshot…" : "Submitting…"}</>
        ) : (
          <><i className="fa-solid fa-paper-plane" /> Submit Payment for Verification</>
        )}
      </button>
    </div>
  );
}

// ── My Submissions ────────────────────────────────────────────────────────────
function MySubmissions({ requests, loading, refetch }: { requests: any[]; loading: boolean; refetch: () => void }) {
  if (loading) return <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={24} color="#FF9B51" /></div>;
  if (!requests.length) return (
    <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>
      <i className="fa-solid fa-inbox" style={{ fontSize: 28, display: "block", marginBottom: 10, opacity: 0.2 }} />
      <p style={{ fontWeight: 700, fontSize: 13 }}>No payment submissions yet.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {requests.map((r: any) => {
        const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
        return (
          <div key={r.id} style={{ padding: "14px 16px", borderRadius: 11, border: "1px solid #e1e8eb", background: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>{r.fee_name || "Fee Payment"}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6a7882", marginTop: 2 }}>
                  {r.bank_name} · Submitted {fmtDate(r.created_at || r.payment_date)}
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
                <i className="fa-solid fa-hashtag" style={{ marginRight: 5, fontSize: 10 }} />
                Ref: {r.transaction_ref}
              </div>
            )}

            {r.status === "rejected" && r.rejection_reason && (
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fde7e7", border: "1px solid #fecaca" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#b42318", marginBottom: 3 }}>Rejection Reason:</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2d36" }}>{r.rejection_reason}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#b42318", marginTop: 6 }}>
                  Please correct the issue and submit again.
                </div>
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
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentPayFeesPage() {
  const [activeTab, setActiveTab] = useState<"pay" | "history">("pay");

  const { data: bankAccounts, loading: bankLoading } = useApi<any[]>("/online-payments/active-bank-accounts");
  const { data: collections,  loading: colLoading  } = useApi<any[]>("/fees/me/collections");
  const { data: myRequests,   loading: reqLoading, refetch: refetchRequests } = useApi<any[]>("/online-payments/my-requests");

  const hasBankAccounts = (bankAccounts ?? []).length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
        .spfp *, .spfp *::before, .spfp *::after { box-sizing: border-box; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
        .spfp { min-height: 100vh; background: #eef2f3; }
        .spfp-main { padding: 20px; max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
        .spfp-card { background: #fff; border-radius: 14px; border: 1px solid #dce5e9; box-shadow: 0 2px 12px rgba(31,45,54,.05); overflow: hidden; }
        .spfp-card-head { padding: 14px 18px; border-bottom: 1px solid #eef2f3; display: flex; align-items: center; gap: 12px; }
        .spfp-card-body { padding: 18px; }
        .spfp-tab { flex: 1; min-height: 52px; border-radius: 11px; border: 2px solid transparent; cursor: pointer; font-weight: 900; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s; }
        .spfp-tab-active { background: #1f2d36; color: #fff; border-color: #1f2d36; }
        .spfp-tab-inactive { background: #fff; color: #6a7882; border-color: #dce5e9; }
        .spfp-tab-inactive:hover { border-color: #1f2d36; color: #1f2d36; }
        @media (max-width: 600px) { .spfp-main { padding: 14px; } .spfp-tab { font-size: 12px; min-height: 44px; } }
      `}</style>

      <div className="spfp">
        <Topbar title="Pay Fees Online" subtitle="Submit your payment proof for admin verification" />

        <div className="spfp-main">

          {/* Info Banner */}
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <i className="fa-solid fa-circle-info" style={{ color: "#c2410c", fontSize: 15, marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#92400e", marginBottom: 4 }}>How to pay online</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", lineHeight: 1.7 }}>
                1. Check the school bank account details below. &nbsp;
                2. Transfer the fee amount from your bank / eSewa / Khalti. &nbsp;
                3. Come back here and fill the form with your transaction ID + screenshot. &nbsp;
                4. Wait for admin to verify (usually within 1 business day). Your fee status will update automatically.
              </div>
            </div>
          </div>

          {/* Bank Account Details */}
          <div className="spfp-card">
            <div className="spfp-card-head">
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fff7ed", color: "#FF9B51", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                <i className="fa-solid fa-building-columns" />
              </div>
              <div>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36", display: "block" }}>School Bank Accounts</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", display: "block", marginTop: 1 }}>Transfer fees to one of these accounts</span>
              </div>
            </div>
            <div className="spfp-card-body">
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

          {/* Tabs — prominent, full-width, equal split */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className={`spfp-tab ${activeTab === "pay" ? "spfp-tab-active" : "spfp-tab-inactive"}`}
              onClick={() => setActiveTab("pay")}
            >
              <i className="fa-solid fa-paper-plane" /> Submit Payment
            </button>
            <button
              className={`spfp-tab ${activeTab === "history" ? "spfp-tab-active" : "spfp-tab-inactive"}`}
              onClick={() => setActiveTab("history")}
            >
              <i className="fa-solid fa-clock-rotate-left" /> My Submissions
            </button>
          </div>

          {/* Submit Panel */}
          {activeTab === "pay" && (
            <div className="spfp-card">
              <div className="spfp-card-head">
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "#e8edff", color: "#3b5bdb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                  <i className="fa-solid fa-paper-plane" />
                </div>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36", display: "block" }}>Submit Payment Proof</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", display: "block", marginTop: 1 }}>Fill after you have made the bank transfer</span>
                </div>
              </div>
              <div className="spfp-card-body">
                {colLoading ? (
                  <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={24} color="#FF9B51" /></div>
                ) : !hasBankAccounts ? (
                  <div style={{ padding: "1rem", textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
                    Online payments are not yet configured by your school admin.
                  </div>
                ) : (
                  <SubmitPaymentForm
                    collections={collections ?? []}
                    bankAccounts={bankAccounts ?? []}
                    onSuccess={() => { setActiveTab("history"); refetchRequests(); }}
                  />
                )}
              </div>
            </div>
          )}

          {/* History Panel */}
          {activeTab === "history" && (
            <div className="spfp-card">
              <div className="spfp-card-head">
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "#f0f9ff", color: "#0369a1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                  <i className="fa-solid fa-clock-rotate-left" />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36", display: "block" }}>My Payment Submissions</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", display: "block", marginTop: 1 }}>Track the status of your submitted payments</span>
                </div>
                <button
                  onClick={refetchRequests}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", color: "#6a7882", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >
                  <i className="fa-solid fa-rotate" /> Refresh
                </button>
              </div>
              <div className="spfp-card-body">
                <MySubmissions requests={myRequests ?? []} loading={reqLoading} refetch={refetchRequests} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
