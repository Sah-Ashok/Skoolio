"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAppSelector } from "@/store/hooks";
import { getRoleRedirect } from "@/store/authSlice";
import s from "./landing.module.css";

// ─── Structured Data (JSON-LD) ───────────────────────────────────────────────
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Skoolio",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  description:
    "Skoolio is a cloud-based school management system for schools in Nepal and India. Manage attendance, fees, exams, staff, hostel, transport and more from one platform.",
  offers: [
    { "@type": "Offer", name: "Free Plan", price: "0", priceCurrency: "NPR" },
    { "@type": "Offer", name: "Pro Plan", priceCurrency: "NPR" },
    { "@type": "Offer", name: "Plus Plan", priceCurrency: "NPR" },
  ],
  featureList: [
    "Attendance Management",
    "Fee Management",
    "Exam & Results",
    "Transport Management",
    "Hostel Management",
    "Staff Salary",
    "Academic Calendar",
    "Notice Board",
  ],
  url: "https://skoolio.app",
  applicationSubCategory: "School Management System",
  countriesSupported: "NP IN",
};

// ─── Scroll-reveal wrapper ───────────────────────────────────────────────────
function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add(s.revealVisible);
          io.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={`${s.reveal}${className ? " " + className : ""}`}>
      {children}
    </div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────
const MODULES = [
  {
    icon: "fa-user-check",
    code: "ATT",
    title: "Attendance",
    desc: "Mark, submit, and lock daily attendance per section. Monthly and yearly roll-ups happen automatically.",
    points: ["Present / Absent / Late / Leave per student", "Section coordinator submits — admin views read-only", "Calendar-aware: holidays excluded from working days"],
  },
  {
    icon: "fa-pen-to-square",
    code: "EXM",
    title: "Exams & Results",
    desc: "Schedule exams, enter marks, compute grades, and publish results — all role-gated.",
    points: ["Custom grade scales per school", "Teachers enter only their own subject marks", "Publish to students only when ready"],
  },
  {
    icon: "fa-file-invoice-dollar",
    code: "FEE",
    title: "Fee Management",
    desc: "Define fee structures, generate monthly bills, collect payments, and issue numbered PDF receipts.",
    points: ["Auto-billing for transport & hostel", "Scholarship discounts applied automatically", "RCP-XXXX receipts, no duplicates ever"],
  },
  {
    icon: "fa-bus",
    code: "TRP",
    title: "Transport & Hostel",
    desc: "Manage routes, stops, vehicles, rooms, and student assignments — integrated directly with fee billing.",
    points: ["Stop-wise monthly fees", "Hostel room assignment with warden details", "One student, one route, one room — enforced"],
  },
  {
    icon: "fa-money-bill-wave",
    code: "SAL",
    title: "Staff & Salary",
    desc: "Full faculty directory, section assignments, and monthly payroll from the same system.",
    points: ["Teaching and non-teaching staff", "Salary: basic + bonus + deduction", "Pay via cash, cheque, or bank transfer"],
  },
  {
    icon: "fa-calendar-days",
    code: "CAL",
    title: "Calendar & Notices",
    desc: "Plan academic events, configure weekly offs, and broadcast notices to the right audience.",
    points: ["Flexible weekly off patterns", "Holidays, events, exam windows", "Section-scoped or school-wide notices"],
  },
];

const PLANS = [
  {
    name: "Free",
    price: "₹0 / NPR 0",
    sub: "forever",
    color: "#64748b",
    students: "100 students",
    teachers: "5 teachers",
    highlight: false,
    features: ["Students & Classes", "Attendance", "Exams & Results", "Calendar & Notices", "Role Portals"],
    missing: ["Fee Management", "Transport & Hostel billing", "Priority support"],
  },
  {
    name: "Pro",
    price: "Contact us",
    sub: "monthly or yearly",
    color: "#FF9B51",
    students: "300 students",
    teachers: "20 teachers",
    highlight: true,
    features: ["Everything in Free", "Full Fee Management", "PDF Receipt generation", "Transport billing", "Hostel billing"],
    missing: ["Priority support"],
  },
  {
    name: "Plus",
    price: "Contact us",
    sub: "monthly or yearly",
    color: "#25343F",
    students: "1,500 students",
    teachers: "40 teachers",
    highlight: false,
    features: ["Everything in Pro", "Large school capacity", "Priority support", "Dedicated onboarding"],
    missing: [],
  },
];

