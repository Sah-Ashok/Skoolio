"use client";

import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

export default function TeacherSalaryPage() {
  const { data: salaries, loading } = useApi<any[]>("/teachers/me/salary");

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
      <Topbar title="My Salary" subtitle="View your salary records" />
      <main style={{ padding: "24px 28px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 18 }}>Salary Records</h1>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}><Spinner size={32} /></div>
        ) : !salaries?.length ? (
          <div style={{
            padding: "48px 32px", textAlign: "center",
            border: "1.5px dashed #d4dde2", borderRadius: 14, background: "#fafcfc",
          }}>
            <p style={{ fontSize: 14, color: "#6a7882", fontWeight: 700 }}>No salary records found.</p>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f7fafb" }}>
                  {["Month", "Basic", "Allowances", "Deductions", "Net Pay", "Status"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 900, fontSize: 11, color: "#6a7882", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salaries.map((s: any) => (
                  <tr key={s.id} style={{ borderTop: "1px solid #edf2f4" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 700 }}>{s.month_label ?? s.month}</td>
                    <td style={{ padding: "14px 16px" }}>₹{Number(s.basic_salary ?? 0).toLocaleString()}</td>
                    <td style={{ padding: "14px 16px" }}>₹{Number(s.allowances ?? 0).toLocaleString()}</td>
                    <td style={{ padding: "14px 16px", color: "#b42318" }}>₹{Number(s.deductions ?? 0).toLocaleString()}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 900 }}>₹{Number(s.net_pay ?? 0).toLocaleString()}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 900,
                        background: s.status === "paid" ? "#e2f6ee" : "#fff1df",
                        color: s.status === "paid" ? "#12805c" : "#c46a14",
                      }}>
                        {s.status ?? "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
