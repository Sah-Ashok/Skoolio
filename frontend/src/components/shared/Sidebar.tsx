'use client';

export {};

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout, logoutThunk } from '@/store/authSlice';
import LogoutConfirmModal from '@/components/shared/LogoutConfirmModal';
import { useApi, clearApiCache } from '@/lib/useApi';

type SidebarRole = 'admin' | 'teacher' | 'student' | 'finance';

interface NavItem {
  href: string;
  icon: string;
  label: string;
  badge?: string;
  exact?: boolean;
}

interface NavSection {
  label: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  items: NavItem[];
}

const roleLabel: Record<SidebarRole, string> = {
  admin:   'School Admin',
  teacher: 'Faculty',
  student: 'Student',
  finance: 'Finance Manager',
};

const HIDDEN_WHEN_FINANCE_ACTIVE = new Set([
  '/fees',
  '/fees/collect',
  '/fees/structures',
  '/fees/bank-accounts',
  '/fees/payment-requests',
]);

const adminNav: NavSection[] = [
  {
    label: 'Main',
    items: [
      { href: '/dashboard', icon: 'fa-gauge-high',          label: 'Dashboard' },
      { href: '/students',  icon: 'fa-user-graduate',       label: 'Students'  },
      { href: '/classes',   icon: 'fa-school',              label: 'Classes'   },
      { href: '/teachers',  icon: 'fa-chalkboard-teacher',  label: 'Teachers', exact: true },
      { href: '/staff',     icon: 'fa-user-tie',            label: 'Staff',    exact: true },
    ],
  },
  {
    label: 'Academics',
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { href: '/timetable',                 icon: 'fa-calendar-week',   label: 'Timetable' },
      { href: '/attendance',                icon: 'fa-clipboard-check', label: 'Class Attendance',  exact: true },
      { href: '/attendance/class',          icon: 'fa-table-cells',     label: 'Class Register',    exact: true },
      { href: '/staff/attendance',          icon: 'fa-user-clock',      label: 'Staff Attendance',  exact: true },
      { href: '/staff/attendance/register', icon: 'fa-table-list',      label: 'Staff Register',    exact: true },
      { href: '/exams',                     icon: 'fa-file-alt',        label: 'Exams'   },
      { href: '/notices',                   icon: 'fa-bullhorn',        label: 'Notices' },
      { href: '/calendar',                  icon: 'fa-calendar-days',   label: 'Calendar'},
      { href: '/academic-years',            icon: 'fa-layer-group',     label: 'Academic Years' },
    ],
  },
  {
    label: 'Finance',
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { href: '/fees',                  icon: 'fa-file-invoice-dollar', label: 'Fee Status',       exact: true },
      { href: '/fees/collect',          icon: 'fa-hand-holding-dollar', label: 'Collect Fee',      exact: true },
      { href: '/fees/history',          icon: 'fa-clock-rotate-left',   label: 'Fee History' },
      { href: '/fees/records',          icon: 'fa-table-list',          label: 'Fee Records',      exact: true },
      { href: '/fees/structures',       icon: 'fa-layer-group',         label: 'Fee Structures' },
      { href: '/fees/bank-accounts',    icon: 'fa-building-columns',    label: 'Bank Accounts & QR' },
      { href: '/fees/payment-requests', icon: 'fa-receipt',             label: 'Online Requests' },
      { href: '/expenses',              icon: 'fa-receipt',             label: 'Expenses' },
    ],
  },
  {
    label: 'Facilities',
    items: [
      { href: '/transport', icon: 'fa-bus', label: 'Transport' },
      { href: '/hostel', icon: 'fa-building', label: 'Hostel' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', icon: 'fa-gear', label: 'Settings' },
      { href: '/subscription', icon: 'fa-crown', label: 'Subscription' },
    ],
  },
];

const teacherNav: NavSection[] = [
  {
    label: 'Main',
    items: [
      { href: '/teacher/dashboard', icon: 'fa-gauge-high', label: 'Dashboard' },
      { href: '/teacher/timetable', icon: 'fa-calendar-week', label: 'Timetable' },
      { href: '/teacher/attendance/class', icon: 'fa-clipboard-check', label: 'Mark Attendance', exact: true },
      { href: '/teacher/attendance', icon: 'fa-user-check', label: 'My Attendance', exact: true },
      { href: '/teacher/students', icon: 'fa-users', label: 'My Students' },
      { href: '/teacher/results?tab=register', icon: 'fa-table-list', label: 'Result Register' },
      { href: '/teacher/results', icon: 'fa-pen-to-square', label: 'Enter Results', exact: true },
    ],
  },
  {
    label: 'Info',
    items: [
      { href: '/teacher/notices', icon: 'fa-bullhorn', label: 'Notices' },
      { href: '/teacher/calendar', icon: 'fa-calendar-days', label: 'Calendar' },
      { href: '/teacher/salary', icon: 'fa-money-bill-wave', label: 'My Salary' },
      { href: '/teacher/profile', icon: 'fa-user', label: 'Profile' },
    ],
  },
];

