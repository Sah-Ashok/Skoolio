"use client";

import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./sa.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const s = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

export default function SuperAdminDashboard() {
  const { data: schools, loading } = useApi<any[]>('/subscriptions/schools');

  const totalSchools = schools?.length || 0;
  const activeCount = schools?.filter((sc) => sc.status === 'active').length || 0;
  const graceCount = schools?.filter((sc) => sc.status === 'grace_period').length || 0;
  const proPlusCount = schools?.filter((sc) => sc.plan_name === 'Pro' || sc.plan_name === 'Plus').length || 0;

  const recentSchools = (schools || []).slice(0, 5);
  const needsAttention = (schools || []).filter((sc) => sc.status === 'grace_period');

  return (
    <div className={s("sa-page")}>
      <Topbar title="Super Admin Dashboard" subtitle="Platform-wide overview" />
      <main className={s("page-content")}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <>
            <section className={s("hero-cards")}>
              <article className={cx(s("hero-card"), s("g1"))}>
                <div className={s("hc-icon")}><i className="fa-solid fa-building-columns" /></div>
                <p className={s("hc-label")}>Total Schools</p>
                <h3 className={s("hc-value")}>{totalSchools}</h3>
                <span className={s("hc-sub")}>Registered on platform</span>
              </article>
              <article className={cx(s("hero-card"), s("g2"))}>
                <div className={s("hc-icon")}><i className="fa-solid fa-circle-check" /></div>
                <p className={s("hc-label")}>Active Subscriptions</p>
                <h3 className={s("hc-value")}>{activeCount}</h3>
                <span className={s("hc-sub")}>Currently paid & active</span>
              </article>
              <article className={cx(s("hero-card"), s("g3"))}>
                <div className={s("hc-icon")}><i className="fa-solid fa-clock" /></div>
                <p className={s("hc-label")}>In Grace Period</p>
                <h3 className={s("hc-value")}>{graceCount}</h3>
                <span className={s("hc-sub")}>Need renewal soon</span>
              </article>
              <article className={cx(s("hero-card"), s("g4"))}>
                <div className={s("hc-icon")}><i className="fa-solid fa-star" /></div>
                <p className={s("hc-label")}>Pro / Plus Schools</p>
                <h3 className={s("hc-value")}>{proPlusCount}</h3>
                <span className={s("hc-sub")}>Paying customers</span>
              </article>
            </section>

            <section className={s("quick-row")}>
              <Link href="/super-admin/schools" className={s("qa-card")}>
                <div className={s("qa-icon")}><i className="fa-solid fa-building-columns" /></div>
                <div><p>Manage Schools</p><span>View & activate subscriptions</span></div>
              </Link>
              <Link href="/super-admin/schools" className={s("qa-card")}>
                <div className={s("qa-icon")}><i className="fa-solid fa-rotate" /></div>
                <div><p>Renew a Plan</p><span>Activate after offline payment</span></div>
              </Link>
            </section>

            <section className={s("two-col")}>
              <div className={s("card")}>
                <div className={s("card-head")}>
                  <div><h3>Needs Attention</h3><p>Schools in grace period \u2014 renew before lockout</p></div>
                  <Link href="/super-admin/schools" className={cx(s("btn"), s("btn-sm"), s("btn-soft"))}>View All</Link>
                </div>
                <div className={s("card-body")} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {needsAttention.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#6b7b86' }}>No schools currently in their grace period.</p>
                  ) : (
                    needsAttention.map((sc) => (
                      <div key={sc.school_id} className={s("alert-row")} style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <i className="fa-solid fa-triangle-exclamation" style={{ color: '#92400e' }} />
                        <div>
                          <strong>{sc.school_name}</strong>
                          <p style={{ fontSize: '12px', marginTop: '2px' }}>{sc.plan_name} plan expired {sc.end_date ? new Date(sc.end_date).toLocaleDateString() : ''} \u2014 will downgrade to Free after grace period.</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={s("card")}>
                <div className={s("card-head")}><div><h3>Recently Registered</h3><p>Newest schools on the platform</p></div></div>
                <div className={s("card-body")} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {recentSchools.map((sc) => (
                    <div key={sc.school_id} className={s("avatar-cell")}>
                      <div className={s("avatar")}>{sc.school_name?.charAt(0)}</div>
                      <div>
                        <strong>{sc.school_name}</strong>
                        <span>{sc.plan_name} plan \u00b7 {sc.country}</span>
                      </div>
                    </div>
                  ))}
                  {recentSchools.length === 0 && <p style={{ fontSize: '13px', color: '#6b7b86' }}>No schools yet.</p>}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
