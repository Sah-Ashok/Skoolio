"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/shared/Loader";

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  userName?: string;
  userRole?: string;
}

export default function LogoutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
  userRole,
}: LogoutConfirmModalProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !loggingOut) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, loggingOut, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setLoggingOut(true);
      await onConfirm();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <style>{`
        .lcm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: lcmFadeIn 0.18s ease-out;
        }

        .lcm-card {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.08);
          max-width: 400px;
          width: 100%;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: lcmScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: 'Nunito', 'Inter', sans-serif;
        }

        .lcm-icon-ring {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: #fff7ed;
          border: 1.5px solid #fed7aa;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ea580c;
          font-size: 22px;
          margin-bottom: 16px;
          box-shadow: 0 4px 12px rgba(234, 88, 12, 0.12);
        }

        .lcm-title {
          font-size: 19px;
          font-weight: 900;
          color: #0f172a;
          margin: 0 0 6px;
          letter-spacing: -0.3px;
        }

        .lcm-desc {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          margin: 0 0 16px;
          line-height: 1.5;
        }

        .lcm-user-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 20px;
        }

        .lcm-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
        }

        .lcm-btn {
          flex: 1;
          height: 42px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          cursor: pointer;
          transition: all 0.15s ease;
          border: none;
          font-family: inherit;
        }

        .lcm-btn-cancel {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .lcm-btn-cancel:hover:not(:disabled) {
          background: #e2e8f0;
          color: #0f172a;
        }

        .lcm-btn-logout {
          background: #ea580c;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(234, 88, 12, 0.25);
        }

        .lcm-btn-logout:hover:not(:disabled) {
          background: #c2410c;
          box-shadow: 0 4px 12px rgba(234, 88, 12, 0.35);
        }

        .lcm-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        @keyframes lcmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes lcmScaleIn {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="lcm-backdrop" onClick={() => !loggingOut && onClose()}>
        <div className="lcm-card" onClick={(e) => e.stopPropagation()}>
          <div className="lcm-icon-ring">
            <i className="fa-solid fa-right-from-bracket" />
          </div>

          <h3 className="lcm-title">Log Out?</h3>
          <p className="lcm-desc">
            Are you sure you want to end your current session and sign out?
          </p>

          {(userName || userRole) && (
            <div className="lcm-user-badge">
              <i className="fa-solid fa-circle-user" style={{ color: "#ff9148", fontSize: 13 }} />
              <span>{userName}</span>
              {userRole && (
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>· {userRole}</span>
              )}
            </div>
          )}

          <div className="lcm-actions">
            <button
              type="button"
              className="lcm-btn lcm-btn-cancel"
              onClick={onClose}
              disabled={loggingOut}
            >
              Cancel
            </button>
            <button
              type="button"
              className="lcm-btn lcm-btn-logout"
              onClick={handleConfirm}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <>
                  <Spinner size={15} color="#ffffff" />
                  <span>Signing out...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-right-from-bracket" />
                  <span>Log Out</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
