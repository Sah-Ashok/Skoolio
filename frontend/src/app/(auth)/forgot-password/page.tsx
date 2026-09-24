'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { Spinner } from '@/components/shared/Loader';
import { showToast } from '@/store/toastSlice';
import { useAppDispatch } from '@/store/hooks';
import styles from '../login/login.module.css';

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer for resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus first OTP box when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        inputs.current[0]?.focus();
      }, 50);
    }
  }, [step]);

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setStep('otp');
      setResendCooldown(30);
      setSuccess(`Verification code sent to ${email.trim()}.`);
      dispatch(
        showToast({
          type: 'success',
          title: 'Code Sent',
          message: `Verification code sent to ${email.trim()}.`,
        })
      );
    } catch (e: any) {
      setError(e.message || 'Failed to send verification code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResendOTP = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setResendCooldown(30);
      setDigits(['', '', '', '', '', '']);
      setSuccess('A new 6-digit code has been sent to your email.');
      inputs.current[0]?.focus();
      dispatch(
        showToast({
          type: 'success',
          title: 'Code Resent',
          message: 'A fresh verification code was sent to your email.',
        })
      );
    } catch (e: any) {
      setError(e.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    const otp = digits.join('');
    if (otp.length < 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiRequest<{ data: { reset_token: string } }>('/auth/verify-reset-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), otp }),
      });
      setResetToken(res.data.reset_token);
      setStep('password');
      setSuccess('Code verified! Set your new password below.');
    } catch (e: any) {
      setError(e.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset Password ────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!newPass || newPass.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ reset_token: resetToken, new_password: newPass }),
      });
      setSuccess('Password updated successfully! Redirecting to login…');
      dispatch(
        showToast({
          type: 'success',
          title: 'Password Updated',
          message: 'Your password was successfully updated. You can now login.',
        })
      );
      setTimeout(() => router.push('/login'), 1500);
    } catch (e: any) {
      setError(e.message || 'Failed to reset password. The session may have expired.');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP digit helpers ─────────────────────────────────────────────────────
  const handleDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleDigitKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleVerifyOTP();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputs.current[5]?.focus();
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── LEFT: Illustration & Brand Panel ── */}
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

            {/* Illustration */}
            <div className={styles.illustrationWrapper}>
              <Image
                src="/Login-page-image.png"
                alt="Account Security Illustration"
                width={660}
                height={440}
                priority
                className={styles.illustrationImg}
              />
            </div>

            {/* Feature Pills */}
            <div className={styles.featurePills}>
              <div className={styles.featurePill}>
                <i className="fa-solid fa-envelope-circle-check" style={{ color: '#2563eb' }} />
                <span>Instant Email OTP</span>
              </div>
              <div className={styles.featurePill}>
                <i className="fa-solid fa-shield-check" style={{ color: '#16a34a' }} />
                <span>256-bit Secure Reset</span>
              </div>
              <div className={styles.featurePill}>
                <i className="fa-solid fa-key" style={{ color: '#ea580c' }} />
                <span>Encrypted Recovery</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Form Card ── */}
        <div className={styles.rightPanel}>
          <div className={styles.card}>
            {/* Step Progress Bar */}
            <div className={styles.stepBar}>
              <div
                className={`${styles.stepDot} ${step === 'email' ? styles.active : 'completed'}`}
              >
                <div className={styles.stepCircle}>
                  {step !== 'email' ? <i className="fa-solid fa-check" /> : '1'}
                </div>
                <span>Email</span>
              </div>
              <div className={`${styles.stepLine} ${step !== 'email' ? styles.completed : ''}`} />
              <div
                className={`${styles.stepDot} ${
                  step === 'otp' ? styles.active : step === 'password' ? 'completed' : ''
                }`}
              >
                <div className={styles.stepCircle}>
                  {step === 'password' ? <i className="fa-solid fa-check" /> : '2'}
                </div>
                <span>Verify OTP</span>
              </div>
              <div className={`${styles.stepLine} ${step === 'password' ? styles.completed : ''}`} />
              <div className={`${styles.stepDot} ${step === 'password' ? styles.active : ''}`}>
                <div className={styles.stepCircle}>3</div>
                <span>New Password</span>
              </div>
            </div>

            {/* ── STEP 1: Enter Email ── */}
            {step === 'email' && (
              <>
                <div className={styles.header}>
                  <h1 className={styles.title}>Forgot Password?</h1>
                  <p className={styles.subtitle}>
                    Enter your registered email address to receive a 6-digit reset code.
                  </p>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="email">
                    Email Address
                  </label>
                  <div className={styles.inputWrap}>
                    <i className="fa-regular fa-envelope" />
                    <input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                      className={styles.input}
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className={styles.errorBox} role="alert">
                    <i className="fa-solid fa-circle-exclamation" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className={styles.successBox} role="status">
                    <i className="fa-solid fa-circle-check" />
                    <span>{success}</span>
                  </div>
                )}

                <button
                  type="button"
                  className={styles.btnLogin}
                  onClick={handleSendOTP}
                  disabled={loading || !email.trim()}
                  style={{ marginTop: 8 }}
                >
                  {loading ? (
                    <>
                      <Spinner size={16} /> Sending Code…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane" /> Send Reset Code
                    </>
                  )}
                </button>

                <div className={styles.footerNote}>
                  <p>
                    Remember your password?{' '}
                    <Link href="/login" className={styles.loginLink}>
                      Back to Login
                    </Link>
                  </p>
                </div>
              </>
            )}

            {/* ── STEP 2: Verify OTP ── */}
            {step === 'otp' && (
              <>
                <div className={styles.header}>
                  <h1 className={styles.title}>Enter Verification Code</h1>
                  <p className={styles.subtitle}>
                    We sent a 6-digit verification code to <strong style={{ color: '#0f172a' }}>{email}</strong>
                  </p>
                </div>

                {/* OTP Boxes */}
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
                      onKeyDown={(e) => handleDigitKey(i, e)}
                      onPaste={i === 0 ? handlePaste : undefined}
                      className={`${styles.otpBox} ${d ? styles.otpBoxFilled : ''}`}
                    />
                  ))}
                </div>

                {error && (
                  <div className={styles.errorBox} role="alert">
                    <i className="fa-solid fa-circle-exclamation" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className={styles.successBox} role="status">
                    <i className="fa-solid fa-circle-check" />
                    <span>{success}</span>
                  </div>
                )}

                <button
                  type="button"
                  className={styles.btnLogin}
                  onClick={handleVerifyOTP}
                  disabled={loading || digits.join('').length < 6}
                  style={{ marginTop: 8 }}
                >
                  {loading ? (
                    <>
                      <Spinner size={16} /> Verifying…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-circle-check" /> Verify Code
                    </>
                  )}
                </button>

                {/* Resend & Change Email Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={resendCooldown > 0 || loading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: resendCooldown > 0 ? '#94a3b8' : '#1d4ed8',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <i className="fa-solid fa-rotate-right" />
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Didn't receive code? Resend"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setDigits(['', '', '', '', '', '']);
                      setError('');
                      setSuccess('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ← Change email address
                  </button>
                </div>

                <div className={styles.footerNote} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                  <p>
                    <Link href="/login" className={styles.loginLink}>
                      ← Back to Login
                    </Link>
                  </p>
                </div>
              </>
            )}

            {/* ── STEP 3: Set New Password ── */}
            {step === 'password' && (
              <>
                <div className={styles.header}>
                  <h1 className={styles.title}>Set New Password</h1>
                  <p className={styles.subtitle}>
                    Enter your new secure password below to complete recovery.
                  </p>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="new-pass">
                    New Password
                  </label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-lock" />
                    <input
                      id="new-pass"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      value={newPass}
                      onChange={(e) => {
                        setNewPass(e.target.value);
                        setError('');
                      }}
                      className={styles.input}
                      autoFocus
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      <i className={`fa-regular ${showPass ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="confirm-pass">
                    Confirm New Password
                  </label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-lock" />
                    <input
                      id="confirm-pass"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Re-enter your new password"
                      value={confirmPass}
                      onChange={(e) => {
                        setConfirmPass(e.target.value);
                        setError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                      className={styles.input}
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      <i className={`fa-regular ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                {error && (
                  <div className={styles.errorBox} role="alert">
                    <i className="fa-solid fa-circle-exclamation" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className={styles.successBox} role="status">
                    <i className="fa-solid fa-circle-check" />
                    <span>{success}</span>
                  </div>
                )}

                <button
                  type="button"
                  className={styles.btnLogin}
                  onClick={handleResetPassword}
                  disabled={loading || !newPass || !confirmPass}
                  style={{ marginTop: 8 }}
                >
                  {loading ? (
                    <>
                      <Spinner size={16} /> Updating Password…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-key" /> Update Password
                    </>
                  )}
                </button>

                <div className={styles.footerNote}>
                  <p>
                    <Link href="/login" className={styles.loginLink}>
                      ← Back to Login
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
