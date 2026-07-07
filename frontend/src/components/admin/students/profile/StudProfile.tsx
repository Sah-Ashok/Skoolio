
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "../students.module.css";

const s = (className: string) => styles[className];
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

export default function Profile(){
    return   <div className="main-wrapper">
      <Topbar title="Students profile" subtitle="Manage admissions, profiles, classes, and fee status" />

    <main className="page-content">
      <section className="page-head">
        <div>
          <h1>Former Student Profile</h1>
          <p>Record for ADM-2026-001. The student studied only className 4 in this school.</p>
        </div>
        <div className="head-actions">
          <a className="btn btn-outline" href="students.html"><i className="fa-solid fa-arrow-left"></i>Back</a>
          <a className="btn btn-soft" href="#"><i className="fa-solid fa-file-lines"></i>Transfer Certificate</a>
          <a className="btn btn-primary" href="add-student.html"><i className="fa-solid fa-pen-to-square"></i>Edit Record</a>
        </div>
      </section>

      <section className="profile-hero profile-hero-polished">
        <div className="profile-main">
          <div className="profile-avatar">RK</div>
          <div>
            <div className="profile-kicker">Former Student</div>
            <h1>Rajesh Kumar</h1>
            <p>className 4 - Section A | Roll No. 18 | Admitted 04 Apr 2026 | Left 28 Mar 2027</p>
            <div className="profile-meta">
              <span className="badge badge-yellow">Left School</span>
              <span className="badge badge-teal">Fee Cleared</span>
              <span className="badge badge-blue">This School Record Only</span>
            </div>
          </div>
        </div>

        <div className="profile-score-panel">
          <div>
            <span>Attendance</span>
            <strong>88%</strong>
          </div>
          <div>
            <span>Final Result</span>
            <strong>80%</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>Left</strong>
          </div>
        </div>
      </section>

      <section className="profile-metrics">
        <article className="metric-card">
          <div className="metric-icon green"><i className="fa-solid fa-calendar-check"></i></div>
          <div><span>Present Days</span><strong>176 / 200</strong></div>
        </article>
        <article className="metric-card">
          <div className="metric-icon blue"><i className="fa-solid fa-folder-open"></i></div>
          <div><span>Stored Records</span><strong>className 4 Only</strong></div>
        </article>
        <article className="metric-card">
          <div className="metric-icon orange"><i className="fa-solid fa-receipt"></i></div>
          <div><span>Fee Paid</span><strong>Rs 32,000</strong></div>
        </article>
        <article className="metric-card">
          <div className="metric-icon rose"><i className="fa-solid fa-right-from-bracket"></i></div>
          <div><span>Exit Status</span><strong>Transferred Out</strong></div>
        </article>
      </section>

      <div className="profile-dashboard-grid">
        <section className="card profile-card-main">
          <div className="card-header">
            <div>
              <h3>Student Information</h3>
              <p>Personal and guardian details stored by this school</p>
            </div>
          </div>
          <div className="profile-info-list">
            <div className="info-row"><span>Date of Birth</span><strong>14 Feb 2016</strong></div>
            <div className="info-row"><span>Gender</span><strong>Male</strong></div>
            <div className="info-row"><span>Blood Group</span><strong>B+</strong></div>
            <div className="info-row"><span>Email</span><strong>rajesh@school.edu</strong></div>
            <div className="info-row"><span>Phone</span><strong>+91 98765 43210</strong></div>
            <div className="info-row"><span>Address</span><strong>18 Green Park Colony, New Delhi</strong></div>
            <div className="info-row"><span>Father Name</span><strong>Mahesh Kumar</strong></div>
            <div className="info-row"><span>Mother Name</span><strong>Sunita Kumar</strong></div>
            <div className="info-row"><span>Guardian Phone</span><strong>+91 98765 11110</strong></div>
            <div className="info-row"><span>Leaving Reason</span><strong>Transferred to another school</strong></div>
          </div>
        </section>

        <aside className="profile-side-stack">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Fee Summary</h3>
                <p>Final year at this school</p>
              </div>
              <span className="badge badge-green">Cleared</span>
            </div>
            <div className="fee-card">
              <div className="fee-row"><span>Total Assigned</span><strong>Rs 32,000</strong></div>
              <div className="fee-row"><span>Total Paid</span><strong className="text-success">Rs 32,000</strong></div>
              <div className="fee-row"><span>Pending</span><strong className="text-danger">Rs 0</strong></div>
              <div className="fee-row"><span>Last Payment</span><strong>20 Mar 2027</strong></div>
              <div className="progress"><span style={{width:"100%"}}></span></div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>School Record Scope</h3>
                <p>What this profile includes</p>
              </div>
            </div>
            <div className="quick-detail-list">
              <div><i className="fa-solid fa-school"></i><span>className 4 - A only</span></div>
              <div><i className="fa-solid fa-hashtag"></i><span>Roll No. 18</span></div>
              <div><i className="fa-solid fa-ban"></i><span>No previous school marks stored</span></div>
              <div><i className="fa-solid fa-user-tie"></i><span>className Teacher: Meera Krishnan</span></div>
            </div>
          </section>
        </aside>
      </div>

      <div className="profile-dashboard-grid lower">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Final Result In This School</h3>
              <p>className 4 final examination record</p>
            </div>
            <span className="badge badge-yellow">Former Student</span>
          </div>
          <div className="table-wrap">
            <table className="profile-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Marks</th>
                  <th>Grade</th>
                  <th>Teacher</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Mathematics</td>
                  <td>82 / 100</td>
                  <td><span className="badge badge-blue">B+</span></td>
                  <td>Meera Krishnan</td>
                  <td><div className="mini-bar"><span style={{width:"82%"}}></span></div></td>
                </tr>
                <tr>
                  <td>Science</td>
                  <td>78 / 100</td>
                  <td><span className="badge badge-yellow">B</span></td>
                  <td>Ramesh Singh</td>
                  <td><div className="mini-bar teal"><span style={{width:"78%"}}></span></div></td>
                </tr>
                <tr>
                  <td>English</td>
                  <td>80 / 100</td>
                  <td><span className="badge badge-blue">B+</span></td>
                  <td>Anita Patel</td>
                  <td><div className="mini-bar blue"><span style={{width:"80%"}}></span></div></td>
                </tr>
                <tr>
                  <td>Social Studies</td>
                  <td>80 / 100</td>
                  <td><span className="badge badge-blue">B+</span></td>
                  <td>Suresh Kumar</td>
                  <td><div className="mini-bar"><span style={{width:"80%"}}></span></div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Recent Activity</h3>
              <p>Latest school-side events</p>
            </div>
          </div>
          <div className="timeline">
            <div className="timeline-item">
              <h4>Transfer certificate issued</h4>
              <p>Student left school after completing className 4.</p>
            </div>
            <div className="timeline-item">
              <h4>Final result published</h4>
              <p>className 4 final result marked as passed.</p>
            </div>
            <div className="timeline-item">
              <h4>Fee cleared</h4>
              <p>All dues cleared before leaving certificate.</p>
            </div>
            <div className="timeline-item">
              <h4>Admission record created</h4>
              <p>Student admitted to className 4 in this school.</p>
            </div>
          </div>
        </section>
      </div>

      <section className="card academic-journey-card">
        <div className="card-header">
          <div>
            <h3>School Academic Record</h3>
            <p>Only classNamees studied in this school are stored and shown</p>
          </div>
          <span className="badge badge-teal">This School Only</span>
        </div>
        <div className="journey-track single-record" aria-label="classNamees studied in this school">
          <article className="journey-item left-school">
            <span className="journey-className">className 4</span>
            <strong>80%</strong>
            <small>Att. 88%</small>
            <em>Left School</em>
          </article>
        </div>
      </section>

      <section className="card previous-results-card">
        <div className="card-header">
          <div>
            <h3>Stored Result Records</h3>
            <p>No previous or next school marks are stored here</p>
          </div>
          <span className="badge badge-blue">className 4</span>
        </div>

        <div className="result-accordion">
          <details className="result-year" open>
            <summary>
              <div>
                <span>2026-27</span>
                <strong>className 4 Final Result</strong>
              </div>
              <div className="result-summary">
                <span className="badge badge-green">80%</span>
                <span className="badge badge-teal">Attendance 88%</span>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </summary>
            <div className="table-wrap">
              <table className="profile-table">
                <thead>
                  <tr><th>Subject</th><th>Full Marks</th><th>Marks</th><th>Grade</th><th>Teacher</th><th>Remarks</th></tr>
                </thead>
                <tbody>
                  <tr><td>Mathematics</td><td>100</td><td>82</td><td><span className="badge badge-blue">B+</span></td><td>Meera Krishnan</td><td>Good</td></tr>
                  <tr><td>Science</td><td>100</td><td>78</td><td><span className="badge badge-yellow">B</span></td><td>Ramesh Singh</td><td>Satisfactory</td></tr>
                  <tr><td>English</td><td>100</td><td>80</td><td><span className="badge badge-blue">B+</span></td><td>Anita Patel</td><td>Good</td></tr>
                  <tr><td>Social Studies</td><td>100</td><td>80</td><td><span className="badge badge-blue">B+</span></td><td>Suresh Kumar</td><td>Good</td></tr>
                </tbody>
              </table>
            </div>
            <div className="result-total">
              <span>Total: <strong>320 / 400</strong></span>
              <span>Percentage: <strong>80%</strong></span>
              <span>Status: <strong>Passed and left school</strong></span>
            </div>
          </details>

          <div className="transfer-records">
            <div>
              <strong>No Other School Data Stored</strong>
              <span>This profile only keeps records created by your school. Previous or next school marks are not stored here.</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
}