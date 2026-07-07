"use client";

import styles from "@/app/(admin)/dashboard/dashboard.module.css";

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");
const s = (className: string) => styles[className];

const students = [
  ["RK", "Rajesh Kumar", "rajesh@campus.edu", "Class 10 - A", "#001", "Active", "b-green"],
  ["PS", "Priya Sharma", "priya@campus.edu", "Class 9 - B", "#002", "Active", "b-green"],
  ["AM", "Amit Mehta", "amit@campus.edu", "Class 8 - A", "#003", "Inactive", "b-yellow"],
  ["SG", "Sneha Gupta", "sneha@campus.edu", "Class 7 - C", "#004", "Active", "b-green"],
  ["VT", "Vivek Tiwari", "vivek@campus.edu", "Class 6 - A", "#005", "Active", "b-green"],
];

const expenses = [
  ["Electricity Bill", "Utilities", "₹12,400", "Jun 01", "Admin", "b-orange"],
  ["Lab Equipment", "Supplies", "₹8,200", "Jun 03", "Admin", "b-green"],
  ["Building Repair", "Maintenance", "₹15,000", "Jun 05", "Admin", "b-red"],
  ["Internet & WiFi", "Other", "₹3,500", "Jun 07", "Admin", "b-blue"],
  ["Stationery", "Supplies", "₹2,100", "Jun 08", "Admin", "b-green"],
];

const salaryStatus = [
  ["MK", "Meera Krishnan", "Mathematics", "Paid", "b-green"],
  ["RS", "Ramesh Singh", "Science", "Paid", "b-green"],
  ["AP", "Anita Patel", "English", "Unpaid", "b-red"],
  ["SK", "Suresh Kumar", "History", "Paid", "b-green"],
  ["NV", "Nisha Verma", "Computer Sc.", "Unpaid", "b-red"],
];

export default function DashboardTables() {
  return (
    <>
      <section className={s("data-row")}>
        <article className={s("tbl-card")}>
          <div className={s("tbl-head")}>
            <h3>
              <i className="fa-solid fa-user-graduate" /> Recent Students
            </h3>
            <a href="/students" className={cx(s("btn"), s("btn-ghost"), s("btn-sm"))}>
              View All
            </a>
          </div>
          <table className={s("table")}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class / Course</th>
                <th>Roll</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map(([initials, name, email, className, roll, status, badge]) => (
                <tr key={name}>
                  <td>
                    <div className={s("av-row")}>
                      <div className={s("av")}>{initials}</div>
                      <div>
                        <div className={s("name")}>{name}</div>
                        <div className={s("sub")}>{email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{className}</td>
                  <td>{roll}</td>
                  <td>
                    <span className={cx(s("badge"), s(badge))}>{status}</span>
                  </td>
                  <td>
                    <a className={cx(s("btn"), s("btn-ghost"), s("btn-sm"))}>View</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className={s("fee-panel")}>
          <div className={s("fee-panel-head")}>
            <h3>
              <i className="fa-solid fa-circle-dollar-to-slot" /> Fee Overview
            </h3>
            <span className={cx(s("badge"), s("b-indigo"))}>June 2025</span>
          </div>
          <div className={s("fee-body")}>
            <div className={s("fee-item")}>
              <div className={s("fee-lbl")}>Total Assigned</div>
              <div className={s("fee-val")}>₹6,00,000</div>
            </div>
            <div className={s("fee-item")}>
              <div className={s("fee-lbl")}>Collected</div>
              <div className={cx(s("fee-val"), s("text-success"))}>₹4,20,000</div>
            </div>
            <div className={s("fee-item")}>
              <div className={s("fee-lbl")}>Pending</div>
              <div className={cx(s("fee-val"), s("text-danger"))}>₹1,80,000</div>
            </div>
            <div className={s("fee-item")}>
              <div className={s("fee-lbl")}>Overdue (&gt;30d)</div>
              <div className={cx(s("fee-val"), s("text-warning"))}>₹48,000</div>
            </div>
            <div className={s("prog-wrap")}>
              <div className={s("prog-label")}>
                <span>Collection Rate</span>
                <span>70%</span>
              </div>
              <div className={s("prog-bar")}>
                <div className={s("prog-fill")} style={{ width: "70%" }} />
              </div>
            </div>
            <div className={s("prog-wrap")}>
              <div className={s("prog-label")}>
                <span>Overdue Rate</span>
                <span className={s("text-danger")}>8%</span>
              </div>
              <div className={s("prog-bar")}>
                <div className={cx(s("prog-fill"), s("danger-fill"))} />
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className={s("data-row")}>
        <article className={s("tbl-card")}>
          <div className={s("tbl-head")}>
            <h3>
              <i className="fa-solid fa-wallet" /> Recent Expenses
            </h3>
            <a href="/expenses" className={cx(s("btn"), s("btn-ghost"), s("btn-sm"))}>
              View All
            </a>
          </div>
          <table className={s("table")}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(([title, category, amount, date, by, badge]) => (
                <tr key={title}>
                  <td className={s("strong-cell")}>{title}</td>
                  <td>
                    <span className={cx(s("badge"), s(badge))}>{category}</span>
                  </td>
                  <td className={s("strong-cell")}>{amount}</td>
                  <td className={s("muted-cell")}>{date}</td>
                  <td>
                    <span className={cx(s("badge"), s("b-blue"))}>{by}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className={s("fee-panel")}>
          <div className={s("fee-panel-head")}>
            <h3>
              <i className="fa-solid fa-money-bill-wave" /> Salary Status
            </h3>
            <span className={cx(s("badge"), s("b-teal"))}>June 2025</span>
          </div>
          <div className={s("fee-body")}>
            <ul className={s("sal-list")}>
              {salaryStatus.map(([initials, name, department, status, badge]) => (
                <li className={s("sal-item")} key={name}>
                  <div className={s("av-row")}>
                    <div className={s("av")}>{initials}</div>
                    <div>
                      <div className={s("name")}>{name}</div>
                      <div className={s("sub")}>{department}</div>
                    </div>
                  </div>
                  <span className={cx(s("badge"), s(badge))}>{status}</span>
                </li>
              ))}
            </ul>
            <div className={s("prog-wrap")}>
              <div className={s("prog-label")}>
                <span>Salary Disbursed</span>
                <span>44 / 48</span>
              </div>
              <div className={s("prog-bar")}>
                <div className={cx(s("prog-fill"), s("salary-fill"))} />
              </div>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
