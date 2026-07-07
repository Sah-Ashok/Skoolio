'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loginThunk, clearError, getRoleRedirect, LoginRole } from '@/store/authSlice';
import { showToast } from '@/store/toastSlice';
import { Spinner } from '@/components/shared/Loader';
import styles from './login.module.css';

const roleConfig: Record<LoginRole, { label: string; placeholder: string; icon: string }> = {
  admin: { label: 'School Admin', placeholder: 'school@email.com', icon: 'fa-school' },
  faculty: { label: 'Faculty', placeholder: 'teacher@email.com', icon: 'fa-chalkboard-teacher' },
  student: { label: 'Student', placeholder: 'student@email.com', icon: 'fa-user-graduate' },
};

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [loginRole, setLoginRole] = useState<LoginRole>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [localError, setLocalError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setLocalError('');
    if (error) dispatch(clearError());
  };

  const switchRole = (role: LoginRole) => {
    setLoginRole(role);
    setLocalError('');
    if (error) dispatch(clearError());
  };

  const handleSubmit = async () => {
    if (!form.email || !form.password) {
      setLocalError('Please enter your email and password.');
      return;
    }

    const result = await dispatch(loginThunk({ ...form, loginRole }));

    if (loginThunk.fulfilled.match(result)) {
      const payload = result.payload as any;

      // 2FA required — redirect to verification page
      if (payload?.requires_2fa) {
        dispatch(showToast({
          type: 'info',
          title: '2FA Required',
          message: 'A verification code has been sent to your email.',
        }));
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

      {/* ── Left decorative panel ── */}
      <div className={styles.left}>
        <div className={styles.bgOrbs}>
          <div className={styles.orb1} />
          <div className={styles.orb2} />
          <div className={styles.orb3} />
        </div>
        <div className={styles.leftInner}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>
              <i className="fa-solid fa-graduation-cap" />
            </div>
            <div>
              <h1>CampusPOS</h1>
              <p>School Management Suite</p>
            </div>
          </div>

          <div className={styles.hero}>
            <img
              src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=640&auto=format&fit=crop&q=80"
              alt="School campus"
              className={styles.heroImg}
            />
            <div className={styles.heroOverlay}>
              <p className={styles.heroQuote}>
                "Empowering educators with smarter tools for a brighter tomorrow."
              </p>
            </div>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <h3>500+</h3>
              <p>Schools</p>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <h3>50K+</h3>
              <p>Students</p>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <h3>99.9%</h3>
              <p>Uptime</p>
            </div>
          </div>

          <div className={styles.trustBadges}>
            <div className={styles.badge}><i className="fa-solid fa-shield-halved" /> Secure &amp; Encrypted</div>
            <div className={styles.badge}><i className="fa-solid fa-bolt" /> Real-time Sync</div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className={styles.right}>
        <div className={styles.formCard}>

          <div className={styles.formHeader}>
            <div className={styles.welcomeIcon}>
              <i className={`fa-solid ${roleConfig[loginRole].icon}`} />
            </div>
            <h2>Welcome back</h2>
            <p>Sign in as {roleConfig[loginRole].label.toLowerCase()}</p>
          </div>

          <div className={styles.formBody}>

            {/* Email */}
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="email">Email Address</label>
              <div className={styles.inputWrap}>
                <i className="fa-solid fa-envelope" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder={roleConfig[loginRole].placeholder}
                  value={form.email}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  className={styles.input}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="password">Password</label>
                <Link href="/forgot-password" className={styles.forgotLink}>
                  Forgot password?
                </Link>
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
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
            </div>

            {/* Error */}
            {displayError && (
              <div className={styles.error} role="alert">
                <i className="fa-solid fa-circle-exclamation" />
                <span>{displayError}</span>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit-btn"
              className={styles.btnPrimary}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <><Spinner size={16} /> Signing in…</>
                : <><i className="fa-solid fa-right-to-bracket" /> Sign In</>
              }
            </button>

            <div className={styles.divider}><span>or sign in as</span></div>

            <div className={styles.roleGrid}>
              <button
                id="faculty-login-btn"
                type="button"
                className={styles.roleBtn}
                style={loginRole === 'faculty' ? { borderColor: '#FF9B51', background: '#fff7ed', color: '#25343F' } : undefined}
                onClick={() => switchRole('faculty')}
              >
                <i className="fa-solid fa-chalkboard-teacher" />
                <span>Faculty</span>
              </button>
              <button
                id="student-login-btn"
                type="button"
                className={styles.roleBtn}
                style={loginRole === 'student' ? { borderColor: '#FF9B51', background: '#fff7ed', color: '#25343F' } : undefined}
                onClick={() => switchRole('student')}
              >
                <i className="fa-solid fa-user-graduate" />
                <span>Student</span>
              </button>
            </div>

            {loginRole !== 'admin' && (
              <button type="button" onClick={() => switchRole('admin')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', marginTop: '-4px' }}>
                <i className="fa-solid fa-arrow-left" /> Back to Admin login
              </button>
            )}
          </div>

          <p className={styles.registerLink}>
            New school? <Link href="/register">Register your school</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
