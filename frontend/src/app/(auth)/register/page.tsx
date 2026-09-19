'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { registerThunk, clearError, getRoleRedirect } from '@/store/authSlice';
import { showToast } from '@/store/toastSlice';
import { Spinner } from '@/components/shared/Loader';
import { apiRequest } from '@/lib/api';
import styles from './register.module.css';

type SchoolType = 'Primary' | 'Secondary' | 'Higher_Secondary' | '';

interface FormData {
  school_name:      string;
  city:             string;
  state:            string;
  country:          string;
  phone:            string;
  email:            string;
  owner_full_name:  string;
  password:         string;
  confirm_password: string;
  school_type:      SchoolType;
  established_year: string;
  timezone:         string;
  calendar_system:  'AD' | 'BS';
}

const FEATURE_PILLS = [
  { icon: 'fa-users',               label: 'Student Management' },
  { icon: 'fa-file-invoice-dollar', label: 'Fee & Finance' },
  { icon: 'fa-calendar-check',      label: 'Attendance & Reports' },
];

const GLOBAL_TIMEZONES = [
  { value: 'UTC',                    label: 'UTC — Universal Coordinated Time (UTC +0:00)' },
  { value: 'America/New_York',       label: 'America/New York — Eastern Time (EST/EDT -5:00)' },
  { value: 'America/Chicago',        label: 'America/Chicago — Central Time (CST/CDT -6:00)' },
  { value: 'America/Denver',         label: 'America/Denver — Mountain Time (MST/MDT -7:00)' },
  { value: 'America/Los_Angeles',    label: 'America/Los Angeles — Pacific Time (PST/PDT -8:00)' },
  { value: 'Europe/London',          label: 'Europe/London — UK / Ireland (GMT/BST +0:00)' },
  { value: 'Europe/Paris',           label: 'Europe/Paris — Central Europe (CET/CEST +1:00)' },
  { value: 'Asia/Dubai',             label: 'Asia/Dubai — UAE / Gulf (GST +4:00)' },
  { value: 'Asia/Riyadh',            label: 'Asia/Riyadh — Saudi Arabia (AST +3:00)' },
  { value: 'Asia/Karachi',           label: 'Asia/Karachi — Pakistan (PKT +5:00)' },
  { value: 'Asia/Kolkata',           label: 'Asia/Kolkata — India / Sri Lanka (IST +5:30)' },
  { value: 'Asia/Kathmandu',         label: 'Asia/Kathmandu — Nepal (NPT +5:45)' },
  { value: 'Asia/Dhaka',             label: 'Asia/Dhaka — Bangladesh (BST +6:00)' },
  { value: 'Asia/Bangkok',           label: 'Asia/Bangkok — Thailand / Vietnam (ICT +7:00)' },
  { value: 'Asia/Singapore',         label: 'Asia/Singapore — Singapore / Malaysia (SGT +8:00)' },
  { value: 'Asia/Shanghai',          label: 'Asia/Shanghai — China (CST +8:00)' },
  { value: 'Asia/Tokyo',             label: 'Asia/Tokyo — Japan (JST +9:00)' },
  { value: 'Australia/Sydney',       label: 'Australia/Sydney — Eastern Australia (AEST +10:00)' },
  { value: 'Africa/Cairo',           label: 'Africa/Cairo — Egypt (EET +2:00)' },
  { value: 'Africa/Lagos',           label: 'Africa/Lagos — Nigeria / West Africa (WAT +1:00)' },
];

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'India',
  'Nepal', 'United Arab Emirates', 'Saudi Arabia', 'Singapore', 'Malaysia',
  'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Sweden',
  'Pakistan', 'Bangladesh', 'Sri Lanka', 'Bhutan', 'South Africa',
  'Nigeria', 'Kenya', 'Philippines', 'Indonesia', 'Japan', 'South Korea',
  'Brazil', 'Mexico', 'Other',
];

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [step, setStep]                = useState(1);
  const [showPassword, setShowPw]      = useState(false);
  const [showConfirm,  setShowConfirm] = useState(false);
  const [localError, setLocalError]    = useState('');
  const [otpSending, setOtpSending]    = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otp, setOtp]                  = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [form, setForm] = useState<FormData>({
    school_name: '', city: '', state: '', country: 'United States',
    phone: '', email: '',
    owner_full_name: '', password: '', confirm_password: '',
    school_type: '', established_year: '',
    timezone: 'America/New_York',
    calendar_system: 'AD',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-set calendar system based on country
      if (name === 'country') {
        updated.calendar_system = value === 'Nepal' ? 'BS' : 'AD';
      }
      return updated;
    });
    setLocalError('');
    if (error) dispatch(clearError());
  };

  // ── Step 1 validation: Account Setup ──
  const validateStep1 = () => {
    if (!form.owner_full_name || !form.phone || !form.email || !form.password || !form.confirm_password) {
      setLocalError('Please fill in all required fields.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setLocalError('Please enter a valid email address.');
      return false;
    }
    if (form.password !== form.confirm_password) {
      setLocalError('Passwords do not match.');
      return false;
    }
    if (form.password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  // ── Step 2 validation: School Info ──
  const validateStep2 = () => {
    if (!form.school_name || !form.city || !form.state || !form.country || !form.school_type) {
      setLocalError('Please fill in all required fields.');
      return false;
    }
    return true;
  };

  // ── OTP input handlers ──
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setLocalError('');
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    const next = [...otp];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  // ── Send OTP ──
  const sendOTP = async () => {
    if (!validateStep2()) return;
    setOtpSending(true);
    setLocalError('');
    try {
      await apiRequest('/auth/register/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: form.email }),
      });
      setStep(3);
      setOtp(['', '', '', '', '', '']);
      // Start 60s resend cooldown
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
      dispatch(showToast({ type: 'info', title: 'OTP Sent', message: `Verification code sent to ${form.email}` }));
    } catch (err: any) {
      setLocalError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  // ── Resend OTP ──
  const resendOTP = async () => {
    if (resendCooldown > 0) return;
    setOtpSending(true);
    setLocalError('');
    try {
      await apiRequest('/auth/register/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: form.email }),
      });
      setOtp(['', '', '', '', '', '']);
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
      dispatch(showToast({ type: 'info', title: 'OTP Resent', message: 'A new code has been sent.' }));
    } catch (err: any) {
      setLocalError(err.message || 'Failed to resend OTP.');
    } finally {
      setOtpSending(false);
    }
  };

  // ── Verify OTP + Register ──
  const handleVerifyAndRegister = async () => {
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      setLocalError('Please enter the complete 6-digit code.');
      return;
    }
    setOtpVerifying(true);
    setLocalError('');
    try {
      // Step 1: verify OTP
      await apiRequest('/auth/register/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, otp: otpCode }),
      });
      // Step 2: register school
      const payload = {
        school_name:      form.school_name,
        city:             form.city,
        state:            form.state,
        country:          form.country,
        phone:            form.phone,
        email:            form.email,
        owner_full_name:  form.owner_full_name,
        password:         form.password,
        school_type:      form.school_type,
        established_year: form.established_year ? Number(form.established_year) : undefined,
        timezone:         form.timezone,
        calendar_system:  form.calendar_system,
      };
      const result = await dispatch(registerThunk(payload));
      if (registerThunk.fulfilled.match(result)) {
        const user = result.payload as any;
        dispatch(showToast({
          type: 'success',
          title: 'School registered successfully!',
          message: `Welcome to Skoolio, ${user.school_name || user.data?.school?.school_name}!`,
        }));
        router.push(getRoleRedirect(user.role));
      }
    } catch (err: any) {
      setLocalError(err.message || 'Verification failed. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const displayError = localError || error;
  const isSubmitting = loading || otpVerifying;

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ── LEFT: Illustration & Brand ── */}
        <div className={styles.leftPanel}>
          <div className={styles.illustrationCard}>
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
            <div className={styles.illustrationWrapper}>
              <Image
                src="/register-img.png"
                alt="School Registration"
                width={660}
                height={440}
                priority
                className={styles.illustrationImg}
              />
            </div>
            <div className={styles.featurePills}>
              {FEATURE_PILLS.map((p) => (
                <span className={styles.featurePill} key={p.label}>
                  <i className={`fa-solid ${p.icon}`} />
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Form ── */}
        <div className={styles.rightPanel}>
          <div className={styles.card}>

            <div className={styles.header}>
              <h1 className={styles.title}>Register Your School</h1>
              <p className={styles.subtitle}>Get started with Skoolio in minutes</p>
            </div>

            {/* ── Stepper ── */}
            <div className={styles.stepper}>
              {/* Step 1 */}
              <div className={`${styles.stepItem} ${step >= 1 ? styles.active : ''} ${step > 1 ? styles.done : ''}`}>
                <div className={styles.stepDot}>
                  {step > 1 ? <i className="fa-solid fa-check" /> : '1'}
                </div>
                <span className={styles.stepLabel}>Account</span>
              </div>
              <div className={`${styles.stepConnector} ${step >= 2 ? styles.filled : ''}`} />
              {/* Step 2 */}
              <div className={`${styles.stepItem} ${step >= 2 ? styles.active : ''} ${step > 2 ? styles.done : ''}`}>
                <div className={styles.stepDot}>
                  {step > 2 ? <i className="fa-solid fa-check" /> : '2'}
                </div>
                <span className={styles.stepLabel}>School Info</span>
              </div>
              <div className={`${styles.stepConnector} ${step >= 3 ? styles.filled : ''}`} />
              {/* Step 3 */}
              <div className={`${styles.stepItem} ${step >= 3 ? styles.active : ''}`}>
                <div className={styles.stepDot}>3</div>
                <span className={styles.stepLabel}>Verify</span>
              </div>
            </div>

            {/* ════════════════════════════════════
                STEP 1 — Account Setup
                ════════════════════════════════════ */}
            {step === 1 && (
              <div className={styles.stepWrap} key="step1">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Account Setup</h2>
                  <p className={styles.sectionSubtitle}>Create your administrator credentials</p>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    Owner Full Name <span className={styles.required}>*</span>
                  </label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-user" />
                    <input
                      type="text" name="owner_full_name"
                      placeholder="Your full name"
                      value={form.owner_full_name}
                      onChange={handleChange}
                      className={styles.input}
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Phone <span className={styles.required}>*</span>
                    </label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-phone" />
                      <input
                        type="tel" name="phone"
                        placeholder="9841234567"
                        value={form.phone}
                        onChange={handleChange}
                        className={styles.input}
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Email <span className={styles.required}>*</span>
                    </label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-envelope" />
                      <input
                        type="email" name="email"
                        placeholder="school@email.com"
                        value={form.email}
                        onChange={handleChange}
                        className={styles.input}
                        autoComplete="email"
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    Password <span className={styles.required}>*</span>
                  </label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-lock" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Min. 6 characters"
                      value={form.password}
                      onChange={handleChange}
                      className={styles.input}
                      autoComplete="new-password"
                    />
                    <button type="button" className={styles.eyeBtn}
                      onClick={() => setShowPw(!showPassword)}
                      aria-label={showPassword ? 'Hide' : 'Show'}>
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    Confirm Password <span className={styles.required}>*</span>
                  </label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-lock" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      name="confirm_password"
                      placeholder="Re-enter password"
                      value={form.confirm_password}
                      onChange={handleChange}
                      className={styles.input}
                      autoComplete="new-password"
                    />
                    <button type="button" className={styles.eyeBtn}
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide' : 'Show'}>
                      <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                {displayError && (
                  <div className={styles.errorBox} role="alert">
                    <i className="fa-solid fa-circle-exclamation" />
                    <span>{displayError}</span>
                  </div>
                )}

                <button className={styles.btnPrimary} onClick={() => { if (validateStep1()) { setStep(2); setLocalError(''); } }}>
                  Continue <i className="fa-solid fa-arrow-right" />
                </button>
              </div>
            )}

            {/* ════════════════════════════════════
                STEP 2 — School Information
                ════════════════════════════════════ */}
            {step === 2 && (
              <div className={styles.stepWrap} key="step2">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>School Information</h2>
                  <p className={styles.sectionSubtitle}>Tell us about your school</p>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    School Name <span className={styles.required}>*</span>
                  </label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-school" />
                    <input
                      type="text" name="school_name"
                      placeholder="e.g. Springfield Public School"
                      value={form.school_name}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      School Type <span className={styles.required}>*</span>
                    </label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-layer-group" />
                      <select name="school_type" value={form.school_type} onChange={handleChange} className={styles.input}>
                        <option value="">Select type</option>
                        <option value="Primary">Primary (1–5)</option>
                        <option value="Secondary">Secondary (6–10)</option>
                        <option value="Higher_Secondary">Higher Secondary (11–12)</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Est. Year <span className={styles.optional}>(optional)</span>
                    </label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-calendar" />
                      <input
                        type="number" name="established_year"
                        placeholder="e.g. 1998"
                        value={form.established_year}
                        onChange={handleChange}
                        className={styles.input}
                        min="1800" max="2030"
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      City <span className={styles.required}>*</span>
                    </label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-city" />
                      <input
                        type="text" name="city" placeholder="City"
                        value={form.city} onChange={handleChange} className={styles.input}
                      />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      State <span className={styles.required}>*</span>
                    </label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-map" />
                      <input
                        type="text" name="state" placeholder="State / Province"
                        value={form.state} onChange={handleChange} className={styles.input}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Country <span className={styles.required}>*</span>
                    </label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-globe" />
                      <select name="country" value={form.country} onChange={handleChange} className={styles.input}>
                        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Timezone <span className={styles.required}>*</span>
                    </label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-clock" />
                      <select name="timezone" value={form.timezone} onChange={handleChange} className={styles.input}>
                        {GLOBAL_TIMEZONES.map((tz) => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Calendar System — only shown for Nepal */}
                {form.country === 'Nepal' && (
                  <div className={styles.field}>
                    <label className={styles.label}>Calendar System</label>
                    <div className={styles.calendarToggle}>
                      <button
                        type="button"
                        className={`${styles.calBtn} ${form.calendar_system === 'BS' ? styles.calBtnActive : ''}`}
                        onClick={() => setForm((f) => ({ ...f, calendar_system: 'BS' }))}
                      >
                        <i className="fa-solid fa-calendar-days" />
                        Bikram Sambat (BS)
                      </button>
                      <button
                        type="button"
                        className={`${styles.calBtn} ${form.calendar_system === 'AD' ? styles.calBtnActive : ''}`}
                        onClick={() => setForm((f) => ({ ...f, calendar_system: 'AD' }))}
                      >
                        <i className="fa-solid fa-earth-asia" />
                        Anno Domini (AD)
                      </button>
                    </div>
                  </div>
                )}

                {displayError && (
                  <div className={styles.errorBox} role="alert">
                    <i className="fa-solid fa-circle-exclamation" />
                    <span>{displayError}</span>
                  </div>
                )}

                <div className={styles.btnRow}>
                  <button className={styles.btnOutline} onClick={() => { setStep(1); setLocalError(''); }}>
                    <i className="fa-solid fa-arrow-left" /> Back
                  </button>
                  <button className={styles.btnPrimary} onClick={sendOTP} disabled={otpSending}>
                    {otpSending
                      ? <><Spinner size={15} /> Sending…</>
                      : <>Send OTP <i className="fa-solid fa-paper-plane" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════
                STEP 3 — OTP Verification
                ════════════════════════════════════ */}
            {step === 3 && (
              <div className={styles.stepWrap} key="step3">
                <div className={styles.sectionHeader}>
                  <div className={styles.otpIcon}>
                    <i className="fa-solid fa-envelope-open-text" />
                  </div>
                  <h2 className={styles.sectionTitle}>Verify Your Email</h2>
                  <p className={styles.sectionSubtitle}>
                    We sent a 6-digit code to <strong>{form.email}</strong>
                  </p>
                </div>

                {/* 6-digit OTP inputs */}
                <div className={styles.otpRow} onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`${styles.otpBox} ${digit ? styles.otpBoxFilled : ''}`}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <div className={styles.otpMeta}>
                  <span className={styles.otpExpiry}>
                    <i className="fa-regular fa-clock" /> Code expires in 10 minutes
                  </span>
                  <button
                    type="button"
                    className={`${styles.resendBtn} ${resendCooldown > 0 ? styles.resendDisabled : ''}`}
                    onClick={resendOTP}
                    disabled={resendCooldown > 0 || otpSending}
                  >
                    {otpSending
                      ? 'Sending…'
                      : resendCooldown > 0
                        ? `Resend in ${resendCooldown}s`
                        : 'Resend Code'}
                  </button>
                </div>

                {displayError && (
                  <div className={styles.errorBox} role="alert">
                    <i className="fa-solid fa-circle-exclamation" />
                    <span>{displayError}</span>
                  </div>
                )}

                <div className={styles.btnRow}>
                  <button className={styles.btnOutline} onClick={() => { setStep(2); setLocalError(''); }}>
                    <i className="fa-solid fa-arrow-left" /> Back
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleVerifyAndRegister}
                    disabled={isSubmitting || otp.join('').length < 6}
                  >
                    {isSubmitting
                      ? <><Spinner size={15} /> Verifying…</>
                      : <>Verify & Register <i className="fa-solid fa-check" /></>}
                  </button>
                </div>

                <p className={styles.otpNote}>
                  Didn&apos;t receive the email? Check your spam folder or go{' '}
                  <button type="button" className={styles.linkBtn} onClick={() => { setStep(2); setLocalError(''); }}>
                    back to edit email
                  </button>
                </p>
              </div>
            )}

            <div className={styles.footerNote}>
              <p>
                Already registered?{' '}
                <Link href="/login" className={styles.loginLink}>
                  Sign in to your school
                </Link>
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
