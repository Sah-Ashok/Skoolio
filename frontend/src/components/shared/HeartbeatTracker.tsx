"use client";

import { useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";

/**
 * Background heartbeat component that silently keeps user presence
 * alive in Redis while browsing any portal (Admin, Teacher, Student, Super Admin).
 *
 * Only fires when the user is authenticated — skips on public pages
 * like /register and /login to prevent 401 console errors.
 */
export default function HeartbeatTracker() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const bootstrapped    = useAppSelector((s) => s.auth.bootstrapped);

  useEffect(() => {
    // Wait until the auth bootstrap has finished (/auth/me resolved),
    // then only proceed if the user is actually logged in.
    if (!bootstrapped || !isAuthenticated) return;

    const sendHeartbeat = () => {
      apiRequest("/security/heartbeat", { method: "POST" }).catch(() => {});
    };

    // Initial heartbeat upon login / page load
    sendHeartbeat();

    // Periodic heartbeat every 2 minutes
    const interval = setInterval(sendHeartbeat, 2 * 60 * 1000);

    // Refresh heartbeat when user focuses / returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [bootstrapped, isAuthenticated]);

  return null;
}

