"use client";

import { useState, useRef, useEffect } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./fees.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

// ── Helpers ───────────────────────────────────────────────────────────────────
const s = (c: string) => styles[c] || c;

type Region = "NP" | "IN" | "OTHER";

function getRegion(country?: string): Region {
  const c = (country || "").toLowerCase().trim();
  if (c === "nepal" || c === "np") return "NP";
  if (c === "india" || c === "in") return "IN";
  return "OTHER";
}

function maskAccount(num: string) {
  if (!num || num.length <= 4) return num || "—";
  return "•••• " + num.slice(-4);
}

const EMPTY_FORM = {
  bank_name: "", account_name: "", account_number: "",
  branch: "", ifsc_code: "", upi_id: "", notes: "",
};

// ── Inline QR Upload widget ───────────────────────────────────────────────────
function QrUpload({
  accountId,
  currentUrl,
  onUploaded,
}: {
  accountId: number;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}) {
  const dispatch  = useAppDispatch();
  const inputRef  = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setPreview(currentUrl || null); }, [currentUrl]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      dispatch(showToast({ type: "error", title: "Invalid file", message: "Only JPEG, PNG or WebP allowed." }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      dispatch(showToast({ type: "error", title: "Too large", message: "Image must be under 2 MB." }));
      return;
    }

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("qr", file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"}/upload/qr-code/${accountId}`,
        { method: "POST", body: formData, credentials: "include" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Upload failed.");
      }
      const j = await res.json();
      const url: string = j.data?.url;
      if (!url) throw new Error("No URL returned.");
      setPreview(url);
      onUploaded(url);
      dispatch(showToast({ type: "success", title: "QR Uploaded", message: "QR code saved to Azure successfully." }));
    } catch (err: any) {
      setPreview(currentUrl || null);
      dispatch(showToast({ type: "error", title: "Upload Failed", message: err.message || "Could not upload QR code." }));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}>
        QR Code / Payment QR
        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>(optional)</span>
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Preview box */}
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          style={{
            width: 96, height: 96, borderRadius: 14, border: "2px dashed #d4dde2",
            background: "#f7fbfc", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: uploading ? "default" : "pointer",
            overflow: "hidden", flexShrink: 0, position: "relative",
            transition: "border-color .15s",
          }}
          title="Click to upload QR code"
        >
          {preview ? (
            <img src={preview} alt="QR Code" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
          ) : (
            <div style={{ textAlign: "center", color: "#94a3b8" }}>
              <i className="fa-solid fa-qrcode" style={{ fontSize: 28, display: "block", marginBottom: 4 }} />
              <span style={{ fontSize: 10, fontWeight: 700 }}>Upload QR</span>
            </div>
          )}
          {uploading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.8)",
                          display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Spinner size={22} color="#FF9B51" />
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#6a7882" }}>
            Upload a QR code image so students can scan and pay directly.
            Image is stored securely on Azure Blob Storage.
          </p>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            style={{
              padding: "7px 14px", borderRadius: 8,
              border: "1.5px solid #d4dde2", background: "#fff",
              color: "#374151", fontSize: 12, fontWeight: 800,
              cursor: uploading ? "not-allowed" : "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="fa-solid fa-arrow-up-from-bracket" />
            {uploading ? "Uploading…" : preview ? "Replace QR" : "Choose Image"}
          </button>
          {preview && (
            <p style={{ margin: "5px 0 0", fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
              <i className="fa-solid fa-circle-check" style={{ color: "#12805c", marginRight: 4 }} />
              QR code saved on Azure
            </p>
          )}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
             style={{ display: "none" }} onChange={handleFile} />
    </div>
  );
}

// ── Readonly detail pill ──────────────────────────────────────────────────────
function DetailPill({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      padding: "10px 14px", borderRadius: 10,
      background: "#f7fbfc", border: "1px solid #e8eef0",
    }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: .6 }}>
        {label}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 800, color: "#1f2d36", marginTop: 4,
        fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all",
      }}>
        {value || "—"}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BankAccountsPage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const region   = getRegion(user?.country);

  const { data: accounts, loading, refetch } = useApi<any[]>("/online-payments/bank-accounts");

  // The school has one active bank account at a time
  const account = accounts?.[0] ?? null;

  // Form state — driven by the existing account or blank
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // When account loads, seed the form
  useEffect(() => {
    if (account) {
      setForm({
        bank_name:      account.bank_name      || "",
        account_name:   account.account_name   || "",
        account_number: account.account_number || "",
        branch:         account.branch         || "",
        ifsc_code:      account.ifsc_code      || "",
        upi_id:         account.upi_id         || "",
        notes:          account.notes          || "",
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
  }, [account]);

  const set = (k: keyof typeof EMPTY_FORM, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  // Country-specific config
  const labels = {
    ifsc:   region === "NP" ? "SWIFT / Bank Code" : region === "IN" ? "IFSC Code" : "Bank Code / SWIFT",
    upi:    region === "NP" ? "eSewa / Khalti ID" : region === "IN" ? "UPI ID"    : "Mobile Pay / QR ID",
  };
  const show = {
    ifsc:  region === "IN" || region === "NP",
    upi:   region === "IN" || region === "NP",
    notes: region === "OTHER" || region === "NP",
  };
  const regionName = region === "NP" ? "Nepal" : region === "IN" ? "India" : "International";

  // ── Save (create or update) ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.bank_name.trim() || !form.account_name.trim() || !form.account_number.trim()) {
      dispatch(showToast({ type: "error", title: "Required", message: "Bank name, account holder name and account number are required." }));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = { ...form };
      (["branch","ifsc_code","upi_id","notes"] as const).forEach(k => { if (!payload[k]) delete payload[k]; });

      if (account) {
        await apiRequest(`/online-payments/bank-accounts/${account.id}`, {
          method: "PATCH", body: JSON.stringify(payload),
        });
        dispatch(showToast({ type: "success", title: "Saved", message: "Bank account updated successfully." }));
      } else {
        await apiRequest("/online-payments/bank-accounts", {
          method: "POST", body: JSON.stringify(payload),
        });
        dispatch(showToast({ type: "success", title: "Account Added", message: "Bank account saved. Students can now use it for online payments." }));
      }
      await refetch();
      setEditMode(false);
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Save Failed", message: e.message || "Could not save." }));
    } finally { setSaving(false); }
  };

  // ── Toggle active ──────────────────────────────────────────────────────────
  const handleToggle = async () => {
    if (!account) return;
    try {
      await apiRequest(`/online-payments/bank-accounts/${account.id}`, {
        method: "PATCH", body: JSON.stringify({ is_active: !account.is_active }),
      });
      dispatch(showToast({
        type: "success",
        title: account.is_active ? "Deactivated" : "Activated",
        message: account.is_active ? "Account hidden from students." : "Account is now visible to students.",
      }));
      refetch();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: e.message || "Could not update." }));
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!account) return;
    setDeleting(true);
    try {
      await apiRequest(`/online-payments/bank-accounts/${account.id}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Deleted", message: "Bank account removed." }));
      setConfirmDel(false);
      setEditMode(false);
      refetch();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Cannot Delete", message: e.message || "Could not delete. Try deactivating instead." }));
    } finally { setDeleting(false); }
  };

  // ── Reusable input style ───────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 13px", borderRadius: 9,
    border: "1.5px solid #d4dde2", fontSize: 13, fontWeight: 700,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    background: "#fff", color: "#1f2d36",
  };
  const fld: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: 5,
    fontSize: 12, fontWeight: 900, color: "#374151",
  };

  return (
    <div className={s("fees-page")}>
      <Topbar
        title="Bank Account"
        subtitle="Manage the school's payment account shown to students for online transfers"
      />

      <main className={s("page-content")}>

        {/* ── Page header ── */}
        <section className={s("page-head")}>
          <div>
            <h1>Payment Bank Account</h1>
            <p>Set up the school's bank or digital wallet. The active account is shown to students on the Pay Online page.</p>
          </div>

          {/* Status badge (only if account exists) */}
          {!loading && account && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 900,
                background: account.is_active ? "#e2f6ee" : "#f1f5f9",
                color:      account.is_active ? "#12805c" : "#64748b",
                border: `1px solid ${account.is_active ? "#a7f3d0" : "#e2e8f0"}`,
              }}>
                <i className={`fa-solid ${account.is_active ? "fa-eye" : "fa-eye-slash"}`} style={{ marginRight: 6 }} />
                {account.is_active ? "Visible to Students" : "Hidden from Students"}
              </span>
            </div>
          )}
        </section>

        {/* ── Region info strip ── */}
        <div style={{
          marginBottom: 20, padding: "9px 14px", borderRadius: 9,
          background: "#f0f9ff", border: "1px solid #bae6fd",
          display: "flex", alignItems: "center", gap: 9, fontSize: 12,
        }}>
          <i className="fa-solid fa-earth-asia" style={{ color: "#0369a1" }} />
          <span style={{ fontWeight: 900, color: "#0369a1" }}>{regionName} school —</span>
          <span style={{ fontWeight: 700, color: "#075985" }}>
            {region === "NP" && "Fields: Bank Name, Account No., Branch, SWIFT Code, eSewa/Khalti ID, Notes"}
            {region === "IN" && "Fields: Bank Name, Account No., Branch, IFSC Code, UPI ID"}
            {region === "OTHER" && "Fields: Bank Name, Account No., Branch, Bank Code/SWIFT, Notes"}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
            <Loader fullScreen={false} size="md" text="Loading bank accounts…" />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

            {/* ────────────────────────────────────────
                LEFT: Form card
            ──────────────────────────────────────── */}
            <section className={s("card")} style={{ padding: "24px" }}>

              {/* Card header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: "linear-gradient(135deg,#fff7ed,#fff0e0)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#FF9B51", fontSize: 18,
                  }}>
                    <i className="fa-solid fa-building-columns" />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#1f2d36" }}>
                      {account ? "Bank Account Details" : "Add Bank Account"}
                    </h2>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6a7882", fontWeight: 700 }}>
                      {account && !editMode ? "Your current payment account" : "Fill in the details below"}
                    </p>
                  </div>
                </div>

                {account && !editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    style={{
                      padding: "7px 14px", borderRadius: 8,
                      border: "1px solid #d4dde2", background: "#fff",
                      color: "#374151", fontSize: 12, fontWeight: 800,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <i className="fa-solid fa-pen" /> Edit
                  </button>
                )}
              </div>

              {/* ── View mode: read-only details ── */}
              {account && !editMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <DetailPill label="Bank Name"           value={account.bank_name} />
                  <DetailPill label="Account Holder Name" value={account.account_name} />
                  <DetailPill label="Account Number"      value={maskAccount(account.account_number)} mono />
                  {account.branch    && <DetailPill label="Branch"         value={account.branch} />}
                  {account.ifsc_code && <DetailPill label={labels.ifsc}    value={account.ifsc_code} mono />}
                  {account.upi_id    && <DetailPill label={labels.upi}     value={account.upi_id} />}
                  {account.notes     && <DetailPill label="Notes"          value={account.notes} />}
                </div>
              ) : (
                /* ── Edit / Create form ── */
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* Required group */}
                  <div style={{ padding: "16px", borderRadius: 10, background: "#f9fbfc", border: "1px solid #edf2f4" }}>
                    <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: .7 }}>
                      Required Details
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <label style={fld}>
                        Bank Name *
                        <input style={inp} value={form.bank_name}
                          onChange={e => set("bank_name", e.target.value)}
                          placeholder={region === "NP" ? "e.g. NIC Asia Bank" : region === "IN" ? "e.g. State Bank of India" : "e.g. HSBC"} />
                      </label>
                      <label style={fld}>
                        Account Holder Name *
                        <input style={inp} value={form.account_name}
                          onChange={e => set("account_name", e.target.value)}
                          placeholder="Name as registered with the bank" />
                      </label>
                      <label style={fld}>
                        Account Number *
                        <input style={inp} value={form.account_number}
                          onChange={e => set("account_number", e.target.value)}
                          placeholder={region === "NP" ? "e.g. 0100123456789" : region === "IN" ? "e.g. 123456789012" : "e.g. 000123456"}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Optional group */}
                  <div style={{ padding: "16px", borderRadius: 10, background: "#f9fbfc", border: "1px solid #edf2f4" }}>
                    <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: .7 }}>
                      Additional Details
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <label style={fld}>
                        Branch
                        <input style={inp} value={form.branch}
                          onChange={e => set("branch", e.target.value)}
                          placeholder={region === "NP" ? "e.g. New Road Branch, Kathmandu" : "e.g. Main Branch"} />
                      </label>

                      {show.ifsc && (
                        <label style={fld}>
                          {labels.ifsc}
                          <input style={inp} value={form.ifsc_code}
                            onChange={e => set("ifsc_code", e.target.value)}
                            placeholder={region === "NP" ? "e.g. NICASYABX001" : "e.g. SBIN0001234"} />
                        </label>
                      )}

                      {show.upi && (
                        <label style={fld}>
                          {labels.upi}
                          <input style={inp} value={form.upi_id}
                            onChange={e => set("upi_id", e.target.value)}
                            placeholder={region === "NP" ? "e.g. 98XXXXXXXX" : "e.g. school@upi"} />
                        </label>
                      )}

                      {show.notes && (
                        <label style={fld}>
                          Notes / Instructions for Students
                          <textarea value={form.notes}
                            onChange={e => set("notes", e.target.value)}
                            placeholder="e.g. Write your name as payment remarks"
                            style={{ ...inp, minHeight: 72, resize: "vertical" }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      style={{
                        flex: 1, minHeight: 44, borderRadius: 10, border: "none",
                        background: saving ? "#94a3b8" : "linear-gradient(135deg,#FF9B51,#ff7b22)",
                        color: "#fff", fontWeight: 900, fontSize: 14,
                        cursor: saving ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        boxShadow: saving ? "none" : "0 4px 14px rgba(255,123,34,.3)",
                      }}
                    >
                      {saving ? <Spinner size={16} color="#fff" /> : <><i className="fa-solid fa-floppy-disk" /> {account ? "Save Changes" : "Add Account"}</>}
                    </button>

                    {editMode && (
                      <button
                        onClick={() => { setEditMode(false); setForm({ bank_name: account?.bank_name||"", account_name: account?.account_name||"", account_number: account?.account_number||"", branch: account?.branch||"", ifsc_code: account?.ifsc_code||"", upi_id: account?.upi_id||"", notes: account?.notes||"" }); }}
                        style={{
                          padding: "0 20px", borderRadius: 10, border: "1px solid #d4dde2",
                          background: "#fff", color: "#6a7882", fontWeight: 700,
                          fontSize: 13, cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ────────────────────────────────────────
                RIGHT: QR upload + controls
            ──────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* QR Card */}
              <section className={s("card")} style={{ padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: "#f0fdf4", color: "#12805c",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                  }}>
                    <i className="fa-solid fa-qrcode" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>QR Code</h3>
                    <p style={{ margin: "1px 0 0", fontSize: 12, color: "#6a7882", fontWeight: 700 }}>
                      Stored on Azure Blob Storage
                    </p>
                  </div>
                </div>

                {account ? (
                  <QrUpload
                    accountId={account.id}
                    currentUrl={account.qr_image_url}
                    onUploaded={(_url) => { /* URL already saved to DB by backend; preview updates inline */ }}
                  />
                ) : (
                  <div style={{
                    padding: "20px", borderRadius: 10, background: "#f9fbfc",
                    border: "1.5px dashed #d4dde2", textAlign: "center", color: "#94a3b8",
                  }}>
                    <i className="fa-solid fa-qrcode" style={{ fontSize: 28, display: "block", marginBottom: 8, opacity: .4 }} />
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
                      Save bank details first,<br />then upload the QR code.
                    </p>
                  </div>
                )}
              </section>

              {/* Controls card (only when account exists) */}
              {account && (
                <section className={s("card")} style={{ padding: "20px 24px" }}>
                  <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 900, color: "#1f2d36" }}>
                    Account Controls
                  </h3>

                  {/* Toggle */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px", borderRadius: 10,
                    background: account.is_active ? "#f0fdf4" : "#f9fbfc",
                    border: `1px solid ${account.is_active ? "#a7f3d0" : "#e8eef0"}`,
                    marginBottom: 10,
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: "#1f2d36" }}>
                        {account.is_active ? "Account is Active" : "Account is Inactive"}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6a7882", fontWeight: 700 }}>
                        {account.is_active ? "Shown to students on Pay Online page" : "Hidden from students"}
                      </p>
                    </div>
                    <div
                      onClick={handleToggle}
                      title={account.is_active ? "Click to deactivate" : "Click to activate"}
                      style={{
                        width: 48, height: 27, borderRadius: 999, cursor: "pointer", flexShrink: 0,
                        background: account.is_active ? "#12805c" : "#d4dde2",
                        position: "relative", transition: "background .2s",
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 3.5,
                        left: account.is_active ? "calc(100% - 24px)" : 3,
                        width: 20, height: 20, borderRadius: 999,
                        background: "#fff", transition: "left .2s",
                        boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                      }} />
                    </div>
                  </div>

                  {/* Delete */}
                  {!confirmDel ? (
                    <button
                      onClick={() => setConfirmDel(true)}
                      style={{
                        width: "100%", padding: "9px", borderRadius: 9,
                        border: "1px solid #fecaca", background: "#fff5f5",
                        color: "#b42318", fontSize: 12, fontWeight: 800,
                        cursor: "pointer", display: "flex", alignItems: "center",
                        justifyContent: "center", gap: 7,
                      }}
                    >
                      <i className="fa-solid fa-trash" /> Remove Account
                    </button>
                  ) : (
                    <div style={{
                      padding: "12px 14px", borderRadius: 10,
                      background: "#fff5f5", border: "1px solid #fecaca",
                    }}>
                      <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 800, color: "#b42318" }}>
                        <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />
                        Remove this bank account permanently?
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          style={{
                            flex: 1, padding: "8px", borderRadius: 8, border: "none",
                            background: "#b42318", color: "#fff",
                            fontSize: 12, fontWeight: 900, cursor: deleting ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          }}
                        >
                          {deleting ? <Spinner size={12} color="#fff" /> : "Yes, Remove"}
                        </button>
                        <button
                          onClick={() => setConfirmDel(false)}
                          style={{
                            padding: "8px 14px", borderRadius: 8,
                            border: "1px solid #d4dde2", background: "#fff",
                            color: "#6a7882", fontSize: 12, fontWeight: 700, cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Tip */}
              <div style={{
                padding: "12px 14px", borderRadius: 10,
                background: "#fffbeb", border: "1px solid #fde68a",
                display: "flex", gap: 9, alignItems: "flex-start",
              }}>
                <i className="fa-solid fa-lightbulb" style={{ color: "#d97706", marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                  <strong>Tip:</strong> Deactivate instead of removing if there are pending payment requests linked to this account — deletion will be blocked.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
