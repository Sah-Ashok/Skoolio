'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/useApi';
import { apiRequest } from '@/lib/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/toastSlice';
import { Loader, Spinner } from '@/components/shared/Loader';
import styles from '@/app/(admin)/settings/settings.module.css';

const s = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(' ');

export default function FinanceAccountTab() {
  const dispatch = useAppDispatch();

  // 1. Fetch Subscription status to check plan tier (Plus / Ultra)
  const { data: subStatus, loading: subLoading } = useApi<any>('/subscriptions/me/status');

  // 2. Fetch School's single finance account
  const { data: financeUser, loading: accLoading, refetch } = useApi<any>('/school/finance-account');

  // Form states
  const [showResetModal, setShowResetModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
  });

  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState(false);

  const planName = subStatus?.plan?.name?.toLowerCase() || '';
  const isProPlan = planName.includes('pro') && !planName.includes('plus') && !planName.includes('ultra');

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/finance-login` : '/finance-login';

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      dispatch(showToast({ type: 'info', title: 'Copied!', message: 'Finance portal link copied to clipboard.' }));
    }
  };

  // Handler: Create Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.password) {
      dispatch(showToast({ type: 'error', title: 'Missing fields', message: 'Full name, email, and password are required.' }));
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/school/finance-account', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      dispatch(showToast({
        type: 'success',
        title: 'Finance Account Created!',
        message: `${form.full_name} can now log in at /finance-login.`,
      }));

      setForm({ full_name: '', email: '', phone: '', password: '' });
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Failed to create', message: err.message || 'Error creating finance account.' }));
    } finally {
      setSubmitting(false);
    }
  };

  // Handler: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      dispatch(showToast({ type: 'error', title: 'Invalid password', message: 'Password must be at least 6 characters.' }));
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/school/finance-account', {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword }),
      });

      dispatch(showToast({
        type: 'success',
        title: 'Password Updated',
        message: 'Finance manager password has been reset successfully.',
      }));

      setShowResetModal(false);
      setNewPassword('');
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Reset failed', message: err.message || 'Error updating password.' }));
    } finally {
      setSubmitting(false);
    }
  };

  // Handler: Remove / Delete Account
  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to revoke this Finance Manager account? Their login access will be removed immediately.')) {
      return;
    }

    try {
      await apiRequest('/school/finance-account', { method: 'DELETE' });
      dispatch(showToast({
        type: 'info',
        title: 'Account Revoked',
        message: 'The finance manager slot is now available to configure a new user.',
      }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Error', message: err.message || 'Failed to remove account.' }));
    }
  };

  if ((subLoading && !subStatus) || (accLoading && !financeUser && financeUser !== null)) {
    return (
      <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
        <Loader fullScreen={false} size="md" text="Loading finance settings..." />
      </div>
    );
  }

  // ── Gated State: Pro Plan ──
  if (subStatus && isProPlan) {
    return (
      <>
        <div className={s('panelHead')}>
          <div className={s('panelHeadTitle')}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#f1f5f9',
              color: '#475569',
              display: 'grid',
              placeItems: 'center',
              fontSize: 16,
            }}>
              <i className="fa-solid fa-lock" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                Dedicated Finance Manager Account
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                Exclusive feature available on Plus and Ultra subscription tiers
              </p>
            </div>
          </div>
          <span style={{
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            background: '#f1f5f9',
            color: '#475569',
            border: '1px solid #e2e8f0',
          }}>
            🔒 Plus &amp; Ultra Only
          </span>
        </div>

        <div className={s('formBody')}>
          <div style={{
            padding: '24px 28px',
            borderRadius: 12,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #2563eb',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 20,
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#2563eb',
              display: 'grid',
              placeItems: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}>
              <i className="fa-solid fa-crown" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                Upgrade to Plus or Ultra to Unlock Finance Role
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
                Your school is currently on the <strong>{subStatus.plan?.name || 'Pro'}</strong> tier. Dedicated Finance Manager login with isolated access to fee collections, salary disbursements, and institutional expenses is available on <strong>Plus</strong> and <strong>Ultra</strong> plans.
              </p>
              <Link
                href="/upgrade"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 40,
                  padding: '0 20px',
                  borderRadius: 9,
                  background: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 13.5,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.2)',
                  transition: 'background 0.2s',
                }}
              >
                <i className="fa-solid fa-arrow-up-right-from-square" />
                Upgrade Plan
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Panel Header ── */}
      <div className={s('panelHead')}>
        <div className={s('panelHeadTitle')}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#1e293b',
            display: 'grid',
            placeItems: 'center',
            fontSize: 16,
            flexShrink: 0,
          }}>
            <i className="fa-solid fa-calculator" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              Dedicated Finance Manager Account
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
              Manage login credentials and portal access for your school&apos;s finance officer
            </p>
          </div>
        </div>

        <span style={{
          padding: '5px 14px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          background: financeUser ? '#ecfdf5' : '#f8fafc',
          color: financeUser ? '#15803d' : '#334155',
          border: `1px solid ${financeUser ? '#bbf7d0' : '#e2e8f0'}`,
        }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: financeUser ? '#10b981' : '#64748b',
          }} />
          {financeUser ? 'Account Active (1 of 1)' : '1 Slot Available'}
        </span>
      </div>

      {/* ── Panel Body ── */}
      <div className={s('formBody')}>

        {/* ── STATE A: Account Configured ── */}
        {financeUser ? (
          <div>
            <div className={s('sectionHeader')}>
              <i className="fa-solid fa-user-check" /> Active Finance Officer
            </div>

            {/* Profile Overview Card */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: '20px 24px',
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 18,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  color: '#ffffff',
                  fontSize: 20,
                  fontWeight: 900,
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 4px 10px rgba(15, 23, 42, 0.2)',
                  flexShrink: 0,
                }}>
                  {financeUser.full_name?.charAt(0).toUpperCase() || 'F'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a' }}>
                      {financeUser.full_name}
                    </h3>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      background: '#ecfdf5',
                      color: '#15803d',
                      border: '1px solid #bbf7d0',
                    }}>
                      ACTIVE
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: '#64748b', flexWrap: 'wrap' }}>
                    <span>
                      <i className="fa-regular fa-envelope" style={{ marginRight: 6, color: '#94a3b8' }} />
                      {financeUser.email}
                    </span>
                    {financeUser.phone && (
                      <span>
                        <i className="fa-solid fa-phone" style={{ marginRight: 6, color: '#94a3b8' }} />
                        {financeUser.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className={cx(s('btn'), s('btnOutline'))}
                  style={{ height: 38, fontSize: 13 }}
                >
                  <i className="fa-solid fa-key" /> Reset Password
                </button>

                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className={s('btn')}
                  style={{
                    height: 38,
                    fontSize: 13,
                    border: '1px solid #fecdd3',
                    background: '#fef2f2',
                    color: '#dc2626',
                  }}
                >
                  <i className="fa-solid fa-user-xmark" /> Revoke Access
                </button>
              </div>
            </div>

            {/* Portal Link Box */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '16px 20px',
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#0f172a',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 14,
                  flexShrink: 0,
                }}>
                  <i className="fa-solid fa-link" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Finance Portal URL
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {portalUrl}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={cx(s('btn'), s('btnOutline'))}
                  style={{ height: 36, padding: '0 14px', fontSize: 12.5 }}
                >
                  <i className={copied ? "fa-solid fa-check" : "fa-regular fa-copy"} />
                  {copied ? 'Copied' : 'Copy Link'}
                </button>
                <Link
                  href="/finance-login"
                  target="_blank"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 9,
                    background: '#0f172a',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 12.5,
                    textDecoration: 'none',
                  }}
                >
                  Open Portal ↗
                </Link>
              </div>
            </div>

            {/* Quick Audit Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 14 }}>
              <div className={s('infoCard')}>
                <span className={s('infoCardLabel')}>Account Role</span>
                <span className={s('infoCardValue')}>Finance Manager</span>
              </div>
              <div className={s('infoCard')}>
                <span className={s('infoCardLabel')}>Slot Utilization</span>
                <span className={s('infoCardValue')}>1 of 1 Configured</span>
              </div>
              <div className={s('infoCard')}>
                <span className={s('infoCardLabel')}>Last Portal Login</span>
                <span className={s('infoCardValue')}>
                  {financeUser.last_login_at ? new Date(financeUser.last_login_at).toLocaleString() : 'Never logged in'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ── STATE B: Slot Available — Clean Neutral Form ── */
          <div>
            {/* Explanatory Info Card (Crisp Slate/Navy) */}
            <div style={{
              padding: '16px 20px',
              borderRadius: 12,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 22,
            }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                display: 'grid',
                placeItems: 'center',
                fontSize: 17,
                flexShrink: 0,
              }}>
                <i className="fa-solid fa-shield-halved" />
              </div>
              <div>
                <strong style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', display: 'block' }}>
                  Create School Finance Manager Account
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b', lineHeight: 1.5 }}>
                  Credentials configured here will allow your finance staff to sign in directly at <strong>/finance-login</strong> to manage fee registers, monthly billing, salary payroll, and expenditures.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateAccount}>
              <div className={s('sectionHeader')}>
                <i className="fa-solid fa-user-plus" /> Account Credentials &amp; Details
              </div>

              <div className={s('formGrid2')} style={{ marginTop: 14 }}>
                <label className={s('field')}>
                  <span>Full Name <em>*</em></span>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Sharma"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    required
                  />
                </label>

                <label className={s('field')}>
                  <span>Login Email <em>*</em></span>
                  <input
                    type="email"
                    placeholder="e.g. finance@yourschool.edu"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </label>

                <label className={s('field')}>
                  <span>Phone Number (Optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>

                <label className={s('field')}>
                  <span>Initial Password <em>*</em></span>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <i className={`fa-solid ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </label>
              </div>

              {/* Action Bar */}
              <div style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
              }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    height: 42,
                    padding: '0 24px',
                    borderRadius: 9,
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 13.5,
                    fontWeight: 800,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.18)',
                    transition: 'background 0.18s, transform 0.18s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1e293b')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#0f172a')}
                >
                  {submitting ? (
                    <>
                      <Spinner size={14} color="#fff" /> Creating Account…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-user-check" /> Create Finance Manager
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* ── Modal: Reset Password ── */}
      {showResetModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 1000,
          padding: 20,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            width: '100%',
            maxWidth: 440,
            padding: 28,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a' }}>
                Reset Finance Password
              </h3>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b' }}>
              Enter a new secure password for <strong>{financeUser?.full_name}</strong> ({financeUser?.email}).
            </p>

            <form onSubmit={handleResetPassword}>
              <label className={s('field')}>
                <span>New Password</span>
                <input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className={cx(s('btn'), s('btnOutline'))}
                  style={{ height: 38 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    height: 38,
                    padding: '0 18px',
                    borderRadius: 9,
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {submitting ? <Spinner size={14} color="#fff" /> : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
