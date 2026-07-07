"use client";

import { useState } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./salary.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

const formatINR = (amount: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);

export default function FacultySalaryPage() {
  const { data: faculty, loading } = useApi<any[]>('/teachers');
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFaculty = faculty?.filter(f => 
    f.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.id.toString().includes(searchTerm)
  );

  return (
    <div className={s("page")}>
      <Topbar title="Faculty Salary" subtitle="Manage monthly payroll and salary payment status" />

      <main className={s("content")}>
        <section className={s("head")}>
          <div>
            <h1>Faculty Salary</h1>
            <p>Select a faculty member to pay their salary.</p>
          </div>
          <Link className={cx(s("btn"), s("btnPrimary"))} href="/salary/pay">
            <i className="fa-solid fa-money-check" /> Pay Salary
          </Link>
        </section>

        <section className={s("toolbar")}>
          <label className={s("search")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input 
              placeholder="Search faculty..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>
        </section>

        <article className={s("card")}>
          <div className={s("cardHead")}>
            <div>
              <h3><i className="fa-solid fa-table-list" /> Teacher Records</h3>
              <p>Faculty-wise details.</p>
            </div>
          </div>

          <div className={s("tableWrap")}>
            {loading ? <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div> : (
              <table>
                <thead>
                  <tr>
                    <th>Faculty ID</th>
                    <th>Faculty</th>
                    <th>Role / Subject</th>
                    <th>Join Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFaculty?.map((person) => (
                    <tr key={person.id}>
                      <td className={s("salaryId")}>{person.id}</td>
                      <td>
                        <div className={s("facultyCell")}>
                          <span>{person.full_name.split(" ").map((part: string) => part[0]).join("").substring(0,2).toUpperCase()}</span>
                          <strong>{person.full_name}</strong>
                        </div>
                      </td>
                      <td>{person.qualification || 'Teacher'}</td>
                      <td>{new Date(person.join_date).toLocaleDateString()}</td>
                      <td><span className={cx(s("badge"), s(person.status === "active" ? "badge-green" : "badge-yellow"))}>{person.status}</span></td>
                      <td>
                        <Link className={cx(s("btn"), s("btnPrimary"), s("btnSm"))} href={`/salary/pay?faculty=${person.id}`}>
                          Pay Salary
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredFaculty?.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>No teachers found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </main>
    </div>
  );
}
