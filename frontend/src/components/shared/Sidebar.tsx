'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { logoutThunk } from '@/store/authSlice'

export type SidebarProps = {
  role?: "super-admin" | "admin" | "teacher" | "student"
}

type NavLink    = { href: string; icon: string; label: string }
type NavSection = { label: string; links: NavLink[] }

const adminNav: NavSection[] = [
  {
    label: 'Main',
    links: [
      { href: '/dashboard',    icon: 'fa-gauge-high',          label: 'Dashboard'       },
      { href: '/students',     icon: 'fa-user-graduate',       label: 'Students'        },
      { href: '/teachers',     icon: 'fa-chalkboard-user',     label: 'Faculty'         },
      { href: '/subscription', icon: 'fa-id-card-clip',        label: 'My Subscription' },
      { href: '/settings',     icon: 'fa-gear',                label: 'Settings'        },
    ],
  },
  {
    label: 'Finance',
    links: [
      { href: '/fees',     icon: 'fa-file-invoice-dollar', label: 'Fee Management' },
      { href: '/expenses', icon: 'fa-wallet',              label: 'Expenses'       },
      { href: '/salary',   icon: 'fa-money-bill-wave',     label: 'Faculty Salary' },
    ],
  },
  {
    label: 'Academic',
    links: [
      { href: '/manage',         icon: 'fa-layer-group',      label: 'Manage Academic' },
      { href: '/academic-years', icon: 'fa-calendar-plus',    label: 'Academic Years'  },
      { href: '/classes',        icon: 'fa-school',           label: 'Classes'         },
      { href: '/sections',       icon: 'fa-table-cells',      label: 'Sections'        },
      { href: '/subjects',       icon: 'fa-book',             label: 'Subjects'        },
      { href: '/calendar',       icon: 'fa-calendar-days',    label: 'Calendar'        },
      { href: '/attendance',     icon: 'fa-chart-column',     label: 'Attendance'      },
      { href: '/exams',          icon: 'fa-pen-to-square',    label: 'Exams & Results' },
    ],
  },
  {
    label: 'Facilities',
    links: [
      { href: '/transport', icon: 'fa-bus',      label: 'Transport' },
      { href: '/hostel',    icon: 'fa-building', label: 'Hostel'    },
    ],
  },
]

const teacherNav: NavSection[] = [
  {
    label: 'Main',
    links: [
      { href: '/teacher/dashboard', icon: 'fa-gauge-high', label: 'Dashboard'  },
      { href: '/teacher/profile',   icon: 'fa-id-badge',  label: 'My Profile' },
    ],
  },
  {
    label: 'Classroom',
    links: [
      { href: '/teacher/attendance',       icon: 'fa-user-check',      label: 'Attendance Overview' },
      { href: '/teacher/attendance/class', icon: 'fa-clipboard-check', label: 'Mark Attendance'     },
      { href: '/teacher/results',          icon: 'fa-pen-to-square',   label: 'Enter Results'       },
    ],
  },
]

const studentNav: NavSection[] = [
  {
    label: 'Main',
    links: [
      { href: '/student/dashboard', icon: 'fa-gauge-high', label: 'Dashboard'  },
      { href: '/student/profile',   icon: 'fa-id-badge',  label: 'My Profile' },
    ],
  },
  {
    label: 'My Records',
    links: [
      { href: '/student/attendance', icon: 'fa-user-check',          label: 'My Attendance' },
      { href: '/student/results',    icon: 'fa-file-circle-check',   label: 'My Results'    },
      { href: '/student/fees',       icon: 'fa-file-invoice-dollar', label: 'My Fees'       },
    ],
  },
]

const superAdminNav: NavSection[] = [
  {
    label: 'Platform',
    links: [
      { href: '/super-admin/dashboard',     icon: 'fa-gauge-high',       label: 'Dashboard'     },
      { href: '/super-admin/schools',       icon: 'fa-building-columns', label: 'Schools'       },
      { href: '/super-admin/subscriptions', icon: 'fa-credit-card',      label: 'Subscriptions' },
      { href: '/super-admin/settings',      icon: 'fa-gear',             label: 'Settings'      },
    ],
  },
]

