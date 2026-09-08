'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loginThunk, meThunk, clearError, getRoleRedirect, LoginRole } from '@/store/authSlice';
import { showToast } from '@/store/toastSlice';
import { Spinner } from '@/components/shared/Loader';
import styles from '../login/login.module.css';

export default function FinanceLoginPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [showPassword, setShowPw] = useState(false);
  const [form, setForm]           = useState({ email: '', password: '' });
  const [localError, setLocalError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setLocalError('');
    if (error) dispatch(clearError());
  };

  const handleSubmit = async () => {
    if (!form.email || !form.password) {
      setLocalError('Please enter your email and password.');
      return;
    }

    const loginRole: LoginRole = 'finance';
    const result = await dispatch(loginThunk({ ...form, loginRole }));

    if (loginThunk.fulfilled.match(result)) {
      const payload = result.payload as any;

      if (payload?.requires_2fa) {
        dispatch(showToast({ type: 'info', title: '2FA Required', message: 'A verification code has been sent to your email.' }));
        router.push('/login/2fa');
        return;
      }

      dispatch(showToast({
        type: 'success',
        title: `Welcome back, ${payload.full_name || payload.school_name || 'Finance Manager'}!`,
        message: 'Redirecting to your finance dashboard…',
      }));
      await dispatch(meThunk());
      router.push(getRoleRedirect(payload.role || 'finance'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const displayError = localError || error;

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ── Left: Illustration & Logo ── */}
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
                src="/Login-page-image.png"
                alt="School Finance Management Illustration"
                width={660}
                height={440}
                priority
                className={styles.illustrationImg}
              />
            </div>

          </div>
        </div>

        {/* ── Right: Auth Card ── */}
        <div className={styles.rightPanel}>
          <div className={styles.card}>
            
            {/* Header */}
            <div className={styles.header}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 12,
              }}>
                <i className="fa-solid fa-shield-halved" />
                <span>Finance Staff Portal</span>
              </div>
              <h1 className={styles.title}>Finance Login</h1>
              <p className={styles.subtitle}>Sign in to manage fees, billing, expenses &amp; payroll</p>
            </div>

            {/* Email / Username Field */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email or Username</label>
              <div className={styles.inputWrap}>
                <i className="fa-regular fa-user" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="Enter your finance account email"
                  value={form.email}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  className={styles.input}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">Password</label>
              <div className={styles.inputWrap}>
                <i className="fa-solid fa-lock" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  className={styles.input}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPw(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
              <div className={styles.forgotWrap}>
                <Link href="/forgot-password" className={styles.forgot}>
                  Forgot Password?
                </Link>
              </div>
            </div>

            {/* Error Message */}
            {displayError && (
              <div className={styles.errorBox} role="alert">
                <i className="fa-solid fa-circle-exclamation" />
                <span>{displayError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              className={styles.btnLogin}
              onClick={handleSubmit}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
                boxShadow: '0 4px 14px rgba(13, 148, 136, 0.35)',
              }}
            >
              {loading ? (
                <>
                  <Spinner size={16} /> Logging in…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-arrow-right-to-bracket" style={{ marginRight: 6 }} />
                  Access Finance Portal
                </>
              )}
            </button>

            {/* Footer Links */}
            <div className={styles.footerNote}>
              <p>
                Admin or Faculty?{' '}
                <Link href="/login" className={styles.registerLink}>
                  General Login
                </Link>
              </p>
              <p className={styles.studentNote}>
                Student?{' '}
                <Link href="/student-login" className={styles.studentLink}>
                  Student Portal
                </Link>
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
