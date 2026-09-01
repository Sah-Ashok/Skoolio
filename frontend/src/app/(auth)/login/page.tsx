'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loginThunk, meThunk, clearError, getRoleRedirect, LoginRole } from '@/store/authSlice';
import { showToast } from '@/store/toastSlice';
import { Spinner } from '@/components/shared/Loader';
import styles from './login.module.css';

type Tab = 'admin' | 'faculty';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [tab, setTab]             = useState<Tab>('admin');
  const [showPassword, setShowPw] = useState(false);
  const [form, setForm]           = useState({ email: '', password: '' });
  const [localError, setLocalError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setLocalError('');
    if (error) dispatch(clearError());
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setLocalError('');
    if (error) dispatch(clearError());
  };

  const handleSubmit = async () => {
    if (!form.email || !form.password) {
      setLocalError('Please enter your email and password.');
      return;
    }

    const loginRole: LoginRole = tab === 'admin' ? 'admin' : 'faculty';
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
        title: `Welcome back, ${payload.full_name || payload.school_name}!`,
        message: 'Redirecting to your dashboard…',
      }));
      await dispatch(meThunk());
      router.push(getRoleRedirect(payload.role));
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
            
               {/* Top-Left Brand Logo & Tagline */}
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
                alt="School Management Illustration"
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
              <h1 className={styles.title}>Welcome Back!</h1>
              <p className={styles.subtitle}>Login to your Skoolio account</p>
            </div>

            {/* Role Switcher */}
            <div className={styles.roleSection}>
              <span className={styles.roleLabel}>Login as</span>
              <div className={styles.roleTabs}>
                <button
                  type="button"
                  className={`${styles.roleTab} ${tab === 'admin' ? styles.roleTabActive : ''}`}
                  onClick={() => switchTab('admin')}
                >
                  <i className="fa-solid fa-user" />
                  <span>Admin</span>
                </button>
                <button
                  type="button"
                  className={`${styles.roleTab} ${tab === 'faculty' ? styles.roleTabActive : ''}`}
                  onClick={() => switchTab('faculty')}
                >
                  <i className="fa-solid fa-chalkboard-user" />
                  <span>Faculty</span>
                </button>
              </div>
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
                  placeholder="Enter your email or username"
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
            >
              {loading ? (
                <>
                  <Spinner size={16} /> Logging in…
                </>
              ) : (
                'Login'
              )}
            </button>

            {/* Footer Links */}
            <div className={styles.footerNote}>
              <p>
                Don&apos;t have an account?{' '}
                <Link href="/register" className={styles.registerLink}>
                  Register School
                </Link>
              </p>
              <p className={styles.studentNote}>
                Student?{' '}
                <Link href="/student-login" className={styles.studentLink}>
                  Access Student Portal
                </Link>
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
