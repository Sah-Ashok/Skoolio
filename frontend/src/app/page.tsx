"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./landing.module.css";

const s = (className: string) => styles[className] || className;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add(s("revealVisible"));
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cx(s("reveal"), className)}>
      {children}
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li>
      <i className="fa-solid fa-check" />
      <span>{children}</span>
    </li>
  );
}

const MODULES = [
  {
    code: "ATT",
    title: "Attendance",
    points: [
      "Mark present, absent, late, or leave - per student, per section, per day",
      "Submit a day's register to lock it, then edit single entries if something changes",
      "Watch monthly and year-to-date averages roll up on their own",
    ],
  },
  {
    code: "EXM",
    title: "Exams & Results",
    points: [
      "Schedule exams and set exam-specific timetables",
      "Record marks against grade scales you define for your school",
      "Publish results to students only once a class is actually ready",
    ],
  },
  {
    code: "ACD",
    title: "Academic Years & Classes",
    points: [
      "Keep exactly one academic year active at a time, school-wide",
      "Organize classes into sections, with room numbers and live status",
      "Assign subjects to a class without ever creating a duplicate entry",
    ],
  },
  {
    code: "FEE",
    title: "Fees & Expenses",
    points: [
      "Track fee structures and what each student currently owes",
      "Record payments as they're collected",
      "Log day-to-day school expenses in the same ledger as fees",
    ],
  },
  {
    code: "STF",
    title: "Staff & Salary",
    points: [
      "Keep a faculty directory with role and contact details",
      "Run payroll from the same system you use to run the classroom",
      "Assign teachers to the specific sections they teach this year",
    ],
  },
  {
    code: "CAL",
    title: "Academic Calendar",
    points: [
      "Plan terms, holidays, and exam windows ahead of time",
      "Post school-wide events everyone in the school can see",
      "Calendar entries stay scoped to your own school automatically",
    ],
  },
];

