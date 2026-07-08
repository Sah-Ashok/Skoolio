"use client";

import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const formatINR = (amount: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount));

export default function StudentFeesPage() {
  const { data: collections, loading } = useApi<any[]>('/fees/me/collections');
  const { data: payments } = useApi<any[]>('/fees/me/payments');

  const totalDue = (collections || []).reduce((sum, c) => sum + Number(c.remaining_amount || 0), 0);
  const totalPaid = (collections || []).reduce((sum, c) => sum + Number(c.paid_amount || 0), 0);
  const totalCollections = collections?.length || 0;

  return (
    <>
      <style>{`
        .sf-page {
          min-height: 100vh;
          background: #f6f8fa;
          padding-bottom: 60px;
        }

        .sf-content {
          max-width: 1100px;
          margin: 0 auto;
          padding: 30px 24px;
        }

        /* ── Header ── */
        .sf-header-wrap {
          margin-bottom: 24px;
        }
        .sf-title {
          font-size: 24px;
          font-weight: 800;
          color: #1f2d36;
          margin: 0 0 4px 0;
        }
        .sf-subtitle {
          font-size: 13px;
          color: #6a7882;
          margin: 0;
          font-weight: 600;
        }

        /* ── Stats Grid ── */
        .sf-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }
        .sf-stat-card {
          background: #fff;
          border-radius: 20px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.03);
          border: 1px solid #e2e8f0;
        }
        .sf-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .sf-icon-orange { background: #fff3e0; color: #ff9b51; }
        .sf-icon-green  { background: #e2f6ee; color: #12805c; }
        .sf-icon-blue   { background: #e8edff; color: #4b8ff7; }
        
        .sf-stat-info p {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 700;
          margin: 0 0 2px 0;
          text-transform: uppercase;
        }
        .sf-stat-info h3 {
          font-size: 24px;
          font-weight: 800;
          color: #1f2d36;
          margin: 0;
        }

        /* ── Sections ── */
        .sf-section {
          background: #fff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 14px rgba(0,0,0,0.03);
          overflow: hidden;
          margin-bottom: 30px;
        }
        .sf-section-header {
          padding: 20px 24px;
          border-bottom: 1px solid #e2e8f0;
        }
        .sf-section-title {
          font-size: 16px;
          font-weight: 800;
          color: #1f2d36;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        /* ── Tables ── */
        .sf-table-wrap {
          overflow-x: auto;
        }
        .sf-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .sf-table th {
          background: #f8fafc;
          color: #6a7882;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 14px 24px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }
        .sf-table td {
          padding: 16px 24px;
          font-size: 13px;
          color: #1f2d36;
          border-bottom: 1px solid #f1f5f9;
          font-weight: 600;
          white-space: nowrap;
        }
        .sf-table tbody tr:last-child td {
          border-bottom: none;
        }
        .sf-table tbody tr:hover {
          background: #fdfefe;
        }
        .sf-fee-name {
          font-weight: 800;
          color: #1f2d36;
        }
        .sf-amount-bold {
          font-weight: 800;
          color: #1f2d36;
        }
        .sf-amount-due {
          font-weight: 800;
          color: #ff5252;
        }

        /* ── Badges ── */
        .sf-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .sf-badge-paid { background: #e2f6ee; color: #12805c; }
        .sf-badge-partial { background: #fff3e0; color: #e65100; }
        .sf-badge-unpaid { background: #ffebee; color: #c62828; }
        .sf-badge-waived { background: #e8edff; color: #283593; }

        @media (max-width: 768px) {
          .sf-content { padding: 20px 16px; }
          .sf-stats { grid-template-columns: 1fr; gap: 16px; }
          .sf-stat-card { padding: 16px; }
          .sf-section-header { padding: 16px; }
          .sf-table th, .sf-table td { padding: 14px 16px; }
        }
      `}</style>
      
      <div className="sf-page">
        <Topbar title="My Fees" subtitle="Your fee collections and payment history" />

        <main className="sf-content">
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center' }}><Spinner size={40} color="#ff9b51" /></div>
          ) : (
            <>
              <div className="sf-header-wrap">
                <h1 className="sf-title">Fee Management</h1>
                <p className="sf-subtitle">Track your payments, upcoming dues, and past receipts.</p>
              </div>

              {/* ── Stats Section ── */}
              <div className="sf-stats">
                <div className="sf-stat-card">
                  <div className="sf-icon-wrap sf-icon-orange"><i className="fa-solid fa-wallet" /></div>
                  <div className="sf-stat-info">
                    <p>Total Due</p>
                    <h3>{formatINR(totalDue)}</h3>
                  </div>
                </div>
                <div className="sf-stat-card">
                  <div className="sf-icon-wrap sf-icon-green"><i className="fa-solid fa-circle-check" /></div>
                  <div className="sf-stat-info">
                    <p>Total Paid</p>
                    <h3>{formatINR(totalPaid)}</h3>
                  </div>
                </div>
                <div className="sf-stat-card">
                  <div className="sf-icon-wrap sf-icon-blue"><i className="fa-solid fa-file-invoice-dollar" /></div>
                  <div className="sf-stat-info">
                    <p>Fee Records</p>
                    <h3>{totalCollections}</h3>
                  </div>
                </div>
              </div>

              {/* ── Fee Records Section ── */}
              <div className="sf-section">
                <div className="sf-section-header">
                  <h2 className="sf-section-title"><i className="fa-solid fa-list-check" style={{color: '#4b8ff7'}}></i> Fee Collections</h2>
                </div>
                <div className="sf-table-wrap">
                  <table className="sf-table">
                    <thead>
                      <tr>
                        <th>Fee Name</th>
                        <th>Due Date</th>
                        <th>Total</th>
                        <th>Discount</th>
                        <th>Fine</th>
                        <th>Paid</th>
                        <th>Remaining</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(collections || []).map((c) => {
                        let badgeClass = 'sf-badge-waived';
                        if (c.status === 'paid') badgeClass = 'sf-badge-paid';
                        if (c.status === 'partial') badgeClass = 'sf-badge-partial';
                        if (c.status === 'unpaid') badgeClass = 'sf-badge-unpaid';

                        return (
                          <tr key={c.id}>
                            <td className="sf-fee-name">{c.fee_name}</td>
                            <td>{new Date(c.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric'})}</td>
                            <td className="sf-amount-bold">{formatINR(c.total_amount)}</td>
                            <td style={{color: '#12805c'}}>{Number(c.discount_amount) > 0 ? `-${formatINR(c.discount_amount)}` : '-'}</td>
                            <td style={{color: '#ff5252'}}>{Number(c.fine_amount) > 0 ? `+${formatINR(c.fine_amount)}` : '-'}</td>
                            <td style={{color: '#12805c', fontWeight: 800}}>{formatINR(c.paid_amount)}</td>
                            <td className="sf-amount-due">{formatINR(c.remaining_amount)}</td>
                            <td><span className={`sf-badge ${badgeClass}`}>{c.status}</span></td>
                          </tr>
                        );
                      })}
                      {(!collections || collections.length === 0) && (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: 13 }}>No fee records found for this academic year.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Payment History Section ── */}
              <div className="sf-section">
                <div className="sf-section-header">
                  <h2 className="sf-section-title"><i className="fa-solid fa-clock-rotate-left" style={{color: '#12805c'}}></i> Payment History</h2>
                </div>
                <div className="sf-table-wrap">
                  <table className="sf-table">
                    <thead>
                      <tr>
                        <th>Receipt No.</th>
                        <th>Fee Reference</th>
                        <th>Amount Paid</th>
                        <th>Date</th>
                        <th>Payment Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payments || []).map((p) => (
                        <tr key={p.id}>
                          <td className="sf-fee-name" style={{fontFamily: 'monospace'}}>{p.receipt_number}</td>
                          <td>{p.fee_name}</td>
                          <td className="sf-amount-bold" style={{color: '#12805c'}}>{formatINR(p.paid_amount)}</td>
                          <td>{new Date(p.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</td>
                          <td>
                            <span style={{background: '#f1f5f9', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, color: '#6a7882', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                              {p.payment_method?.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!payments || payments.length === 0) && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: 13 }}>No payment history available.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </>
          )}
        </main>
      </div>
    </>
  );
}
