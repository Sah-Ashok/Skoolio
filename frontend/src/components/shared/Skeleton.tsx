'use client';

import React from 'react';
import styles from './skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = 6,
  className = '',
  style = {},
}: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

/** Renders a row of shimmering stat cards (e.g. Total Students, Active Students, etc.) */
export function SkeletonStatRow({ count = 3 }: { count?: number }) {
  return (
    <section className={styles.statRow}>
      {Array.from({ length: count }).map((_, i) => (
        <article className={styles.statCard} key={i}>
          <Skeleton className={styles.statIcon} width={46} height={46} borderRadius={12} />
          <div className={styles.statContent}>
            <Skeleton width="60%" height={12} borderRadius={4} />
            <Skeleton width="40%" height={22} borderRadius={6} style={{ marginTop: 4 }} />
          </div>
        </article>
      ))}
    </section>
  );
}

/** Renders a shimmering table skeleton */
export function SkeletonTable({
  rows = 5,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className={styles.tableCard}>
      <div className={styles.tableHeader}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={i}
            width={`${Math.max(10, Math.floor(100 / columns) - 4)}%`}
            height={14}
            borderRadius={4}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div className={styles.tableRow} key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              width={`${Math.max(12, Math.floor(100 / columns) - 3 + ((r + c) % 3) * 5)}%`}
              height={16}
              borderRadius={4}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Renders a shimmering chart card skeleton */
export function SkeletonChart({ height = 280 }: { height?: number }) {
  return (
    <div className={styles.chartCard} style={{ minHeight: height }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width={140} height={18} borderRadius={4} />
        <Skeleton width={80} height={14} borderRadius={4} />
      </div>
      <Skeleton width="100%" height={height - 70} borderRadius={8} />
    </div>
  );
}

export default Skeleton;
