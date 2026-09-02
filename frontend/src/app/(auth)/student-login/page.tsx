'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loginThunk, meThunk, clearError, getRoleRedirect } from '@/store/authSlice';
import { showToast } from '@/store/toastSlice';
import { Spinner } from '@/components/shared/Loader';
import styles from './student-login.module.css';



export default function StudentLoginPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [showPassword, setShowPw]   = useState(false);
  const [localError, setLocalError] = useState('');
  const [form, setForm]             = useState({ email: '', password: '' });

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
    const result = await dispatch(loginThunk({ ...form, loginRole: 'student' }));
    if (loginThunk.fulfilled.match(result)) {
      const payload = result.payload as any;
      dispatch(showToast({
        type:    'success',
        title:   `Welcome, ${payload.full_name || 'Student'}!`,
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

        {/* ── LEFT: Illustration & Brand ── */}
        <div className={styles.leftPanel}>
          <div className={styles.illustrationCard}>

            {/* Logo */}
            <div className={styles.brandHeader}>
              <Link href="/" aria-label="Skoolio — Home" className={styles.brandLink}>
                <Image
                  src="/Logo.png"
                  alt="Skoolio"
                  width={220}
                  height={75}
                  priority
                  style={{ objectFit: 'contain' }}
                />
              </Link>
            </div>

            {/* Illustration */}
            <div className={styles.illustrationWrapper}>
              <Image
                src="/student-login.png"
                alt="Student Portal Illustration"
                width={660}
                height={440}
                priority
                className={styles.illustrationImg}
              />
            </div>

      
          </div>
        </div>

        {/* ── RIGHT: Form ── */}
        <div className={styles.rightPanel}>
          <div className={styles.card}>


            {/* Header */}
            <div className={styles.header}>
              <h1 className={styles.title}>Welcome Back!</h1>
              <p className={styles.subtitle}>Sign in to your student account</p>
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
                  placeholder="student@email.com"
                  value={form.email}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  className={styles.input}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
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

            {/* Divider */}
            <div className={styles.divider}><span>or</span></div>

       

            {/* Help text */}
            <p className={styles.helpText}>
              <i className="fa-solid fa-circle-info" />
              Your login credentials are provided by your school. Contact your admin if you need help.
            </p>

          </div>
        </div>

      </div>
    </div>
  );
}
