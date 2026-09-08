'use client';

export {};

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout, logoutThunk } from '@/store/authSlice';
import LogoutConfirmModal from '@/components/shared/LogoutConfirmModal';

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
  items: NavItem[];
}

const roleLabel: Record<SidebarRole, string> = {
  admin:   'School Admin',
  teacher: 'Faculty',
  student: 'Student',
  finance: 'Finance Manager',
};

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
    items: [
      { href: '/fees',                  icon: 'fa-file-invoice-dollar', label: 'Fee Status',       exact: true },
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
      { href: '/finance/dashboard', icon: 'fa-gauge-high', label: 'Dashboard' },
    ],
  },
  {
    label: 'Fee Management',
    items: [
      { href: '/finance/fees/collect',          icon: 'fa-hand-holding-dollar',   label: 'Collect Fee',      exact: true },
      { href: '/finance/fees/monthly-billing',  icon: 'fa-calendar-plus',         label: 'Monthly Billing',  exact: true },
      { href: '/finance/fees/records',          icon: 'fa-table-list',            label: 'Fee Records',      exact: true },
      { href: '/finance/fees/history',          icon: 'fa-clock-rotate-left',     label: 'Fee History' },
      { href: '/finance/fees/structures',       icon: 'fa-layer-group',           label: 'Fee Structures' },
      { href: '/finance/fees/bank-accounts',    icon: 'fa-building-columns',      label: 'Bank Accounts & QR' },
      { href: '/finance/fees/payment-requests', icon: 'fa-receipt',               label: 'Online Requests' },
    ],
  },
  {
    label: 'Students',
    items: [
      { href: '/finance/students',              icon: 'fa-user-graduate',         label: 'Student Directory' },
    ],
  },
  {
    label: 'Accounting',
    items: [
      { href: '/finance/expenses',             icon: 'fa-file-invoice-dollar',   label: 'Expenses' },
      { href: '/finance/salary',               icon: 'fa-money-bill-wave',       label: 'Payroll & Salary' },
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
  const navSections  = navMap[role];
  const activeRole   = role as SidebarRole;
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          {user?.logo ? (
            <Link href="/" className="school-brand">
              <div className="school-monogram">
                <Image
                  src={user.logo}
                  alt={user.school_name || 'School'}
                  width={58}
                  height={58}
                  style={{ objectFit: 'cover', borderRadius: 14, width: '100%', height: '100%' }}
                />
              </div>
              <span className="school-brand-copy">
                <strong>{user.school_name || 'School'}</strong>
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
          {navSections.map(section => (
            <div key={section.label}>
              <div className="nav-label">{section.label}</div>
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
          ))}
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
