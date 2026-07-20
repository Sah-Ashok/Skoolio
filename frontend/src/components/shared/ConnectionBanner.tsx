'use client';

import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import styles from './connection-banner.module.css';

/**
 * ConnectionBanner
 *
 * Renders a full-width sticky banner at the top of the viewport when the
 * user loses internet connectivity (e.g. router power cut).
 *
 * - 'offline'      → red banner, no dismiss
 * - 'reconnecting' → yellow banner, spinner
 * - 'online'       → brief green "back online" flash, then hides
 */
export default function ConnectionBanner() {
  const status = useOnlineStatus();
  const [visible, setVisible] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);

  useEffect(() => {
    if (status === 'offline' || status === 'reconnecting') {
      setVisible(true);
    }

    // Was offline/reconnecting, now back online → show green flash then hide
    if (prevStatus !== 'online' && status === 'online') {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }

    setPrevStatus(status);
  }, [status]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.banner} ${styles[status]}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.inner}>
        {status === 'offline' && (
          <>
            <i className="fa-solid fa-wifi" style={{ opacity: 0.7 }} />
            <span>
              <strong>No internet connection.</strong> Please check your router or network.
            </span>
          </>
        )}

        {status === 'reconnecting' && (
          <>
            <span className={styles.spinner} />
            <span>
              <strong>Reconnecting…</strong> Waiting for server response.
            </span>
          </>
        )}

        {status === 'online' && (
          <>
            <i className="fa-solid fa-circle-check" />
            <span>
              <strong>Back online.</strong> Your connection has been restored.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
