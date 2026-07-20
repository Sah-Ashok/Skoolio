'use client';

import { useEffect, useState, useRef } from 'react';

export type OnlineState = 'online' | 'offline' | 'reconnecting';

/**
 * Tracks browser connectivity state.
 *
 * States:
 *  - 'online'       → navigator.onLine is true (normal)
 *  - 'offline'      → navigator.onLine is false (router cut / no internet)
 *  - 'reconnecting' → was offline, browser says online again but we haven't
 *                     confirmed the server is reachable yet (brief flash state)
 */
export function useOnlineStatus(): OnlineState {
  const [state, setState] = useState<OnlineState>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'
  );

  // Track whether we were previously offline so we can show 'reconnecting'
  const wasOffline = useRef(false);

  useEffect(() => {
    function handleOffline() {
      wasOffline.current = true;
      setState('offline');
    }

    function handleOnline() {
      if (wasOffline.current) {
        // Briefly show reconnecting, then confirm with a lightweight ping
        setState('reconnecting');
        wasOffline.current = false;

        // Ping the backend health endpoint to confirm actual connectivity
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        fetch('/api/health', { method: 'HEAD', signal: controller.signal, cache: 'no-store' })
          .then(() => setState('online'))
          .catch(() => {
            // Browser says online but server unreachable — stay reconnecting briefly
            setTimeout(() => setState('online'), 3000);
          })
          .finally(() => clearTimeout(timeout));
      } else {
        setState('online');
      }
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return state;
}
