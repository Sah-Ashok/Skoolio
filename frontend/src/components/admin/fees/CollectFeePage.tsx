"use client";

import Link from "next/link";
import { useState, useMemo, type ReactNode } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./fees.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const formatINR = (n: number | string) =>
  "₹" + Number(n || 0).toLocaleString("en-IN");

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

const TYPE_COLOR: Record<string, string> = {
  academic:  "#3b5bdb",
  transport: "#c46a14",
  hostel:    "#7c3aed",
};

const TYPE_BG: Record<string, string> = {
  academic:  "#e8edff",
  transport: "#fff1df",
  hostel:    "#f3e8ff",
};

export default function CollectFeePage() {
  const dispatch   = useAppDispatch();
  const [searchTerm, setSearchTerm]   = useState("");
  const [typeFilter, setTypeFilter]   = useState("all");
  const [generating, setGenerating]   = useState(false);
  const [billingMonth, setBillingMonth] = useState(
    new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  );

  const { data: activeYear }              = useApi<any>("/academic-years/active");
  const { data: students, loading: studentsLoading } = useApi<any[]>("/students");
  const { execute: payFee, loading: isPaying }       = useMutation("/fees/payments", "POST");

  // Student search
  const matchedStudent = useMemo(() => {
    if (!searchTerm || !students) return null;
    return students.find(st =>
      st.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.admission_number?.toLowerCase() === searchTerm.toLowerCase()
    );
  }, [searchTerm, students]);

  const { data: rawCollections, refetch: refetchCollections } = useApi<any[]>(
    matchedStudent ? `/fees/collections/student/${matchedStudent.id}` : ""
  );

  // Filter collections by type
  const collections = (rawCollections || []).filter(c =>
    typeFilter === "all" || (c.fee_type || "academic") === typeFilter
  );
  const pendingCollections = collections.filter(c => c.status !== "paid");

  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [amount,       setAmount]       = useState("");
  const [paymentDate,  setPaymentDate]  = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode,  setPaymentMode]  = useState("cash");
  const [referenceNo,  setReferenceNo]  = useState("");
  const [remarks,      setRemarks]      = useState("");

  const selectedCollection = pendingCollections.find(c => String(c.id) === selectedCollectionId);
  const maxPayable = selectedCollection
    ? parseFloat(selectedCollection.remaining_amount || "0")
    : 0;

  const needsRef = ["online", "bank_transfer", "cheque"].includes(paymentMode);

  // Summary totals
  const totalDue  = (rawCollections || []).reduce((s, c) => s + parseFloat(c.remaining_amount || "0"), 0);
  const totalPaid = (rawCollections || []).reduce((s, c) => s + parseFloat(c.paid_amount || "0"), 0);
  const overdue   = (rawCollections || []).filter(c =>
    c.status !== "paid" && new Date(c.due_date) < new Date()
  ).length;

  // ── Payment handler ──────────────────────────────────────────────────────
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedStudent)       return dispatch(showToast({ type: "error",   title: "Error",   message: "No student selected" }));
    if (!selectedCollectionId) return dispatch(showToast({ type: "error",   title: "Error",   message: "Select a fee to pay" }));
    if (!amount || Number(amount) <= 0) return dispatch(showToast({ type: "error", title: "Error", message: "Enter a valid amount" }));
    if (Number(amount) > maxPayable) return dispatch(showToast({ type: "error", title: "Error", message: `Max payable is ${formatINR(maxPayable)}` }));

    try {
      const res = await payFee({
        collection_id:  parseInt(selectedCollectionId),
        student_id:     matchedStudent.id,
        paid_amount:    parseFloat(amount),
        payment_date:   paymentDate,
        payment_method: paymentMode,
        transaction_id: referenceNo || undefined,
        remarks:        remarks     || undefined,
      });

      if (res) {
        dispatch(showToast({ type: "success", title: "Payment Recorded", message: `Receipt generated successfully.` }));
        refetchCollections();
        setAmount(""); setSelectedCollectionId(""); setReferenceNo(""); setRemarks("");
      }
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Payment Failed", message: err.message || "Payment failed" }));
    }
  };

  // ── Generate transport bills ──────────────────────────────────────────────
  const handleGenerateTransport = async () => {
    if (!activeYear?.id || !billingMonth) return;
    setGenerating(true);
    try {
      const res = await apiRequest<{ data: any }>("/fees/transport/generate", {
        method: "POST",
        body: JSON.stringify({ academic_year_id: activeYear.id, billing_month: billingMonth }),
      });
      const { created, skipped } = res.data || {};
      dispatch(showToast({
        type:    "success",
        title:   "Transport Bills Generated",
        message: `${created} new bills created, ${skipped} already billed.`,
      }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message }));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={s("fees-page")}>
      <Topbar title="Collect Fee" subtitle="Record fee payment for a student" />
      <main className={s("page-content")}>

        <section className={s("page-head")}>
          <div>
            <h1>Collect Fee</h1>
            <p>Search a student, select their pending fee, and record the payment.</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/fees/records">
              <i className="fa-solid fa-table-list" /> All Records
            </Link>
            <Link className={cx(s("btn"), s("btn-soft"))} href="/fees/structures">
              <i className="fa-solid fa-list" /> Fee Structures
            </Link>
          </div>
        </section>

        {/* Generate transport bills panel */}
        <section className={s("card")} style={{ marginBottom: 0 }}>
          <div className={s("card-head")}>
            <div>
              <h3><i className="fa-solid fa-bus" style={{ color: "#ff9b51", marginRight: 8 }} />Generate Transport Bills</h3>
              <p>Batch-create transport fee collections for all assigned students for a specific month.</p>
            </div>
          </div>
          <div style={{ padding: "14px 18px", display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 900 }}>Billing Month</label>
              <input
                type="month"
                value={billingMonth}
                onChange={e => setBillingMonth(e.target.value)}
                style={{ minHeight: 40, padding: "0 12px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 13, fontWeight: 800, outline: "none" }}
              />
            </div>
            <button
              className={cx(s("btn"), s("btn-primary"))}
              onClick={handleGenerateTransport}
              disabled={generating || !activeYear?.id}
            >
              {generating
                ? <><Spinner size={15} /> Generating…</>
                : <><i className="fa-solid fa-bolt" /> Generate Bills</>}
            </button>
            <p style={{ fontSize: 12, color: "#6a7882", fontWeight: 700, alignSelf: "center" }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />
              Skips students already billed for the selected month.
            </p>
          </div>
        </section>

        <form className={s("simple-collect-layout")} onSubmit={handlePayment}>
          {/* Student search */}
          <section className={s("simple-collect-card")}>
            <div className={s("card-head")}>
              <div>
                <h3><i className="fa-solid fa-user-graduate" /> Student</h3>
                <p>Search by name or admission number</p>
              </div>
            </div>

            <div style={{ padding: "0 18px 18px" }}>
              <label style={{ display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", background: "#f8fafc" }}>
                <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", marginRight: 10 }} />
                <input
                  type="search"
                  placeholder="Enter student name or admission number…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ border: "none", background: "transparent", outline: "none", width: "100%", fontSize: 14, fontWeight: 700 }}
                />
              </label>
            </div>

            {studentsLoading && searchTerm && <div style={{ textAlign: "center", padding: "1rem" }}><Spinner size={24} /></div>}

            {matchedStudent && (
              <>
                <div style={{ margin: "0 18px 16px", background: "#e0f2fe", padding: "14px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ width: 46, height: 46, borderRadius: "50%", background: "#0284c7", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
                    {getInitials(matchedStudent.full_name)}
                  </span>
                  <div>
                    <strong style={{ display: "block", fontSize: 16, color: "#0f172a" }}>{matchedStudent.full_name}</strong>
                    <small style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>
                      {matchedStudent.admission_number} · {matchedStudent.email || "No email"}
                    </small>
                  </div>
                </div>

                {/* Fee summary for this student */}
                {rawCollections && rawCollections.length > 0 && (
                  <div style={{ margin: "0 18px 18px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {[
                      ["Total Due", formatINR(totalDue), "#b42318", "#fde7e7"],
                      ["Paid",      formatINR(totalPaid), "#12805c", "#e2f6ee"],
                      ["Overdue",   String(overdue),      "#c46a14", "#fff1df"],
                    ].map(([label, val, color, bg]) => (
                      <div key={label} style={{ padding: "10px 12px", borderRadius: 8, background: bg, textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color }}>{val}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!matchedStudent && searchTerm && !studentsLoading && (
              <p style={{ margin: "0 18px 18px", color: "#b42318", fontSize: 13, fontWeight: 700 }}>
                No student found.
              </p>
            )}
          </section>

          {/* Payment form */}
          {matchedStudent && (
            <section className={s("simple-collect-card")}>
              <div className={s("card-head")}>
                <div>
                  <h3><i className="fa-solid fa-file-invoice-dollar" /> Payment Details</h3>
                  <p>Select fee and record payment</p>
                </div>
                {/* Type filter */}
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  style={{ minHeight: 32, padding: "0 10px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 12, fontWeight: 800, background: "#fff" }}
                >
                  <option value="all">All Types</option>
                  <option value="academic">Academic</option>
                  <option value="transport">Transport</option>
                  <option value="hostel">Hostel</option>
                </select>
              </div>

              <div style={{ padding: "14px 18px" }}>
                {/* Scholarship notice */}
                {matchedStudent?.scholarship_percent && Number(matchedStudent.scholarship_percent) > 0 && (
                  <div style={{ margin: "0 0 14px", padding: "10px 14px", borderRadius: 10, background: "#fefce8", border: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 10 }}>
                    <i className="fa-solid fa-graduation-cap" style={{ color: "#b45309", fontSize: 16 }} />
                    <div>
                      <strong style={{ fontSize: 13, color: "#92400e" }}>
                        {matchedStudent.scholarship_type
                          ? `${matchedStudent.scholarship_type.replace(/_/g, " ")} Scholarship`
                          : "Scholarship"}
                        {" "}— {matchedStudent.scholarship_percent}% fee discount
                      </strong>
                      {matchedStudent.scholarship_remarks && (
                        <p style={{ fontSize: 11, color: "#78350f", fontWeight: 700, marginTop: 2 }}>{matchedStudent.scholarship_remarks}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Fee selector */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 900 }}>
                    <span>Select Pending Fee <span style={{ color: "#b42318" }}>*</span></span>
                    <select
                      value={selectedCollectionId}
                      onChange={e => {
                        setSelectedCollectionId(e.target.value);
                        const col = pendingCollections.find(c => String(c.id) === e.target.value);
                        if (col) setAmount(String(parseFloat(col.remaining_amount || "0")));
                      }}
                      required
                      style={{ minHeight: 44, padding: "0 13px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 13, fontWeight: 800, outline: "none" }}
                    >
                      <option value="">— Select Fee to Pay —</option>
                      {pendingCollections.length === 0 && (
                        <option disabled>No pending fees found</option>
                      )}
                      {pendingCollections.map(c => {
                        const feeType = c.fee_type || "academic";
                        const due     = parseFloat(c.remaining_amount || "0");
                        return (
                          <option key={c.id} value={c.id}>
                            [{feeType.toUpperCase()}] {c.fee_name || `Fee #${c.id}`} · Due: {formatINR(due)}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                {/* Selected fee detail */}
                {selectedCollection && (
                  <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: "#f8fbfc", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, padding: "3px 10px", borderRadius: 999, background: TYPE_BG[selectedCollection.fee_type] || "#e8edff", color: TYPE_COLOR[selectedCollection.fee_type] || "#3b5bdb" }}>
                        {(selectedCollection.fee_type || "academic").toUpperCase()}
                      </span>
                      <strong style={{ fontSize: 13 }}>{selectedCollection.fee_name}</strong>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12, fontWeight: 700 }}>
                      <div><div style={{ color: "#6a7882" }}>Total</div><div>{formatINR(selectedCollection.total_amount)}</div></div>
                      <div><div style={{ color: "#6a7882" }}>Paid</div><div style={{ color: "#12805c" }}>{formatINR(selectedCollection.paid_amount || 0)}</div></div>
                      <div><div style={{ color: "#6a7882" }}>Remaining</div><div style={{ color: "#b42318", fontWeight: 900 }}>{formatINR(selectedCollection.remaining_amount || 0)}</div></div>
                    </div>
                  </div>
                )}

                {selectedCollectionId && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                      <Field label="Amount to Pay *">
                        <input
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          type="number"
                          max={maxPayable}
                          required
                          placeholder={`Max: ${formatINR(maxPayable)}`}
                          style={{ minHeight: 44, padding: "0 13px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 14, fontWeight: 800, outline: "none", width: "100%" }}
                        />
                      </Field>
                      <Field label="Payment Date *">
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={e => setPaymentDate(e.target.value)}
                          required
                          style={{ minHeight: 44, padding: "0 13px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 14, fontWeight: 800, outline: "none", width: "100%" }}
                        />
                      </Field>
                      <Field label="Payment Mode">
                        <select
                          value={paymentMode}
                          onChange={e => setPaymentMode(e.target.value)}
                          style={{ minHeight: 44, padding: "0 13px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 14, fontWeight: 800, outline: "none", width: "100%" }}
                        >
                          <option value="cash">Cash</option>
                          <option value="online">Online</option>
                          <option value="cheque">Cheque</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </Field>
                      {needsRef && (
                        <Field label="Transaction / Cheque No.">
                          <input
                            value={referenceNo}
                            onChange={e => setReferenceNo(e.target.value)}
                            placeholder="Reference number"
                            required
                            style={{ minHeight: 44, padding: "0 13px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 14, fontWeight: 800, outline: "none", width: "100%" }}
                          />
                        </Field>
                      )}
                    </div>
                    <Field label="Remarks (optional)">
                      <input
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        placeholder="Optional note…"
                        style={{ minHeight: 40, padding: "0 13px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 13, fontWeight: 800, outline: "none", width: "100%" }}
                      />
                    </Field>

                    <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
                      <button className={cx(s("btn"), s("btn-primary"))} type="submit" disabled={isPaying} style={{ minHeight: 46, padding: "0 28px", fontSize: 14 }}>
                        {isPaying
                          ? <><Spinner size={16} /> Processing…</>
                          : <><i className="fa-solid fa-check" /> Process Payment</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </form>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 900, color: "#25343f" }}>{label}</span>
      {children}
    </label>
  );
}
