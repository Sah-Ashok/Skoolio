"use client";

/**
 * FeedbackWidget — slim bottom-right slide-up card.
 * Rating (1–5 stars) + optional quick note. That's it.
 * Shows 3–5× per month, ≥5 days apart, 12s after load.
 */

import { useState, useEffect } from "react";
import { useMutation } from "@/lib/useApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import styles from "./FeedbackWidget.module.css";

const s  = (n: string) => styles[n] || n;
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

/* ── Storage ──────────────────────────────────────────────────── */
interface State { month: string; count: number; last: string; snoozed: boolean; }
const KEY      = "skoolio_fw3";
const MAX      = 5;
const MIN_DAYS = 5;

const tod  = () => new Date().toISOString().slice(0, 10);
const mon  = () => new Date().toISOString().slice(0, 7);
const diff = (a: string, b: string) =>
  Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);

function load(): State {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch {}
  return { month: "", count: 0, last: "", snoozed: false };
}
function save(s: State) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

function canShow(st: State): boolean {
  const m = mon();
  if (st.month !== m)                           return true;
  if (st.snoozed || st.count >= MAX)            return false;
  if (st.last === tod())                        return false;
  if (st.last && diff(st.last, tod()) < MIN_DAYS) return false;
  return true;
}

/* ── Rating config ────────────────────────────────────────────── */
const RATINGS = [
  { n: 1, icon: "fa-face-angry",     label: "Terrible",  color: "#ef4444" },
  { n: 2, icon: "fa-face-frown",     label: "Poor",      color: "#f97316" },
  { n: 3, icon: "fa-face-meh",       label: "Okay",      color: "#eab308" },
  { n: 4, icon: "fa-face-smile",     label: "Good",      color: "#22c55e" },
  { n: 5, icon: "fa-face-grin-beam", label: "Excellent", color: "#0ea5e9" },
];

/* ── Main ─────────────────────────────────────────────────────── */
export default function FeedbackWidget() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(st => st.auth);
  const role     = user?.role;
  const eligible = role === "admin" || role === "faculty" || role === "super_admin";

  const [open,      setOpen]      = useState(false);
  const [leaving,   setLeaving]   = useState(false);
  const [rating,    setRating]    = useState(0);
  const [hovered,   setHovered]   = useState(0);
  const [note,      setNote]      = useState("");
  const [done,      setDone]      = useState(false);

  const endpoint = role === "faculty" ? "/feedback/teacher" : "/feedback/admin";
  const { execute: submit, loading } = useMutation(endpoint, "POST");

  /* auto-show */
  useEffect(() => {
    if (!eligible) return;
    const t = setTimeout(() => {
      const st = load();
      if (!canShow(st)) return;
      const m = mon();
      save({ month: m, count: st.month === m ? st.count + 1 : 1, last: tod(), snoozed: false });
      setOpen(true);
    }, 12_000);
    return () => clearTimeout(t);
  }, [eligible]);

  const close = (snooze = false) => {
    setLeaving(true);
    if (snooze) { const st = load(); save({ ...st, snoozed: true }); }
    setTimeout(() => { setLeaving(false); setOpen(false); setDone(false); setRating(0); setNote(""); }, 320);
  };

  const handleSubmit = async () => {
    if (!rating) {
      dispatch(showToast({ type: "error", title: "", message: "Pick a rating first!" }));
      return;
    }
    const r = RATINGS[rating - 1];
    try {
      await submit({
        category:    "general",
        title:       `${r.label} (${rating}/5)`,
        description: note.trim() || "No additional note.",
        rating,
        priority:    rating <= 2 ? "high" : "low",
      });
      setDone(true);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed." }));
    }
  };

  /* open from sidebar trigger */
  if (typeof window !== "undefined") {
    (window as any).__openFeedback = () => { setDone(false); setRating(0); setNote(""); setOpen(true); };
  }

  if (!open || !eligible) return null;

  const display = hovered || rating;
  const rCfg    = display ? RATINGS[display - 1] : null;

  return (
    <div className={cx(s("wrap"), leaving && s("wrapOut"))}>
      {/* header */}
      <div className={s("head")}>
        <div className={s("headLeft")}>
          <span className={s("headDot")} />
          <strong>{done ? "Thank you!" : "How's Skoolio?"}</strong>
        </div>
        <div className={s("headRight")}>
          {!done && (
            <button className={s("snooze")} onClick={() => close(true)} title="Don't ask again">
              Later
            </button>
          )}
          <button className={s("xBtn")} onClick={() => close()} title="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      </div>

      {done ? (
        /* ── Thank you ── */
        <div className={s("doneBody")}>
          <span className={s("doneEmoji")}>🎉</span>
          <p>Your feedback makes Skoolio better.</p>
          <button className={cx(s("submitBtn"), s("doneBtn"))} onClick={() => close()}>Close</button>
        </div>
      ) : (
        /* ── Rating form ── */
        <div className={s("body")}>
          {/* Star / face row */}
          <div className={s("faces")}>
            {RATINGS.map(r => (
              <button
                key={r.n}
                className={cx(s("face"), (rating === r.n) && s("faceActive"))}
                onMouseEnter={() => setHovered(r.n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(r.n)}
                title={r.label}
                style={(rating === r.n || hovered === r.n) ? { borderColor: r.color, background: r.color + "14" } : {}}
              >
                <i
                  className={`fa-solid ${r.icon}`}
                  style={{ color: (rating === r.n || hovered === r.n) ? r.color : "#c8d6de", fontSize: 24 }}
                />
              </button>
            ))}
          </div>

          {/* Label */}
          <div className={s("labelRow")}>
            {rCfg ? (
              <span className={s("rLabel")} style={{ color: rCfg.color }}>
                {rCfg.label}
              </span>
            ) : (
              <span className={s("rPlaceholder")}>Tap to rate</span>
            )}
          </div>

          {/* Note */}
          <textarea
            className={s("note")}
            placeholder="Quick note? (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={300}
            rows={2}
          />

          {/* Submit */}
          <button
            className={s("submitBtn")}
            onClick={handleSubmit}
            disabled={loading || !rating}
          >
            {loading ? <Spinner size={13} color="#fff" /> : <i className="fa-solid fa-paper-plane" />}
            {loading ? "Sending…" : "Submit"}
          </button>
        </div>
      )}
    </div>
  );
}