const FAQS = [
  {
    q: "Is our school's data kept separate from other schools?",
    a: "Yes. Every student, class, attendance record, result, and fee entry is tied to your school's own account - there's no shared data between schools on the platform.",
  },
  {
    q: "Can more than one teacher use the system at the same time?",
    a: "Yes. Each faculty member signs in with their own account and works from their own assigned classes without stepping on anyone else's records.",
  },
  {
    q: "What happens when the academic year changes?",
    a: "CampusPOS keeps exactly one academic year active at a time, so you can close out the current year and open the next one without losing historical attendance or results.",
  },
  {
    q: "Do students get their own login?",
    a: "Each role - admin, faculty, and student - signs in separately from the same login screen, so everyone only ever sees what's relevant to them.",
  },
  {
    q: "Is CampusPOS mobile-friendly?",
    a: "Yes, the whole system is responsive and works on phones and tablets as well as desktops.",
  },
  {
    q: "How do we get started, and what does it cost?",
    a: "Register your school directly from this page to get set up, then reach out and we'll work out a plan that fits your school's size.",
  },
];

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className={s("faqList")}>
      {FAQS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div className={s("faqItem")} key={item.q}>
            <button
              type="button"
              className={cx(s("faqQuestion"), isOpen && s("faqQuestionOpen"))}
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              {item.q}
              <i className="fa-solid fa-plus" />
            </button>
            <div className={cx(s("faqAnswer"), isOpen && s("faqAnswerOpen"))}>
              <p>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className={s("page")}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;0,700;0,900;1,600&family=IBM+Plex+Mono:wght@500;700&display=swap"
      />

      {/* ───────── nav ───────── */}
      <nav className={s("nav")}>
        <Link href="/" className={s("logo")}>
          <span className={s("logoMark")}>CP</span>
          CampusPOS
        </Link>
        <div className={s("navLinks")}>
          <a href="#manage">What you manage</a>
          <a href="#roles">Roles</a>
          <a href="#about">About</a>
        </div>
        <div className={s("navActions")}>
          <Link href="/login" className={cx(s("btn"), s("btnGhost"), s("btnSm"))}>
            Sign In
          </Link>
          <Link href="/register" className={cx(s("btn"), s("btnPrimary"), s("btnSm"))}>
            Register School
          </Link>
        </div>
      </nav>

      {/* ───────── hero ───────── */}
      <header className={s("hero")}>
        <div>
          <div className={s("heroEyebrow")}>SCHOOL OPERATIONS REGISTER</div>
          <h1 className={s("heroTitle")}>
            Run your school's whole day from <em>one ledger.</em>
          </h1>
          <p className={s("heroSub")}>
            Attendance, exams, fees, and staff — entered once, recorded everywhere, and visible to exactly
            the right role. CampusPOS replaces the stack of registers, spreadsheets, and notice boards with
            one system built for how schools actually run.
          </p>
          <div className={s("heroActions")}>
            <Link href="/register" className={cx(s("btn"), s("btnStamp"))}>
              <i className="fa-solid fa-school" /> Register Your School
            </Link>
            <Link href="/login" className={cx(s("btn"), s("btnGhost"))}>
              Sign In <i className="fa-solid fa-arrow-right" />
            </Link>
          </div>
          <div className={s("heroNote")}>
            <i className="fa-solid fa-shield-halved" />
            Every record is scoped to your school automatically — nothing crosses over.
          </div>
        </div>

        <div className={s("heroVisual")}>
          <div className={s("registerCard")}>
            <div className={s("registerHead")}>
              <h4>Class 9 — Section A</h4>
              <span className="mono">TODAY</span>
            </div>
            {[
              { name: "Aarav Sharma", status: "present" },
              { name: "Priya Thapa", status: "present" },
              { name: "Rohan Gupta", status: "late" },
              { name: "Sneha Karki", status: "present" },
            ].map((row) => (
              <div className={s("registerRow")} key={row.name}>
                <div className={s("registerName")}>
                  <span className={s("avatarDot")}>{row.name.charAt(0)}</span>
                  {row.name}
                </div>
                <span className={row.status === "present" ? s("statusPresent") : s("statusLate")}>
                  {row.status === "present" ? "PRESENT" : "LATE"}
                </span>
              </div>
            ))}
          </div>
          <div className={s("stamp")}>
            DIGITAL
            <br />
            REGISTER
            <br />
            ✓ VERIFIED
          </div>
        </div>
      </header>

      {/* ───────── facts strip ───────── */}
      <Reveal>
        <section className={s("factsStrip")}>
          <div className={s("factItem")}>
            <strong>4 ROLE PORTALS</strong>
            <span>Admin, Faculty, Student, Super Admin</span>
          </div>
          <div className={s("factItem")}>
            <strong>ONE ACTIVE YEAR</strong>
            <span>Every class and record tied to a single live year</span>
          </div>
          <div className={s("factItem")}>
            <strong>SECTION-LEVEL ATTENDANCE</strong>
            <span>Marked, edited, and submitted per class section</span>
          </div>
          <div className={s("factItem")}>
            <strong>SCHOOL-SCOPED DATA</strong>
            <span>No record is ever visible outside its own school</span>
          </div>
        </section>
      </Reveal>

      {/* ───────── how it works ───────── */}
      <section className={s("section")} id="how">
        <Reveal className={s("sectionHead")}>
          <div className={s("eyebrow")}>Getting started</div>
          <h2 className={s("sectionTitle")}>From sign-up to your first attendance entry</h2>
          <p className={s("sectionIntro")}>
            No setup calls, no onboarding queue - a school admin can have the system running the same day.
          </p>
        </Reveal>
        <Reveal>
          <div className={s("howGrid")}>
            <div className={s("stepCard")}>
              <span className={s("stepNum")}>01</span>
              <h3>Register your school</h3>
              <p>Create your school's account directly from this page - it takes a few minutes, not a sales call.</p>
            </div>
            <div className={s("stepCard")}>
              <span className={s("stepNum")}>02</span>
              <h3>Set up your year</h3>
              <p>Add your active academic year, classes, sections, subjects, and staff - the foundation everything else is built on.</p>
            </div>
            <div className={s("stepCard")}>
              <span className={s("stepNum")}>03</span>
              <h3>Run your school day</h3>
              <p>Mark attendance, record exam results, and track fees - all from the same ledger, the same day you sign up.</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────── modules: what you manage ───────── */}
      <section className={s("section")} id="manage">
        <Reveal className={s("sectionHead")}>
          <div className={s("eyebrow")}>The ledger</div>
          <h2 className={s("sectionTitle")}>Everything a school office actually manages</h2>
          <p className={s("sectionIntro")}>
            Six modules, all writing to the same underlying record — so attendance, results, and fees never
            drift out of sync with each other.
          </p>
        </Reveal>
        <Reveal>
          <div className={s("modulesGrid")}>
            {MODULES.map((m) => (
              <div className={s("moduleCard")} key={m.code}>
                <span className={s("moduleCode")}>{m.code}</span>
                <h3>{m.title}</h3>
                <ul className={s("checklist")}>
                  {m.points.map((point) => (
                    <Check key={point}>{point}</Check>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ───────── photo banner ───────── */}
      <Reveal>
        <div className={s("photoBanner")}>
          <img
            className={s("photoBannerImg")}
            src="https://images.pexels.com/photos/6936011/pexels-photo-6936011.jpeg?auto=compress&cs=tinysrgb&w=1600"
            alt="Students studying together in a classroom"
            loading="lazy"
          />
          <div className={s("photoOverlay")}>
            <div className={s("photoCaption")}>
              <div className={s("eyebrow")}>Built for real classrooms</div>
              <h3>Designed around the section, not the spreadsheet</h3>
              <p>
                Teachers mark attendance for the class in front of them. Admins see every section roll up
                into one school-wide view. Nobody re-enters the same name twice.
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ───────── roles ───────── */}
      <section className={s("section")} id="roles">
        <Reveal className={s("sectionHead")}>
          <div className={s("eyebrow")}>Role by role</div>
          <h2 className={s("sectionTitle")}>Everyone sees exactly their part of the register</h2>
          <p className={s("sectionIntro")}>
            CampusPOS is split into four portals from the same login screen, each scoped to what that role
            actually needs to do.
          </p>
        </Reveal>

        <Reveal>
          <div className={s("roleDetailGrid")}>
            <div className={s("roleDetailCard")}>
              <div className={s("roleDetailImgWrap")}>
                <img
                  className={s("roleDetailImg")}
                  src="https://images.pexels.com/photos/8926835/pexels-photo-8926835.jpeg?auto=compress&cs=tinysrgb&w=900"
                  alt="Teacher leading students across the school campus"
                  loading="lazy"
                />
                <span className={s("roleDetailTag")}>FACULTY</span>
              </div>
              <div className={s("roleDetailBody")}>
                <h3>Faculty — built for the class in front of you</h3>
                <p>What a teacher's account can do once they're signed in.</p>
                <ul className={s("checklist")}>
                  <Check>Mark attendance for the sections assigned to them, one period at a time</Check>
                  <Check>Edit a day's attendance entries up until it's submitted</Check>
                  <Check>Enter and update exam results for their own students</Check>
                  <Check>Pull up their own class lists without waiting on an admin</Check>
                </ul>
                <div className={s("roleBoundary")}>
                  <i className="fa-solid fa-lock" />
                  Faculty accounts are scoped automatically to their own school — never another school's
                  classes or staff.
                </div>
              </div>
            </div>

            <div className={s("roleDetailCard")}>
              <div className={s("roleDetailImgWrap")}>
                <img
                  className={s("roleDetailImg")}
                  src="https://images.pexels.com/photos/32292156/pexels-photo-32292156.jpeg?auto=compress&cs=tinysrgb&w=900"
                  alt="Two students walking through a school corridor"
                  loading="lazy"
                />
                <span className={s("roleDetailTag")}>STUDENT</span>
              </div>
              <div className={s("roleDetailBody")}>
                <h3>Student — your own record, nothing else</h3>
                <p>What a student's account can do once they're signed in.</p>
                <ul className={s("checklist")}>
                  <Check>View their own attendance history, month by month</Check>
                  <Check>View their own exam results once a teacher publishes them</Check>
                  <Check>See their own profile and class enrollment details</Check>
                </ul>
                <div className={s("roleBoundary")}>
                  <i className="fa-solid fa-lock" />
                  A student account can never see another student's attendance or marks — not even from
                  the same class.
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className={s("section")} id="faq">
        <Reveal className={s("sectionHead")}>
          <div className={s("eyebrow")}>Questions</div>
          <h2 className={s("sectionTitle")}>Before you register</h2>
          <p className={s("sectionIntro")}>The things schools usually ask before switching over.</p>
        </Reveal>
        <Reveal>
          <FaqAccordion />
        </Reveal>
      </section>

      {/* ───────── CTA band ───────── */}
      <Reveal>
        <section className={s("ctaBand")} id="about">
          <div className={s("ctaText")}>
            <div className={s("eyebrow")}>Get started</div>
            <h2>Ready to put your school's records in order?</h2>
            <p>Register your school in a few minutes, then add classes, sections, and staff as you go.</p>
          </div>
          <div className={s("ctaActions")}>
            <Link href="/register" className={cx(s("btn"), s("btnStamp"))}>
              <i className="fa-solid fa-school" /> Register Your School
            </Link>
            <Link href="/login" className={cx(s("btn"), s("btnGhost"))}>
              Sign In
            </Link>
          </div>
        </section>
      </Reveal>

      {/* ───────── footer ───────── */}
      <footer className={s("footer")}>
        <div className={s("footerInner")}>
          <div className={s("footerBrand")}>
            <Link href="/" className={s("logo")}>
              <span className={s("logoMark")}>CP</span>
              CampusPOS
            </Link>
            <p>The school's operating ledger, digitized — attendance, exams, fees, and staff in one place.</p>
            <div className={s("footerSocial")}>
              <a href="#" aria-label="CampusPOS on X"><i className="fa-brands fa-x-twitter" /></a>
              <a href="#" aria-label="CampusPOS on LinkedIn"><i className="fa-brands fa-linkedin-in" /></a>
              <a href="#" aria-label="CampusPOS on Facebook"><i className="fa-brands fa-facebook-f" /></a>
              <a href="#" aria-label="CampusPOS on Instagram"><i className="fa-brands fa-instagram" /></a>
            </div>
          </div>
          <div className={s("footerCols")}>
            <div className={s("footerCol")}>
              <h5>PRODUCT</h5>
              <a href="#manage">Attendance</a>
              <a href="#manage">Exams &amp; Results</a>
              <a href="#manage">Fees &amp; Expenses</a>
              <a href="#roles">Role Portals</a>
            </div>
            <div className={s("footerCol")}>
              <h5>COMPANY</h5>
              <a href="#how">How It Works</a>
              <a href="#roles">Roles</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className={s("footerCol")}>
              <h5>SUPPORT</h5>
              <a href="#faq">Help Center</a>
              <a href="#faq">Contact Us</a>
              <Link href="/login">Sign In</Link>
              <Link href="/register">Register School</Link>
            </div>
          </div>
        </div>
        <div className={s("footerBottom")}>
          <span>© 2026 CampusPOS · Built for schools that run on order, not chaos.</span>
          <div className={s("footerLegalRow")}>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
