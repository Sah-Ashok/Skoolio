import styles from './loader.module.css';

/** Full-screen overlay loader — shown during page-level loading */
export default function Loader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className={styles.overlay} role="status" aria-label={text}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.ring} />
          <div className={styles.logo}>
            <i className="fa-solid fa-graduation-cap" />
          </div>
        </div>
        <p className={styles.label}>{text}</p>
        <div className={styles.dots}>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

/** Compact inline spinner for buttons and small areas */
export function Spinner({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      className={styles.spinner}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
