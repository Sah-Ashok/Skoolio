"use client";

import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

export default function StudentProfilePage() {
  const { data: me, loading } = useApi<any>('/auth/me');
  const { data: enrollments } = useApi<any[]>('/students/me/enrollments');

  const initials = me?.full_name
    ? me.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'S';

  const currentEnrollment = enrollments?.[0];

  const personalRows: [string, any][] = me ? [
    ['Admission Number', me.admission_number],
    ['Email', me.email || '-'],
    ['Phone', me.phone || '-'],
    ['Gender', me.gender],
    ['Date of Birth', me.date_of_birth ? new Date(me.date_of_birth).toLocaleDateString() : '-'],
    ['Blood Group', me.blood_group || '-'],
    ['Nationality', me.nationality || '-'],
    ['City', me.city || '-'],
    ['State', me.state || '-'],
    ['Admission Date', me.admission_date ? new Date(me.admission_date).toLocaleDateString() : '-'],
  ] : [];

  const guardianRows: [string, any][] = me ? [
    ['Guardian Name', me.guardian_name],
    ['Relation', me.guardian_relation],
    ['Guardian Phone', me.guardian_phone],
    ['Guardian Email', me.guardian_email || '-'],
    ['Guardian Occupation', me.guardian_occupation || '-'],
  ] : [];

  return (
    <div className="main-wrapper">
      <Topbar title="My Profile" subtitle="Your personal and academic information" />
      <main className="page-content">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <>
            <section className="card" style={{ marginBottom: '20px' }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: 72, height: 72, borderRadius: 16, background: '#FF9B51', color: '#25343F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800 }}>
                  {initials}
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{me?.full_name}</h2>
                  <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                    {me?.school_name} &middot; {currentEnrollment ? `${currentEnrollment.class_name || 'Class'} - ${currentEnrollment.section_name || ''}` : 'No active enrollment'}
                  </p>
                </div>
              </div>
            </section>

            <section className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header"><h3>Personal Details</h3></div>
              <div className="card-body">
                <div className="form-grid">
                  {personalRows.map(([label, value]) => (
                    <div key={label}>
                      <label className="form-label">{label}</label>
                      <p style={{ fontSize: 14, color: '#1e293b', fontWeight: 600, textTransform: label === 'Gender' ? 'capitalize' : 'none' }}>{value || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h3>Guardian Details</h3></div>
              <div className="card-body">
                <div className="form-grid">
                  {guardianRows.map(([label, value]) => (
                    <div key={label}>
                      <label className="form-label">{label}</label>
                      <p style={{ fontSize: 14, color: '#1e293b', fontWeight: 600 }}>{value || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
