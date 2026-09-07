/* eslint-disable @next/next/no-img-element */
import styles from './loader.module.css';

export interface LoaderProps {
  text?: string | null;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Branded Loader — features the Skoolio smile icon in the center of an animated circle ring.
 * Uses native <img> with eager loading to guarantee the smile icon renders instantly without hydration/decoding delays.
 */
export default function Loader({
  text = 'Loading...',
  fullScreen = true,
  size = 'lg',
}: LoaderProps) {
  const content = (
    <div className={`${styles.card} ${styles[size]} ${!fullScreen ? styles.inlineCard : ''}`}>
      <div className={`${styles.logoWrap} ${styles[`wrap_${size}`]}`}>
        <div className={styles.ringTrack} />
        <div className={styles.ring} />
        <div className={styles.smileWrap}>
          <img
            src="/loader-icon.png"
            alt="Loading"
            className={styles.smileImg}
            loading="eager"
            decoding="sync"
          />
        </div>
      </div>
      {text && (
        <div className={styles.labelWrap}>
          <p className={styles.label}>{text}</p>
          <div className={styles.dots}>
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  );

  if (!fullScreen) {
    return (
      <div className={styles.inlineWrap} role="status" aria-label={text || 'Loading'}>
        {content}
      </div>
    );
  }

  return (
    <div className={styles.overlay} role="status" aria-label={text || 'Loading'}>
      {content}
    </div>
  );
}

/** Compact inline spinner for buttons and small areas — defaults to brand orange (#FF9B51) */
export function Spinner({ size = 18, color = '#FF9B51' }: { size?: number; color?: string }) {
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

export { Loader };
