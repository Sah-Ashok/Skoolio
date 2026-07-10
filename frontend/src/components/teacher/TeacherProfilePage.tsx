"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { apiRequest } from "@/lib/api";

export default function TeacherProfilePage() {
  const { data: me, loading } = useApi<any>('/auth/me');

  // ── change password state ──
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError,   setPwdError]   = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const initials = me?.full_name
    ? me.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'T';

  const rows: [string, any][] = me ? [
    ['Full Name', me.full_name],
    ['Email', me.email],
    ['Phone', me.phone],
    ['Gender', me.gender],
    ['Date of Birth', me.date_of_birth ? new Date(me.date_of_birth).toLocaleDateString() : '-'],
    ['Qualification', me.qualification || '-'],
    ['Experience', `${me.experience_years ?? 0} years`],
    ['Join Date', me.join_date ? new Date(me.join_date).toLocaleDateString() : '-'],
    ['City', me.city || '-'],
    ['State', me.state || '-'],
    ['Country', me.country || '-'],
    ['Status', me.status],
  ] : [];

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (newPwd.length < 6) {
      setPwdError('New password must be at least 6 characters.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('New passwords do not match.');
      return;
    }

    setPwdLoading(true);
    try {
      await apiRequest('/auth/change-password/teacher', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      });
      setPwdSuccess('Password changed successfully.');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err: any) {
      setPwdError(err.message || 'Failed to change password.');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="main-wrapper">
      <Topbar title="My Profile" subtitle="Your personal and professional information" />
      <main className="page-content">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <>
            {/* ── Avatar / header ── */}
            <section className="card" style={{ marginBottom: '20px' }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: 72, height: 72, borderRadius: 16, background: '#FF9B51', color: '#25343F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800 }}>
                  {initials}
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{me?.full_name}</h2>
                  <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{me?.school_name} &middot; Faculty</p>
                  {me?.subjects && me.subjects.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {me.subjects.map((subject: any) => (
                        <span key={subject.id} className="badge badge-indigo">{subject.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Personal details ── */}
            <section className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header"><h3>Personal Details</h3></div>
              <div className="card-body">
                <div className="form-grid">
                  {rows.map(([label, value]) => (
                    <div key={label}>
                      <label className="form-label">{label}</label>
                      <p style={{ fontSize: 14, color: '#1e293b', fontWeight: 600, textTransform: label === 'Gender' || label === 'Status' ? 'capitalize' : 'none' }}>
                        {value || '-'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Change Password ── */}
            <section className="card">
              <div className="card-header">
                <h3>
                  <i className="fa-solid fa-lock" style={{ marginRight: 8, color: '#6366f1' }} />
                  Change Password
                </h3>
              </div>
              <div className="card-body">
                <form onSubmit={handleChangePassword}>
                  <div className="form-grid" style={{ marginBottom: '16px' }}>
                    <div>
                      <label className="form-label">Current Password</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Enter current password"
                        value={currentPwd}
                        onChange={e => setCurrentPwd(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">New Password</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Min. 6 characters"
                        value={newPwd}
                        onChange={e => setNewPwd(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Confirm New Password</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Repeat new password"
                        value={confirmPwd}
                        onChange={e => setConfirmPwd(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {pwdError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 7 }} />
                      {pwdError}
                    </div>
                  )}
                  {pwdSuccess && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#16a34a', fontSize: 13, marginBottom: 14 }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: 7 }} />
                      {pwdSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={pwdLoading}
                    style={{ minWidth: 160 }}
                  >
                    {pwdLoading
                      ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 7 }} />Updating...</>
                      : <><i className="fa-solid fa-key" style={{ marginRight: 7 }} />Update Password</>
                    }
                  </button>
                </form>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
