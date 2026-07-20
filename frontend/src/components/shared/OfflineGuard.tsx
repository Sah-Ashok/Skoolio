'use client';

import { useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import styles from './offline-page.module.css';

export default function OfflineGuard({ children }: { children: React.ReactNode }) {
  const status = useOnlineStatus();
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);

  if (status === 'online') return <>{children}</>;

  // Manual retry — just pings /api/health, no page reload
  // If successful the browser's 'online' event will already have fired and
  // useOnlineStatus will flip to 'online', re-rendering children automatically.
  // This button is only a UX comfort for users who want to try immediately.
  async function handleRetry() {
    setChecking(true);
    setCheckFailed(false);
    try {
      const res = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
      if (!res.ok) throw new Error('not ok');
      // Server reachable — if browser still says offline just wait;
      // useOnlineStatus will catch the 'online' event on its own.
      setCheckFailed(false);
    } catch {
      setCheckFailed(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>

        {/* Icon */}
        <div className={`${styles.iconWrap} ${status === 'reconnecting' ? styles.reconnecting : styles.offline}`}>
          {status === 'offline' && !checking
            ? <i className="fa-solid fa-wifi" />
            : <span className={styles.spinner} />
          }
        </div>

        {/* Text */}
        {status === 'offline' ? (
          <>
            <h2 className={styles.title}>No Internet Connection</h2>
            <p className={styles.desc}>
              Your router or network appears to be offline.<br />
              Please check your connection and try again.
            </p>
          </>
        ) : (
          <>
            <h2 className={styles.title}>Reconnecting…</h2>
            <p className={styles.desc}>
              Connection restored. Verifying server…
            </p>
          </>
        )}

        {/* Tips */}
        {status === 'offline' && (
          <ul className={styles.tips}>
            <li><i className="fa-solid fa-plug-circle-xmark" /> Check if your router is powered on</li>
            <li><i className="fa-solid fa-rotate" /> Try restarting your router</li>
            <li><i className="fa-solid fa-signal" /> Check your Wi-Fi or ethernet cable</li>
          </ul>
        )}

        {/* Check failed notice */}
        {checkFailed && (
          <p className={styles.checkFailed}>
            <i className="fa-solid fa-circle-exclamation" /> Still offline. Please check your network.
          </p>
        )}

        {/* Retry button — no reload, just pings health */}
        {status === 'offline' && (
          <button
            className={styles.retryBtn}
            onClick={handleRetry}
            disabled={checking}
          >
            {checking
              ? <><span className={styles.btnSpinner} /> Checking…</>
              : <><i className="fa-solid fa-arrows-rotate" /> Retry</>
            }
          </button>
        )}

      </div>
    </div>
  );
}
