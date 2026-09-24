"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrency, CurrencySymbol } from "@/lib/useCurrency";
import { useDateFormat } from "@/lib/useDateFormat";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentSubmitPaymentPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { fmt } = useCurrency();
  const { formatDate } = useDateFormat();

  const { data: bankAccounts, loading: bankLoading } = useApi<any[]>("/online-payments/active-bank-accounts");
  const { data: collections,  loading: colLoading  } = useApi<any[]>("/fees/me/collections");

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

  const hasBankAccounts = (bankAccounts ?? []).length > 0;
  const unpaidCollections = (collections ?? []).filter(
    c => c.status !== "paid" && c.status !== "waived" && Number(c.remaining_amount) > 0
  );

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
          method: "POST", credentials: "include", body: formData,
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
      router.push("/student/fees/my-submissions");
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Submission Failed", message: e.message || "Could not submit payment request." }));
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <>
      <style>{`
        .ssp { min-height: 100vh; background: #f8fafc; }
        .ssp-main { padding: 20px 24px 48px; max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
        .ssp-card { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.02); overflow: hidden; }
        .ssp-card-head { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; }
        .ssp-card-body { padding: 18px; }
        @media (max-width: 600px) { .ssp-main { padding: 14px 12px 32px; } }
      `}</style>

      <div className="ssp">
        <Topbar title="Submit Payment" subtitle="Fill in your payment details for admin verification" />

        <div className="ssp-main">

          {/* Link to My Submissions */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href="/student/fees/my-submissions" style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 9, border: "1px solid #dce5e9",
              background: "#fff", color: "#1f2d36", fontWeight: 800, fontSize: 13,
              textDecoration: "none",
            }}>
              <i className="fa-solid fa-clock-rotate-left" /> My Submissions
            </Link>
          </div>

          

          <div className="ssp-card">
            <div className="ssp-card-head">
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fff7ed", color: "#FF9B51", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                <i className="fa-solid fa-building-columns" />
              </div>
              <div>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36", display: "block" }}>Bank Details</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", display: "block", marginTop: 1 }}>Open the separate bank details page to review the account information before you pay</span>
              </div>
            </div>
            <div className="ssp-card-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "#f7fbfc", border: "1px solid #e1e8eb", color: "#1f2d36", fontSize: 13, fontWeight: 700, lineHeight: 1.7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <i className="fa-solid fa-circle-info" style={{ color: "#FF9B51" }} />
                    <span>Payment details are now shown on a separate page.</span>
                  </div>
                  <div>
                    <Link href="/student/fees/bank-details" style={{ color: "#3b5bdb", fontWeight: 800, textDecoration: "none" }}>
                      View bank details page <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginLeft: 4 }} />
                    </Link>
                  </div>
                </div>
                {bankLoading ? (
                  <div style={{ padding: "1rem", textAlign: "center" }}><Loader fullScreen={false} size="sm" text="Loading bank accounts…" /></div>
                ) : !hasBankAccounts ? (
                  <div style={{ padding: "1rem", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
                    No bank accounts are currently available for payment submission.
                  </div>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#6a7882" }}>
                    You can still choose the bank account you paid to below.
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Submit Form */}
          <div className="ssp-card">
            <div className="ssp-card-head">
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#e8edff", color: "#3b5bdb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                <i className="fa-solid fa-paper-plane" />
              </div>
              <div>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36", display: "block" }}>Submit Payment Proof</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", display: "block", marginTop: 1 }}>Fill after you have made the bank transfer</span>
              </div>
            </div>
            <div className="ssp-card-body">
              {colLoading ? (
                <div style={{ padding: "2rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading fee data…" /></div>
              ) : !hasBankAccounts ? (
                <div style={{ padding: "1rem", textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
                  Online payments are not yet configured by your school admin.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
                      Select Fee to Pay <span style={{ color: "#e53e3e" }}>*</span>
                    </label>
                    <select value={form.fee_collection_id}
                      onChange={e => {
                        const col = (collections ?? []).find(c => String(c.id) === e.target.value);
                        setForm(f => ({ ...f, fee_collection_id: e.target.value, amount: col ? String(col.remaining_amount) : "" }));
                      }}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700, color: "#1f2d36", background: "#fff", appearance: "none" }}>
                      <option value="">— Select fee —</option>
                      {unpaidCollections.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.fee_name} · Due {formatDate(c.due_date?.slice(0, 10))} · {fmt(c.remaining_amount)} remaining
                        </option>
                      ))}
                    </select>
                    {unpaidCollections.length === 0 && (
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#12805c", marginTop: 6 }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: 5 }} />All your fees are paid up!
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
                      Bank Account You Paid To <span style={{ color: "#e53e3e" }}>*</span>
                    </label>
                    <select value={form.bank_account_id}
                      onChange={e => setForm(f => ({ ...f, bank_account_id: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700, color: "#1f2d36", background: "#fff", appearance: "none" }}>
                      <option value="">— Select bank account —</option>
                      {(bankAccounts ?? []).map(b => (
                        <option key={b.id} value={b.id}>{b.bank_name} · {b.account_name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
                        Amount Paid (<CurrencySymbol />) <span style={{ color: "#e53e3e" }}>*</span>
                      </label>
                      <input type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 5000"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
                        Payment Date <span style={{ color: "#e53e3e" }}>*</span>
                      </label>
                      <input type="date" value={form.payment_date} max={new Date().toISOString().slice(0, 10)} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700 }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
                      Transaction / Reference ID
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", marginLeft: 6 }}>(Highly recommended)</span>
                    </label>
                    <input type="text" value={form.transaction_ref} onChange={e => setForm(f => ({ ...f, transaction_ref: e.target.value }))}
                      placeholder="e.g. TXN123456789 or eSewa transaction ID"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700 }} />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
                      Payment Screenshot
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", marginLeft: 6 }}>(Strongly recommended for faster approval)</span>
                    </label>
                    {screenshotPreview ? (
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <img src={screenshotPreview} alt="Screenshot preview" style={{ width: "100%", maxWidth: 320, maxHeight: 200, objectFit: "contain", borderRadius: 10, border: "1px solid #e1e8eb" }} />
                        <button onClick={() => { setScreenshotFile(null); setScreenshotPreview(null); }}
                          style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", border: "none", background: "#b42318", color: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", display: "block", marginBottom: 6 }}>
                      Additional Note <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882" }}>(optional)</span>
                    </label>
                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="e.g. Paid via eSewa mobile banking. Please check and confirm."
                      rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 700, resize: "vertical", fontFamily: "inherit" }} />
                  </div>

                  <button onClick={handleSubmit} disabled={submitting || unpaidCollections.length === 0}
                    style={{ minHeight: 46, borderRadius: 10, border: "none", background: "#FF9B51", color: "#fff", fontWeight: 900, fontSize: 14, cursor: (submitting || unpaidCollections.length === 0) ? "not-allowed" : "pointer", opacity: (submitting || unpaidCollections.length === 0) ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {submitting ? (
                      <><Spinner size={16} color="#fff" /> {uploading ? "Uploading screenshot…" : "Submitting…"}</>
                    ) : (
                      <><i className="fa-solid fa-paper-plane" /> Submit Payment for Verification</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
