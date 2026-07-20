'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loginThunk, clearError, getRoleRedirect, LoginRole } from '@/store/authSlice';
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
      router.push(getRoleRedirect(payload.role));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const displayError = localError || error;

  return (
    <div className={styles.page}>

      {/* ── Left: full-bleed image ── */}
      <div className={styles.left}>
        <img
          src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1200&auto=format&fit=crop&q=80"
          alt="School"
          className={styles.bgImg}
        />
        <div className={styles.overlay} />
        <div className={styles.leftContent}>
          <div className={styles.quote}>
            <span className={styles.quoteIcon}>"</span>
            <p>Empowering educators with smarter tools for a brighter tomorrow.</p>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}><strong>500+</strong><span>Schools</span></div>
            <div className={styles.statDiv} />
            <div className={styles.stat}><strong>50K+</strong><span>Students</span></div>
            <div className={styles.statDiv} />
            <div className={styles.stat}><strong>99.9%</strong><span>Uptime</span></div>
          </div>
        </div>
      </div>

      {/* ── Right: form ── */}
      <div className={styles.right}>
        <div className={styles.card}>

          {/* Logo */}
          <div className={styles.logoWrap}>
            <Image src="/Logo.png" alt="Skoolio" width={52} height={52} className={styles.logo} />
            <div className={styles.logoText}>
              <span className={styles.logoName}>Skoolio</span>
              <span className={styles.logoSub}>School Management Suite</span>
            </div>
          </div>

          <h2 className={styles.heading}>Sign in to your account</h2>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'admin' ? styles.tabActive : ''}`}
              onClick={() => switchTab('admin')}
            >
              <i className="fa-solid fa-school" />
              Admin
            </button>
            <button
              className={`${styles.tab} ${tab === 'faculty' ? styles.tabActive : ''}`}
              onClick={() => switchTab('faculty')}
            >
              <i className="fa-solid fa-chalkboard-teacher" />
              Faculty
            </button>
          </div>

          {/* Email */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email Address</label>
            <div className={styles.inputWrap}>
              <i className="fa-solid fa-envelope" />
              <input
                id="email"
                type="email"
                name="email"
                placeholder={tab === 'admin' ? 'school@email.com' : 'teacher@email.com'}
                value={form.email}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                className={styles.input}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="password">Password</label>
              <Link href="/forgot-password" className={styles.forgot}>Forgot password?</Link>
            </div>
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
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(!showPassword)}>
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
          </div>

          {/* Error */}
          {displayError && (
            <div className={styles.errorBox} role="alert">
              <i className="fa-solid fa-circle-exclamation" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Submit */}
          <button
            className={styles.btnPrimary}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <><Spinner size={16} /> Signing in…</>
              : <>Sign In <i className="fa-solid fa-arrow-right" /></>
            }
          </button>

          {/* Student portal link */}
          <div className={styles.studentPortal}>
            <i className="fa-solid fa-user-graduate" />
            <span>Student? </span>
            <Link href="/student-login">Access Student Portal</Link>
          </div>

          <p className={styles.registerLink}>
            New school? <Link href="/register">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
