'use client';

import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { hideToast } from '@/store/toastSlice';
import styles from './toast-notification.module.css';

const icons = {
  success: 'fa-circle-check',
  warning: 'fa-triangle-exclamation',
  error:   'fa-circle-xmark',
  info:    'fa-circle-info',
};

const AUTO_DISMISS_MS = 4000;

export default function ToastNotification() {
  const dispatch = useAppDispatch();
  const { show, type, title, message } = useAppSelector((s) => s.toast);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!show) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => dispatch(hideToast()), AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [show, title, dispatch]);

  if (!show) return null;

  return (
    <div
      className={`${styles.toast} ${styles[type]}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Glow accent bar */}
      <div className={styles.accentBar} />

      {/* Icon */}
      <div className={styles.iconWrap}>
        <i className={`fa-solid ${icons[type]}`} />
      </div>

      {/* Content */}
      <div className={styles.content}>
        <strong className={styles.toastTitle}>{title}</strong>
        {message && <span className={styles.toastMsg}>{message}</span>}
      </div>

      {/* Close */}
      <button
        type="button"
        className={styles.closeBtn}
        onClick={() => dispatch(hideToast())}
        aria-label="Dismiss notification"
      >
        <i className="fa-solid fa-xmark" />
      </button>

      {/* Progress bar */}
      <div className={styles.progressBar} />
    </div>
  );
}
