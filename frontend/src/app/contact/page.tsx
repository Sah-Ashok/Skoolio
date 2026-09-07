'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiRequest } from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import AppFooter from '@/components/shared/AppFooter';
import styles from './contact.module.css';
import s from '../landing.module.css';

type Form = {
  name:        string;
  email:       string;
  school_name: string;
  phone:       string;
  subject:     string;
  message:     string;
};

const SUBJECTS = [
  'General Enquiry',
  'Request a Demo',
  'Pricing & Plans',
  'Technical Support',
  'Partnership',
  'Other',
];

const CONTACT_INFO = [
  {
    icon: 'fa-envelope',
    label: 'Email Support',
    value: 'skoolio.support@gmail.com',
    href:  'mailto:skoolio.support@gmail.com',
    color: '#FF9B51',
    bg:    '#fff7ed',
  },
  {
    icon: 'fa-brands fa-whatsapp',
    label: 'WhatsApp Support',
    value: '+977 9713823636',
    href:  'https://wa.me/9779713823636',
    color: '#16a34a',
    bg:    '#f0fdf4',
  },
  {
    icon: 'fa-clock',
    label: 'Response Time',
    value: 'Quick Support (< 2 hrs)',
    href:  null,
    color: '#12805c',
    bg:    '#f0fdf4',
  },
];