const studentNav: NavSection[] = [
  {
    label: 'Main',
    items: [
      { href: '/student/dashboard', icon: 'fa-gauge-high', label: 'Dashboard' },
      { href: '/student/timetable', icon: 'fa-calendar-week', label: 'Timetable' },
      { href: '/student/attendance', icon: 'fa-clipboard-check', label: 'Attendance' },
      { href: '/student/results', icon: 'fa-file-circle-check', label: 'Exams & Results' },
      { href: '/student/fees', icon: 'fa-file-invoice-dollar', label: 'Fee Status' },
      { href: '/student/notices', icon: 'fa-bullhorn', label: 'Notices' },
    ],
  },
  {
    label: 'Info',
    items: [
      { href: '/student/profile', icon: 'fa-user', label: 'Profile' },
      { href: '/student/calendar', icon: 'fa-calendar-days', label: 'Calendar' },
    ],
  },
];

const financeNav: NavSection[] = [
  {
    label: 'Main',
    items: [
      { href: '/finance/dashboard', icon: 'fa-gauge-high',    label: 'Dashboard' },
      { href: '/finance/notices',   icon: 'fa-bullhorn',      label: 'Notices' },
      { href: '/finance/calendar',  icon: 'fa-calendar-days', label: 'Calendar' },
    ],
  },
  {
    label: 'Fee Management',
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { href: '/finance/fees/collect',          icon: 'fa-hand-holding-dollar',   label: 'Collect Fee',      exact: true },
      { href: '/finance/fees/history',          icon: 'fa-clock-rotate-left',     label: 'Fee History' },
      { href: '/finance/fees/records',          icon: 'fa-table-list',            label: 'Fee Records',      exact: true },
      { href: '/finance/fees/structures',       icon: 'fa-layer-group',           label: 'Fee Structures' },
      { href: '/finance/fees/bank-accounts',    icon: 'fa-building-columns',      label: 'Bank Accounts & QR' },
      { href: '/finance/fees/payment-requests', icon: 'fa-receipt',               label: 'Online Requests' },
    ],
  },
  {
    label: 'Students',
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { href: '/finance/students',              icon: 'fa-user-graduate',         label: 'Student Directory' },
    ],
  },
  {
    label: 'Accounting',
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { href: '/finance/staff/attendance/register', icon: 'fa-table-list',            label: 'Staff Register' },
      { href: '/finance/salary',                   icon: 'fa-money-bill-wave',       label: 'Payroll & Salary' },
      { href: '/finance/expenses',                 icon: 'fa-file-invoice-dollar',   label: 'Expenses' },
    ],
  },
  {
    label: 'Facilities',
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { href: '/finance/transport', icon: 'fa-bus',      label: 'Transport' },
      { href: '/finance/hostel',    icon: 'fa-building', label: 'Hostel' },
    ],
  },
];

const mobileNavMap: Record<SidebarRole, NavItem[]> = {
  admin: [
    { href: '/dashboard', icon: 'fa-gauge-high',    label: 'Dashboard' },
    { href: '/students',  icon: 'fa-user-graduate', label: 'Students'  },
    { href: '/classes',   icon: 'fa-school',        label: 'Classes'   },
    { href: '/staff',     icon: 'fa-user-tie',      label: 'Staff'     },
    { href: '/timetable', icon: 'fa-calendar-week', label: 'Timetable' },
    { href: '/fees',      icon: 'fa-file-invoice-dollar', label: 'Fees' },
  ],
  teacher: [
    { href: '/teacher/dashboard', icon: 'fa-gauge-high', label: 'Dashboard' },
    { href: '/teacher/timetable', icon: 'fa-calendar-week', label: 'Timetable' },
    { href: '/teacher/attendance/class', icon: 'fa-clipboard-check', label: 'Attendance' },
    { href: '/teacher/results?tab=register', icon: 'fa-table-list', label: 'Register' },
    { href: '/teacher/results', icon: 'fa-pen-to-square', label: 'Results', exact: true },
  ],
  student: [
    { href: '/student/dashboard', icon: 'fa-gauge-high', label: 'Dashboard' },
    { href: '/student/timetable', icon: 'fa-calendar-week', label: 'Timetable' },
    { href: '/student/attendance', icon: 'fa-clipboard-check', label: 'Attendance' },
    { href: '/student/results', icon: 'fa-file-circle-check', label: 'Results' },
    { href: '/student/fees', icon: 'fa-file-invoice-dollar', label: 'Fees' },
  ],
  finance: [
    { href: '/finance/dashboard',    icon: 'fa-gauge-high',          label: 'Dashboard' },
    { href: '/finance/fees/collect', icon: 'fa-hand-holding-dollar', label: 'Collect' },
    { href: '/finance/fees/records', icon: 'fa-table-list',          label: 'Records' },
    { href: '/finance/expenses',     icon: 'fa-receipt',             label: 'Expenses' },
    { href: '/finance/salary',       icon: 'fa-money-bill-wave',     label: 'Salary' },
  ],
};

