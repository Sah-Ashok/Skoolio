"use client";

import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const formatINR = (amount: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount));

const statusBadge: Record<string, string> = {
  paid: 'badge-green',
  partial: 'badge-yellow',
  unpaid: 'badge-red',
  waived: 'badge-indigo',
};

export default function StudentFeesPage() {
  const { data: collections, loading } = useApi<any[]>('/fees/me/collections');
  const { data: payments } = useApi<any[]>('/fees/me/payments');

  const totalDue = (collections || []).reduce((sum, c) => sum + Number(c.remaining_amount || 0), 0);
  const totalPaid = (collections || []).reduce((sum, c) => sum + Number(c.paid_amount || 0), 0);

  return (
    <div className="main-wrapper">
      <Topbar title="My Fees" subtitle="Your fee collections and payment history" />
      <main className="page-content">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <>
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon green"><i className="fa-solid fa-circle-check" /></div>
                <div className="stat-info"><p>Total Paid</p><h3>{formatINR(totalPaid)}</h3></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><i className="fa-solid fa-triangle-exclamation" /></div>
                <div className="stat-info"><p>Total Due</p><h3>{formatINR(totalDue)}</h3></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><i className="fa-solid fa-receipt" /></div>
                <div className="stat-info"><p>Total Records</p><h3>{collections?.length || 0}</h3></div>
              </div>
            </section>

            <section className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header"><h3>Fee Records</h3></div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Fee Name</th><th>Due Date</th><th>Total</th><th>Discount</th><th>Fine</th><th>Paid</th><th>Remaining</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {(collections || []).map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.fee_name}</strong></td>
                        <td>{new Date(c.due_date).toLocaleDateString()}</td>
                        <td>{formatINR(c.total_amount)}</td>
                        <td>{Number(c.discount_amount) > 0 ? formatINR(c.discount_amount) : '-'}</td>
                        <td>{Number(c.fine_amount) > 0 ? formatINR(c.fine_amount) : '-'}</td>
                        <td>{formatINR(c.paid_amount)}</td>
                        <td><strong>{formatINR(c.remaining_amount)}</strong></td>
                        <td><span className={`badge ${statusBadge[c.status] || 'badge-indigo'}`} style={{ textTransform: 'capitalize' }}>{c.status}</span></td>
                      </tr>
                    ))}
                    {(!collections || collections.length === 0) && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>No fee records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h3>Payment History</h3></div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Receipt No</th><th>Fee</th><th>Amount Paid</th><th>Date</th><th>Method</th></tr>
                  </thead>
                  <tbody>
                    {(payments || []).map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.receipt_number}</strong></td>
                        <td>{p.fee_name}</td>
                        <td>{formatINR(p.paid_amount)}</td>
                        <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td style={{ textTransform: 'capitalize' }}>{p.payment_method?.replace('_', ' ')}</td>
                      </tr>
                    ))}
                    {(!payments || payments.length === 0) && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No payment history yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
