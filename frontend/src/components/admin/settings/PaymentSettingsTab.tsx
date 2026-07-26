"use client";

import { useState, useEffect } from "react";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import styles from "./settings.module.css";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

// Region-aware field definitions
type FieldDef = { key: string; label: string; placeholder: string; hint?: string };

const NEPAL_FIELDS: FieldDef[] = [
  { key: "bank_name",      label: "Bank Name",        placeholder: "e.g. NIC Asia Bank" },
  { key: "account_name",   label: "Account Name",     placeholder: "e.g. Sunrise Academy" },
  { key: "account_number", label: "Account Number",   placeholder: "e.g. 0012345678901" },
  { key: "branch",         label: "Branch",           placeholder: "e.g. Lazimpat, Kathmandu" },
  { key: "esewa_id",       label: "eSewa ID / Number",placeholder: "e.g. 9800000000", hint: "Students can pay via eSewa to this ID" },
  { key: "khalti_id",      label: "Khalti ID / Number",placeholder: "e.g. 9811111111", hint: "Students can pay via Khalti to this ID" },
  { key: "qr_url",         label: "QR Code URL",      placeholder: "Paste Azure Blob URL of QR image", hint: "Optional — shown to students for scanning" },
];

const INDIA_FIELDS: FieldDef[] = [
  { key: "bank_name",      label: "Bank Name",        placeholder: "e.g. State Bank of India" },
  { key: "account_name",   label: "Account Name",     placeholder: "e.g. Sunrise Academy" },
  { key: "account_number", label: "Account Number",   placeholder: "e.g. 00110012345678" },
  { key: "ifsc_code",      label: "IFSC Code",        placeholder: "e.g. SBIN0001234" },
  { key: "upi_id",         label: "UPI ID",           placeholder: "e.g. school@sbi", hint: "Students can pay via Google Pay, PhonePe, etc." },
  { key: "qr_url",         label: "QR Code URL",      placeholder: "Paste Azure Blob URL of QR image", hint: "Optional — UPI QR for scanning" },
];

const OTHER_FIELDS: FieldDef[] = [
  { key: "bank_name",      label: "Bank Name",        placeholder: "Bank name" },
  { key: "account_name",   label: "Account Name",     placeholder: "Account holder name" },
  { key: "account_number", label: "Account Number",   placeholder: "Account number" },
  { key: "branch",         label: "Branch / SWIFT",   placeholder: "Branch or SWIFT code" },
  { key: "notes",          label: "Payment Notes",    placeholder: "Any additional payment instructions" },
];

function getFields(country: string): FieldDef[] {
  const c = country?.toLowerCase() ?? "";
  if (c.includes("nepal")) return NEPAL_FIELDS;
  if (c.includes("india")) return INDIA_FIELDS;
  return OTHER_FIELDS;
}

type BankAccount = {
  id:             number;
  bank_name:      string;
  account_name:   string;
  account_number: string;
  branch?:        string;
  ifsc_code?:     string;
  upi_id?:        string;
  esewa_id?:      string;
  khalti_id?:     string;
  qr_url?:        string;
  notes?:         string;
  is_active:      boolean;
  is_primary:     boolean;
};

const emptyForm = (): Record<string, string> => ({
  bank_name: "", account_name: "", account_number: "",
  branch: "", ifsc_code: "", upi_id: "", esewa_id: "",
  khalti_id: "", qr_url: "", notes: "",
});

