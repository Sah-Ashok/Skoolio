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
          background: #ffffff;
          color: #475569;
          display: flex; flex-direction: column;
          z-index: 100; overflow: hidden;
          border-right: 1px solid #e2e8f0;
          box-shadow: 2px 0 16px rgba(15, 23, 42, 0.04);
        }
        .sa-logo {
          padding: 20px 20px 16px;
          border-bottom: 1px solid #e2e8f0;
          display: flex; align-items: center; gap: 12px;
          background: #ffffff;
        }
        .sa-logo-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: #FF9B51;
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; color: #fff;
          box-shadow: 0 2px 8px rgba(255,155,81,0.3);
        }
        .sa-logo h1 { color: #0f172a; font-size: 17px; font-weight: 900; letter-spacing: -0.3px; }
        .sa-logo h1 span { color: #FF9B51; }
        .sa-logo p { color: #64748b; font-size: 10.5px; margin-top: 2px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }

        .sa-role-badge {
          margin: 12px 14px 4px;
          padding: 7px 12px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 8px;
          display: flex; align-items: center; gap: 8px;
          font-size: 11px; font-weight: 800; color: #ea580c;
          letter-spacing: 0.5px; text-transform: uppercase;
        }
        .sa-role-badge i { font-size: 12px; color: #ea580c; }

        .sa-nav {
          flex: 1; min-height: 0;
          padding: 6px 0 12px;
          overflow-y: auto; scrollbar-width: none;
        }
        .sa-nav::-webkit-scrollbar { display: none; }
        .sa-nav-label {
          color: #94a3b8; font-size: 10.5px; font-weight: 800;
          letter-spacing: 1.2px; text-transform: uppercase;
          padding: 16px 20px 6px;
        }
        .sa-nav-item {
          display: flex; align-items: center; gap: 11px;
          padding: 9px 18px; color: #475569;
          text-decoration: none; font-size: 13.5px; font-weight: 700;
          transition: all 0.16s ease; border-left: 3px solid transparent;
          min-height: 40px; margin: 2px 10px; border-radius: 8px;
        }
        .sa-nav-item:hover { background: #f8fafc; color: #0f172a; }
        .sa-nav-item.active {
          background: #fff7ed;
          color: #ea580c; border-left: 3px solid #FF9B51;
          font-weight: 800;
        }
        .sa-nav-item.active i { color: #ea580c; }
        .sa-nav-item i { width: 17px; font-size: 14.5px; color: #64748b; }
        .sa-nav-item:hover i { color: #0f172a; }
        .sa-nav-badge {
          margin-left: auto; border-radius: 999px;
          background: #FF9B51; color: #fff;
          font-size: 10px; font-weight: 800; padding: 2px 7px;
        }
        .sa-sidebar-footer {
          padding: 10px 12px 14px;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
        }
        .sa-footer-inner {
          padding: 10px 12px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: flex; align-items: center; gap: 10px;
        }
        .sa-avatar {
          width: 34px; height: 34px; border-radius: 9px;
          background: #FF9B51;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 12.5px; font-weight: 800; flex-shrink: 0;
        }
        .sa-footer-info p { color: #0f172a; font-size: 12.5px; font-weight: 800; }
        .sa-footer-info span { color: #64748b; font-size: 11px; font-weight: 600; }
        .sa-logout {
          margin-left: auto; background: none; border: none;
          cursor: pointer; color: #94a3b8; padding: 6px;
          border-radius: 6px; transition: color 0.16s; font-size: 14px;
        }
        .sa-logout:hover { color: #ef4444; }
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