const navMap: Record<SidebarRole, NavSection[]> = {
  admin:   adminNav,
  teacher: teacherNav,
  student: studentNav,
  finance: financeNav,
};

function isNavItemActive(pathname: string, searchParams: ReturnType<typeof useSearchParams> | null, item: NavItem) {
  const [itemPath, itemQuery] = item.href.split('?');

  if (itemQuery) {
    if (pathname !== itemPath) return false;
    const itemParams = new URLSearchParams(itemQuery);
    for (const [key, val] of itemParams.entries()) {
      if (searchParams?.get(key) !== val) return false;
    }
    return true;
  }

  if (item.exact) {
    if (searchParams && searchParams.get('tab')) return false;
    return pathname === itemPath;
  }

  if (searchParams && searchParams.get('tab') && pathname === itemPath) return false;

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

interface SidebarProps {
  role: SidebarRole;
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const dispatch     = useAppDispatch();
  const { user }     = useAppSelector(s => s.auth);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [user?.logo]);

  // Check if school has an active finance account configured
  const [financeAccountTick, setFinanceAccountTick] = useState(0);
  useEffect(() => {
    const handleAccountChange = () => {
      clearApiCache('/school/finance-account');
      setFinanceAccountTick((t) => t + 1);
    };
    window.addEventListener('finance-account-changed', handleAccountChange);
    return () => window.removeEventListener('finance-account-changed', handleAccountChange);
  }, []);

  const { data: financeAccount } = useApi<any>(
    role === 'admin' ? '/school/finance-account' : null,
    [financeAccountTick]
  );

  const hasActiveFinanceAccount = Boolean(
    financeAccount && (financeAccount.id || financeAccount.email) && financeAccount.status !== 'inactive'
  );

  const navSections = useMemo(() => {
    const baseSections = navMap[role];
    if (role !== 'admin' || !hasActiveFinanceAccount) {
      return baseSections;
    }

    // When finance account exists, remove operational fee links and Facilities from admin sidebar
    return baseSections
      .filter((section) => section.label !== 'Facilities')
      .map((section) => {
        if (section.label !== 'Finance') return section;
        return {
          ...section,
          items: section.items.filter((item) => !HIDDEN_WHEN_FINANCE_ACTIVE.has(item.href)),
        };
      });
  }, [role, hasActiveFinanceAccount]);

  const activeRole = role as SidebarRole;

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    dispatch(logout());
    if (role === 'student') {
      router.push('/student-login');
    } else {
      router.push('/login');
    }
  };

  const openFeedback = () => {
    if (typeof window !== 'undefined') (window as any).__openFeedback?.();
  };

  const displayName = user?.full_name || user?.school_name || roleLabel[role];
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const allMobileItems = mobileNavMap[activeRole] || navSections.flatMap(s => s.items).slice(0, 6);

  // Check if a section contains the currently active route
  const isSectionActive = useCallback(
    (section: NavSection) => {
      return section.items.some(item => isNavItemActive(pathname, searchParams, item));
    },
    [pathname, searchParams]
  );

  // Track collapsed state per section: true = collapsed, false = open
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  // Auto-expand section if it contains the currently active route
  useEffect(() => {
    navSections.forEach(section => {
      if (section.collapsible && isSectionActive(section)) {
        setCollapsedMap(prev => (prev[section.label] ? { ...prev, [section.label]: false } : prev));
      }
    });
  }, [pathname, searchParams, navSections, isSectionActive]);

  const toggleSection = (section: NavSection) => {
    setCollapsedMap(prev => {
      const isCurrentlyCollapsed = prev[section.label] !== undefined
        ? prev[section.label]
        : (!isSectionActive(section) && Boolean(section.defaultCollapsed));
      return { ...prev, [section.label]: !isCurrentlyCollapsed };
    });
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          {user?.logo && !logoError ? (
            <Link href="/" className="school-brand">
              <div className="school-monogram">
                <Image
                  src={user.logo}
                  alt={user.school_name || 'School'}
                  width={58}
                  height={58}
                  unoptimized
                  style={{ objectFit: 'cover', borderRadius: 12, width: '100%', height: '100%' }}
                  onError={() => setLogoError(true)}
                />
              </div>
              <span className="school-brand-copy">
                <strong>{user.school_name || 'School'}</strong>
                <small>{roleLabel[activeRole]}</small>
              </span>
            </Link>
          ) : user?.school_name ? (
            <Link href="/" className="school-brand">
              <div className="school-monogram">
                {initials}
              </div>
              <span className="school-brand-copy">
                <strong>{user.school_name}</strong>
                <small>{roleLabel[activeRole]}</small>
              </span>
            </Link>
          ) : (
            <Link href="/" className="skoolio-brand">
              <Image
                src="/Logo.png"
                alt="Skoolio"
                width={200}
                height={80}
                priority
                style={{ objectFit: 'contain' }}
              />
            </Link>
          )}
        </div>

        <nav className="nav">
          {navSections.map(section => {
            const hasActiveItem = isSectionActive(section);
            const isCollapsed = section.collapsible
              ? (collapsedMap[section.label] !== undefined
                  ? collapsedMap[section.label]
                  : (!hasActiveItem && Boolean(section.defaultCollapsed)))
              : false;
            const isOpen = !isCollapsed;

            return (
              <div key={section.label} className="nav-section-group">
                {section.collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section)}
                    className="nav-label-btn"
                    aria-expanded={isOpen}
                  >
                    <span className="nav-label-title">
                      <span>{section.label}</span>
                      {!isOpen && (
                        <span className="nav-label-count">
                          {section.items.length}
                        </span>
                      )}
                      {!isOpen && hasActiveItem && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#ea580c',
                            display: 'inline-block',
                          }}
                        />
                      )}
                    </span>
                    <i
                      className="fa-solid fa-chevron-right nav-label-chevron"
                      style={{
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    />
                  </button>
                ) : (
                  <div className="nav-label">{section.label}</div>
                )}

                <div className={`nav-section-items ${isOpen ? 'open' : 'collapsed'}`}>
                  {section.items.map(item => {
                    const isActive = isNavItemActive(pathname, searchParams, item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-item${isActive ? ' active' : ''}`}
                      >
                        <i className={`fa-solid ${item.icon}`} />
                        <span>{item.label}</span>
                        {item.badge && <span className="nav-badge">{item.badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer-wrap">

          {/* ── Rate Skoolio button ── */}
          <button className="sidebar-rate-btn" onClick={openFeedback} title="Rate Skoolio">
            <span className="sidebar-rate-stars">
              {[1,2,3,4,5].map(n => <i key={n} className="fa-solid fa-star" />)}
            </span>
            <span className="sidebar-rate-label">Rate Skoolio</span>
            <i className="fa-solid fa-chevron-right sidebar-rate-arrow" />
          </button>

          <div className="sidebar-footer">
            <div className="s-avatar">{initials}</div>
            <div className="info">
              <p>{displayName}</p>
              <span>{roleLabel[activeRole]}</span>
            </div>
            <button
              className="logout-btn"
              onClick={() => setShowLogoutModal(true)}
              title="Logout"
            >
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>
        </div>
      </aside>

      <div className="mobile-bottom-nav">
        <div className="mobile-nav-scroll">
          {allMobileItems.map(item => {
            const isActive = isNavItemActive(pathname, searchParams, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-nav-item${isActive ? ' mobile-nav-active' : ''}`}
              >
                <i className={`fa-solid ${item.icon}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            className="mobile-nav-item mobile-nav-logout"
            onClick={() => setShowLogoutModal(true)}
          >
            <i className="fa-solid fa-right-from-bracket" />
            <span>Logout</span>
          </button>
        </div>
        <div className="mobile-nav-fade" />
      </div>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        userName={displayName}
        userRole={roleLabel[activeRole]}
      />
    </>
  );
}
