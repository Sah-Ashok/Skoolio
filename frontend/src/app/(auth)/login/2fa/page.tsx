'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { verify2FAThunk, clearError, getRoleRedirect, clearTwofa } from '@/store/authSlice';
import { showToast } from '@/store/toastSlice';
import { Spinner } from '@/components/shared/Loader';
import styles from '../login.module.css';

export default function TwoFAPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { loading, error, twofaPending, twofaSession } = useAppSelector((s) => s.auth);

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!twofaPending) router.replace('/login');
    else inputs.current[0]?.focus();
  }, [twofaPending, router]);

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0)
      inputs.current[index - 1]?.focus();
    if (e.key === 'Enter') handleVerify();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp_code = digits.join('');
    if (otp_code.length < 6 || !twofaSession) return;

    const result = await dispatch(verify2FAThunk({ twofa_session: twofaSession, otp_code }));

    if (verify2FAThunk.fulfilled.match(result)) {
      dispatch(showToast({ type: 'success', title: 'Verified!', message: 'Redirecting to your dashboard…' }));
      router.push(getRoleRedirect(result.payload.role));
    }
  };

  const handleBack = () => {
    dispatch(clearTwofa());
    dispatch(clearError());
    router.push('/login');
  };

  const otp_code = digits.join('');

  return (
    <div className={styles.page}>
      {/* Left */}
      <div className={styles.left}>
        <div className={styles.bgOrbs}>
          <div className={styles.orb1} /><div className={styles.orb2} /><div className={styles.orb3} />
        </div>
        <div className={styles.leftInner}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}><i className="fa-solid fa-graduation-cap" /></div>
            <div><h1>CampusPOS</h1><p>School Management Suite</p></div>
          </div>

          <div style={{ padding: '28px 24px', background: 'rgba(255,255,255,0.05)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg,#FF9B51,#e87a2f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🛡️</div>
              <div>
                <p style={{ color: '#EAEFEF', fontWeight: 800, fontSize: 14 }}>Two-Factor Authentication</p>
                <p style={{ color: '#7a96a6', fontSize: 12, fontWeight: 600 }}>Enabled by your platform admin</p>
              </div>
            </div>
            {[
              ['📧', 'Code sent to your registered email'],
              ['⏱️', 'Expires in 5 minutes'],
              ['🔒', 'One-time use — never reusable'],
              ['🚫', 'Never share your code with anyone'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ color: '#9db5c2', fontSize: 13, fontWeight: 600 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right */}
      <div className={styles.right}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <div className={styles.welcomeIcon}><i className="fa-solid fa-shield-halved" /></div>
            <h2>Verify Your Identity</h2>
            <p>Enter the 6-digit code sent to your email</p>
          </div>

          <div className={styles.formBody}>
            {/* Digit boxes */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 4 }}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  style={{
                    width: 52, height: 58, borderRadius: 13,
                    border: d ? '2.5px solid #25343F' : '1.5px solid #e2e8f0',
                    background: d ? '#f0f4f8' : '#f8fafc',
                    textAlign: 'center', fontSize: 24, fontWeight: 900,
                    color: '#1e293b', outline: 'none', fontFamily: 'monospace',
                    transition: 'all 0.15s',
                  }}
                />
              ))}
            </div>

            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
              Check your inbox — and spam folder if needed
            </p>

            {error && (
              <div className={styles.error} role="alert">
                <i className="fa-solid fa-circle-exclamation" />
                <span>{error}</span>
              </div>
            )}

            <button className={styles.btnPrimary} onClick={handleVerify} disabled={loading || otp_code.length < 6}>
              {loading
                ? <><Spinner size={16} /> Verifying…</>
                : <><i className="fa-solid fa-check-circle" /> Verify &amp; Sign In</>}
            </button>

            <button type="button" onClick={handleBack} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 4 }}>
              <i className="fa-solid fa-arrow-left" /> Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
