'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { verify2FAThunk, clearError, getRoleRedirect, clearTwofa } from '@/store/authSlice';
import { showToast } from '@/store/toastSlice';
import { Spinner } from '@/components/shared/Loader';
import styles from '../login.module.css';

export default function TwoFAPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { loading, error, twofaPending, twofaSession, twofaType } = useAppSelector((s) => s.auth);

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!twofaPending) {
      router.replace('/login');
    } else if (!useRecovery) {
      inputs.current[0]?.focus();
    }
  }, [twofaPending, useRecovery, router]);

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') handleVerify();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const rawPasted = e.clipboardData.getData('text').trim();
    // If pasted an 8-character recovery code like "A1B2-C3D4" or "A1B2C3D4"
    if (rawPasted.includes('-') || rawPasted.length >= 8) {
      setUseRecovery(true);
      setRecoveryCode(rawPasted);
      return;
    }

    const pastedDigits = rawPasted.replace(/\D/g, '').slice(0, 6);
    if (pastedDigits.length === 6) {
      setDigits(pastedDigits.split(''));
      inputs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const codeToSubmit = useRecovery ? recoveryCode.trim() : digits.join('');
    if (!codeToSubmit || !twofaSession) return;
    if (!useRecovery && codeToSubmit.length < 6) return;

    const result = await dispatch(verify2FAThunk({ twofa_session: twofaSession, otp_code: codeToSubmit }));

    if (verify2FAThunk.fulfilled.match(result)) {
      dispatch(showToast({ type: 'success', title: 'Verified!', message: 'Signed in successfully. Redirecting…' }));
      router.push(getRoleRedirect(result.payload.role));
    }
  };

  const handleBack = () => {
    dispatch(clearTwofa());
    dispatch(clearError());
    router.push('/login');
  };

  const isEmail = twofaType === 'email';
  const otpCode = digits.join('');
  const canSubmit = useRecovery ? recoveryCode.trim().length >= 8 : otpCode.length === 6;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── Left: Brand & Illustration ── */}
        <div className={styles.leftPanel}>
          <div className={styles.illustrationCard}>
            {/* Top-Left Brand Logo */}
            <div className={styles.brandHeader}>
              <Link href="/" aria-label="Skoolio — Home" className={styles.brandLink}>
                <Image
                  src="/Logo.png"
                  alt="Skoolio"
                  width={240}
                  height={82}
                  priority
                  style={{ objectFit: 'contain' }}
                />
              </Link>
            </div>

            {/* Hero Illustration */}
            <div className={styles.illustrationWrapper}>
              <Image
                src="/2fa-image.png"
                alt="Two-Factor Security Authentication"
                width={660}
                height={440}
                priority
                className={styles.illustrationImg}
              />
            </div>

            {/* Security Pills */}
            <div className={styles.featurePills}>
              <div className={styles.featurePill}>
                <i className="fa-solid fa-shield-halved" style={{ color: '#0284c7' }} />
                <span>Authenticator App (TOTP)</span>
              </div>
              <div className={styles.featurePill}>
                <i className="fa-solid fa-key" style={{ color: '#ea580c' }} />
                <span>Recovery Codes Supported</span>
              </div>
              <div className={styles.featurePill}>
                <i className="fa-solid fa-lock" style={{ color: '#16a34a' }} />
                <span>Encrypted Sessions</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Verification Card ── */}
        <div className={styles.rightPanel}>
          <div className={styles.card}>
            {/* Header */}
            <div className={styles.header}>
              <h1 className={styles.title}>Two-Factor Verification</h1>
              <p className={styles.subtitle}>
                {useRecovery
                  ? 'Enter one of your 8-character emergency recovery codes.'
                  : isEmail
                  ? 'Enter the 6-digit code sent to your registered email address.'
                  : 'Enter the 6-digit code from your Authenticator app (e.g. Google Authenticator, Microsoft Authenticator).'}
              </p>
            </div>

            {/* Input Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!useRecovery ? (
                <>
                  {/* 6-Digit OTP boxes */}
                  <div className={styles.otpRow}>
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          inputs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={(e) => handleDigit(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={i === 0 ? handlePaste : undefined}
                        className={`${styles.otpBox} ${d ? styles.otpBoxFilled : ''}`}
                      />
                    ))}
                  </div>

                  <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, fontWeight: 500, margin: '0 0 4px' }}>
                    {isEmail
                      ? 'Check your inbox — and spam folder if needed.'
                      : 'Open your Authenticator app to view your 6-digit verification code.'}
                  </p>
                </>
              ) : (
                /* Emergency Recovery Code Input */
                <div className={styles.field} style={{ margin: '8px 0' }}>
                  <label className={styles.label} htmlFor="recovery-code">
                    Emergency Recovery Code
                  </label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-key" style={{ color: '#ea580c' }} />
                    <input
                      id="recovery-code"
                      type="text"
                      placeholder="e.g. A1B2-C3D4"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleVerify();
                      }}
                      className={styles.input}
                      style={{ letterSpacing: '2px', fontWeight: 700, fontFamily: 'monospace' }}
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className={styles.errorBox} role="alert">
                  <i className="fa-solid fa-circle-exclamation" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                className={styles.btnLogin}
                onClick={handleVerify}
                disabled={loading || !canSubmit}
                style={{ width: '100%', marginTop: 8 }}
              >
                {loading ? (
                  <>
                    <Spinner size={16} /> Verifying…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-circle-check" /> Verify &amp; Sign In
                  </>
                )}
              </button>

              {/* Toggle Recovery Code Mode */}
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    setUseRecovery(!useRecovery);
                    dispatch(clearError());
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1d4ed8',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    borderRadius: 6,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#1e40af';
                    e.currentTarget.style.background = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#1d4ed8';
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  <i className="fa-solid fa-key" style={{ fontSize: 11, color: '#ea580c' }} />
                  <span>
                    {useRecovery
                      ? '← Use 6-digit Authenticator code instead'
                      : 'Lost access to your app? Use an emergency recovery code'}
                  </span>
                </button>
              </div>

              {/* Back to Login */}
              <div style={{ textAlign: 'center', marginTop: 10, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={handleBack}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '4px 8px',
                    borderRadius: 6,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#0f172a';
                    e.currentTarget.style.background = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  <i className="fa-solid fa-arrow-left" /> Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
