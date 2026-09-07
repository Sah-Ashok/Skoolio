"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./sa.module.css";
import { useApi } from "@/lib/useApi";
import { Loader } from "@/components/shared/Loader";

const s  = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

const subStatusBadge = (st: string) => {
  const m: Record<string, string> = {
    active:       "badge-green",
    grace_period: "badge-yellow",
    expired:      "badge-red",
    cancelled:    "badge-red",
  };
  return s(m[st] ?? "badge-blue");
};

const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function SchoolSubscriptionHistoryPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const router = useRouter();

  const { data: history, loading } = useApi<any[]>(
    schoolId ? `/subscriptions/schools/${schoolId}/history` : null,
    [schoolId]
  );

  // Derive school name from first record if available
  const schoolName = history?.[0]?.school_name ?? `School #${schoolId}`;

  return (
    <div className={s("sa-page")}>
      <Topbar
        title="Subscription History"
        subtitle={schoolName}
      />

      <main className={s("page-content")}>
        {/* Back link */}
        <div>
          <Link
            href="/super-admin/schools"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: 13, fontWeight: 700, color: "#6b7b86",
              textDecoration: "none",
            }}
          >
            <i className="fa-solid fa-arrow-left" /> Back to Schools
          </Link>
        </div>

        <section className={s("card")}>
          <div className={s("card-head")}>
            <div>
              <h3>Subscription History</h3>
              <p>{schoolName}</p>
            </div>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7b86" }}>
                {history?.length ?? 0} record{(history?.length ?? 0) !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
              <Loader fullScreen={false} size="md" text="Loading subscription history…" />
            </div>
          ) : !history || history.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#6b7b86" }}>
              <i
                className="fa-solid fa-clock-rotate-left"
                style={{ fontSize: 28, marginBottom: 10, display: "block", opacity: 0.3 }}
              />
              No subscription history found for this school.
            </div>
          ) : (
            <div className={s("table-wrap")}>
              <table className={s("table")}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Plan</th>
                    <th>Cycle</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Reference</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: any, idx: number) => (
                    <tr key={h.id}>
                      <td style={{ color: "#6b7b86", fontSize: 12 }}>{idx + 1}</td>
                      <td>
                        <strong style={{ fontWeight: 800 }}>{h.plan_name}</strong>
                      </td>
                      <td style={{ textTransform: "capitalize", color: "#6b7b86" }}>
                        {h.billing_cycle?.replace("_", " ") || "—"}
                      </td>
                      <td>
                        <span
                          className={cx(s("badge"), subStatusBadge(h.status))}
                          style={{ textTransform: "capitalize" }}
                        >
                          {h.status?.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: "#6b7b86" }}>
                        {h.start_date ? fmtDate(h.start_date) : "—"}
                      </td>
                      <td style={{ fontSize: 13, color: "#6b7b86" }}>
                        {h.end_date
                          ? fmtDate(h.end_date)
                          : <span style={{ color: "#0f766e", fontWeight: 700 }}>No expiry</span>}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {h.amount_paid > 0
                          ? `${h.currency ?? ""} ${Number(h.amount_paid).toLocaleString()}`
                          : <span style={{ color: "#6b7b86" }}>Free</span>}
                      </td>
                      <td style={{ color: "#6b7b86", textTransform: "capitalize" }}>
                        {h.payment_method?.replace("_", " ") || "—"}
                      </td>
                      <td style={{ color: "#6b7b86", fontSize: 12 }}>
                        {h.payment_reference || "—"}
                      </td>
                      <td style={{ color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>
                        {h.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
