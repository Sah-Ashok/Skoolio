'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loginThunk, clearError, getRoleRedirect } from '@/store/authSlice';
import { showToast } from '@/store/toastSlice';
import { Spinner } from '@/components/shared/Loader';
import styles from './student-login.module.css';

export default function StudentLoginPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [showPassword, setShowPw]   = useState(false);
  const [localError,   setLocalError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });

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
      router.push(getRoleRedirect(payload.role));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const displayError = localError || error;

  return (
    <div className={styles.page}>

      {/* ── Left: image panel ── */}
      <div className={styles.left}>
        <img
          src="https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=1200&auto=format&fit=crop&q=80"
          alt="Students learning"
          className={styles.bgImg}
        />
        <div className={styles.overlay} />
        <div className={styles.leftContent}>

          {/* Floating feature cards */}
          <div className={styles.featureCards}>
            {[
              { icon: 'fa-chart-column',        title: 'Attendance',    sub: 'Track your daily attendance'  },
              { icon: 'fa-file-circle-check',   title: 'Results',       sub: 'View exam marks & grades'     },
              { icon: 'fa-file-invoice-dollar', title: 'Fee Status',    sub: 'Check payments & dues'        },
              { icon: 'fa-bullhorn',            title: 'Notices',       sub: 'Stay updated with school news' },
            ].map(f => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <i className={`fa-solid ${f.icon}`} />
                </div>
                <div>
                  <div className={styles.featureTitle}>{f.title}</div>
                  <div className={styles.featureSub}>{f.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.quote}>
            <span className={styles.quoteIcon}>"</span>
            <p>Education is the passport to the future, for tomorrow belongs to those who prepare for it today.</p>
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
              <span className={styles.logoSub}>Student Portal</span>
            </div>
          </div>

          {/* Student badge */}
          <div className={styles.portalBadge}>
            <div className={styles.portalBadgeIcon}>
              <i className="fa-solid fa-user-graduate" />
            </div>
            <div>
              <div className={styles.portalBadgeTitle}>Student Login</div>
              <div className={styles.portalBadgeSub}>Access your personal academic dashboard</div>
            </div>
          </div>

          <h2 className={styles.heading}>Sign in to Student Portal</h2>

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
                tabIndex={-1}
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

          {/* Staff portal link */}
          <Link href="/login" className={styles.staffPortal}>
            <i className="fa-solid fa-school" />
            <span>Admin / Faculty Portal</span>
            <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, marginLeft: 'auto' }} />
          </Link>

          {/* Help text */}
          <p className={styles.helpText}>
            <i className="fa-solid fa-circle-info" />
            Your login credentials are provided by your school. Contact your admin if you need help.
          </p>
        </div>
      </div>
    </div>
  );
}