const PARTNERS = [
  { name: "Himalayan Public School", abbr: "HPS", location: "Kathmandu, Nepal" },
  { name: "Sunrise Academy",         abbr: "SA",  location: "Pokhara, Nepal" },
  { name: "Delhi Modern School",     abbr: "DMS", location: "New Delhi, India" },
  { name: "Everest Secondary School",abbr: "ESS", location: "Lalitpur, Nepal" },
  { name: "Horizon International",   abbr: "HI",  location: "Mumbai, India" },
  { name: "Patan High School",       abbr: "PHS", location: "Patan, Nepal" },
];

const TECH_PARTNERS = [
  { name: "Microsoft Azure",  icon: "fa-microsoft" },
  { name: "PostgreSQL",       icon: "fa-database" },
  { name: "Next.js",          icon: "fa-n" },
  { name: "Redis",            icon: "fa-layer-group" },
  { name: "Node.js",          icon: "fa-node" },
];

const FAQS = [
  {
    q: "Is our school's data kept separate from other schools?",
    a: "Yes — completely. Every student, class, attendance record, result, and fee entry is tied to your school's own account. There is no shared data between schools on the platform. All queries are scoped by school_id enforced at the database level.",
  },
  {
    q: "Can multiple teachers use the system at the same time?",
    a: "Yes. Each faculty member signs in with their own account and sees only their assigned sections and subjects. They cannot access data from other teachers' classes.",
  },
  {
    q: "What happens when the academic year changes?",
    a: "Skoolio keeps exactly one academic year active at a time. When a new year starts, create it and begin fresh — all historical data from previous years is retained and searchable.",
  },
  {
    q: "Does Skoolio support Nepali calendar (BS)?",
    a: "Yes. Nepal schools can switch to Bikram Sambat (BS) display mode. The system stores all dates in AD internally but displays them in BS — Baishakh, Jestha, Ashadh and so on.",
  },
  {
    q: "Do students get their own login?",
    a: "Yes. Students log in separately and see only their own profile, attendance, results, and fee history. They cannot see any other student's data — not even classmates.",
  },
  {
    q: "How does fee management work on the Free plan?",
    a: "Fee Management is not available on the Free plan. All other modules — students, classes, attendance, exams, calendar, and notices — are fully available. Upgrade to Pro or Plus to enable fee collection and PDF receipts.",
  },
];

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className={s.faqList}>
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div className={s.faqItem} key={item.q}>
            <button
              type="button"
              className={`${s.faqQuestion}${isOpen ? " " + s.faqQuestionOpen : ""}`}
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span>{item.q}</span>
              <i className={`fa-solid ${isOpen ? "fa-minus" : "fa-plus"}`} />
            </button>
            <div className={`${s.faqAnswer}${isOpen ? " " + s.faqAnswerOpen : ""}`}>
              <p>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user, isAuthenticated, bootstrapped } = useAppSelector((st) => st.auth);
  const dashboardHref = user ? getRoleRedirect(user.role) : "/dashboard";

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <div className={s.page}>
        {/* ═══════════════════════════════ NAV ═══════════════════════════════ */}
        <nav className={s.nav} role="navigation" aria-label="Main navigation">
          <Link href="/" className={s.navLogo} aria-label="Skoolio — Home">
            <Image
              src="/Logo.png"
              alt="Skoolio"
              width={123}
              height={42}
              priority
              style={{ objectFit: "contain" }}
            />
          </Link>

          <div className={s.navLinks}>
            <a href="#modules">Features</a>
            <a href="#partners">Trusted By</a>
            <a href="#pricing">Pricing</a>
            <a href="#roles">Roles</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className={s.navActions}>
            {bootstrapped && isAuthenticated && user ? (
              <>
                <div className={s.navUserChip}>
                  <span className={s.navUserAvatar}>
                    {(user.school_name || user.full_name || "U").charAt(0).toUpperCase()}
                  </span>
                  <span className={s.navUserName}>
                    {user.school_name || user.full_name || user.email}
                  </span>
                </div>
                <Link href={dashboardHref} className={s.btnPrimary}>
                  <i className="fa-solid fa-gauge-high" /> Go to Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className={s.btnGhost}>Sign In</Link>
                <Link href="/register" className={s.btnPrimary}>
                  <i className="fa-solid fa-school" /> Register School
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger — links only on mobile */}
          <button className={s.navMobileMenu} aria-label="Open menu">
            <i className="fa-solid fa-bars" />
          </button>
        </nav>

        {/* ═══════════════════════════════ HERO ══════════════════════════════ */}
        <header className={s.hero} id="home">
          <div className={s.heroContent}>
            <div className={s.heroEyebrow}>
              <span className={s.heroBadge}>🇳🇵 Nepal &amp; 🇮🇳 India</span>
              School Management Platform
            </div>
            <h1 className={s.heroTitle}>
              Run your entire school from{" "}
              <em>one platform.</em>
            </h1>
            <p className={s.heroSub}>
              Skoolio replaces registers, spreadsheets, and scattered apps with
              one cloud system — attendance, fees, exams, staff, hostel, and
              transport all connected. Built for how South Asian schools actually run.
            </p>
            <div className={s.heroActions}>
              {isAuthenticated && user ? (
                <Link href={dashboardHref} className={s.btnHeroPrimary}>
                  <i className="fa-solid fa-gauge-high" /> Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/register" className={s.btnHeroPrimary}>
                    <i className="fa-solid fa-school" /> Register Your School — Free
                  </Link>
                  <Link href="/login" className={s.btnHeroGhost}>
                    Sign In <i className="fa-solid fa-arrow-right" />
                  </Link>
                </>
              )}
            </div>
            <div className={s.heroTrustRow}>
              <div className={s.heroTrustItem}>
                <i className="fa-solid fa-shield-halved" />
                <span>School-isolated data</span>
              </div>
              <div className={s.heroTrustItem}>
                <i className="fa-solid fa-cloud" />
                <span>Runs on any device</span>
              </div>
              <div className={s.heroTrustItem}>
                <i className="fa-solid fa-bolt" />
                <span>Start same day</span>
              </div>
            </div>
          </div>

          {/* Hero visual — attendance card */}
          <div className={s.heroVisual} aria-hidden="true">
            <div className={s.heroCard}>
              <div className={s.heroCardHeader}>
                <div>
                  <div className={s.heroCardTitle}>Class 9 — Section A</div>
                  <div className={s.heroCardSub}>Today's Attendance</div>
                </div>
                <span className={s.heroCardBadge}>LIVE</span>
              </div>
              {[
                { name: "Aarav Sharma",  init: "A", status: "present" },
                { name: "Priya Thapa",   init: "P", status: "present" },
                { name: "Rohan Gupta",   init: "R", status: "late" },
                { name: "Sneha Karki",   init: "S", status: "present" },
                { name: "Dipak Adhikari",init: "D", status: "absent" },
              ].map((row) => (
                <div className={s.heroCardRow} key={row.name}>
                  <div className={s.heroCardName}>
                    <span className={s.heroAvatar} data-status={row.status}>{row.init}</span>
                    {row.name}
                  </div>
                  <span className={s[`status_${row.status}`]}>
                    {row.status.toUpperCase()}
                  </span>
                </div>
              ))}
              <div className={s.heroCardFooter}>
                <span>4 / 5 present</span>
                <span className={s.heroCardSubmit}>Submit Register ›</span>
              </div>
            </div>

            {/* Floating stat pills */}
            <div className={s.heroPill} style={{ top: "12px", right: "-20px" }}>
              <i className="fa-solid fa-indian-rupee-sign" style={{ color: "#FF9B51" }} />
              <span>Fee collected</span>
              <strong>₹2,40,000</strong>
            </div>
            <div className={s.heroPill} style={{ bottom: "50px", left: "-28px" }}>
              <i className="fa-solid fa-users" style={{ color: "#22c55e" }} />
              <span>Students</span>
              <strong>847</strong>
            </div>
          </div>
        </header>

        {/* ═══════════════════════════════ STATS STRIP ═══════════════════════ */}
        <Reveal>
          <section className={s.statsStrip} aria-label="Platform highlights">
            {[
              { num: "4",  label: "Role portals",         sub: "Admin, Faculty, Student, Super Admin" },
              { num: "15+",label: "Modules",               sub: "All connected, one system" },
              { num: "BS", label: "Nepali calendar",       sub: "Bikram Sambat display support" },
              { num: "0₹", label: "Free plan forever",     sub: "Up to 100 students, no credit card" },
            ].map((s2) => (
              <div className={s.statItem} key={s2.label}>
                <strong>{s2.num}</strong>
                <span>{s2.label}</span>
                <small>{s2.sub}</small>
              </div>
            ))}
          </section>
        </Reveal>

        {/* ═══════════════════════════════ PARTNERS ══════════════════════════ */}
        <section className={s.partnersSection} id="partners" aria-label="Trusted schools">
          <Reveal>
            <div className={s.partnersInner}>
              <p className={s.partnersLabel}>Trusted by schools across Nepal &amp; India</p>
              <div className={s.partnersLogos}>
                {PARTNERS.map((p) => (
                  <div className={s.partnerCard} key={p.name}>
                    <div className={s.partnerLogoBox}>
                      <span className={s.partnerAbbr}>{p.abbr}</span>
                    </div>
                    <div className={s.partnerInfo}>
                      <span className={s.partnerName}>{p.name}</span>
                      <span className={s.partnerLoc}>
                        <i className="fa-solid fa-location-dot" /> {p.location}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={s.techPartnerRow}>
                <span className={s.techPartnerLabel}>Built on</span>
                {TECH_PARTNERS.map((t) => (
                  <div className={s.techPartnerItem} key={t.name}>
                    <i className={`fa-brands ${t.icon}`} />
                    <span>{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ═══════════════════════════════ HOW IT WORKS ══════════════════════ */}
        <section className={s.section} id="how" aria-labelledby="how-title">
          <Reveal className={s.sectionHead}>
            <div className={s.eyebrow}>Getting started</div>
            <h2 id="how-title" className={s.sectionTitle}>
              From sign-up to your first attendance entry — same day
            </h2>
            <p className={s.sectionIntro}>
              No setup calls, no waiting. A school admin can have Skoolio fully configured and running the same day they register.
            </p>
          </Reveal>
          <div className={s.howGrid}>
            {[
              { n: "01", title: "Register your school", desc: "Create your school account in minutes — name, type, location, timezone. No sales call required." },
              { n: "02", title: "Set up your year",     desc: "Add your active academic year, classes, sections, subjects, and staff. The foundation everything else builds on." },
              { n: "03", title: "Run your school",      desc: "Mark attendance, record exam marks, collect fees, and publish results — all from one dashboard." },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 120}>
                <div className={s.stepCard}>
                  <span className={s.stepNum}>{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════ MODULES ═══════════════════════════ */}
        <section className={s.section} id="modules" aria-labelledby="modules-title">
          <Reveal className={s.sectionHead}>
            <div className={s.eyebrow}>The platform</div>
            <h2 id="modules-title" className={s.sectionTitle}>
              Everything a school office actually manages
            </h2>
            <p className={s.sectionIntro}>
              Six core modules, all writing to the same underlying record — so attendance, results, and fees never drift out of sync.
            </p>
          </Reveal>
          <div className={s.modulesGrid}>
            {MODULES.map((m, i) => (
              <Reveal key={m.code} delay={i * 80}>
                <article className={s.moduleCard}>
                  <div className={s.moduleIconWrap}>
                    <i className={`fa-solid ${m.icon}`} />
                  </div>
                  <div className={s.moduleCodeTag}>{m.code}</div>
                  <h3 className={s.moduleTitle}>{m.title}</h3>
                  <p className={s.moduleDesc}>{m.desc}</p>
                  <ul className={s.modulePoints}>
                    {m.points.map((pt) => (
                      <li key={pt}>
                        <i className="fa-solid fa-check" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════ PHOTO BANNER ══════════════════════ */}
        <Reveal>
          <div className={s.photoBanner}>
            <img
              className={s.photoBannerImg}
              src="https://images.pexels.com/photos/6936011/pexels-photo-6936011.jpeg?auto=compress&cs=tinysrgb&w=1600"
              alt="Students studying together in a South Asian classroom"
              loading="lazy"
              width={1600}
              height={600}
            />
            <div className={s.photoOverlay}>
              <div className={s.photoCaption}>
                <div className={s.eyebrow} style={{ color: "#FF9B51" }}>Built for real classrooms</div>
                <h3>Designed around the section, not the spreadsheet</h3>
                <p>
                  Teachers mark attendance for the class in front of them. Admins see every section roll up into one school-wide view. Nobody re-enters the same name twice.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ═══════════════════════════════ ROLES ═════════════════════════════ */}
        <section className={s.section} id="roles" aria-labelledby="roles-title">
          <Reveal className={s.sectionHead}>
            <div className={s.eyebrow}>Role by role</div>
            <h2 id="roles-title" className={s.sectionTitle}>
              Everyone sees exactly their part of the system
            </h2>
            <p className={s.sectionIntro}>
              Four separate portals, one login screen. Each role is scoped to only what it needs.
            </p>
          </Reveal>
          <div className={s.rolesGrid}>
            {[
              {
                tag: "ADMIN",
                color: "#25343F",
                title: "School Admin",
                desc: "Full control over every module — students, staff, fees, exams, transport, hostel, and settings.",
                perms: ["Manage all students and teachers", "Full fee management and receipts", "Create and publish exams", "Manage transport, hostel, salary"],
              },
              {
                tag: "FACULTY",
                color: "#FF9B51",
                title: "Teacher / Faculty",
                desc: "Scoped to their own sections and subjects. Can't touch data outside their assignment.",
                perms: ["Mark attendance for own sections only", "Enter results for own subjects only", "View class lists and notices", "View own salary history"],
              },
              {
                tag: "STUDENT",
                color: "#22c55e",
                title: "Student",
                desc: "Self-service view of their own record only. No access to classmates' data.",
                perms: ["View own attendance history", "View own exam results (when published)", "View own fee collections", "Download payment receipts"],
              },
              {
                tag: "SUPER ADMIN",
                color: "#6366f1",
                title: "Super Admin",
                desc: "Platform-level access. Manages all schools, subscriptions, and platform settings.",
                perms: ["Manage all schools on platform", "Activate and manage subscriptions", "View platform-wide analytics", "Configure global settings"],
              },
            ].map((role, i) => (
              <Reveal key={role.tag} delay={i * 80}>
                <article className={s.roleCard}>
                  <div className={s.roleCardTop} style={{ borderTopColor: role.color }}>
                    <span className={s.roleTag} style={{ background: role.color }}>{role.tag}</span>
                    <h3 className={s.roleTitle}>{role.title}</h3>
                    <p className={s.roleDesc}>{role.desc}</p>
                  </div>
                  <ul className={s.rolePerms}>
                    {role.perms.map((p) => (
                      <li key={p}>
                        <i className="fa-solid fa-check" style={{ color: role.color }} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════ PRICING ═══════════════════════════ */}
        <section className={s.section} id="pricing" aria-labelledby="pricing-title">
          <Reveal className={s.sectionHead}>
            <div className={s.eyebrow}>Pricing</div>
            <h2 id="pricing-title" className={s.sectionTitle}>
              Start free. Grow when you're ready.
            </h2>
            <p className={s.sectionIntro}>
              All plans include the core academic modules. Fee management and higher capacity are available on paid plans.
            </p>
          </Reveal>
          <div className={s.pricingGrid}>
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 100}>
                <article className={`${s.planCard}${plan.highlight ? " " + s.planHighlight : ""}`}>
                  {plan.highlight && <div className={s.planBadge}>Most Popular</div>}
                  <div className={s.planTop}>
                    <h3 className={s.planName} style={{ color: plan.color }}>{plan.name}</h3>
                    <div className={s.planPrice}>{plan.price}</div>
                    <div className={s.planSub}>{plan.sub}</div>
                    <div className={s.planCapacity}>
                      <span><i className="fa-solid fa-user-graduate" /> {plan.students}</span>
                      <span><i className="fa-solid fa-chalkboard-user" /> {plan.teachers}</span>
                    </div>
                  </div>
                  <ul className={s.planFeatures}>
                    {plan.features.map((f) => (
                      <li key={f} className={s.planFeatureYes}>
                        <i className="fa-solid fa-check" />{f}
                      </li>
                    ))}
                    {plan.missing.map((f) => (
                      <li key={f} className={s.planFeatureNo}>
                        <i className="fa-solid fa-xmark" />{f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.name === "Free" ? "/register" : "/register"}
                    className={plan.highlight ? s.btnPrimary : s.btnGhost}
                    style={{ width: "100%", justifyContent: "center", marginTop: "auto" }}
                  >
                    {plan.name === "Free" ? "Get Started Free" : "Contact Us"}
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════ FAQ ═══════════════════════════════ */}
        <section className={s.section} id="faq" aria-labelledby="faq-title">
          <Reveal className={s.sectionHead}>
            <div className={s.eyebrow}>FAQ</div>
            <h2 id="faq-title" className={s.sectionTitle}>Before you register</h2>
            <p className={s.sectionIntro}>Common questions from school admins.</p>
          </Reveal>
          <Reveal>
            <FaqAccordion />
          </Reveal>
        </section>

        {/* ═══════════════════════════════ CTA BAND ══════════════════════════ */}
        <Reveal>
          <section className={s.ctaBand} id="about" aria-label="Call to action">
            <div className={s.ctaContent}>
              <div className={s.eyebrow} style={{ color: "#FF9B51" }}>Get started today</div>
              <h2 className={s.ctaTitle}>
                Ready to put your school's records in order?
              </h2>
              <p className={s.ctaSub}>
                Register in minutes. Add classes, sections, and staff as you go. Free forever for small schools.
              </p>
              <div className={s.ctaActions}>
                {isAuthenticated && user ? (
                  <Link href={dashboardHref} className={s.btnHeroPrimary}>
                    <i className="fa-solid fa-gauge-high" /> Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/register" className={s.btnHeroPrimary}>
                      <i className="fa-solid fa-school" /> Register Free
                    </Link>
                    <Link href="/login" className={`${s.btnHeroGhost} ${s.ctaGhost}`}>
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            </div>
          </section>
        </Reveal>

        {/* ═══════════════════════════════ FOOTER ════════════════════════════ */}
        <footer className={s.footer} aria-label="Site footer">
          <div className={s.footerInner}>
            <div className={s.footerBrand}>
              <Link href="/" aria-label="Skoolio — Home">
                <Image
                  src="/Logo.png"
                  alt="Skoolio"
                  width={140}
                  height={48}
                  style={{ objectFit: "contain" }}
                />
              </Link>
              <p>
                The all-in-one school management platform for Nepal and India. Attendance, fees, exams, and staff — entered once, visible to the right role.
              </p>
              <div className={s.footerSocial}>
                <a href="https://wa.me/9779713823636" target="_blank" rel="noopener noreferrer" aria-label="Skoolio WhatsApp Support: +977 9713823636"><i className="fa-brands fa-whatsapp" /></a>
                <a href="mailto:skoolio.support@gmail.com" aria-label="Email Skoolio Support: skoolio.support@gmail.com"><i className="fa-solid fa-envelope" /></a>
                <a href="#" aria-label="Skoolio on LinkedIn"><i className="fa-brands fa-linkedin-in" /></a>
                <a href="#" aria-label="Skoolio on Facebook"><i className="fa-brands fa-facebook-f" /></a>
              </div>
            </div>

            <div className={s.footerCols}>
              <div className={s.footerCol}>
                <h5>PRODUCT</h5>
                <a href="#modules">Attendance</a>
                <a href="#modules">Fee Management</a>
                <a href="#modules">Exams &amp; Results</a>
                <a href="#modules">Transport &amp; Hostel</a>
                <a href="#modules">Staff &amp; Salary</a>
              </div>
              <div className={s.footerCol}>
                <h5>PLATFORM</h5>
                <a href="#how">How it Works</a>
                <a href="#roles">Role Portals</a>
                <a href="#pricing">Pricing</a>
                <a href="#partners">Trusted By</a>
              </div>
              <div className={s.footerCol}>
                <h5>SUPPORT &amp; CONTACT</h5>
                <a
                  href="https://wa.me/9779713823636"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "14px",
                    fontWeight: 800,
                    color: "#16a34a",
                    marginBottom: 6,
                  }}
                >
                  <i className="fa-brands fa-whatsapp" style={{ fontSize: "16px", color: "#25D366" }} />
                  +977 9713823636
                </a>
                <a
                  href="mailto:skoolio.support@gmail.com"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "#ea580c",
                    marginBottom: 8,
                  }}
                >
                  <i className="fa-solid fa-envelope" style={{ fontSize: "14px", color: "#FF9B51" }} />
                  skoolio.support@gmail.com
                </a>
                <a href="/contact"><i className="fa-solid fa-headset" style={{ color: "#ea580c", marginRight: 4 }} /> Contact Us Page</a>
                <Link href="/login">Sign In</Link>
                <Link href="/register">Register School</Link>
              </div>
            </div>
          </div>

          <div className={s.footerBottom}>
            <span>© 2026 Skoolio · Built for schools in Nepal &amp; India</span>
            <div className={s.footerLegal}>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
