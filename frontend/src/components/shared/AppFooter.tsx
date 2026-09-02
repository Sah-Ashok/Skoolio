import Link from 'next/link';
import Image from 'next/image';

interface AppFooterProps {
  role?: 'admin' | 'teacher' | 'student' | 'super_admin';
}

export default function AppFooter({ role = 'admin' }: AppFooterProps) {
  const basePath =
    role === 'super_admin' ? '/super-admin' :
    role === 'teacher'     ? '/teacher' :
    role === 'student'     ? '/student' :
    '';

  return (
    <footer className="sk-footer" aria-label="Site footer">
      {/* ── Top brand accent strip ── */}
      <div className="sk-footer-accent-bar" aria-hidden="true" />

      <div className="sk-footer-body">
        <div className="sk-footer-inner">

          {/* ── 1. Brand & Mission Column ── */}
          <div className="sk-footer-brand-col">
            <div className="sk-footer-logo-row">
              <Link href="/" aria-label="Skoolio — Home" className="sk-footer-logo-link">
                <Image
                  src="/Logo.png"
                  alt="Skoolio Logo"
                  width={145}
                  height={46}
                  style={{ objectFit: 'contain' }}
                  priority={false}
                />
              </Link>
              <div className="sk-footer-status-pill">
                <span className="sk-footer-status-dot" />
                <span>Cloud Active</span>
              </div>
            </div>

            <p className="sk-footer-desc">
              Everything your school manages — attendance, results, notices,
              and daily operations — in one seamless, role-aware platform.
            </p>

            <div className="sk-footer-social" aria-label="Social links">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="sk-social-btn sk-social-facebook"
              >
                <i className="fa-brands fa-facebook-f" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="sk-social-btn sk-social-linkedin"
              >
                <i className="fa-brands fa-linkedin-in" />
              </a>
              <a
                href="https://wa.me/9779713823636"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="sk-social-btn sk-social-whatsapp"
              >
                <i className="fa-brands fa-whatsapp" />
              </a>
              <a
                href="mailto:skoolio.support@gmail.com"
                aria-label="Email Support"
                className="sk-social-btn sk-social-email"
              >
                <i className="fa-solid fa-envelope" />
              </a>
            </div>
          </div>

          {/* ── 2. Quick Platform Links (No Academic / Finance clutter) ── */}
          <nav className="sk-footer-nav" aria-label="Platform navigation">
            <p className="sk-footer-nav-title">Platform &amp; Links</p>
            <ul>
              <li>
                <Link href={`${basePath}/dashboard`}>
                  <i className="fa-solid fa-house" />
                  <span>Dashboard Home</span>
                </Link>
              </li>
              <li>
                <Link href={`${basePath}/notices`}>
                  <i className="fa-solid fa-bullhorn" />
                  <span>Notice Board</span>
                </Link>
              </li>
              <li>
                <Link href={`${basePath}/calendar`}>
                  <i className="fa-solid fa-calendar-days" />
                  <span>Academic Calendar</span>
                </Link>
              </li>
              <li>
                <Link href="/contact">
                  <i className="fa-solid fa-headset" />
                  <span>Helpdesk &amp; Support</span>
                </Link>
              </li>
              <li>
                <Link href={`${basePath}/settings`}>
                  <i className="fa-solid fa-sliders" />
                  <span>Preferences</span>
                </Link>
              </li>
            </ul>
          </nav>

          {/* ── 3. Direct Support & Contact Column ── */}
          <div className="sk-footer-nav" aria-label="Direct support">
            <p className="sk-footer-nav-title">Direct Support</p>
            
            <div className="sk-footer-contact-list">
              {/* WhatsApp Contact */}
              <a
                href="https://wa.me/9779713823636"
                target="_blank"
                rel="noopener noreferrer"
                className="sk-footer-contact-item"
              >
                <div className="sk-contact-icon-badge wa">
                  <i className="fa-brands fa-whatsapp" />
                </div>
                <div className="sk-contact-details">
                  <span className="sk-contact-lbl wa">WhatsApp Instant Chat</span>
                  <strong className="sk-contact-val big-phone">+977 9713823636</strong>
                </div>
              </a>

              {/* Email Contact */}
              <a
                href="mailto:skoolio.support@gmail.com"
                className="sk-footer-contact-item"
              >
                <div className="sk-contact-icon-badge mail">
                  <i className="fa-solid fa-envelope" />
                </div>
                <div className="sk-contact-details">
                  <span className="sk-contact-lbl mail">Official Email Helpdesk</span>
                  <strong className="sk-contact-val big-email">skoolio.support@gmail.com</strong>
                </div>
              </a>

              {/* Action link */}
              <Link href="/contact" className="sk-footer-contact-action">
                <i className="fa-solid fa-headset" />
                <span>Helpdesk &amp; Inquiry Page →</span>
              </Link>
            </div>
          </div>

        </div>

        {/* ── Bottom Bar ── */}
        <div className="sk-footer-bottom">
          <span className="sk-footer-copyright">
            © {new Date().getFullYear()} <strong>Skoolio</strong>. All rights reserved.
          </span>
          <span className="sk-footer-builder">
            Crafted with <i className="fa-solid fa-heart" style={{ color: '#ef4444', fontSize: 11, margin: '0 2px' }} /> by <strong>@ZenoSoft.in</strong>
          </span>
          <span className="sk-footer-motto">
            Engineered for modern school management
          </span>
        </div>
      </div>
    </footer>
  );
}
