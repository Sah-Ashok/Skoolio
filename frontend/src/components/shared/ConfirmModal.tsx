"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/shared/Loader";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "warning" | "primary";
  icon?: string;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  icon = "fa-triangle-exclamation",
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !loading) {
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
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const isDanger = confirmVariant === "danger";
  const isWarning = confirmVariant === "warning";

  const ringBg = isDanger ? "#fef2f2" : isWarning ? "#fff7ed" : "#eff6ff";
  const ringBorder = isDanger ? "#fecaca" : isWarning ? "#fed7aa" : "#bfdbfe";
  const iconColor = isDanger ? "#dc2626" : isWarning ? "#ea580c" : "#2563eb";
  const btnBg = isDanger ? "#dc2626" : isWarning ? "#ea580c" : "#2563eb";

  return (
    <>
      <style>{`
        .cm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: cmFadeIn 0.18s ease-out;
        }

        .cm-card {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08);
          max-width: 420px;
          width: 100%;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: cmScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: 'Nunito', 'Inter', sans-serif;
        }

        .cm-icon-ring {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: ${ringBg};
          border: 1.5px solid ${ringBorder};
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${iconColor};
          font-size: 22px;
          margin-bottom: 16px;
        }

        .cm-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 8px;
          letter-spacing: -0.2px;
        }

        .cm-desc {
          font-size: 13.5px;
          font-weight: 600;
          color: #64748b;
          margin: 0 0 20px;
          line-height: 1.5;
        }

        .cm-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
        }

        .cm-btn {
          flex: 1;
          height: 40px;
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

        .cm-btn-cancel {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .cm-btn-cancel:hover:not(:disabled) {
          background: #e2e8f0;
          color: #0f172a;
        }

        .cm-btn-confirm {
          background: ${btnBg};
          color: #ffffff;
        }

        .cm-btn-confirm:hover:not(:disabled) {
          opacity: 0.9;
        }

        .cm-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        @keyframes cmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes cmScaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="cm-backdrop" onClick={() => !loading && onClose()}>
        <div className="cm-card" onClick={(e) => e.stopPropagation()}>
          <div className="cm-icon-ring">
            <i className={`fa-solid ${icon}`} />
          </div>

          <h3 className="cm-title">{title}</h3>
          <p className="cm-desc">{message}</p>

          <div className="cm-actions">
            <button
              type="button"
              className="cm-btn cm-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className="cm-btn cm-btn-confirm"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner size={14} color="#ffffff" />
                  <span>Processing...</span>
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
