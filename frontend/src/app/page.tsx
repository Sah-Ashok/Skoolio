"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAppSelector } from "@/store/hooks";
import { getRoleRedirect } from "@/store/authSlice";
import AppFooter from "@/components/shared/AppFooter";
import { CurrencySymbol } from "@/components/shared/NepaliCurrency";
import s from "./landing.module.css";

export default function HomePage() {
  const { user, isAuthenticated, bootstrapped } = useAppSelector((st) => st.auth);
  const dashboardHref = user ? getRoleRedirect(user.role) : "/dashboard";
  const [scrolled, setScrolled] = useState(false);
  const [activeCard, setActiveCard] = useState(2);

  const schools = [
    { name: "Greenwood Academy",       location: "New Delhi, India",    logo: "/school-logo/school-logo1.png", initial: "G", color: "#ff5e1e", bg: "#fff7ed" },
    { name: "Sunrise Public School",   location: "Mumbai, India",       logo: "/school-logo/school-logo2.png", initial: "S", color: "#2563eb", bg: "#eff6ff" },
    { name: "St. Mary's Convent",      location: "Bangalore, India",    logo: "/school-logo/school-logo3.png", initial: "M", color: "#9333ea", bg: "#f3e8ff" },
    { name: "Delhi Public School",     location: "Hyderabad, India",    logo: "/school-logo/school-logo1.png", initial: "D", color: "#059669", bg: "#ecfdf5" },
    { name: "Bright Future Academy",   location: "Chennai, India",      logo: "/school-logo/school-logo2.png", initial: "B", color: "#d97706", bg: "#fef9c3" },
  ];

  const leftFeatures = [
    {
      icon: "fa-user-plus",
      bg: "#ff5e1e",
      title: "Online Admissions",
      desc: "Paperless enrollment & forms"
    },
    {
      icon: "fa-graduation-cap",
      bg: "#2563eb",
      title: "Student & Academics",
      desc: "Classes, sections & syllabus"
    },
    {
      icon: "fa-calendar-check",
      bg: "#10b981",
      title: "Smart Attendance",
      desc: "Daily logs & instant SMS alerts"
    },
    {
      icon: "fa-file-lines",
      bg: "#8b5cf6",
      title: "Exams & Grading",
      desc: "Custom rules & instant reports"
    },
    {
      icon: "fa-chart-pie",
      bg: "#ec4899",
      title: "Fee Collection",
      desc: "Invoices & online payments"
    },
  ];

  const rightFeatures = [
    {
      icon: "fa-users",
      bg: "#f59e0b",
      title: "Staff & Teachers",
      desc: "Workload & staff payroll"
    },
    {
      icon: "fa-chalkboard-user",
      bg: "#3b82f6",
      title: "Smart Classroom",
      desc: "Homework & lesson planning"
    },
    {
      icon: "fa-comment-dots",
      bg: "#ea580c",
      title: "Parent Portal",
      desc: "Circulars, chat & notices"
    },
    {
      icon: "fa-calendar-days",
      bg: "#7c3aed",
      title: "Timetable & Events",
      desc: "Conflict-free scheduler"
    },
    {
      icon: "fa-chart-line",
      bg: "#059669",
      title: "Reports & Analytics",
      desc: "Real-time decision dashboards"
    },
  ];

  /* Sticky Navbar scroll state */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* Auto-advance school cards every 5 seconds, resets timer on user click */
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCard((prev) => (prev + 1) % schools.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeCard, schools.length]);

  /* Mobile Feature Slide State: 5 cards per slide, auto-advance every 3s, pauses on hover */
  const [featureSlide, setFeatureSlide] = useState(0);
  const [featureHovered, setFeatureHovered] = useState(false);

  useEffect(() => {
    if (featureHovered) return;
    const timer = setInterval(() => {
      setFeatureSlide((prev) => (prev === 0 ? 1 : 0));
    }, 3000);
    return () => clearInterval(timer);
  }, [featureHovered, featureSlide]);

  /* Section 4: Role Solutions State */
  type RoleKey = "admin" | "teacher" | "student" | "parent";
  const [activeRole, setActiveRole] = useState<RoleKey>("admin");

  const roleSolutions: Record<RoleKey, {
    label: string;
    icon: string;
    badge: string;
    accent: string;
    badgeBg: string;
    title: string;
    desc: string;
    features: string[];
    ctaText: string;
    ctaLink: string;
  }> = {
    admin: {
      label: "School Leaders & Admins",
      icon: "fa-user-tie",
      badge: "Executive Control",
      accent: "#002b66",
      badgeBg: "rgba(0, 43, 102, 0.08)",
      title: "Total Command & Financial Clarity Across Campus",
      desc: "Eliminate administrative bottlenecks. Monitor admissions in real time, automate fee collection & bank reconciliation, track multi-branch performance, and generate government compliance reports from one intuitive control center.",
      features: [
        "Automated fee structures & 1-click verification of QR/eSewa/bank payment submissions",
        "Multi-branch academic, staff & cash-flow executive analytics",
        "Role-based permissions with comprehensive enterprise audit trails",
        "100% paperless student admissions & digital document archives",
      ],
      ctaText: "Start Free Admin Trial",
      ctaLink: "/register",
    },
    teacher: {
      label: "Teachers & Educators",
      icon: "fa-chalkboard-user",
      badge: "Classroom Freedom",
      accent: "#ff5e1e",
      badgeBg: "rgba(255, 94, 30, 0.1)",
      title: "Spend Less Time on Spreadsheets, More Time Teaching",
      desc: "Designed to remove daily administrative friction. Mark attendance in seconds, calculate grades automatically with custom weightings, dispatch homework assignments, and communicate with parents effortlessly.",
      features: [
        "1-tap digital attendance with instant absent SMS alerts to parents",
        "Smart gradebook with automatic GPA, rank & report card generation",
        "Frictionless homework dispatch & online submission tracker",
        "Instant broadcast circulars to specific classes or student groups",
      ],
      ctaText: "Explore Teacher Tools",
      ctaLink: "/register",
    },
    student: {
      label: "Students",
      icon: "fa-graduation-cap",
      badge: "Student Success",
      accent: "#2563eb",
      badgeBg: "rgba(37, 99, 235, 0.1)",
      title: "A Crystal-Clear Path to Daily Academic Success",
      desc: "Empower students to take ownership of their learning journey. A clean personal dashboard provides immediate access to daily timetables, upcoming exams, published report cards, and digital library resources.",
      features: [
        "Personalized daily timetable, classroom schedules & syllabus tracker",
        "Instant exam schedule alerts and published report cards",
        "Digital library catalog with search, hold & renewal management",
        "Attendance percentage monitor and academic milestone progress",
      ],
      ctaText: "Preview Student Portal",
      ctaLink: "/student-login",
    },
    parent: {
      label: "Parents & Families",
      icon: "fa-heart",
      badge: "360° Peace of Mind",
      accent: "#10b981",
      badgeBg: "rgba(16, 185, 129, 0.1)",
      title: "Always In Touch With Your Child’s School Life",
      desc: "Stay effortlessly informed and involved. Receive real-time arrival notifications, pay tuition fees directly via school QR or eSewa with screenshot proof, track exam marks, and connect directly with educators with complete transparency.",
      features: [
        "Instant campus arrival & departure notification alerts",
        "Pay via school QR/eSewa, submit payment screenshots & receive verified receipts",
        "Direct, respectful communication channel with class teachers",
        "Live attendance overview, progress reports & school event calendar",
      ],
      ctaText: "Learn About Parent App",
      ctaLink: "/contact",
    },
  };

  /* ══════════════════════════════════════════════════════════════
     Section 5: Dynamic Country-Based Pricing (India ₹, Nepal रु, Global $)
  ══════════════════════════════════════════════════════════════ */
  type CountryCode = "IN" | "NP" | "GLOBAL";
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>("GLOBAL");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");

  interface DynamicPlan {
    id: number;
    name: string;
    max_students: number | null;
    max_teachers: number | null;
    fee_management_enabled: boolean;
    online_payment_enabled: boolean;
    is_active: boolean;
    resolved_pricing: {
      currency: string;
      symbol: string;
      price_monthly: number;
      price_yearly: number;
      price_key: string;
    };
  }

  const [dynamicPlans, setDynamicPlans] = useState<DynamicPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(true);

  const countryOptions: { code: CountryCode; label: string; flag: string; symbol: string; currencyName: string }[] = [
    { code: "IN", label: "India", flag: "🇮🇳", symbol: "₹", currencyName: "INR" },
    { code: "NP", label: "Nepal", flag: "🇳🇵", symbol: "रु ", currencyName: "NPR" },
    { code: "GLOBAL", label: "Global", flag: "🌐", symbol: "$", currencyName: "USD" },
  ];

  /* Auto-detect visitor's country: Timezone check (instant) + Geo-IP API */
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase();
      if (tz.includes("kathmandu")) {
        setSelectedCountry("NP");
      } else if (tz.includes("kolkata") || tz.includes("calcutta")) {
        setSelectedCountry("IN");
      }
    } catch {
      // Fallback
    }

    fetch("https://api.country.is")
      .then((res) => res.json())
      .then((data) => {
        if (data?.country === "IN") {
          setSelectedCountry("IN");
        } else if (data?.country === "NP") {
          setSelectedCountry("NP");
        } else if (data?.country) {
          setSelectedCountry("GLOBAL");
        }
      })
      .catch(() => {
        // Fallback already set by timezone
      });
  }, []);

  /* Fetch dynamic plans from live API whenever selectedCountry changes */
  useEffect(() => {
    let isMounted = true;
    setLoadingPlans(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

    fetch(`${apiUrl}/subscriptions/public/plans?country=${selectedCountry}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch public plans");
        return res.json();
      })
      .then((data) => {
        if (isMounted && data?.success && Array.isArray(data.data) && data.data.length > 0) {
          setDynamicPlans(data.data);
        }
      })
      .catch(() => {
        // Gracefully keep fallback curated pricing tiers if API is unreachable
      })
      .finally(() => {
        if (isMounted) setLoadingPlans(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCountry]);

  const pricingTiers = [
    {
      id: "starter",
      name: "Starter",
      badge: "Small Schools",
      tagline: "Ideal for preschools, daycares & standalone academies.",
      popular: false,
      studentCap: "Up to 250 Students",
      prices: {
        GLOBAL: { annual: 39, monthly: 49 },
        IN:     { annual: 2499, monthly: 2999 },
        NP:     { annual: 3999, monthly: 4999 },
      },
      features: [
        "Core student & staff records",
        "1-click daily attendance tracker",
        "Online enrollment & admissions",
        "Standard fee receipts & cash tracking",
        "Basic report card generator",
        "Email support (24–48h SLA)",
      ],
      ctaText: "Start 14-Day Free Trial",
      ctaHref: "/register?plan=starter",
    },
    {
      id: "growth",
      name: "Growth",
      badge: "Most Popular",
      topBadge: "Recommended Choice",
      tagline: "The complete automation suite for growing K-12 campuses.",
      popular: true,
      studentCap: "Up to 1,500 Students",
      prices: {
        GLOBAL: { annual: 79, monthly: 99 },
        IN:     { annual: 5499, monthly: 6999 },
        NP:     { annual: 7999, monthly: 9999 },
      },
      features: [
        "Everything in Starter, plus:",
        "Parent & Teacher dedicated mobile apps",
        "Automated WhatsApp & SMS notifications",
        "Online fee collection gateway (UPI, Cards)",
        "Automated conflict-free timetable scheduler",
        "Exams, GPA calculations & ranked report cards",
        "Priority 24/7 phone & live chat support",
      ],
      ctaText: "Claim 14-Day Free Trial",
      ctaHref: "/register?plan=growth",
    },
    {
      id: "enterprise",
      name: "Enterprise",
      badge: "Multi-Branch & Trusts",
      tagline: "Dedicated infrastructure for large institutions & school groups.",
      popular: false,
      studentCap: "Unlimited Students",
      prices: {
        GLOBAL: { annual: 159, monthly: 199 },
        IN:     { annual: 11999, monthly: 14999 },
        NP:     { annual: 16999, monthly: 19999 },
      },
      features: [
        "Everything in Growth, plus:",
        "Centralized multi-campus dashboard",
        "Granular role-based permissions & audit logs",
        "Teacher payroll & biometric hardware sync",
        "Dedicated onboarding manager & free data migration",
        "Enterprise 99.9% uptime SLA guarantee",
        "Custom API & webhook integrations",
      ],
      ctaText: "Contact Enterprise Sales",
      ctaHref: "/contact?type=enterprise",
    },
  ];

  /* ── Compute dynamic rendered pricing tiers & live savings percentage ── */
  const renderedTiers = dynamicPlans.length > 0
    ? dynamicPlans.map((plan, idx) => {
        const isMiddle = idx === 1 || plan.name.toLowerCase() === "plus" || plan.name.toLowerCase() === "growth";
        const rp = plan.resolved_pricing;
        const monthlyRate = Number(rp?.price_monthly) || 0;
        const yearlyRate = Number(rp?.price_yearly) || 0;
        const currencySymbol = rp?.symbol || (countryOptions.find((c) => c.code === selectedCountry)?.symbol || "$");

        let annualMonthlyRate = yearlyRate;
        let savingsPct = 0;
        let annualSavingsAmt = 0;
        let totalAnnualPrice = yearlyRate;

        if (yearlyRate > monthlyRate && monthlyRate > 0) {
          annualMonthlyRate = Math.round(yearlyRate / 12);
          annualSavingsAmt = (monthlyRate * 12) - yearlyRate;
          totalAnnualPrice = yearlyRate;
          if (annualSavingsAmt > 0) {
            savingsPct = Math.round((annualSavingsAmt / (monthlyRate * 12)) * 100);
          }
        } else if (yearlyRate > 0 && yearlyRate <= monthlyRate) {
          annualMonthlyRate = yearlyRate;
          annualSavingsAmt = (monthlyRate - yearlyRate) * 12;
          totalAnnualPrice = yearlyRate * 12;
          if (monthlyRate > 0) {
            savingsPct = Math.round(((monthlyRate - yearlyRate) / monthlyRate) * 100);
          }
        } else {
          annualMonthlyRate = monthlyRate;
          totalAnnualPrice = monthlyRate * 12;
          savingsPct = 0;
          annualSavingsAmt = 0;
        }

        const price = billingCycle === "annual" ? annualMonthlyRate : monthlyRate;

        const features: string[] = [
          plan.max_students ? `Capacity for up to ${plan.max_students.toLocaleString()} students` : "Unlimited student admissions",
          plan.max_teachers ? `Up to ${plan.max_teachers.toLocaleString()} teacher & staff accounts` : "Unlimited staff accounts",
          plan.fee_management_enabled
            ? "Automated fee billing & receipt generator"
            : "Standard cash fee collection logs",
          plan.online_payment_enabled
            ? (selectedCountry === "NP" ? "School QR (eSewa/Khalti) screenshot submission & admin verification" : "School QR (UPI/Bank) screenshot submission & admin verification")
            : "Standard manual cash fee collection logs",
          isMiddle || idx >= 2
            ? "Dedicated Parent & Teacher mobile apps"
            : "Mobile-responsive web portal for teachers & parents",
          isMiddle || idx >= 2
            ? "Automated WhatsApp & SMS attendance alerts"
            : "1-click daily attendance tracker",
          idx >= 2
            ? "Multi-branch admin console & audit logs"
            : "Exams, GPA calculations & report cards",
          isMiddle || idx >= 2
            ? "Priority 24/7 phone & live chat support"
            : "Standard email support (24–48h SLA)",
        ];

        return {
          id: String(plan.id),
          name: plan.name,
          badge: isMiddle ? "Most Popular" : idx === 0 ? "Starter & Small Campus" : "Multi-Branch & Trusts",
          topBadge: "Recommended Choice",
          tagline: idx === 0
            ? "Essential automation for growing schools & academies."
            : isMiddle
              ? "The complete school operating system for modern K-12 campuses."
              : "Dedicated infrastructure for large educational institutions & trusts.",
          popular: isMiddle,
          studentCap: plan.max_students ? `Up to ${plan.max_students.toLocaleString()} Students` : "Unlimited Students",
          price,
          currencySymbol,
          savingsPct,
          annualSavingsAmt,
          totalAnnualPrice,
          features,
          ctaText: idx >= 2 ? "Contact Enterprise Sales" : (isMiddle ? "Claim 14-Day Free Trial" : "Start 14-Day Free Trial"),
          ctaHref: idx >= 2 ? `/contact?plan=${encodeURIComponent(plan.name.toLowerCase())}` : `/register?plan=${encodeURIComponent(plan.name.toLowerCase())}`,
        };
      })
    : pricingTiers.map((tier) => {
        const currentPrices = tier.prices[selectedCountry] || tier.prices.GLOBAL;
        const monthlyRate = currentPrices.monthly;
        const annualMonthlyRate = currentPrices.annual;
        const totalAnnualPrice = annualMonthlyRate * 12;
        const annualSavingsAmt = (monthlyRate - annualMonthlyRate) * 12;
        const savingsPct = Math.round((annualSavingsAmt / (monthlyRate * 12)) * 100) || 20;
        const price = billingCycle === "annual" ? annualMonthlyRate : monthlyRate;
        const currencySymbol = countryOptions.find((c) => c.code === selectedCountry)?.symbol || "$";
        return {
          id: tier.id,
          name: tier.name,
          badge: tier.badge,
          topBadge: tier.topBadge,
          tagline: tier.tagline,
          popular: tier.popular,
          studentCap: tier.studentCap,
          price,
          currencySymbol,
          savingsPct,
          annualSavingsAmt,
          totalAnnualPrice,
          features: tier.features,
          ctaText: tier.ctaText,
          ctaHref: tier.ctaHref,
        };
      });

  const maxSavingsPct = renderedTiers.length > 0
    ? Math.max(...renderedTiers.map((t) => t.savingsPct).filter((s) => s > 0), 0) || 20
    : 20;

  /* ══════════════════════════════════════════════════════════════
     Section 6: Interactive Frequently Asked Questions (FAQs)
  ══════════════════════════════════════════════════════════════ */
  interface FaqItem {
    id: number;
    question: string;
    answer: string;
    category: "setup" | "features" | "billing" | "security";
    badge: string;
  }

  const [openFaq, setOpenFaq] = useState<number | null>(1); // First item open by default
  const [faqCategory, setFaqCategory] = useState<string>("all");
  const [showAllFaqs, setShowAllFaqs] = useState(false);

  const faqCategories = [
    { key: "all", label: "All Questions" },
    { key: "setup", label: "Setup & Migration" },
    { key: "features", label: "BS Calendar & Apps" },
    { key: "billing", label: "Fees & Payments" },
    { key: "security", label: "Security & Backups" },
  ];

  const faqData: FaqItem[] = [
    {
      id: 1,
      question: "How easy is it to migrate our existing student & staff data from Excel or other legacy software?",
      answer: "Extremely easy. Skoolio provides 1-click bulk Excel and CSV import templates for students, parents, teachers, and past fee records. In addition, our dedicated onboarding engineers provide free assisted migration to ensure all your historical data is imported cleanly with zero school downtime.",
      category: "setup",
      badge: "Migration & Setup",
    },
    {
      id: 2,
      question: "Does Skoolio support the Nepali Bikram Sambat (BS) calendar and dual date systems?",
      answer: "Yes, 100%! Skoolio has native first-class Bikram Sambat (BS) calendar support alongside Gregorian (AD). Schools in Nepal can configure BS academic sessions, track daily attendance by BS months (Baishakh to Chaitra), schedule exam terms, and generate fee invoices natively in BS.",
      category: "features",
      badge: "Calendar & Nepal BS",
    },
    {
      id: 3,
      question: "How do online fee payments & QR verification work in Skoolio?",
      answer: "Parents pay directly to the school account by scanning the school's official QR code (eSewa, Khalti, Bank QR, or UPI) and submit their payment screenshot along with the transaction details. The school accountant or admin reviews the submission in the 'Payment Requests' verification panel with one click. Once approved, the student's dues are instantly updated, and an official verified receipt is issued.",
      category: "billing",
      badge: "Fee Collection",
    },
    {
      id: 4,
      question: "Are there dedicated mobile applications for teachers, parents, and students?",
      answer: "Yes. Teachers can mark attendance and input exam marks right from their mobile phones. Parents get dedicated instant alerts when their child arrives at school, access to live fee receipts, report cards, and direct homework updates.",
      category: "features",
      badge: "Mobile Apps",
    },
    {
      id: 5,
      question: "How secure is our school's student, exam, and financial records?",
      answer: "We use bank-grade 256-bit SSL encryption for all data in transit and at rest. Automated encrypted offsite backups are generated daily. Granular role-based access control guarantees that teachers, accountants, and staff only see the exact data they are authorized to view.",
      category: "security",
      badge: "Security & Backups",
    },
    {
      id: 6,
      question: "Can we try Skoolio before committing to a paid subscription?",
      answer: "Yes! Every school receives a 14-day free trial with full access to all features. No credit card is required to register. You can invite your staff, test the attendance tracker, and experience the platform firsthand.",
      category: "billing",
      badge: "Free Trial",
    },
    {
      id: 7,
      question: "Can trustees or school chains manage multiple branch campuses from one place?",
      answer: "Yes. Our multi-campus architecture allows group administrators and trustees to toggle between different school branches, view consolidated fee collections, analyze staff attendance, and compare academic outcomes from a single master dashboard.",
      category: "setup",
      badge: "Multi-Campus",
    },
    {
      id: 8,
      question: "What kind of training and customer support is included?",
      answer: "We provide full live video onboarding for your admin and teaching staff, comprehensive step-by-step video tutorials, and 24/7 priority phone, WhatsApp, and live chat support to resolve any questions instantly.",
      category: "setup",
      badge: "Training & SLA",
    },
    {
      id: 9,
      question: "Can we generate custom report cards and calculate GPA/letter grades automatically?",
      answer: "Yes. Skoolio features a customizable exam evaluation engine that supports custom subject weightings, GPA calculation, class rankings, and 1-click printable PDF report cards branded with your school logo and grading rubrics.",
      category: "features",
      badge: "Exams & Grading",
    },
    {
      id: 10,
      question: "Can Skoolio sync with biometric fingerprint or facial recognition devices for staff attendance?",
      answer: "Yes. Higher tier plans support hardware biometric synchronization so staff check-ins and check-outs automatically reflect on teacher attendance logs and monthly payroll calculations with zero manual entry.",
      category: "security",
      badge: "Biometrics & Payroll",
    },
  ];

  /* ══════════════════════════════════════════════════════════════
     Section 7: Social Proof & Verified Testimonials (3D Coverflow)
  ══════════════════════════════════════════════════════════════ */
  const [activeTestimonial, setActiveTestimonial] = useState(1);
  const [testimonialHovered, setTestimonialHovered] = useState(false);

  const testimonialsStats = [
    { number: "78%", isAccent: true, label: "Faster fee collection & QR verification" },
    { number: "1.5h+", isAccent: false, label: "Saved per teacher daily on grading & records" },
    { number: "99.4%", isAccent: false, label: "On-time parent arrival & fee notification delivery" },
    { number: "100%", isAccent: true, label: "Zero data loss during Excel legacy migration" },
  ];

  const testimonialsData = [
    {
      id: 1,
      name: "Dr. Ramesh Adhikari",
      role: "Principal",
      school: "Valley View Academy",
      location: "Kathmandu, Nepal",
      flag: "🇳🇵",
      initial: "R",
      logo: "/school-logo/school-logo1.png",
      avatarBg: "linear-gradient(135deg, #002b66, #2563eb)",
      rating: 5,
      tag: "1,200+ Students • BS Calendar",
      quote:
        "Switching to Skoolio was effortless. Having native Bikram Sambat (BS) calendar support for our Baishakh-to-Chaitra academic sessions solved our biggest frustration with other platforms. Daily attendance, exam marksheets, and report cards are now 100% paperless.",
    },
    {
      id: 2,
      name: "Pooja Sharma",
      role: "Senior Accounts Head",
      school: "Greenwood Global School",
      location: "New Delhi, India",
      flag: "🇮🇳",
      initial: "P",
      logo: "/school-logo/school-logo2.png",
      avatarBg: "linear-gradient(135deg, #ff5e1e, #ea580c)",
      rating: 5,
      tag: "₹2.4 Cr+ Annual Fees Reconciled",
      quote:
        "The school QR payment and screenshot verification module has eliminated our entire month-end reconciliation headache. Parents scan our school QR, submit payment proof, and we verify hundreds of fee transactions in minutes with zero ledger mismatch.",
    },
    {
      id: 3,
      name: "Sunil Thapa",
      role: "Academic Director",
      school: "Mount Annapurna Secondary School",
      location: "Pokhara, Nepal",
      flag: "🇳🇵",
      initial: "S",
      logo: "/school-logo/school-logo3.png",
      avatarBg: "linear-gradient(135deg, #10b981, #059669)",
      rating: 5,
      tag: "98% On-Time Attendance Alerts",
      quote:
        "Our teachers save over an hour every day because exam marksheets, GPA calculations, and student rank reports are generated automatically. Parents constantly praise the dedicated mobile app for instant campus arrival and attendance alerts.",
    },
    {
      id: 4,
      name: "Anand Vardhan",
      role: "Managing Trustee",
      school: "Bright Future Educational Trust",
      location: "Bangalore, India",
      flag: "🇮🇳",
      initial: "A",
      logo: "/school-logo/school-logo1.png",
      avatarBg: "linear-gradient(135deg, #9333ea, #7c3aed)",
      rating: 5,
      tag: "3 Campuses • Multi-Branch Oversight",
      quote:
        "We operate 3 campuses and were drowning in fragmented Excel sheets. Skoolio's centralized multi-branch console lets our executive board monitor admissions, student growth, and teacher payroll across all branches in real time from one dashboard.",
    },
    {
      id: 5,
      name: "Bikash Gurung",
      role: "Finance Officer",
      school: "Everest Horizon English School",
      location: "Lalitpur, Nepal",
      flag: "🇳🇵",
      initial: "B",
      logo: "/school-logo/school-logo2.png",
      avatarBg: "linear-gradient(135deg, #0284c7, #0369a1)",
      rating: 5,
      tag: "eSewa & Khalti QR Collection",
      quote:
        "Parents love that they don't have to stand in bank queues during fee week. They simply transfer via eSewa or Khalti on the school QR and upload their screenshot. Verification is instant, and verifiable digital receipts are issued immediately.",
    },
    {
      id: 6,
      name: "Meera Krishnan",
      role: "Head of Academic Operations",
      school: "St. Jude's International School",
      location: "Hyderabad, India",
      flag: "🇮🇳",
      initial: "M",
      logo: "/school-logo/school-logo3.png",
      avatarBg: "linear-gradient(135deg, #d97706, #b45309)",
      rating: 5,
      tag: "100% Conflict-Free Timetable",
      quote:
        "The automated timetable generator saved our academic committee days of manual trial and error. Room clashes and faculty overlap were eliminated instantly, and teachers can access their daily period schedules directly from their phones.",
    },
  ];

  /* Auto-advance 3D testimonials carousel every 5s, pauses on user hover */
  useEffect(() => {
    if (testimonialHovered) return;
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonialsData.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [testimonialHovered, testimonialsData.length]);

  return (
    <div className={s.page}>
      {/* ═══════════════════════════════ NAVBAR ═══════════════════════════════ */}
      <nav className={`${s.nav}${scrolled ? ` ${s.navScrolled}` : ""}`} role="navigation" aria-label="Main Navigation">
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
          <a href="#features" className={s.navLink}>Features</a>
          <a href="#solutions" className={s.navLink}>
            Solutions <i className={`fa-solid fa-chevron-down ${s.navLinkChevron}`} />
          </a>
          <a href="#pricing" className={s.navLink}>Pricing</a>
          <a href="#testimonials" className={s.navLink}>Reviews</a>
          <a href="#faq" className={s.navLink}>FAQs</a>
          <Link href="/contact" className={s.navLink}>Contact</Link>
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

      {/* ═══════════════════════════════ HERO SECTION ═══════════════════════════════ */}
      <header className={s.hero} id="home">
        <div className={s.heroInner}>
          <div className={s.heroLeft}>
            {/* Eyebrow Pill Badge */}
            <div className={s.heroBadge}>
              <span className={s.heroBadgeDot} />
              <span>Trusted By 500+ Schools Worldwide</span>
            </div>

            {/* Main Headline */}
            <h1 className={s.heroTitle}>
              Run Your School.<br />
              <span className={s.heroTitleGradient}>Simply &amp; Effortlessly.</span>
            </h1>

            {/* Subheadline */}
            <p className={s.heroSub}>
              The unified platform for admissions, attendance, fee collection, exams, and parent communication. Designed to help school leaders, teachers, and students thrive.
            </p>

            {/* CTA Buttons */}
            <div className={s.heroActions}>
              <Link href="/register" className={s.heroBtnPrimary}>
                <span>Get Started Free</span>
                <i className={`fa-solid fa-arrow-right ${s.heroBtnIcon}`} />
              </Link>
            </div>

            {/* Micro-Trust Strip */}
            <div className={s.heroTrustRow}>
              <div className={s.heroTrustBadge}>
                <span className={s.heroTrustIconWrap}>
                  <i className="fa-solid fa-shield-check" />
                </span>
                <span className={s.heroTrustBadgeText}>14-day free trial period</span>
                <span className={s.heroTrustBadgeTag}>No credit card</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Illustration & Stage */}
          <div className={s.heroRight}>
            {/* Ambient Backdrop Stage & Halo */}
            <div className={s.heroImageStage} />
            <div className={s.heroFloorShadow} />

            <div className={s.heroImageWrap}>
              {/* Central 3D Illustration */}
              <Image
                src="/Landing_page/hero-img.png"
                alt="Skoolio School Management Ecosystem"
                width={612}
                height={408}
                priority
                className={s.heroImage}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════ SECTION 2: SOCIAL PROOF ═══════════════════════════════ */}
      <section className={s.trustSection} id="schools">
        {/* Subtle Ambient Glow */}
        <div className={s.trustAmbientGlow} aria-hidden="true" />

        {/* ── Heading ── */}
        <div className={s.trustHeading}>
          <h2 className={s.trustTitle}>
            Empowering Modern Education With <span className={s.gradientText}>Skoolio</span>
          </h2>
          <p className={s.trustSubtitle}>
            Leading schools trust our unified ERP to streamline admissions, fees, exams, and parent collaboration.
          </p>
        </div>

        {/* ── Coverflow Card Carousel (Infinite Circular Wrap) ── */}
        <div className={s.coverflowStage}>
          {schools.map((school, i) => {
            const n = schools.length;
            let offset = ((i - activeCard) % n + n) % n;
            if (offset > n / 2) offset -= n;

            const isActive = offset === 0;
            let posClass = s.cardActive;
            if (offset === -1) posClass = s.cardLeft1;
            else if (offset === 1) posClass = s.cardRight1;
            else if (offset <= -2) posClass = s.cardLeft2;
            else if (offset >= 2) posClass = s.cardRight2;

            return (
              <div
                key={i}
                className={`${s.schoolCard} ${isActive ? s.schoolCardActive : ''} ${posClass}`}
                onClick={() => !isActive && setActiveCard(i)}
                role="button"
                tabIndex={0}
                aria-label={`View ${school.name}`}
              >
                {/* School Logo */}
                <div className={s.schoolCardLogo}>
                  {school.logo ? (
                    <Image
                      src={school.logo}
                      alt={`${school.name} Logo`}
                      width={210}
                      height={175}
                      className={s.schoolCardLogoImg}
                      priority={isActive}
                    />
                  ) : (
                    <div className={s.schoolCardLogoInitial} style={{ background: school.color }}>
                      {school.initial}
                    </div>
                  )}
                </div>

                {/* School Info */}
                <div className={s.schoolCardInfo}>
                  <h3 className={s.schoolCardName}>{school.name}</h3>
                  <p className={s.schoolCardLocation}>
                    <i className="fa-solid fa-location-dot" /> {school.location}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </section>

      {/* ═══════════════════════════════ SECTION 3: PRODUCT FEATURES ═══════════════════════════════ */}
      <section className={s.featuresSection} id="features">
        <div className={s.featuresInner}>
          {/* Header */}
          <div className={s.featuresHeading}>
            <h2 className={s.featuresTitle}>
              Everything Your School Needs to <span className={s.gradientText}>Thrive</span>
            </h2>
          </div>

          {/* 3-Column Visual Layout (Desktop: Left 5, Center Screen, Right 5) */}
          <div className={s.featureShowcaseLayout}>
            {/* Left Column (5 Cards - Overlaps into left of image) */}
            <div className={`${s.featureCardsColumn} ${s.featureCardsLeft}`}>
              {leftFeatures.map((feat, idx) => (
                <div key={idx} className={`${s.featurePillCard} ${s.featurePillLeft}`}>
                  <div className={s.featurePillIcon} style={{ background: feat.bg }}>
                    <i className={`fa-solid ${feat.icon}`} />
                  </div>
                  <div className={s.featurePillText}>
                    <h4 className={s.featurePillTitle}>{feat.title}</h4>
                    <p className={s.featurePillDesc}>{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Center Column (Dashboard Image) */}
            <div className={s.featureShowcaseCenter}>
              <div className={s.featureShowcaseAmbient} aria-hidden="true" />
              <div className={s.featureImageContainer}>
                <Image
                  src="/feature-bg.png"
                  alt="Skoolio Complete ERP Dashboard Preview"
                  width={1120}
                  height={560}
                  className={s.featureMainImage}
                  priority
                />
              </div>
            </div>

            {/* Right Column (5 Cards - Overlaps into right of image) */}
            <div className={`${s.featureCardsColumn} ${s.featureCardsRight}`}>
              {rightFeatures.map((feat, idx) => (
                <div key={idx} className={`${s.featurePillCard} ${s.featurePillRight}`}>
                  <div className={s.featurePillIcon} style={{ background: feat.bg }}>
                    <i className={`fa-solid ${feat.icon}`} />
                  </div>
                  <div className={s.featurePillText}>
                    <h4 className={s.featurePillTitle}>{feat.title}</h4>
                    <p className={s.featurePillDesc}>{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Feature Slider (Visible <= 1080px) - 5 Features per slide, auto-advances 3s, pause on hover/touch */}
          <div
            className={s.mobileFeatureSlider}
            onMouseEnter={() => setFeatureHovered(true)}
            onMouseLeave={() => setFeatureHovered(false)}
            onTouchStart={() => setFeatureHovered(true)}
            onTouchEnd={() => setFeatureHovered(false)}
          >
            <div className={s.mobileFeatureCardList} key={featureSlide}>
              {(featureSlide === 0 ? leftFeatures : rightFeatures).map((feat, idx) => (
                <div key={idx} className={s.featurePillCard}>
                  <div className={s.featurePillIcon} style={{ background: feat.bg }}>
                    <i className={`fa-solid ${feat.icon}`} />
                  </div>
                  <div className={s.featurePillText}>
                    <h4 className={s.featurePillTitle}>{feat.title}</h4>
                    <p className={s.featurePillDesc}>{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Slider Controls: Indicator Dots & Single Next Button */}
            <div className={s.mobileSliderControls}>
              <div className={s.mobileSliderDots}>
                <button
                  type="button"
                  aria-label="Slide 1: Admissions, Students, Attendance, Exams, Fees"
                  className={`${s.mobileSliderDot} ${featureSlide === 0 ? s.mobileSliderDotActive : ""}`}
                  onClick={() => setFeatureSlide(0)}
                />
                <button
                  type="button"
                  aria-label="Slide 2: Staff, Classroom, Parents, Timetable, Analytics"
                  className={`${s.mobileSliderDot} ${featureSlide === 1 ? s.mobileSliderDotActive : ""}`}
                  onClick={() => setFeatureSlide(1)}
                />
              </div>

              <button
                type="button"
                className={s.mobileNextBtn}
                onClick={() => setFeatureSlide((prev) => (prev === 0 ? 1 : 0))}
                aria-label="Next features slide"
              >
                <span>{featureSlide === 0 ? "Next Features" : "First Features"}</span>
                <i className={`fa-solid ${featureSlide === 0 ? "fa-arrow-right" : "fa-rotate-left"}`} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ SECTION 4: ROLE-BASED SOLUTIONS ═══════════════════════════════ */}
      <section className={s.solutionsSection} id="solutions">
        <div className={s.solutionsInner}>
          {/* Section Header */}
          <div className={s.solutionsHeading}>
            <h2 className={s.solutionsTitle}>
              Designed for Everyone Who Makes <span className={s.gradientText}>School Happen</span>
            </h2>
            <p className={s.solutionsSub}>
              Whether you run the institution, lead the classroom, study hard, or nurture at home — Skoolio connects every stakeholder with purpose-built workflows.
            </p>
          </div>

          {/* Interactive Role Switcher Tabs */}
          <div className={s.solutionsTabs} role="tablist" aria-label="Stakeholder Solutions">
            {(Object.keys(roleSolutions) as RoleKey[]).map((key) => {
              const r = roleSolutions[key];
              const isActive = activeRole === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`${s.solutionsTabBtn} ${isActive ? s.solutionsTabBtnActive : ""}`}
                  onClick={() => setActiveRole(key)}
                  style={isActive ? { borderColor: r.accent, color: r.accent } : undefined}
                >
                  <span
                    className={s.solutionsTabIcon}
                    style={{
                      background: isActive ? r.accent : "#f1f5f9",
                      color: isActive ? "#ffffff" : "#64748b",
                    }}
                  >
                    <i className={`fa-solid ${r.icon}`} />
                  </span>
                  <span className={s.solutionsTabLabel}>{r.label}</span>
                </button>
              );
            })}
          </div>

          {/* Role Showcase Stage */}
          <div className={s.solutionsStage}>
            {/* Left: Active Role Card */}
            <div className={s.solutionsCard} key={activeRole}>
              <div
                className={s.solutionsRoleBadge}
                style={{
                  background: roleSolutions[activeRole].badgeBg,
                  color: roleSolutions[activeRole].accent,
                  borderColor: `${roleSolutions[activeRole].accent}33`,
                }}
              >
                <i className={`fa-solid ${roleSolutions[activeRole].icon}`} />
                <span>{roleSolutions[activeRole].badge}</span>
              </div>

              <h3 className={s.solutionsRoleTitle}>{roleSolutions[activeRole].title}</h3>
              <p className={s.solutionsRoleDesc}>{roleSolutions[activeRole].desc}</p>

              {/* Feature Checklist */}
              <div className={s.solutionsFeatureList}>
                {roleSolutions[activeRole].features.map((feat, idx) => (
                  <div key={idx} className={s.solutionsFeatureItem}>
                    <div
                      className={s.solutionsCheckIcon}
                      style={{ background: `${roleSolutions[activeRole].accent}18`, color: roleSolutions[activeRole].accent }}
                    >
                      <i className="fa-solid fa-check" />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <div className={s.solutionsActionWrap}>
                <Link
                  href={roleSolutions[activeRole].ctaLink}
                  className={s.solutionsCtaBtn}
                  style={{ background: roleSolutions[activeRole].accent }}
                >
                  <span>{roleSolutions[activeRole].ctaText}</span>
                  <i className="fa-solid fa-arrow-right" />
                </Link>
                <div className={s.solutionsTrustMini}>
                  <i className="fa-solid fa-shield-halved" />
                  <span>Role-based secure access</span>
                </div>
              </div>
            </div>

            {/* Right: Illustration Visual Stage */}
            <div className={s.solutionsVisual}>
              <div className={s.solutionsVisualAmbient} aria-hidden="true" />
              <div className={s.solutionsImageContainer}>
                <Image
                  src="/connected-img.png"
                  alt="Skoolio Connected School Community"
                  width={960}
                  height={540}
                  className={s.solutionsImage}
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ SECTION 5: PRICING SECTION ═══════════════════════════════ */}
      <section className={s.pricingSection} id="pricing">
        <div className={s.pricingAmbientGlow} aria-hidden="true" />

        <div className={s.pricingInner}>
          {/* Header */}
          <div className={s.pricingHeading}>
            <h2 className={s.pricingTitle}>
              Simple, Predictable Plans for <span className={s.gradientText}>Every Campus</span>
            </h2>
            <p className={s.pricingSub}>
              Start with a 14-day free trial. No credit card required. Upgrade, downgrade, or cancel anytime.
            </p>
          </div>

          {/* Controls: Country/Currency Selector & Billing Cycle Toggle */}
          <div className={s.pricingControlsRow}>
            {/* Country/Currency Selector */}
            <div className={s.countrySelectorPill}>
              <span className={s.countrySelectorLabel}>
                <i className="fa-solid fa-globe" />
                <span>Region:</span>
              </span>
              <div className={s.countryButtons}>
                {countryOptions.map((co) => {
                  const isSel = selectedCountry === co.code;
                  return (
                    <button
                      key={co.code}
                      type="button"
                      className={`${s.countryBtn} ${isSel ? s.countryBtnActive : ""}`}
                      onClick={() => setSelectedCountry(co.code)}
                      aria-label={`View pricing in ${co.label} (${co.currencyName})`}
                    >
                      <span className={s.countryFlag}>{co.flag}</span>
                      <span className={s.countryName}>{co.label}</span>
                      <span className={s.countrySymbol}>(<CurrencySymbol symbol={co.symbol} />)</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Billing Cycle Pill Toggle */}
            <div className={s.pricingTogglePill}>
              <button
                type="button"
                className={`${s.pricingToggleBtn} ${billingCycle === "monthly" ? s.pricingToggleBtnActive : ""}`}
                onClick={() => setBillingCycle("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`${s.pricingToggleBtn} ${billingCycle === "annual" ? s.pricingToggleBtnActive : ""}`}
                onClick={() => setBillingCycle("annual")}
              >
                <span>Annual</span>
                <span className={s.pricingSaveTag}>Save {maxSavingsPct}%</span>
              </button>
            </div>
          </div>

          {/* 3 Elevated Tier Cards */}
          <div className={s.pricingCardsGrid}>
            {renderedTiers.map((tier) => {
              return (
                <div
                  key={tier.id}
                  className={`${s.tierCard} ${tier.popular ? s.tierCardPopular : ""}`}
                >
                  {tier.popular && (
                    <div className={s.tierPopularPill}>
                      <i className="fa-solid fa-fire" />
                      <span>{tier.topBadge}</span>
                    </div>
                  )}

                  {/* Header: Plan Name & Badge on the same line */}
                  <div className={s.tierHeader}>
                    <div className={s.tierTitleRow}>
                      <h3 className={s.tierName}>{tier.name}</h3>
                      <span
                        className={s.tierRolePill}
                        style={{
                          background: tier.popular ? "rgba(255, 94, 30, 0.1)" : "rgba(0, 43, 102, 0.06)",
                          color: tier.popular ? "#ff5e1e" : "#002b66",
                        }}
                      >
                        {tier.badge}
                      </span>
                    </div>
                    <p className={s.tierTagline}>{tier.tagline}</p>
                  </div>

                  {/* Price Block */}
                  <div className={s.tierPriceSection}>
                    <div className={s.tierPriceAmountRow}>
                      <span className={s.tierCurrency}><CurrencySymbol symbol={tier.currencySymbol} /></span>
                      <span className={s.tierPriceNumber}>{tier.price.toLocaleString()}</span>
                      <span className={s.tierPricePeriod}>/mo</span>
                    </div>
                    <div className={s.tierBillingHint}>
                      {billingCycle === "annual" ? (
                        tier.savingsPct > 0 ? (
                          <span>
                            Billed annually: <CurrencySymbol symbol={tier.currencySymbol} />{tier.totalAnnualPrice.toLocaleString()}/yr{" "}
                            <strong style={{ color: "#10b981" }}>
                              (Save <CurrencySymbol symbol={tier.currencySymbol} />{tier.annualSavingsAmt.toLocaleString()} · {tier.savingsPct}%)
                            </strong>
                          </span>
                        ) : (
                          <>Billed annually: <CurrencySymbol symbol={tier.currencySymbol} />{tier.totalAnnualPrice.toLocaleString()}/yr</>
                        )
                      ) : (
                        <span>
                          Billed monthly, cancel anytime
                          {tier.savingsPct > 0 ? ` · Save ${tier.savingsPct}% on Annual` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Capacity Ribbon */}
                  <div className={s.tierCapacityBadge}>
                    <i className="fa-solid fa-users" />
                    <span>{tier.studentCap}</span>
                  </div>

                  <div className={s.tierDivider} />

                  {/* Features List */}
                  <div className={s.tierFeaturesList}>
                    {tier.features.map((feat, fIdx) => (
                      <div key={fIdx} className={s.tierFeatureItem}>
                        <div
                          className={s.tierCheckIcon}
                          style={{
                            background: tier.popular ? "rgba(255, 94, 30, 0.12)" : "rgba(16, 185, 129, 0.12)",
                            color: tier.popular ? "#ff5e1e" : "#10b981",
                          }}
                        >
                          <i className="fa-solid fa-check" />
                        </div>
                        <span className={fIdx === 0 && feat.includes("Everything") ? s.tierFeatureHighlight : undefined}>
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Action CTA */}
                  <Link
                    href={tier.ctaHref}
                    className={`${s.tierCtaBtn} ${tier.popular ? s.tierCtaBtnPopular : s.tierCtaBtnStandard}`}
                  >
                    <span>{tier.ctaText}</span>
                    <i className="fa-solid fa-arrow-right" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ SECTION 7: SOCIAL PROOF & TESTIMONIALS (3D COVERFLOW) ═══════════════════════════════ */}
      <section className={s.testimonialsSection} id="testimonials">
        <div className={s.testimonialsAmbientGlow} aria-hidden="true" />

        <div className={s.testimonialsInner}>
          {/* Section Header (Badge and Filter Tabs Removed per user request) */}
          <div className={s.testimonialsHeading}>
            <h2 className={s.testimonialsTitle}>
              Trusted by 150+ Schools Across <span className={s.gradientText}>Nepal &amp; India</span>
            </h2>
            <p className={s.testimonialsSub}>
              See how modern school leaders eliminated paper bottlenecks, accelerated fee reconciliation, and empowered teachers with Skoolio.
            </p>
          </div>

          {/* Quantifiable Impact Metrics Ribbon */}
          <div className={s.testimonialsStatsRow}>
            {testimonialsStats.map((st, sIdx) => (
              <div key={sIdx} className={s.testimonialsStatCard}>
                <div
                  className={`${s.testimonialsStatNumber} ${st.isAccent ? s.testimonialsStatNumberAccent : ""}`}
                >
                  {st.number}
                </div>
                <p className={s.testimonialsStatLabel}>{st.label}</p>
              </div>
            ))}
          </div>

          {/* ── 3D Coverflow Card Carousel ── */}
          <div
            className={s.testimonialsCarouselWrap}
            onMouseEnter={() => setTestimonialHovered(true)}
            onMouseLeave={() => setTestimonialHovered(false)}
          >
            {/* Prev Navigation Button */}
            <button
              type="button"
              className={`${s.testimonialsNavBtn} ${s.testimonialsNavBtnLeft}`}
              onClick={() =>
                setActiveTestimonial(
                  (prev) => (prev - 1 + testimonialsData.length) % testimonialsData.length
                )
              }
              aria-label="Previous testimonial"
            >
              <i className="fa-solid fa-chevron-left" />
            </button>

            {/* 3D Coverflow Stage */}
            <div className={s.testimonialsCoverflowStage}>
              {testimonialsData.map((t, i) => {
                const n = testimonialsData.length;
                let offset = ((i - activeTestimonial) % n + n) % n;
                if (offset > n / 2) offset -= n;

                const isActive = offset === 0;
                let posClass = s.tCardActive;
                if (offset === -1) posClass = s.tCardLeft1;
                else if (offset === 1) posClass = s.tCardRight1;
                else if (offset === -2) posClass = s.tCardLeft2;
                else if (offset === 2) posClass = s.tCardRight2;
                else if (offset < -2) posClass = s.tCardFarLeft;
                else if (offset > 2) posClass = s.tCardFarRight;

                return (
                  <div
                    key={t.id}
                    className={`${s.testimonialCoverflowCard} ${isActive ? s.testimonialCoverflowCardActive : ""} ${posClass}`}
                    onClick={() => !isActive && setActiveTestimonial(i)}
                    role="button"
                    tabIndex={0}
                    aria-label={`View story by ${t.name}`}
                  >
                    {/* Top rating & tag bar */}
                    <div className={s.testimonialCardTop}>
                      <div className={s.testimonialStars} aria-label="5 out of 5 stars">
                        {[...Array(t.rating)].map((_, rIdx) => (
                          <i key={rIdx} className="fa-solid fa-star" />
                        ))}
                      </div>
                      <span className={s.testimonialTag}>{t.tag}</span>
                    </div>

                    {/* Quote text */}
                    <div className={s.testimonialQuoteWrap}>
                      <i className={`fa-solid fa-quote-left ${s.testimonialQuoteIcon}`} aria-hidden="true" />
                      <p className={s.testimonialQuote}>
                        &ldquo;{t.quote}&rdquo;
                      </p>
                    </div>

                    {/* Author & School Details */}
                    <div className={s.testimonialAuthorRow}>
                      {t.logo ? (
                        <div className={s.testimonialSchoolLogo}>
                          <Image
                            src={t.logo}
                            alt={`${t.school} logo`}
                            width={48}
                            height={48}
                            className={s.testimonialSchoolLogoImg}
                          />
                        </div>
                      ) : (
                        <div
                          className={s.testimonialAvatar}
                          style={{ background: t.avatarBg }}
                          aria-hidden="true"
                        >
                          {t.initial}
                        </div>
                      )}
                      <div className={s.testimonialAuthorInfo}>
                        <h4 className={s.testimonialAuthorName}>
                          {t.name} <span className={s.testimonialAuthorFlag}>{t.flag}</span>
                        </h4>
                        <p className={s.testimonialAuthorRole}>
                          {t.role} · {t.school}
                        </p>
                        <span className={s.testimonialAuthorLoc}>
                          <i className="fa-solid fa-location-dot" /> {t.location}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Next Navigation Button */}
            <button
              type="button"
              className={`${s.testimonialsNavBtn} ${s.testimonialsNavBtnRight}`}
              onClick={() =>
                setActiveTestimonial((prev) => (prev + 1) % testimonialsData.length)
              }
              aria-label="Next testimonial"
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>

          {/* Indicator Pagination Dots */}
          <div className={s.testimonialsDotsRow}>
            {testimonialsData.map((_, dIdx) => (
              <button
                key={dIdx}
                type="button"
                className={`${s.testimonialsDot} ${activeTestimonial === dIdx ? s.testimonialsDotActive : ""}`}
                onClick={() => setActiveTestimonial(dIdx)}
                aria-label={`Go to slide ${dIdx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ SECTION 6: FREQUENTLY ASKED QUESTIONS ═══════════════════════════════ */}
      <section className={s.faqSection} id="faq">
        <div className={s.faqAmbientGlow} aria-hidden="true" />

        <div className={s.faqInner}>
          {/* Section Header */}
          <div className={s.faqHeading}>
            <h2 className={s.faqTitle}>
              Frequently Asked <span className={s.gradientText}>Questions</span>
            </h2>
            <p className={s.faqSub}>
              Everything you need to know about setting up, migrating, and running Skoolio on your campus.
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className={s.faqCategoryTabs}>
            {faqCategories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                className={`${s.faqCategoryBtn} ${faqCategory === cat.key ? s.faqCategoryBtnActive : ""}`}
                onClick={() => {
                  setFaqCategory(cat.key);
                  const filtered = cat.key === "all" ? faqData : faqData.filter((q) => q.category === cat.key);
                  if (filtered.length > 0) setOpenFaq(filtered[0].id);
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Interactive Accordion List */}
          {(() => {
            const filteredFaqs = faqCategory === "all" ? faqData : faqData.filter((q) => q.category === faqCategory);
            const visibleFaqs = showAllFaqs ? filteredFaqs : filteredFaqs.slice(0, 5);

            return (
              <>
                <div className={s.faqAccordionGrid}>
                  {visibleFaqs.map((item) => {
                    const isOpen = openFaq === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`${s.faqItem} ${isOpen ? s.faqItemOpen : ""}`}
                      >
                        <button
                          type="button"
                          className={s.faqQuestionBtn}
                          onClick={() => setOpenFaq(isOpen ? null : item.id)}
                          aria-expanded={isOpen}
                        >
                          <div className={s.faqQuestionLeft}>
                            <span className={s.faqBadgeTag}>{item.badge}</span>
                            <span className={s.faqQuestionText}>{item.question}</span>
                          </div>
                          <div className={`${s.faqChevronWrap} ${isOpen ? s.faqChevronWrapOpen : ""}`}>
                            <i className="fa-solid fa-chevron-down" />
                          </div>
                        </button>

                        <div className={`${s.faqAnswerWrap} ${isOpen ? s.faqAnswerWrapOpen : ""}`}>
                          <p className={s.faqAnswerText}>{item.answer}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* View More / Show Less Toggle Button */}
                {filteredFaqs.length > 5 && (
                  <div className={s.faqMoreRow}>
                    <button
                      type="button"
                      className={s.faqMoreBtn}
                      onClick={() => setShowAllFaqs(!showAllFaqs)}
                      aria-expanded={showAllFaqs}
                    >
                      <span>
                        {showAllFaqs
                          ? "Show Fewer Questions"
                          : `View More Questions (${filteredFaqs.length - 5} More)`}
                      </span>
                      <i className={`fa-solid ${showAllFaqs ? "fa-chevron-up" : "fa-chevron-down"}`} />
                    </button>
                  </div>
                )}
              </>
            );
          })()}

          {/* Bottom Helpdesk / Contact CTA Card */}
          <div className={s.faqCtaBanner}>
            <div className={s.faqCtaTextWrap}>
              <h3 className={s.faqCtaTitle}>Still Have Questions?</h3>
              <p className={s.faqCtaDesc}>
                Our education technology specialists are available to answer your technical questions or walk your leadership team through a tailored demo.
              </p>
            </div>
            <div className={s.faqCtaBtnRow}>
              <Link href="/contact" className={s.faqCtaBtnPrimary}>
                <span>Talk to an Expert</span>
                <i className="fa-solid fa-arrow-right" />
              </Link>
              <Link href="/register" className={s.faqCtaBtnSecondary}>
                <i className="fa-solid fa-play" />
                <span>Start Free Trial</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ SECTION 8: FULL-WIDTH SLIM FINAL CTA ═══════════════════════════════ */}
      <section className={s.finalCtaSection} id="cta">
        <div className={s.finalCtaAmbientGlow} aria-hidden="true" />
        <div className={s.finalCtaInnerGlow} aria-hidden="true" />

        <div className={s.finalCtaCard}>
          {/* Left Visual Column (3D Illustration) */}
          <div className={s.finalCtaLeft}>
            <div className={s.finalCtaPedestal} aria-hidden="true" />
            <div className={s.finalCtaImageWrap}>
              <Image
                src="/cta-img.png"
                alt="Modern School Administration with Skoolio"
                width={420}
                height={260}
                className={s.finalCtaImage}
                priority
              />
            </div>
          </div>

          {/* Right Content Column */}
          <div className={s.finalCtaRight}>
            <h2 className={s.finalCtaTitle}>
              Ready to Experience the Future of <span className={s.finalCtaGradientText}>School Management?</span>
            </h2>

            {/* Single Action CTA Button */}
            <div className={s.finalCtaActions}>
              <Link href="/register" className={s.finalCtaBtnPrimary}>
                <span>Start 14-Day Free Trial</span>
                <i className="fa-solid fa-arrow-right" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ APP FOOTER (SAME AS SCHOOL ADMIN) ═══════════════════════════════ */}
      <AppFooter role="admin" />

      {/* ═══════════════════════════════ MOBILE VIEW FOOTER NAVIGATION ═══════════════════════════════ */}
      <nav className={s.mobileBottomNav} aria-label="Mobile Navigation">
        <Link href="/" className={`${s.mobileBottomNavItem} ${s.mobileBottomNavItemActive}`}>
          <i className="fa-solid fa-house" />
          <span>Home</span>
        </Link>
        <a href="#features" className={s.mobileBottomNavItem}>
          <i className="fa-solid fa-wand-magic-sparkles" />
          <span>Features</span>
        </a>
        <a href="#pricing" className={s.mobileBottomNavItem}>
          <i className="fa-solid fa-tags" />
          <span>Pricing</span>
        </a>
        <Link href="/contact" className={s.mobileBottomNavItem}>
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
