"use client";

import { useState, useEffect, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import { Spinner } from "@/components/shared/Loader";
import { useApi, useMutation } from "@/lib/useApi";
import styles from "./staff.module.css";

const s  = (n: string) => styles[n] || n;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

type Staff = { id: number; full_name: string; role_name?: string; status: string };
type AttRecord = { id: number; staff_id: number; date: string; status: string };

const ATT_STATUSES = [
  { key: "present",  label: "Present", cls: "attPresent" },
  { key: "absent",   label: "Absent",  cls: "attAbsent"  },
  { key: "leave",    label: "Leave",   cls: "attLeave"   },
  { key: "half_day", label: "Half",    cls: "attHalf"    },
];

const today = () => new Date().toISOString().split("T")[0];

export function StaffAttendancePage() {
  const { data: staff, loading: loadingStaff } = useApi<Staff[]>("/staff");
  const [date, setDate] = useState(today());

  // Endpoint changes when date changes — no extra deps array needed
  const { data: existing, loading: loadingAtt, refetch } =
    useApi<AttRecord[]>(`/staff/attendance?date=${date}`);

  // Local draft: staff_id → status
  const [draft, setDraft] = useState<Record<number, string>>({});

  // useEffect (not useMemo) because we're calling setState as a side effect
  useEffect(() => {
    if (existing) {
      const map: Record<number, string> = {};
      existing.forEach(r => { map[r.staff_id] = r.status; });
      setDraft(map);
    }
  }, [existing]);

  const { execute: bulkMark, loading: saving } = useMutation("/staff/attendance/bulk", "POST");

  const activeStaff = useMemo(
    () => (staff ?? []).filter(m => m.status !== "terminated"),
    [staff]
  );

  const setStatus = (staff_id: number, status: string) =>
    setDraft(d => ({ ...d, [staff_id]: status }));

  const handleSave = async () => {
    const records = activeStaff.map(m => ({
      staff_id: m.id,
      status: draft[m.id] ?? "present",
    }));
    await bulkMark({ date, records });
    refetch();
  };

  // Summary counts from draft
  const summary = useMemo(() => {
    const counts: Record<string, number> = { present: 0, absent: 0, leave: 0, half_day: 0 };
    activeStaff.forEach(m => {
      const st = draft[m.id] ?? "present";
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [draft, activeStaff]);

  return (
    <div className={s("page")}>
      <Topbar title="Staff Attendance" subtitle="Mark daily attendance for all non-teaching staff" />
      <main className={s("content")}>

        {/* Head */}
        <section className={s("head")}>
          <div>
            <h1>Daily Attendance</h1>
            <p>Mark or update attendance for any date. Changes are saved when you click Save All.</p>
          </div>
          <div className={s("actions")}>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                minHeight: 38, padding: "0 12px", border: "1px solid #c6d0d7",
                borderRadius: 8, background: "#fff", color: "#1f2d36",
                font: "inherit", fontSize: 13, fontWeight: 800, outline: "none",
              }}
            />
            <button
              className={cx(s("btn"), s("btnPrimary"))}
              onClick={handleSave}
              disabled={saving || loadingStaff || loadingAtt || activeStaff.length === 0}
            >
              {saving
                ? <><Spinner size={14} color="#fff" /> Saving…</>
                : <><i className="fa-solid fa-floppy-disk" /> Save All</>
              }
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className={s("stats")}>
          {[
            { label: "Present",  value: summary.present,  cls: "green",  icon: "fa-circle-check"        },
            { label: "Absent",   value: summary.absent,   cls: "red",    icon: "fa-circle-xmark"        },
            { label: "On Leave", value: summary.leave,    cls: "blue",   icon: "fa-circle-pause"        },
            { label: "Half Day", value: summary.half_day, cls: "orange", icon: "fa-circle-half-stroke"  },
          ].map(({ label, value, cls, icon }) => (
            <article key={label} className={cx(s("stat"), s(cls))}>
              <div><i className={`fa-solid ${icon}`} /></div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>out of {activeStaff.length} staff</small>
            </article>
          ))}
        </section>

        {/* Attendance Grid */}
        <div className={s("card")}>
          <div className={s("cardHead")}>
            <div>
              <h3><i className="fa-solid fa-clipboard-check" />Attendance Sheet</h3>
              <p>
                {new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long", day: "2-digit", month: "long", year: "numeric",
                })}
              </p>
            </div>
            {loadingAtt && <Spinner size={18} color="#FF9B51" />}
          </div>

          {loadingStaff ? (
            <div className={s("empty")}><Spinner size={28} color="#FF9B51" /></div>
          ) : activeStaff.length === 0 ? (
            <div className={s("empty")}>
              <i className="fa-solid fa-users-slash" />
              <p>No active staff members</p>
              <small>Add staff from the Staff Management page first.</small>
            </div>
          ) : (
            <div className={s("attGrid")}>
              {/* Header */}
              <div className={cx(s("attRow"), s("attHead"))}>
                <div className={s("attCell")}>Staff Member</div>
                {ATT_STATUSES.map(a => (
                  <div key={a.key} className={s("attCell")} style={{ textAlign: "center" }}>
                    {a.label}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {activeStaff.map(m => {
                const current = draft[m.id] ?? "present";
                return (
                  <div key={m.id} className={s("attRow")}>
                    <div className={s("attCell")}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: "#fff1df", color: "#c46a14",
                          display: "grid", placeItems: "center",
                          fontSize: 11, fontWeight: 900, flexShrink: 0,
                        }}>
                          {m.full_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ fontSize: 13, fontWeight: 900 }}>{m.full_name}</strong>
                          <small style={{ display: "block", fontSize: 11, color: "#6a7882", fontWeight: 800 }}>
                            {m.role_name ?? "Staff"}
                          </small>
                        </div>
                      </div>
                    </div>
                    {ATT_STATUSES.map(a => (
                      <div key={a.key} className={s("attCell")} style={{ textAlign: "center" }}>
                        <button
                          className={cx(
                            s("attBtn"),
                            current === a.key && cx(s("attBtnActive"), s(a.cls))
                          )}
                          onClick={() => setStatus(m.id, a.key)}
                        >
                          {current === a.key && (
                            <i className="fa-solid fa-check" style={{ marginRight: 4 }} />
                          )}
                          {a.label}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
