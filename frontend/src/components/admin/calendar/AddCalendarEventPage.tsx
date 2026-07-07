"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./calendar.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

export default function AddCalendarEventPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { data: activeYear } = useApi<any>('/academic-years/active');
  const { data: calendarData } = useApi<any>(activeYear ? `/calendar?academic_year_id=${activeYear.id}` : '');
  const { execute: createEvent, loading: saving } = useMutation('/calendar/events', 'POST');

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("holiday");
  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [affectsAttendance, setAffectsAttendance] = useState(true);
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calendarData?.id || !activeYear?.id) return dispatch(showToast({ type: 'error', title: 'Error', message: 'No active calendar found' }));
    if (!title || !eventDate) return dispatch(showToast({ type: 'error', title: 'Error', message: 'Please fill required fields' }));
    if (endDate && new Date(endDate) < new Date(eventDate)) return dispatch(showToast({ type: 'error', title: 'Error', message: 'End date cannot be before start date' }));

    try {
      await createEvent({
        calendar_id: calendarData.id,
        academic_year_id: activeYear.id,
        title,
        event_type: eventType,
        event_date: eventDate,
        end_date: endDate || undefined,
        description: description || undefined,
        affects_attendance: affectsAttendance,
      });

      dispatch(showToast({ type: 'success', title: 'Success', message: 'Calendar entry created successfully' }));
      router.push('/calendar');
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Error', message: err.message || 'Failed to create event' }));
    }
  };

  return (
    <div className={s("page")}>
      <Topbar title="Add Calendar Entry" subtitle="Create holiday, event, exam, vacation, or working day entry" />

      <main className={s("content")}>
        <section className={s("head")}>
          <div>
            <h1>Add Holiday / Event</h1>
            <p>Calendar entries decide whether attendance can be marked for a date.</p>
          </div>
          <Link className={cx(s("btn"), s("btnOutline"))} href="/calendar">
            <i className="fa-solid fa-arrow-left" /> Back to Calendar
          </Link>
        </section>

        <section className={s("formLayout")}>
          <form className={s("formStack")} onSubmit={handleSubmit}>
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div><h2>Calendar Details</h2><p>Basic date and event information.</p></div>
                <span className={s("step")}>01</span>
              </div>
              <div className={s("formGrid")}>
                <label className={s("field")}>
                  <span>Title <b>*</b></span>
                  <input placeholder="Example: Diwali Holiday" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </label>
                <label className={s("field")}>
                  <span>Type <b>*</b></span>
                  <select value={eventType} onChange={(e) => setEventType(e.target.value)} required>
                    <option value="holiday">Holiday</option>
                    <option value="event">Event</option>
                    <option value="exam">Exam</option>
                    <option value="early_closing">Early Closing</option>
                  </select>
                </label>
                <label className={s("field")}>
                  <span>From Date <b>*</b></span>
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                </label>
                <label className={s("field")}>
                  <span>To Date <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional, for multi-day)</span></span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={eventDate} />
                </label>
                <label className={s("field")}>
                  <span>Affects Attendance <b>*</b></span>
                  <select value={affectsAttendance ? "yes" : "no"} onChange={(e) => setAffectsAttendance(e.target.value === "yes")} required>
                    <option value="yes">Yes — counts as non-working day</option>
                    <option value="no">No — informational only</option>
                  </select>
                </label>
                <label className={cx(s("field"), s("full"))}>
                  <span>Description</span>
                  <textarea placeholder="Short note for this calendar entry" value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
              </div>
            </article>

            <div className={s("formActions")}>
              <button className={cx(s("btn"), s("btnSoft"))} type="reset">Clear</button>
              <button className={cx(s("btn"), s("btnPrimary"))} type="submit" disabled={saving}>
                {saving ? <Spinner size={16} /> : <><i className="fa-solid fa-floppy-disk" /> Save Calendar Entry</>}
              </button>
            </div>
          </form>

          <aside className={s("summaryCard")}>
            <div className={s("summaryIcon")}><i className="fa-solid fa-calendar-days" /></div>
            <h2>Entry Summary</h2>
            <div className={s("rules")}>
              <span><b>Default Type</b><strong style={{textTransform: 'capitalize'}}>{eventType.replace('_', ' ')}</strong></span>
              <span><b>Attendance</b><strong>{affectsAttendance ? "Disabled (non-working day)" : "Enabled"}</strong></span>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
