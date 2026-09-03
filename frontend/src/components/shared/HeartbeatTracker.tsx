"use client";

import { useEffect } from "react";
import { apiRequest } from "@/lib/api";

/**
 * Background heartbeat component that silently keeps user presence
 * alive in Redis while browsing any portal (Admin, Teacher, Student, Super Admin).
 */
export default function HeartbeatTracker() {
  useEffect(() => {
    const sendHeartbeat = () => {
      apiRequest("/security/heartbeat", { method: "POST" }).catch(() => {});
    };

    // Initial heartbeat upon load
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
  }, []);

  return null;
}