type MobileGroup = { sectionLabel: string; links: NavLink[] }
const adminMobileGroups:      MobileGroup[] = adminNav.map(s => ({ sectionLabel: s.label, links: s.links }))
const teacherMobileGroups:    MobileGroup[] = teacherNav.map(s => ({ sectionLabel: s.label, links: s.links }))
const studentMobileGroups:    MobileGroup[] = studentNav.map(s => ({ sectionLabel: s.label, links: s.links }))
const superAdminMobileGroups: MobileGroup[] = superAdminNav.map(s => ({ sectionLabel: s.label, links: s.links }))

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector(state => state.auth)

  const activeRole =
    user?.role ||
    (role === 'super-admin' ? 'super_admin' : role === 'teacher' ? 'faculty' : role) ||
    'admin'

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    admin:       'Admin Panel',
    faculty:     'Teacher Portal',
    student:     'Student Portal',
  }

  const navSections: NavSection[] =
    activeRole === 'super_admin' ? superAdminNav :
    activeRole === 'faculty'     ? teacherNav    :
    activeRole === 'student'     ? studentNav    :
    adminNav

  const mobileGroups: MobileGroup[] =
    activeRole === 'super_admin' ? superAdminMobileGroups :
    activeRole === 'faculty'     ? teacherMobileGroups    :
    activeRole === 'student'     ? studentMobileGroups    :
    adminMobileGroups

  const displayName =
    activeRole === 'admin' || activeRole === 'super_admin'
      ? (user?.school_name || 'Skoolio')
      : (user?.full_name || user?.email?.split('@')[0] || 'User')

  const initials = displayName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`)
      ? 'nav-item active'
      : 'nav-item'

  const isMobileActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`)

  const handleLogout = async () => {
    await dispatch(logoutThunk())
    router.push('/login')
  }

  return (
    <>
      {/* ══════════════════════════════════════
          DESKTOP SIDEBAR
      ══════════════════════════════════════ */}
      <aside className="sidebar">

        {/* ── Logo block: white bg, logo on top, school name below ── */}
        <div
          className="sidebar-logo"
          style={{
            background:     '#ffffff',
            flexDirection:  'column',
            alignItems:     'flex-start',
            gap:            0,
            padding:        '14px 20px 12px',
          }}
        >
          <Link href="/" style={{ display: 'block', lineHeight: 0, textDecoration: 'none' }}>
            <Image
              src="/desktop-logo.png"
              alt="Skoolio"
              width={160}
              height={48}
              priority
              style={{ objectFit: 'contain', width: 'auto', height: 44, maxWidth: '100%' }}
            />
          </Link>

          {/* School name sits BELOW the logo, dark text on white bg */}
          {user?.school_name && (
            <p style={{
              marginTop:     6,
              fontSize:      11,
              fontWeight:    700,
              color:         '#64748b',
              whiteSpace:    'nowrap',
              overflow:      'hidden',
              textOverflow:  'ellipsis',
              maxWidth:      '100%',
              lineHeight:    1.3,
            }}>
              {user.school_name}
            </p>
          )}
        </div>

        {/* Nav */}
        <nav className="nav">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="nav-label">{section.label}</div>
              {section.links.map((link) => (
                <Link key={link.href} href={link.href} className={isActive(link.href)}>
                  <i className={`fa-solid ${link.icon}`} />
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer-wrap">
          <div className="sidebar-footer">
            <div className="s-avatar">{initials}</div>
            <div className="info">
              <p>{displayName}</p>
              <span>{roleLabel[activeRole] || 'Admin Panel'}</span>
            </div>
            <button
              className="logout-btn"
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              title="Log out"
            >
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MOBILE BOTTOM NAV
      ══════════════════════════════════════ */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <div className="mobile-nav-scroll">
          {mobileGroups.map((group, gi) => (
            <div key={group.sectionLabel} className="mobile-nav-group">
              {gi > 0 && (
                <div className="mobile-nav-divider" aria-hidden="true">
                  <span>{group.sectionLabel}</span>
                </div>
              )}
              {group.links.map((link) => {
                const active = isMobileActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`mobile-nav-item${active ? ' mobile-nav-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <i className={`fa-solid ${link.icon}`} />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}

          <div className="mobile-nav-group">
            <div className="mobile-nav-divider" aria-hidden="true">
              <span>Account</span>
            </div>
            <button
              className="mobile-nav-item mobile-nav-logout"
              onClick={handleLogout}
              aria-label="Log out"
            >
              <i className="fa-solid fa-right-from-bracket" />
              <span>Logout</span>
            </button>
          </div>
        </div>
        <div className="mobile-nav-fade" aria-hidden="true" />
      </nav>
    </>
  )
}
