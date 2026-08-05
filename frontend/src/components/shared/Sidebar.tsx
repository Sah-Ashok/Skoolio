'use client';

export {};

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout, logoutThunk } from '@/store/authSlice';

type SidebarRole = 'admin' | 'teacher' | 'student';

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
  admin: 'School Admin',
  teacher: 'Faculty',
  student: 'Student',
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
      { href: '/attendance',          icon: 'fa-clipboard-check', label: 'Student Attendance', exact: true },
      { href: '/teachers/attendance', icon: 'fa-user-clock',      label: 'Staff Attendance',   exact: true },
      { href: '/exams',               icon: 'fa-file-alt',        label: 'Exams'   },
      { href: '/notices',             icon: 'fa-bullhorn',        label: 'Notices' },
      { href: '/calendar',            icon: 'fa-calendar-days',   label: 'Calendar'},
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/fees',                  icon: 'fa-file-invoice-dollar', label: 'Fees',             exact: true },
      { href: '/fees/monthly-billing',  icon: 'fa-calendar-plus',       label: 'Monthly Billing',  exact: true },
      { href: '/expenses',              icon: 'fa-receipt',             label: 'Expenses' },
      { href: '/salary',                icon: 'fa-money-bill-wave',     label: 'Salary'   },
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
      { href: '/teacher/attendance/class', icon: 'fa-clipboard-check', label: 'Mark Attendance', exact: true },
      { href: '/teacher/attendance', icon: 'fa-user-check', label: 'My Attendance', exact: true },
      { href: '/teacher/students', icon: 'fa-users', label: 'My Students' },
      { href: '/teacher/results', icon: 'fa-pen-to-square', label: 'Enter Results' },
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
      { href: '/student/attendance', icon: 'fa-clipboard-check', label: 'Attendance' },
      { href: '/student/results', icon: 'fa-file-circle-check', label: 'Results' },
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

const navMap: Record<SidebarRole, NavSection[]> = {
  admin: adminNav,
  teacher: teacherNav,
  student: studentNav,
};

function isNavItemActive(pathname: string, item: NavItem) {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

interface SidebarProps {
  role: SidebarRole;
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname    = usePathname();
  const router      = useRouter();
  const dispatch    = useAppDispatch();
  const { user }    = useAppSelector(s => s.auth);
  const navSections = navMap[role];
  const activeRole  = role as SidebarRole;

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    dispatch(logout());
    router.push('/login');
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

  const allMobileItems = navSections.flatMap(s => s.items).slice(0, 6);

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
                width={160}
                height={48}
                priority
                style={{ objectFit: 'contain', width: 'auto', height: 48 }}
              />
            </Link>
          )}
        </div>

        <nav className="nav">
          {navSections.map(section => (
            <div key={section.label}>
              <div className="nav-label">{section.label}</div>
              {section.items.map(item => {
                const isActive = isNavItemActive(pathname, item);
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
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>
        </div>
      </aside>

      <div className="mobile-bottom-nav">
        <div className="mobile-nav-scroll">
          {allMobileItems.map(item => {
            const isActive = isNavItemActive(pathname, item);
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
          <button className="mobile-nav-item mobile-nav-logout" onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket" />
            <span>Logout</span>
          </button>
        </div>
        <div className="mobile-nav-fade" />
      </div>
    </>
  );
}
