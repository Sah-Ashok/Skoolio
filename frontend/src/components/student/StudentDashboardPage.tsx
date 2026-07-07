"use client";

import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

export default function StudentDashboardPage() {
  const { data: me, loading: meLoading } = useApi<any>('/auth/me');
  const { data: activeYear } = useApi<any>('/academic-years/active');
  const { data: enrollments } = useApi<any[]>('/students/me/enrollments');

  const currentEnrollment = enrollments?.find((en: any) => en.academic_year_id === activeYear?.id) || enrollments?.[0];

  const startOfYear = activeYear ? `${activeYear.start_date}` : '';
  const today = new Date().toISOString().split('T')[0];
  const { data: attendanceSummary, loading: attendanceLoading } = useApi<any>(
    activeYear?.id ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${startOfYear}&end_date=${today}` : '',
    [activeYear?.id]
  );

  const { data: feeCollections } = useApi<any[]>('/fees/me/collections');
  const pendingFees = (feeCollections || []).filter((f) => f.status !== 'paid');
  const totalDue = pendingFees.reduce((sum, f) => sum + Number(f.remaining_amount || 0), 0);

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="main-wrapper">
      <Topbar title="Student Dashboard" subtitle={`Welcome back, ${me?.full_name || 'Student'} | ${todayLabel}`} />
      <main className="page-content">
        {meLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <>
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon blue"><i className="fa-solid fa-school" /></div>
                <div className="stat-info">
                  <p>Class & Section</p>
                  <h3 style={{ fontSize: '16px' }}>{currentEnrollment ? `${currentEnrollment.class_name || 'Class'} - ${currentEnrollment.section_name || ''}` : '-'}</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><i className="fa-solid fa-user-check" /></div>
                <div className="stat-info">
                  <p>Attendance</p>
                  <h3>{attendanceLoading ? '...' : `${attendanceSummary?.attendance_percentage ?? 0}%`}</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><i className="fa-solid fa-file-invoice-dollar" /></div>
                <div className="stat-info">
                  <p>Pending Fees</p>
                  <h3>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalDue)}</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon indigo"><i className="fa-solid fa-id-card" /></div>
                <div className="stat-info">
                  <p>Admission No</p>
                  <h3 style={{ fontSize: '16px' }}>{me?.admission_number || '-'}</h3>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h3>Quick Links</h3></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Link className="btn btn-outline" href="/student/attendance" style={{ justifyContent: 'flex-start' }}>
                  <i className="fa-solid fa-user-check" /> View My Attendance
                </Link>
                <Link className="btn btn-outline" href="/student/results" style={{ justifyContent: 'flex-start' }}>
                  <i className="fa-solid fa-file-circle-check" /> View My Results
                </Link>
                <Link className="btn btn-outline" href="/student/fees" style={{ justifyContent: 'flex-start' }}>
                  <i className="fa-solid fa-file-invoice-dollar" /> View My Fees
                </Link>
                <Link className="btn btn-outline" href="/student/profile" style={{ justifyContent: 'flex-start' }}>
                  <i className="fa-solid fa-id-badge" /> View My Profile
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
