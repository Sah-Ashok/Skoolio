'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { logoutThunk } from '@/store/authSlice'

export default function SuperAdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector(state => state.auth)

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`)
      ? 'sa-nav-item active'
      : 'sa-nav-item'

  const handleLogout = async () => {
    await dispatch(logoutThunk())
    router.push('/login')
  }

  return (
    <>
      <style>{`
        .sa-sidebar {
          position: fixed; top: 0; left: 0;
          width: 260px; height: 100vh;
          background: linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%);
          color: #94a3b8;
          display: flex; flex-direction: column;
          z-index: 100; overflow: hidden;
          box-shadow: 4px 0 24px rgba(0,0,0,0.35);
        }
        .sa-logo {
          padding: 22px 20px 18px;
          border-bottom: 1px solid rgba(148,163,184,0.12);
          display: flex; align-items: center; gap: 12px;
        }
        .sa-logo-icon {
          width: 42px; height: 42px; border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; color: #fff;
          box-shadow: 0 4px 12px rgba(99,102,241,0.4);
        }
        .sa-logo h1 { color: #f1f5f9; font-size: 16px; font-weight: 800; letter-spacing: -0.3px; }
        .sa-logo h1 span { color: #818cf8; }
        .sa-logo p { color: #64748b; font-size: 10.5px; margin-top: 2px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }

        .sa-role-badge {
          margin: 12px 16px;
          padding: 7px 12px;
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 8px;
          display: flex; align-items: center; gap: 8px;
          font-size: 11px; font-weight: 700; color: #818cf8;
          letter-spacing: 0.5px; text-transform: uppercase;
        }
        .sa-role-badge i { font-size: 12px; }

        .sa-nav {
          flex: 1; min-height: 0;
          padding: 6px 0 12px;
          overflow-y: auto; scrollbar-width: none;
        }
        .sa-nav::-webkit-scrollbar { display: none; }
        .sa-nav-label {
          color: #475569; font-size: 10px; font-weight: 800;
          letter-spacing: 1.2px; text-transform: uppercase;
          padding: 16px 20px 5px;
        }
        .sa-nav-item {
          display: flex; align-items: center; gap: 11px;
          padding: 10px 20px; color: #64748b;
          text-decoration: none; font-size: 13.5px; font-weight: 600;
          transition: all 0.18s; border-left: 3px solid transparent;
          min-height: 42px;
        }
        .sa-nav-item:hover { background: rgba(99,102,241,0.08); color: #c7d2fe; }
        .sa-nav-item.active {
          background: rgba(99,102,241,0.15);
          color: #a5b4fc; border-left: 3px solid #6366f1;
        }
        .sa-nav-item i { width: 17px; font-size: 14px; }
        .sa-nav-badge {
          margin-left: auto; border-radius: 999px;
          background: rgba(99,102,241,0.25); color: #a5b4fc;
          font-size: 10px; font-weight: 800; padding: 2px 7px;
        }
        .sa-sidebar-footer {
          padding: 12px;
          border-top: 1px solid rgba(148,163,184,0.1);
        }
        .sa-footer-inner {
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(99,102,241,0.1);
          display: flex; align-items: center; gap: 10px;
        }
        .sa-avatar {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 13px; font-weight: 800; flex-shrink: 0;
        }
        .sa-footer-info p { color: #e2e8f0; font-size: 12.5px; font-weight: 700; }
        .sa-footer-info span { color: #64748b; font-size: 11px; }
        .sa-logout {
          margin-left: auto; background: none; border: none;
          cursor: pointer; color: #64748b; padding: 6px;
          border-radius: 6px; transition: color 0.2s;
        }
        .sa-logout:hover { color: #f87171; }
      `}</style>

      <aside className="sa-sidebar">
        <div className="sa-logo">
          <div className="sa-logo-icon">
            <i className="fa-solid fa-shield-halved" />
          </div>
          <div>
            <h1><span>Campus</span>POS</h1>
            <p>Control Center</p>
          </div>
        </div>

        <div className="sa-role-badge">
          <i className="fa-solid fa-crown" />
          Super Admin
        </div>

        <nav className="sa-nav">
          <div className="sa-nav-label">Overview</div>
          <Link href="/super-admin/dashboard" className={isActive('/super-admin/dashboard')}>
            <i className="fa-solid fa-gauge-high" /> Dashboard
          </Link>

          <div className="sa-nav-label">Management</div>
          <Link href="/super-admin/schools" className={isActive('/super-admin/schools')}>
            <i className="fa-solid fa-building-columns" /> Schools
          </Link>
          <Link href="/super-admin/subscriptions" className={isActive('/super-admin/subscriptions')}>
            <i className="fa-solid fa-credit-card" /> Subscriptions
          </Link>

          <div className="sa-nav-label">System</div>
          <Link href="/super-admin/settings" className={isActive('/super-admin/settings')}>
            <i className="fa-solid fa-sliders" /> Settings
          </Link>
        </nav>

        <div className="sa-sidebar-footer">
          <div className="sa-footer-inner">
            <div className="sa-avatar">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="sa-footer-info">
              <p>{user?.email ? user.email.split('@')[0] : 'Super Admin'}</p>
              <span>Platform Owner</span>
            </div>
            <button className="sa-logout" onClick={handleLogout} title="Logout">
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
