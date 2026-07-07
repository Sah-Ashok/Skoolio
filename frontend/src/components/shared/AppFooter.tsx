import Link from 'next/link';

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
            <div className="sk-footer-logo">
              <span className="sk-footer-logo-icon">
                <i className="fa-solid fa-graduation-cap" />
              </span>
              <div className="sk-footer-logo-text">
                <strong>Skoolio</strong>
                <span>Smart School Management</span>
              </div>
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
                href="https://wa.me/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp support"
                className="sk-social-btn sk-social-whatsapp"
              >
                <i className="fa-brands fa-whatsapp" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Skoolio on Instagram"
                className="sk-social-btn sk-social-instagram"
              >
                <i className="fa-brands fa-instagram" />
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
          <nav className="sk-footer-nav" aria-label="Support navigation">
            <p className="sk-footer-nav-title">Support</p>
            <ul>
              <li><Link href={`${basePath}/dashboard`}>Help Center</Link></li>
              <li>
                <a href="https://wa.me/" target="_blank" rel="noopener noreferrer">
                  WhatsApp Support
                </a>
              </li>
              <li><Link href={`${basePath}/settings`}>Settings</Link></li>
              <li><Link href={`${basePath}/dashboard`}>Privacy &amp; Security</Link></li>
            </ul>
          </nav>

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
