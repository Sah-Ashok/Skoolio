"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";

export default function PlanStatusBanner() {
  const { data: status } = useApi<any>('/subscriptions/me/status');

  if (!status || !status.is_in_grace_period) return null;

  return (
    <div style={{
      background: '#fffbeb',
      border: '1px solid #fde68a',
      borderRadius: '10px',
      margin: '0 28px 16px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ color: '#92400e' }} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>
          Your {status.plan?.name} plan has expired. You have {status.days_until_lock} day{status.days_until_lock === 1 ? '' : 's'} left before your account is downgraded to Free.
        </span>
      </div>
      <Link
        href="/upgrade"
        style={{
          background: '#FF9B51',
          color: '#25343F',
          fontWeight: 800,
          fontSize: '12.5px',
          padding: '8px 14px',
          borderRadius: '8px',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Renew Now
      </Link>
    </div>
  );
}
