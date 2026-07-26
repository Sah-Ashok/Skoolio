'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { registerThunk, clearError, getRoleRedirect } from '@/store/authSlice';
import { showToast } from '@/store/toastSlice';
import { Spinner } from '@/components/shared/Loader';
import styles from './register.module.css';

type SchoolType = 'Primary' | 'Secondary' | 'Higher_Secondary' | '';

interface FormData {
  school_name: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone: string;
  email: string;
  owner_full_name: string;
  password: string;
  confirm_password: string;
  school_type: SchoolType;
  established_year: string;
  timezone: string;
}

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [localError, setLocalError] = useState('');

  const [form, setForm] = useState<FormData>({
    school_name: '', city: '', state: '', country: 'Nepal',
    pincode: '', phone: '', email: '',
    owner_full_name: '', password: '', confirm_password: '',
    school_type: '', established_year: '', timezone: 'Asia/Kathmandu',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setLocalError('');
    if (error) dispatch(clearError());
  };

  const validateStep1 = () => {
    if (!form.school_name || !form.city || !form.state || !form.country || !form.school_type) {
      setLocalError('Please fill in all required fields.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!form.owner_full_name || !form.phone || !form.email || !form.password || !form.confirm_password) {
      setLocalError('Please fill in all required fields.');
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

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    const payload = {
      school_name:      form.school_name,
      city:             form.city,
      state:            form.state,
      country:          form.country,
      pincode:          form.pincode || undefined,
      phone:            form.phone,
      email:            form.email,
      owner_full_name:  form.owner_full_name,
      password:         form.password,
      school_type:      form.school_type,
      established_year: form.established_year ? Number(form.established_year) : undefined,
      timezone:         form.timezone,
    };

    const result = await dispatch(registerThunk(payload));

    if (registerThunk.fulfilled.match(result)) {
      const user = result.payload;
      dispatch(showToast({
        type: 'success',
        title: 'School registered successfully!',
        message: `Welcome to CampusPOS, ${user.school_name}!`,
      }));
      router.push(getRoleRedirect(user.role));
    } else {
      dispatch(showToast({
        type: 'error',
        title: 'Registration failed',
        message: (result.payload as string) || 'Please try again.',
      }));
    }
  };

  const displayError = localError || error;

  return (
    <div className={styles.page}>

      {/* ── Left panel ── */}
      <div className={styles.left}>
        <div className={styles.bgOrbs}>
          <div className={styles.orb1} />
          <div className={styles.orb2} />
        </div>
        <div className={styles.leftInner}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}><i className="fa-solid fa-graduation-cap" /></div>
            <div>
              <h1>CampusPOS</h1>
              <p>School Management Suite</p>
            </div>
          </div>

          <div className={styles.hero}>
            <img
              src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=640&auto=format&fit=crop&q=80"
              alt="School management"
              className={styles.heroImg}
            />
          </div>

          <div className={styles.features}>
            {[
              { icon: 'fa-users',        title: 'Student Management', desc: 'Enroll, track, and manage all student data' },
              { icon: 'fa-file-invoice-dollar', title: 'Fee & Finance',  desc: 'Collect fees, manage expenses & salaries' },
              { icon: 'fa-chart-line',   title: 'Analytics & Reports', desc: 'Real-time insights on your school data' },
            ].map((f) => (
              <div className={styles.feature} key={f.title}>
                <div className={styles.featureIcon}><i className={`fa-solid ${f.icon}`} /></div>
                <div>
                  <h4>{f.title}</h4>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className={styles.tagline}>
            <i className="fa-solid fa-circle-check" /> Trusted by schools across Nepal &amp; India
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className={styles.right}>
        <div className={styles.formCard}>

          {/* Progress stepper */}
          <div className={styles.progress}>
            <div className={`${styles.progressStep} ${step >= 1 ? styles.active : ''} ${step > 1 ? styles.done : ''}`}>
              <div className={styles.progressDot}>
                {step > 1 ? <i className="fa-solid fa-check" /> : '1'}
              </div>
              <span>School Info</span>
            </div>
            <div className={`${styles.progressLine} ${step >= 2 ? styles.activeLine : ''}`} />
            <div className={`${styles.progressStep} ${step >= 2 ? styles.active : ''}`}>
              <div className={styles.progressDot}>2</div>
              <span>Admin Account</span>
            </div>
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className={styles.stepWrap} key="step1">
              <div className={styles.formHeader}>
                <div className={styles.stepIcon}><i className="fa-solid fa-school" /></div>
                <h2>School Information</h2>
                <p>Tell us about your school to get started</p>
              </div>

              <div className={styles.formBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>School Name <span className={styles.required}>*</span></label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-school" />
                    <input type="text" name="school_name" placeholder="e.g. Springfield Public School"
                      value={form.school_name} onChange={handleChange} className={styles.input} />
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>School Type <span className={styles.required}>*</span></label>
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
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Est. Year <span className={styles.optional}>(optional)</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-calendar" />
                      <input type="number" name="established_year" placeholder="e.g. 1998"
                        value={form.established_year} onChange={handleChange} className={styles.input} min="1800" max="2026" />
                    </div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>City <span className={styles.required}>*</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-city" />
                      <input type="text" name="city" placeholder="City" value={form.city} onChange={handleChange} className={styles.input} />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>State <span className={styles.required}>*</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-map" />
                      <input type="text" name="state" placeholder="State / Province" value={form.state} onChange={handleChange} className={styles.input} />
                    </div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Country <span className={styles.required}>*</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-globe" />
                      <select name="country" value={form.country} onChange={handleChange} className={styles.input}>
                        <option value="Nepal">Nepal</option>
                        <option value="India">India</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Timezone <span className={styles.required}>*</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-clock" />
                      <select name="timezone" value={form.timezone} onChange={handleChange} className={styles.input}>
                        <option value="Asia/Kathmandu">Asia/Kathmandu (NPT)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Pincode <span className={styles.optional}>(optional)</span></label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-location-dot" />
                    <input type="text" name="pincode" placeholder="e.g. 44600" value={form.pincode} onChange={handleChange} className={styles.input} />
                  </div>
                </div>

                {displayError && (
                  <div className={styles.error} role="alert">
                    <i className="fa-solid fa-circle-exclamation" /><span>{displayError}</span>
                  </div>
                )}

                <button id="register-next-btn" className={styles.btnPrimary} onClick={handleNext}>
                  Continue <i className="fa-solid fa-arrow-right" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className={styles.stepWrap} key="step2">
              <div className={styles.formHeader}>
                <div className={styles.stepIcon}><i className="fa-solid fa-user-shield" /></div>
                <h2>Admin Account</h2>
                <p>Create your administrator login credentials</p>
              </div>

              <div className={styles.formBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Owner Full Name <span className={styles.required}>*</span></label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-user" />
                    <input type="text" name="owner_full_name" placeholder="Full name"
                      value={form.owner_full_name} onChange={handleChange} className={styles.input} />
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Phone <span className={styles.required}>*</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-phone" />
                      <input type="tel" name="phone" placeholder="e.g. 9841234567"
                        value={form.phone} onChange={handleChange} className={styles.input} />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Email <span className={styles.required}>*</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-envelope" />
                      <input type="email" name="email" placeholder="school@email.com"
                        value={form.email} onChange={handleChange} className={styles.input} />
                    </div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Password <span className={styles.required}>*</span></label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-lock" />
                    <input type={showPassword ? 'text' : 'password'} name="password"
                      placeholder="Min. 6 characters" value={form.password} onChange={handleChange} className={styles.input} />
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Confirm Password <span className={styles.required}>*</span></label>
                  <div className={styles.inputWrap}>
                    <i className="fa-solid fa-lock" />
                    <input type={showConfirm ? 'text' : 'password'} name="confirm_password"
                      placeholder="Re-enter password" value={form.confirm_password} onChange={handleChange} className={styles.input} />
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm(!showConfirm)}>
                      <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                {displayError && (
                  <div className={styles.error} role="alert">
                    <i className="fa-solid fa-circle-exclamation" /><span>{displayError}</span>
                  </div>
                )}

                <div className={styles.btnRow}>
                  <button className={styles.btnOutline} onClick={() => { setStep(1); setLocalError(''); }}>
                    <i className="fa-solid fa-arrow-left" /> Back
                  </button>
                  <button id="register-submit-btn" className={styles.btnPrimary} onClick={handleSubmit} disabled={loading}>
                    {loading
                      ? <><Spinner size={16} /> Registering…</>
                      : <>Register School <i className="fa-solid fa-check" /></>
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className={styles.loginLink}>
            Already registered? <Link href="/login">Sign in to your school</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