export default function ContactPage() {
  const { user, isAuthenticated, bootstrapped } = useAppSelector((st) => st.auth);
  const [form, setForm]       = useState<Form>({ name: '', email: '', school_name: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState('');

  const roleSlug = (user?.role || "school_admin").toLowerCase().replace(/[\s-]+/g, "_");
  const dashboardHref =
    roleSlug === "teacher"
      ? "/teacher"
      : roleSlug === "student"
      ? "/student"
      : roleSlug === "parent"
      ? "/parent"
      : "/overview";

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.subject || !form.message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.message.trim().length < 20) {
      setError('Message must be at least 20 characters.');
      return;
    }
    setLoading(true);
    try {
      await apiRequest('/contact', { method: 'POST', body: JSON.stringify(form) });
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${styles.page} ${s.page}`}>

      {/* ═══════════════════════════════ NAVBAR ═══════════════════════════════ */}
      <nav className={s.nav} role="navigation" aria-label="Main Navigation">
        {/* Logo */}
        <Link href="/" className={s.navLogo} aria-label="Skoolio — Home">
          <Image
            src="/Logo.png"
            alt="Skoolio Logo"
            width={132}
            height={42}
            priority
            style={{ objectFit: "contain" }}
          />
        </Link>

        {/* Center Links */}
        <div className={s.navLinks}>
          <Link href="/#features" className={s.navLink}>Features</Link>
          <Link href="/#solutions" className={s.navLink}>
            Solutions <i className={`fa-solid fa-chevron-down ${s.navLinkChevron}`} />
          </Link>
          <Link href="/#pricing" className={s.navLink}>Pricing</Link>
          <Link href="/#testimonials" className={s.navLink}>Reviews</Link>
          <Link href="/#faq" className={s.navLink}>FAQs</Link>
          <Link href="/contact" className={s.navLink} style={{ color: "var(--royal-blue, #003882)" }}>Contact</Link>
        </div>

        {/* Right Actions */}
        <div className={s.navActions}>
          {bootstrapped && isAuthenticated && user ? (
            <>
              <Link href={dashboardHref} className={s.navUserChip}>
                <span className={s.navUserAvatar}>
                  {(user.school_name || user.full_name || "U").charAt(0).toUpperCase()}
                </span>
                <span className={s.navUserName}>
                  {user.school_name || user.full_name || user.email}
                </span>
              </Link>
              <Link href={dashboardHref} className={s.navCtaBtn}>
                <i className="fa-solid fa-gauge-high" /> Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={s.navLoginBtn}>
                Login
              </Link>
              <Link href="/register" className={s.navCtaBtn}>
                Get Started Free <i className="fa-solid fa-arrow-right" />
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>
          We'd love to <span className={styles.heroAccent}>hear from you</span>
        </h1>
        <p className={styles.heroSub}>
          Whether you're exploring Skoolio for your school, need support, or just want to say hello — we're here.
        </p>
      </div>

      {/* ── Main content ── */}
      <div className={styles.main}>

        {/* Left — info cards */}
        <div className={styles.left}>

          {/* Info cards */}
          <div className={styles.infoCards}>
            {CONTACT_INFO.map(c => (
              <div key={c.label} className={styles.infoCard}>
                <div className={styles.infoIcon} style={{ background: c.bg, color: c.color }}>
                  <i className={`fa-solid ${c.icon}`} />
                </div>
                <div>
                  <p className={styles.infoLabel}>{c.label}</p>
                  {c.href
                    ? <a href={c.href} className={styles.infoValue} style={{ color: c.color }}>{c.value}</a>
                    : <p className={styles.infoValue}>{c.value}</p>
                  }
                </div>
              </div>
            ))}
          </div>

          {/* FAQ teaser */}
          <div className={styles.faqCard}>
            <div className={styles.faqIcon}><i className="fa-solid fa-circle-question" /></div>
            <div>
              <h3>Common questions</h3>
              <p>Looking for quick answers? Check out our FAQ section on the home page.</p>
              <Link href="/#faq" className={styles.faqLink}>View FAQ <i className="fa-solid fa-arrow-right" /></Link>
            </div>
          </div>

          {/* Illustration */}
          <div className={styles.illustration}>
            <img
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80"
              alt="Team"
              className={styles.illustrationImg}
            />
            <div className={styles.illustrationOverlay}>
              <p>"Building smarter schools, one conversation at a time."</p>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className={styles.right}>
          <div className={styles.formCard}>

            {success ? (
              /* ── Success state ── */
              <div className={styles.successState}>
                <div className={styles.successIcon}><i className="fa-solid fa-circle-check" /></div>
                <h2>Message sent!</h2>
                <p>Thanks for reaching out, <strong>{form.name}</strong>. We'll get back to you at <strong>{form.email}</strong> within 24 hours.</p>
                <div className={styles.successActions}>
                  <button className={styles.btnPrimary} onClick={() => { setSuccess(false); setForm({ name: '', email: '', school_name: '', phone: '', subject: '', message: '' }); }}>
                    Send another message
                  </button>
                  <Link href="/" className={styles.btnGhost}>Back to home</Link>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.formHead}>
                  <div className={styles.formTitleRow}>
                    <h2>Send us a message</h2>
                    <div className={styles.formBadge}>
                      <i className="fa-solid fa-headset" /> Get in touch
                    </div>
                  </div>
                  <p>Fill in the form and we'll respond within 24 hours.</p>
                </div>

                <div className={styles.formGrid}>

                  {/* Name */}
                  <div className={styles.field}>
                    <label>Full Name <span>*</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-user" />
                      <input name="name" value={form.name} onChange={set} placeholder="Your full name" />
                    </div>
                  </div>

                  {/* Email */}
                  <div className={styles.field}>
                    <label>Email Address <span>*</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-envelope" />
                      <input name="email" type="email" value={form.email} onChange={set} placeholder="you@school.com" />
                    </div>
                  </div>

                  {/* School name */}
                  <div className={styles.field}>
                    <label>School Name <span className={styles.optional}>(optional)</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-school" />
                      <input name="school_name" value={form.school_name} onChange={set} placeholder="Your school's name" />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className={styles.field}>
                    <label>Phone Number <span className={styles.optional}>(optional)</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-phone" />
                      <input name="phone" value={form.phone} onChange={set} placeholder="+977 98XXXXXXXX" />
                    </div>
                  </div>

                  {/* Subject — full width */}
                  <div className={`${styles.field} ${styles.fullWidth}`}>
                    <label>Subject <span>*</span></label>
                    <div className={styles.inputWrap}>
                      <i className="fa-solid fa-tag" />
                      <select name="subject" value={form.subject} onChange={set}>
                        <option value="">Select a subject…</option>
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Message — full width */}
                  <div className={`${styles.field} ${styles.fullWidth}`}>
                    <label>Message <span>*</span></label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={set}
                      placeholder="Tell us about your school, what you're looking for, or how we can help…"
                      rows={5}
                    />
                    <span className={styles.charCount}>{form.message.length} chars {form.message.length < 20 && form.message.length > 0 ? `(${20 - form.message.length} more needed)` : ''}</span>
                  </div>

                </div>

                {/* Error */}
                {error && (
                  <div className={styles.errorBox}>
                    <i className="fa-solid fa-circle-exclamation" />
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button className={styles.btnPrimary} onClick={handleSubmit} disabled={loading}>
                  {loading
                    ? <><span className={styles.spinner} /> Sending…</>
                    : <><i className="fa-solid fa-paper-plane" /> Send Message</>
                  }
                </button>

                <p className={styles.privacy}>
                  <i className="fa-solid fa-shield-halved" />
                  Your information is kept private and never shared with third parties.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <AppFooter role="admin" />

      {/* ═══════════════════════════════ MOBILE VIEW FOOTER NAVIGATION ═══════════════════════════════ */}
      <nav className={s.mobileBottomNav} aria-label="Mobile Navigation">
        <Link href="/" className={s.mobileBottomNavItem}>
          <i className="fa-solid fa-house" />
          <span>Home</span>
        </Link>
        <Link href="/#features" className={s.mobileBottomNavItem}>
          <i className="fa-solid fa-wand-magic-sparkles" />
          <span>Features</span>
        </Link>
        <Link href="/#pricing" className={s.mobileBottomNavItem}>
          <i className="fa-solid fa-tags" />
          <span>Pricing</span>
        </Link>
        <Link href="/contact" className={`${s.mobileBottomNavItem} ${s.mobileBottomNavItemActive}`}>
          <i className="fa-solid fa-headset" />
          <span>Contact</span>
        </Link>
        {bootstrapped && isAuthenticated && user ? (
          <Link href={dashboardHref} className={`${s.mobileBottomNavItem} ${s.mobileBottomNavCta}`}>
            <i className="fa-solid fa-gauge-high" />
            <span>Dashboard</span>
          </Link>
        ) : (
          <Link href="/register" className={`${s.mobileBottomNavItem} ${s.mobileBottomNavCta}`}>
            <i className="fa-solid fa-rocket" />
            <span>Sign Up</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
