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

      {/* ── Top wave divider ── */}
      <div className="sk-footer-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,20 C360,40 1080,0 1440,20 L1440,0 L0,0 Z" fill="#EAEFEF" />
        </svg>
      </div>

      <div className="sk-footer-body">
        <div className="sk-footer-inner">

          {/* ── Brand column ── */}
          <div className="sk-footer-brand-col">
            <div className="sk-footer-logo" style={{ marginBottom: 14 }}>
              <Link href="/" aria-label="Skoolio — Home" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Image
                  src="/Logo.png"
                  alt="Skoolio"
                  width={140}
                  height={48}
                  style={{ objectFit: 'contain' }}
                />
              </Link>
            </div>

            <p className="sk-footer-desc">
              Everything your school office manages — attendance, exams, fees,
              and staff — in one clean, role-aware dashboard.
            </p>

            <div className="sk-footer-social" aria-label="Social links">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Skoolio on Facebook"
                className="sk-social-btn sk-social-facebook"
              >
                <i className="fa-brands fa-facebook-f" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Skoolio on LinkedIn"
                className="sk-social-btn sk-social-linkedin"
              >
                <i className="fa-brands fa-linkedin-in" />
              </a>
              <a
                href="https://wa.me/9779713823636"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp support: +977 9713823636"
                className="sk-social-btn sk-social-whatsapp"
              >
                <i className="fa-brands fa-whatsapp" />
              </a>
              <a
                href="mailto:skoolio.support@gmail.com"
                aria-label="Email support: skoolio.support@gmail.com"
                className="sk-social-btn sk-social-email"
                style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}
              >
                <i className="fa-solid fa-envelope" />
              </a>
            </div>
          </div>

          {/* ── Academic nav ── */}
          <nav className="sk-footer-nav" aria-label="Academic navigation">
            <p className="sk-footer-nav-title">Academic</p>
            <ul>
              <li><Link href={`${basePath}/students`}>Students</Link></li>
              <li><Link href={`${basePath}/teachers`}>Teachers / Faculty</Link></li>
              <li><Link href={`${basePath}/classes`}>Classes &amp; Sections</Link></li>
              <li><Link href={`${basePath}/exams`}>Exams &amp; Results</Link></li>
              <li><Link href={`${basePath}/attendance`}>Attendance</Link></li>
            </ul>
          </nav>

          {/* ── Finance nav ── */}
          <nav className="sk-footer-nav" aria-label="Finance navigation">
            <p className="sk-footer-nav-title">Finance</p>
            <ul>
              <li><Link href={`${basePath}/fees`}>Fee Management</Link></li>
              <li><Link href={`${basePath}/expenses`}>Expenses</Link></li>
              <li><Link href={`${basePath}/salary`}>Staff Salary</Link></li>
            </ul>
          </nav>

          {/* ── Support nav ── */}
          <div className="sk-footer-nav" aria-label="Support navigation">
            <p className="sk-footer-nav-title">Support &amp; Contact</p>
            
            {/* WhatsApp Box */}
            <a
              href="https://wa.me/9779713823636"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 14px',
                borderRadius: 10,
                background: '#f0fdf4',
                border: '1.5px solid #bbf7d0',
                textDecoration: 'none',
                marginBottom: 10,
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: '#25D366', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>
                <i className="fa-brands fa-whatsapp" />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 900, color: '#15803d', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  WhatsApp Support
                </span>
                <strong style={{ fontSize: 14, fontWeight: 900, color: '#166534', letterSpacing: 0.3 }}>
                  +977 9713823636
                </strong>
              </div>
            </a>

            {/* Email Box */}
            <a
              href="mailto:skoolio.support@gmail.com"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 14px',
                borderRadius: 10,
                background: '#fff7ed',
                border: '1.5px solid #fed7aa',
                textDecoration: 'none',
                marginBottom: 12,
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: '#FF9B51', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
              }}>
                <i className="fa-solid fa-envelope" />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 900, color: '#c2410c', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Email Support
                </span>
                <strong style={{ fontSize: 12.5, fontWeight: 900, color: '#9a3412', wordBreak: 'break-all' }}>
                  skoolio.support@gmail.com
                </strong>
              </div>
            </a>

            <ul>
              <li><Link href="/contact"><i className="fa-solid fa-headset" style={{ color: '#ea580c', marginRight: 4 }} /> Contact Us Page</Link></li>
              <li><Link href={`${basePath}/dashboard`}>Help Center</Link></li>
              <li><Link href={`${basePath}/settings`}>Settings</Link></li>
            </ul>
          </div>

        </div>

        {/* ── Bottom bar ── */}
        <div className="sk-footer-bottom">
          <span>© {new Date().getFullYear()} Skoolio. All rights reserved.</span>
          <strong>@ZenoSoft.in</strong>
          <span>Built for schools that run on order, not chaos.</span>
        </div>
      </div>
    </footer>
  );
}