export default function PaymentSettingsTab() {
  const dispatch = useAppDispatch();
  const { data: settings } = useApi<any>("/school/settings");
  const country = settings?.country ?? "Nepal";
  const fields  = getFields(country);

  const { data: accounts, loading, refetch } = useApi<BankAccount[]>("/online-payments/bank-accounts");

  const [showForm, setShowForm]   = useState(false);
  const [editing,  setEditing]    = useState<BankAccount | null>(null);
  const [form,     setForm]       = useState<Record<string, string>>(emptyForm());
  const [saving,   setSaving]     = useState(false);
  const [deleting, setDeleting]   = useState<number | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        bank_name:      editing.bank_name      ?? "",
        account_name:   editing.account_name   ?? "",
        account_number: editing.account_number ?? "",
        branch:         editing.branch         ?? "",
        ifsc_code:      editing.ifsc_code      ?? "",
        upi_id:         editing.upi_id         ?? "",
        esewa_id:       editing.esewa_id       ?? "",
        khalti_id:      editing.khalti_id      ?? "",
        qr_url:         editing.qr_url         ?? "",
        notes:          editing.notes          ?? "",
      });
      setShowForm(true);
    }
  }, [editing]);

  const cancelForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()); };

  const handleSave = async () => {
    if (!form.bank_name?.trim() || !form.account_name?.trim() || !form.account_number?.trim()) {
      dispatch(showToast({ type: "error", title: "Required", message: "Bank name, account name and account number are required." }));
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v?.trim())
      );
      if (editing) {
        await apiRequest(`/online-payments/bank-accounts/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        dispatch(showToast({ type: "success", title: "Updated", message: "Bank account updated." }));
      } else {
        await apiRequest("/online-payments/bank-accounts", { method: "POST", body: JSON.stringify(payload) });
        dispatch(showToast({ type: "success", title: "Added", message: "Bank account added." }));
      }
      cancelForm();
      refetch();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Error", message: e.message || "Could not save." }));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (acc: BankAccount) => {
    try {
      await apiRequest(`/online-payments/bank-accounts/${acc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !acc.is_active }),
      });
      dispatch(showToast({ type: "success", title: acc.is_active ? "Deactivated" : "Activated", message: `${acc.bank_name} is now ${acc.is_active ? "inactive" : "active"}.` }));
      refetch();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Error", message: e.message || "Could not toggle." }));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this bank account? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await apiRequest(`/online-payments/bank-accounts/${id}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Deleted", message: "Bank account removed." }));
      refetch();
    } catch (e: any) {
      dispatch(showToast({ type: "error", title: "Error", message: e.message || "Could not delete — it may have requests linked to it. Deactivate instead." }));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className={s("panel-head")}>
        <div className={cx(s("ph-icon"))} style={{ background: "#e2f6ee", color: "#12805c" }}>
          <i className="fa-solid fa-building-columns" />
        </div>
        <div>
          <h2>Online Payment Setup</h2>
          <p>Add bank account details students will use to transfer fees. Region: <strong>{country}</strong></p>
        </div>
        {!showForm && (
          <button className={cx(s("btn"), s("btn-primary"))} onClick={() => { setEditing(null); setForm(emptyForm()); setShowForm(true); }}>
            <i className="fa-solid fa-plus" /> Add Account
          </button>
        )}
      </div>

      {/* Info box */}
      <div style={{ margin: "0 0 20px", padding: "12px 16px", borderRadius: 10, background: "#f0f9ff", border: "1px solid #bae6fd", fontSize: 13, color: "#0369a1", fontWeight: 700, display: "flex", alignItems: "flex-start", gap: 10 }}>
        <i className="fa-solid fa-circle-info" style={{ marginTop: 2, flexShrink: 0 }} />
        <span>
          Students will see these details in their portal when submitting a payment. They'll also upload a screenshot of the transfer.
          You then verify each request here or in <strong>Fee Management → Payment Requests</strong>.
        </span>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div style={{ marginBottom: 24, padding: "20px", borderRadius: 12, border: "1.5px solid #ff9b51", background: "#fff7ed" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 900 }}>
            {editing ? "Edit Bank Account" : "Add Bank Account"}
          </h3>
          <div className={s("grid")} style={{ marginBottom: 14 }}>
            {fields.map(f => (
              <div key={f.key} className={s("field")}>
                <label>{f.label}{["bank_name","account_name","account_number"].includes(f.key) && <em> *</em>}</label>
                {f.hint && <span className={s("field-hint")}>{f.hint}</span>}
                <input
                  value={form[f.key] ?? ""}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size={14} color="#fff" /> : <><i className="fa-solid fa-floppy-disk" /> {editing ? "Save Changes" : "Add Account"}</>}
            </button>
            <button className={cx(s("btn"), s("btn-ghost"))} onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      {/* Account list */}
      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={24} color="#FF9B51" /></div>
      ) : !accounts || accounts.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#6a7882", border: "2px dashed #d4dde2", borderRadius: 12 }}>
          <i className="fa-solid fa-building-columns" style={{ fontSize: 28, display: "block", marginBottom: 10, opacity: 0.3 }} />
          <p style={{ fontWeight: 700, fontSize: 14 }}>No bank accounts added yet.</p>
          <p style={{ fontSize: 12 }}>Click "Add Account" to get started.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ padding: "16px 18px", borderRadius: 12, border: `1.5px solid ${acc.is_active ? "#bee8d6" : "#e1e8eb"}`, background: acc.is_active ? "#f6fdf9" : "#f8fafc", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              {/* Icon */}
              <div style={{ width: 44, height: 44, borderRadius: 11, background: acc.is_active ? "#e2f6ee" : "#eaecef", color: acc.is_active ? "#12805c" : "#9aa7ae", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                <i className="fa-solid fa-building-columns" />
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <strong style={{ fontSize: 15, fontWeight: 900 }}>{acc.bank_name}</strong>
                  {acc.is_primary && (
                    <span style={{ padding: "2px 9px", borderRadius: 99, background: "#e8edff", color: "#3b5bdb", fontSize: 10, fontWeight: 900 }}>PRIMARY</span>
                  )}
                  <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 10, fontWeight: 900, background: acc.is_active ? "#e2f6ee" : "#f0f0f0", color: acc.is_active ? "#12805c" : "#9aa7ae" }}>
                    {acc.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "4px 16px" }}>
                  {(
                    [
                      ["Account Name",   acc.account_name],
                      ["Account No.",    acc.account_number],
                      acc.branch    ? ["Branch",  acc.branch]    : null,
                      acc.ifsc_code ? ["IFSC",    acc.ifsc_code] : null,
                      acc.upi_id    ? ["UPI ID",  acc.upi_id]    : null,
                      acc.esewa_id  ? ["eSewa",   acc.esewa_id]  : null,
                      acc.khalti_id ? ["Khalti",  acc.khalti_id] : null,
                    ].filter(Boolean) as string[][]
                  ).map(([label, val]) => (
                    <div key={label} style={{ fontSize: 12 }}>
                      <span style={{ color: "#6a7882", fontWeight: 800 }}>{label}: </span>
                      <strong style={{ fontWeight: 900, color: "#1f2d36" }}>{val}</strong>
                    </div>
                  ))}
                </div>
                {acc.notes && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6a7882", fontStyle: "italic" }}>{acc.notes}</p>}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                <button
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", cursor: "pointer", fontWeight: 800, fontSize: 12, color: "#6a7882" }}
                  onClick={() => setEditing(acc)}
                >
                  <i className="fa-solid fa-pen" /> Edit
                </button>
                <button
                  style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: acc.is_active ? "#fde7e7" : "#e2f6ee", color: acc.is_active ? "#b42318" : "#12805c", cursor: "pointer", fontWeight: 800, fontSize: 12 }}
                  onClick={() => handleToggleActive(acc)}
                >
                  {acc.is_active ? <><i className="fa-solid fa-eye-slash" /> Deactivate</> : <><i className="fa-solid fa-eye" /> Activate</>}
                </button>
                <button
                  style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#fde7e7", color: "#b42318", cursor: "pointer", fontSize: 12 }}
                  onClick={() => handleDelete(acc.id)}
                  disabled={deleting === acc.id}
                >
                  {deleting === acc.id ? <Spinner size={12} /> : <i className="fa-solid fa-trash" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
