"use client";

import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

export default function StudentResultsPage() {
  const { data: activeYear } = useApi<any>('/academic-years/active');
  const { data: results, loading } = useApi<any[]>(
    activeYear?.id ? `/exams/me/results?academic_year_id=${activeYear.id}` : '',
    [activeYear?.id]
  );

  const groupedByExam = (results || []).reduce((acc: Record<string, any[]>, r: any) => {
    const key = r.exam_name || `Exam ${r.exam_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="main-wrapper">
      <Topbar title="My Results" subtitle="Published exam results" />
      <main className="page-content">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51" /></div>
        ) : Object.keys(groupedByExam).length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            No published results yet for this academic year.
          </div>
        ) : (
          Object.entries(groupedByExam).map(([examName, subjectResults]) => {
            const totalMax = subjectResults.reduce((sum, r) => sum + Number(r.max_marks), 0);
            const totalObtained = subjectResults.reduce((sum, r) => sum + Number(r.marks_obtained || 0), 0);
            const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;

            return (
              <section className="card" key={examName} style={{ marginBottom: '20px' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>{examName}</h3>
                  <span className="badge badge-indigo">{overallPct}% overall</span>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Subject</th><th>Marks Obtained</th><th>Max Marks</th><th>Percentage</th><th>Grade</th><th>Result</th></tr>
                    </thead>
                    <tbody>
                      {subjectResults.map((r: any) => (
                        <tr key={r.id}>
                          <td><strong>{r.subject_name}</strong></td>
                          <td>{r.is_absent ? 'Absent' : r.marks_obtained}</td>
                          <td>{r.max_marks}</td>
                          <td>{r.is_absent ? '-' : `${r.percentage}%`}</td>
                          <td>{r.is_absent ? '-' : r.grade || '-'}</td>
                          <td>
                            {r.is_absent ? (
                              <span className="badge badge-yellow">Absent</span>
                            ) : (
                              <span className={`badge ${r.is_passed ? 'badge-green' : 'badge-red'}`}>{r.is_passed ? 'Pass' : 'Fail'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
