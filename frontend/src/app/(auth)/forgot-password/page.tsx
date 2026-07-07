'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { Spinner } from '@/components/shared/Loader';
import styles from '../login/login.module.css';

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step,       setStep]       = useState<Step>('email');
  const [email,      setEmail]      = useState('');
  const [digits,     setDigits]     = useState(['','','','','','']);
  const [resetToken, setResetToken] = useState('');
  const [newPass,    setNewPass]    = useState('');
  const [confirmPass,setConfirmPass]= useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Step 1: send OTP ──────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true); setError('');
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setStep('otp');
      setSuccess(`OTP sent to ${email}. Check your inbox.`);
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP. Please check your email.');
    } finally { setLoading(false); }
  };

  // ── Step 2: verify OTP ────────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    const otp = digits.join('');
    if (otp.length < 6) { setError('Please enter the complete 6-digit code.'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await apiRequest<{ data: { reset_token: string } }>('/auth/verify-reset-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });
      setResetToken(res.data.reset_token);
      setStep('password');
      setSuccess('OTP verified! Set your new password below.');
    } catch (e: any) {
      setError(e.message || 'Invalid or expired OTP. Please try again.');
    } finally { setLoading(false); }
  };

  // ── Step 3: reset password ────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!newPass || newPass.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPass !== confirmPass)         { setError('Passwords do not match.'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ reset_token: resetToken, new_password: newPass }),
      });
      setSuccess('Password reset successful! Redirecting to login…');
      setTimeout(() => router.push('/login'), 1800);
    } catch (e: any) {
      setError(e.message || 'Failed to reset password. The link may have expired.');
    } finally { setLoading(false); }
  };

  // ── OTP digit input helpers ───────────────────────────────────────────────
  const handleDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...digits]; next[i] = v; setDigits(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };
  const handleDigitKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'Enter') handleVerifyOTP();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    if (pasted.length === 6) { setDigits(pasted.split('')); inputs.current[5]?.focus(); }
  };

  // ── Step indicator ────────────────────────────────────────────────────────
  const STEPS = [
    { key: 'email',    num: 1, label: 'Email'       },
    { key: 'otp',      num: 2, label: 'Verify OTP'  },
    { key: 'password', num: 3, label: 'New Password' },
  ];
  const stepIdx = STEPS.findIndex(s => s.key === step);

  return (
    <div className={styles.page}>
      {/* ── Left panel ── */}
      <div className={styles.left}>
        <div className={styles.bgOrbs}>
          <div className={styles.orb1}/><div className={styles.orb2}/><div className={styles.orb3}/>
        </div>
        <div className={styles.leftInner}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}><i className="fa-solid fa-graduation-cap"/></div>
            <div><h1>CampusPOS</h1><p>School Management Suite</p></div>
          </div>

          {/* Step progress */}
          <div style={{ padding: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ color: '#EAEFEF', fontWeight: 800, fontSize: 14, marginBottom: 20 }}>Password Reset Steps</p>
            {STEPS.map((s, i) => {
              const done    = i < stepIdx;
              const current = i === stepIdx;
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: done ? '#15803d' : current ? '#FF9B51' : 'rgba(255,255,255,0.1)',
                    color: done || current ? '#fff' : '#6b7b86',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900,
                  }}>
                    {done ? <i className="fa-solid fa-check"/> : s.num}
                  </div>
                  <div>
                    <p style={{ color: current ? '#FF9B51' : done ? '#EAEFEF' : '#6b7b86', fontWeight: current ? 800 : 700, fontSize: 13 }}>
                      Step {s.num}: {s.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ color: '#7a96a6', fontSize: 13, lineHeight: 1.7, fontWeight: 600 }}>
              We'll send a 6-digit one-time code to your registered email. The code expires in <strong style={{ color: '#FF9B51' }}>10 minutes</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className={styles.right}>
        <div className={styles.formCard}>

          {/* ── STEP 1: Email ── */}
          {step === 'email' && (
            <>
              <div className={styles.formHeader}>
                <div className={styles.welcomeIcon}><i className="fa-solid fa-key"/></div>
                <h2>Forgot Password?</h2>
                <p>Enter your school admin email to receive a reset code</p>
              </div>

              <div className={styles.formBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email Address</label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-envelope"/>
                    <input
                      type="email"
                      className={styles.input}
                      placeholder="school@email.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                      autoFocus
                    />
                  </div>
                </div>

                {error   && <div className={styles.error}><i className="fa-solid fa-circle-exclamation"/><span>{error}</span></div>}
                {success && <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, color: '#15803d', fontSize: 13, fontWeight: 600 }}><i className="fa-solid fa-circle-check" style={{ marginRight: 8 }}/>{success}</div>}

                <button className={styles.btnPrimary} onClick={handleSendOTP} disabled={loading}>
                  {loading ? <><Spinner size={16}/> Sending…</> : <><i className="fa-solid fa-paper-plane"/> Send OTP</>}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === 'otp' && (
            <>
              <div className={styles.formHeader}>
                <div className={styles.welcomeIcon}><i className="fa-solid fa-shield-halved"/></div>
                <h2>Enter OTP</h2>
                <p>We sent a 6-digit code to <strong style={{ color: '#25343F' }}>{email}</strong></p>
              </div>

              <div className={styles.formBody}>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => { inputs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={e => handleDigit(i, e.target.value)}
                      onKeyDown={e => handleDigitKey(i, e)}
                      onPaste={i === 0 ? handlePaste : undefined}
                      style={{
                        width: 52, height: 58, borderRadius: 13, textAlign: 'center',
                        fontSize: 24, fontWeight: 900, fontFamily: 'monospace',
                        border: d ? '2.5px solid #25343F' : '1.5px solid #e2e8f0',
                        background: d ? '#f0f4f8' : '#f8fafc',
                        color: '#1e293b', outline: 'none', transition: 'all 0.15s',
                      }}
                    />
                  ))}
                </div>

                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                  Check inbox & spam — expires in 10 minutes
                </p>

                {error   && <div className={styles.error}><i className="fa-solid fa-circle-exclamation"/><span>{error}</span></div>}
                {success && <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, color: '#15803d', fontSize: 13, fontWeight: 600 }}><i className="fa-solid fa-circle-check" style={{ marginRight: 8 }}/>{success}</div>}

                <button className={styles.btnPrimary} onClick={handleVerifyOTP} disabled={loading || digits.join('').length < 6}>
                  {loading ? <><Spinner size={16}/> Verifying…</> : <><i className="fa-solid fa-check-circle"/> Verify OTP</>}
                </button>

                <button type="button" onClick={() => { setStep('email'); setError(''); setSuccess(''); setDigits(['','','','','','']); }}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}>
                  <i className="fa-solid fa-arrow-left"/> Back
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: New Password ── */}
          {step === 'password' && (
            <>
              <div className={styles.formHeader}>
                <div className={styles.welcomeIcon}><i className="fa-solid fa-lock-open"/></div>
                <h2>Set New Password</h2>
                <p>Create a strong password for your account</p>
              </div>

              <div className={styles.formBody}>
                {success && <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, color: '#15803d', fontSize: 13, fontWeight: 600, marginBottom: 4 }}><i className="fa-solid fa-circle-check" style={{ marginRight: 8 }}/>{success}</div>}

                <div className={styles.formGroup}>
                  <label className={styles.label}>New Password</label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-lock"/>
                    <input
                      type={showPass ? 'text' : 'password'}
                      className={styles.input}
                      placeholder="Minimum 6 characters"
                      value={newPass}
                      onChange={e => { setNewPass(e.target.value); setError(''); }}
                      autoFocus
                    />
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                      <i className={`fa-solid ${showPass ? 'fa-eye-slash' : 'fa-eye'}`}/>
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Confirm New Password</label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-lock"/>
                    <input
                      type={showPass ? 'text' : 'password'}
                      className={styles.input}
                      placeholder="Re-enter your password"
                      value={confirmPass}
                      onChange={e => { setConfirmPass(e.target.value); setError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                    />
                  </div>
                </div>

                {/* Password strength indicator */}
                {newPass && (
                  <div style={{ marginTop: -8 }}>
                    <div style={{ height: 4, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4, transition: 'width 0.3s',
                        width: newPass.length >= 10 ? '100%' : newPass.length >= 8 ? '66%' : newPass.length >= 6 ? '33%' : '10%',
                        background: newPass.length >= 10 ? '#15803d' : newPass.length >= 8 ? '#d8941f' : '#ef4444',
                      }}/>
                    </div>
                    <p style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: newPass.length >= 10 ? '#15803d' : newPass.length >= 8 ? '#d8941f' : '#ef4444' }}>
                      {newPass.length >= 10 ? 'Strong' : newPass.length >= 8 ? 'Medium' : 'Weak'}
                    </p>
                  </div>
                )}

                {error && <div className={styles.error}><i className="fa-solid fa-circle-exclamation"/><span>{error}</span></div>}

                <button className={styles.btnPrimary} onClick={handleResetPassword} disabled={loading}>
                  {loading ? <><Spinner size={16}/> Resetting…</> : <><i className="fa-solid fa-check"/> Reset Password</>}
                </button>
              </div>
            </>
          )}

          <p className={styles.registerLink}>
            Remembered your password?{' '}
            <Link href="/login">Back to login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
