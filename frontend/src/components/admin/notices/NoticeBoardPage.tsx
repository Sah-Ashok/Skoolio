"use client";

import { useState, useMemo } from "react";
import styles from "./notices.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import DateInput from "@/components/shared/DateInput";
import { useDateFormat } from "@/lib/useDateFormat";

const s  = (n: string) => styles[n] || n;
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

interface Notice {
  id: number;
  title: string;
  content: string;
  created_by_role: "admin" | "faculty";
  created_by_name: string;
  target_type: "section" | null;
  target_section_id: number | null;
  section_name: string | null;
  class_name: string | null;
  is_pinned: boolean;
  expires_at: string | null;
  status: "active" | "archived";
  created_at: string;
}

const isExpired = (expires_at: string | null) =>
  expires_at ? new Date(expires_at) < new Date() : false;

type FilterStatus = "all" | "active" | "archived" | "pinned";

const FILTERS: { value: FilterStatus; label: string; icon: string }[] = [
  { value: "all",      label: "All",      icon: "fa-list"         },
  { value: "active",   label: "Active",   icon: "fa-circle-check" },
  { value: "pinned",   label: "Pinned",   icon: "fa-thumbtack"    },
  { value: "archived", label: "Archived", icon: "fa-box-archive"  },
];

export default function NoticeBoardPage() {
  const dispatch = useAppDispatch();
  const { formatDate } = useDateFormat();

  const { data: notices, loading, refetch } = useApi<Notice[]>("/notices/admin");

  const { execute: createNotice, loading: creating } = useMutation("/notices/admin", "POST");
  const { execute: updateNotice, loading: updating } = useMutation("/notices", "PATCH");
  const { execute: deleteNotice }                     = useMutation("/notices", "DELETE");

  const [selected, setSelected]   = useState<Notice | null>(null);
  const [search, setSearch]        = useState("");
  const [filterStatus, setFilter]  = useState<FilterStatus>("all");
  const [showModal, setShowModal]  = useState(false);
  const [editNotice, setEditNotice] = useState<Notice | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: "", content: "", is_pinned: false, expires_at: "",
  });

  const filtered = useMemo(() => {
    if (!notices) return [];
    return notices.filter((n) => {
      if (filterStatus === "active"   && n.status !== "active")   return false;
      if (filterStatus === "archived" && n.status !== "archived") return false;
      if (filterStatus === "pinned"   && !n.is_pinned)            return false;
      if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [notices, filterStatus, search]);

  const totalActive   = notices?.filter(n => n.status === "active").length   ?? 0;
  const totalPinned   = notices?.filter(n => n.is_pinned).length             ?? 0;
  const totalArchived = notices?.filter(n => n.status === "archived").length ?? 0;
  const totalExpired  = notices?.filter(n => isExpired(n.expires_at)).length ?? 0;

  const openCreate = () => {
    setEditNotice(null);
    setForm({ title: "", content: "", is_pinned: false, expires_at: "" });
    setShowModal(true);
  };

  const openEdit = (notice: Notice, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditNotice(notice);
    setForm({
      title: notice.title,
      content: notice.content,
      is_pinned: notice.is_pinned,
      expires_at: notice.expires_at ?? "",
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Title and content are required." }));
      return;
    }
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      is_pinned: form.is_pinned,
      expires_at: form.expires_at || null,
    };
    try {
      if (editNotice) {
        await updateNotice(payload, `/notices/${editNotice.id}`);
        dispatch(showToast({ type: "success", title: "Updated", message: "Notice updated successfully." }));
      } else {
        await createNotice(payload);
        dispatch(showToast({ type: "success", title: "Created", message: "Notice posted successfully." }));
      }
      setShowModal(false);
      refetch();
      if (selected && editNotice && selected.id === editNotice.id) {
        setSelected(null);
      }
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to save notice." }));
    }
  };

  const handleTogglePin = async (notice: Notice, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateNotice({ is_pinned: !notice.is_pinned }, `/notices/${notice.id}`);
      dispatch(showToast({ type: "success", title: notice.is_pinned ? "Unpinned" : "Pinned", message: `Notice ${notice.is_pinned ? "unpinned" : "pinned"}.` }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message }));
    }
  };

  const handleToggleArchive = async (notice: Notice, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = notice.status === "active" ? "archived" : "active";
    try {
      await updateNotice({ status: newStatus }, `/notices/${notice.id}`);
      dispatch(showToast({ type: "success", title: "Updated", message: `Notice ${newStatus}.` }));
      refetch();
      if (selected?.id === notice.id) setSelected(null);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message }));
    }
  };

  const handleDelete = async (notice: Notice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${notice.title}"? This cannot be undone.`)) return;
    try {
      await deleteNotice(undefined, `/notices/${notice.id}`);
      dispatch(showToast({ type: "success", title: "Deleted", message: "Notice deleted." }));
      refetch();
      if (selected?.id === notice.id) setSelected(null);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message }));
    }
  };

  return (
    <div className={s("page")}>
      <main className={s("content")}>

        {/* ── Head ── */}
        <section className={s("head")}>
          <div className={s("headLeft")}>
            <div className={s("headIcon")}>
              <i className="fa-solid fa-bullhorn" />
            </div>
            <div>
              <h1>Notice Board</h1>
              <p>Create, pin, and manage announcements for students, teachers, and faculty.</p>
            </div>
          </div>
          <div className={s("actions")}>
            <button className={cx(s("btn"), s("btnPrimary"))} onClick={openCreate} id="new-notice-btn">
              <i className="fa-solid fa-plus" />
              New Notice
            </button>
          </div>
        </section>

        {/* ── Compact Horizontal Stats (~75px) ── */}
        <section className={s("stats")}>
          <article className={cx(s("stat"), s("green"))}>
            <div className={s("statInfo")}>
              <span className={s("statLabel")}>Active</span>
              <strong className={s("statValue")}>{totalActive}</strong>
              <span className={s("statSub")}>Published</span>
            </div>
            <div className={s("statIcon")}><i className="fa-solid fa-bullhorn" /></div>
          </article>

          <article className={cx(s("stat"), s("orange"))}>
            <div className={s("statInfo")}>
              <span className={s("statLabel")}>Pinned</span>
              <strong className={s("statValue")}>{totalPinned}</strong>
              <span className={s("statSub")}>Important</span>
            </div>
            <div className={s("statIcon")}><i className="fa-solid fa-thumbtack" /></div>
          </article>

          <article className={cx(s("stat"), s("blue"))}>
            <div className={s("statInfo")}>
              <span className={s("statLabel")}>Archived</span>
              <strong className={s("statValue")}>{totalArchived}</strong>
              <span className={s("statSub")}>Old notices</span>
            </div>
            <div className={s("statIcon")}><i className="fa-solid fa-box-archive" /></div>
          </article>

          <article className={cx(s("stat"), s("purple"))}>
            <div className={s("statInfo")}>
              <span className={s("statLabel")}>Expired</span>
              <strong className={s("statValue")}>{totalExpired}</strong>
              <span className={s("statSub")}>Past date</span>
            </div>
            <div className={s("statIcon")}><i className="fa-solid fa-clock-rotate-left" /></div>
          </article>
        </section>

        {/* ── Toolbar ── */}
        <section className={s("toolbar")}>
          <div className={s("search")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              id="notice-search"
              placeholder="Search notices by title..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search notices"
            />
            {search && (
              <button
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex" }}
                onClick={() => setSearch("")}
                title="Clear search"
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: 12 }} />
              </button>
            )}
          </div>

          <div className={s("filterGroup")} role="group" aria-label="Filter notices">
            {FILTERS.map(f => (
              <button
                key={f.value}
                className={cx(s("filterBtn"), filterStatus === f.value && s("filterBtnActive"))}
                onClick={() => setFilter(f.value)}
                aria-pressed={filterStatus === f.value}
              >
                <i className={`fa-solid ${f.icon}`} />
                {f.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Main Grid ── */}
        <section className={s("grid")}>

          {/* Notice List */}
          <article className={s("card")}>
            <div className={s("cardHead")}>
              <div className={s("cardHeadLeft")}>
                <h3><i className="fa-solid fa-list" />All Notices</h3>
                <p>
                  {loading ? "Loading..." : `${filtered.length} notice${filtered.length !== 1 ? "s" : ""} found`}
                </p>
              </div>
            </div>

            <div className={s("noticeList")} role="list" aria-label="Notice list">
              {/* Loading state */}
              {loading && (
                <div style={{ padding: "3rem", textAlign: "center" }}>
                  <Spinner size={28} color="#FF9B51" />
                  <p style={{ marginTop: 10, color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Loading notices…</p>
                </div>
              )}

              {/* Empty state */}
              {!loading && filtered.length === 0 && (
                <div className={s("emptyState")}>
                  <div className={s("emptyStateIcon")}>
                    <i className="fa-solid fa-bullhorn" />
                  </div>
                  <p>
                    {search
                      ? `No notices match "${search}"`
                      : filterStatus !== "all"
                        ? `No ${filterStatus} notices`
                        : 'No notices yet. Click "New Notice" to post one.'}
                  </p>
                </div>
              )}

              {/* Notice items */}
              {!loading && filtered.map((notice) => (
                <div
                  key={notice.id}
                  className={cx(s("noticeItem"), selected?.id === notice.id && s("noticeItemActive"))}
                  onClick={() => setSelected(notice)}
                  role="listitem"
                  aria-selected={selected?.id === notice.id}
                >
                  <div className={s("noticeItemTop")}>
                    <span className={s("noticeItemTitle")}>
                      {notice.is_pinned && <i className={cx("fa-solid fa-thumbtack", s("pinIcon"))} aria-label="Pinned" />}
                      {notice.title}
                    </span>
                    <div className={s("noticeActions")}>
                      <button
                        className={cx(s("btn"), s("btnSoft"), s("btnSm"), s("btnIcon"))}
                        title={notice.is_pinned ? "Unpin" : "Pin notice"}
                        onClick={e => handleTogglePin(notice, e)}
                        style={{ color: notice.is_pinned ? "#ea580c" : undefined }}
                        aria-label={notice.is_pinned ? "Unpin" : "Pin"}
                      >
                        <i className="fa-solid fa-thumbtack" />
                      </button>
                      <button
                        className={cx(s("btn"), s("btnSoft"), s("btnSm"), s("btnIcon"))}
                        title="Edit notice"
                        onClick={e => openEdit(notice, e)}
                        aria-label="Edit"
                      >
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button
                        className={cx(s("btn"), s("btnDanger"), s("btnSm"), s("btnIcon"))}
                        title="Delete notice"
                        onClick={e => handleDelete(notice, e)}
                        aria-label="Delete"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>

                  <div className={s("noticeMeta")}>
                    <span className={cx(s("badge"), notice.status === "active" ? s("badgeGreen") : s("badgeGray"))}>
                      <i className={`fa-solid fa-circle${notice.status === "active" ? "-check" : ""}`} style={{ fontSize: 8 }} />
                      {notice.status}
                    </span>
                    {notice.created_by_role === "faculty" && (
                      <span className={cx(s("badge"), s("badgeBlue"))}>
                        <i className="fa-solid fa-chalkboard-teacher" style={{ fontSize: 8 }} />
                        Teacher
                      </span>
                    )}
                    {notice.target_type === "section" && notice.section_name && (
                      <span className={cx(s("badge"), s("badgeOrange"))}>
                        <i className="fa-solid fa-users" style={{ fontSize: 8 }} />
                        {notice.class_name} – {notice.section_name}
                      </span>
                    )}
                    {isExpired(notice.expires_at) && (
                      <span className={cx(s("badge"), s("badgeRed"))}>
                        <i className="fa-solid fa-hourglass-end" style={{ fontSize: 8 }} />
                        Expired
                      </span>
                    )}
                    <span className={s("noticeDate")}>
                      <i className="fa-regular fa-clock" />
                      {formatDate(notice.created_at)}
                    </span>
                  </div>

                  <p className={s("noticePreview")}>{notice.content}</p>
                </div>
              ))}
            </div>
          </article>

          {/* Detail Panel */}
          <article className={s("card")}>
            {!selected ? (
              <div className={s("noSelection")}>
                <div className={s("noSelectionIcon")}>
                  <i className="fa-regular fa-newspaper" />
                </div>
                <p>Select a notice to view its full content</p>
                <p className={s("noSelectionHint")}>
                  Click any notice from the list on the left
                </p>
              </div>
            ) : (
              <div className={s("detailPanel")}>
                {/* Header */}
                <div className={s("detailHeader")}>
                  <div className={s("detailTitleRow")}>
                    <h2 className={s("detailTitle")}>
                      {selected.is_pinned && (
                        <i className={cx("fa-solid fa-thumbtack", s("pinIcon"))} aria-label="Pinned" />
                      )}
                      {selected.title}
                    </h2>
                    <div className={s("detailActions")}>
                      <button
                        className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                        onClick={e => handleToggleArchive(selected, e)}
                        aria-label={selected.status === "active" ? "Archive notice" : "Restore notice"}
                      >
                        <i className={`fa-solid fa-${selected.status === "active" ? "box-archive" : "rotate-left"}`} />
                        {selected.status === "active" ? "Archive" : "Restore"}
                      </button>
                      <button
                        className={cx(s("btn"), s("btnPrimary"), s("btnSm"))}
                        onClick={e => openEdit(selected, e)}
                        aria-label="Edit notice"
                      >
                        <i className="fa-solid fa-pen" />
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className={s("detailMeta")}>
                    <span className={s("metaItem")}>
                      <i className="fa-solid fa-user" />
                      {selected.created_by_name}
                      {selected.created_by_role === "faculty" && " (Teacher)"}
                    </span>
                    <span className={s("metaItem")}>
                      <i className="fa-solid fa-calendar" />
                      {formatDate(selected.created_at)}
                    </span>
                    {selected.expires_at && (
                      <span className={s("metaItem")}>
                        <i className="fa-solid fa-hourglass-end" />
                        Expires: {formatDate(selected.expires_at)}
                      </span>
                    )}
                    {selected.target_type === "section" && selected.section_name ? (
                      <span className={s("metaItem")}>
                        <i className="fa-solid fa-users" />
                        {selected.class_name} – {selected.section_name}
                      </span>
                    ) : (
                      <span className={s("metaItem")}>
                        <i className="fa-solid fa-school" />
                        School-wide
                      </span>
                    )}
                  </div>

                  {/* Status badges */}
                  <div className={s("detailBadges")}>
                    <span className={cx(s("badge"), selected.status === "active" ? s("badgeGreen") : s("badgeGray"))}>
                      <i className="fa-solid fa-circle-dot" style={{ fontSize: 8 }} />
                      {selected.status}
                    </span>
                    {selected.is_pinned && (
                      <span className={cx(s("badge"), s("badgeOrange"))}>
                        <i className="fa-solid fa-thumbtack" style={{ fontSize: 8 }} />
                        Pinned
                      </span>
                    )}
                    {isExpired(selected.expires_at) && (
                      <span className={cx(s("badge"), s("badgeRed"))}>
                        <i className="fa-solid fa-hourglass-end" style={{ fontSize: 8 }} />
                        Expired
                      </span>
                    )}
                    {selected.created_by_role === "faculty" && (
                      <span className={cx(s("badge"), s("badgeBlue"))}>
                        <i className="fa-solid fa-chalkboard-teacher" style={{ fontSize: 8 }} />
                        Teacher
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className={s("detailContentWrapper")}>
                  <span className={s("detailContentLabel")}>
                    <i className="fa-solid fa-align-left" />
                    Notice Content
                  </span>
                  <div className={s("detailContent")}>{selected.content}</div>
                </div>
              </div>
            )}
          </article>
        </section>
      </main>

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div
          className={s("overlay")}
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label={editNotice ? "Edit Notice" : "New Notice"}
        >
          <div className={s("modal")} onClick={e => e.stopPropagation()}>
            {/* Modal Head */}
            <div className={s("modalHead")}>
              <div className={s("modalHeadLeft")}>
                <div className={s("modalHeadIcon")}>
                  <i className="fa-solid fa-bullhorn" />
                </div>
                <div>
                  <h3>{editNotice ? "Edit Notice" : "New Notice"}</h3>
                  <p>{editNotice ? "Update the notice details below" : "Fill in the details to post a new announcement"}</p>
                </div>
              </div>
              <button
                className={s("closeBtn")}
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Modal Body */}
            <div className={s("modalBody")}>
              <div className={s("field")}>
                <span className={s("fieldLabel")}>
                  Title <b>*</b>
                </span>
                <input
                  id="notice-title"
                  placeholder="Enter notice title (e.g. Annual Sports Day / Examination Routine)"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className={s("field")}>
                <span className={s("fieldLabel")}>
                  Content <b>*</b>
                </span>
                <textarea
                  id="notice-content"
                  placeholder="Write the full notice announcement details here..."
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                />
              </div>

              <div className={s("field")}>
                <span className={s("fieldLabel")}>
                  Expiry Date
                  <small>(optional — leave blank to keep indefinitely)</small>
                </span>
                <DateInput
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                />
              </div>

              <label className={s("checkRow")}>
                <input
                  type="checkbox"
                  id="notice-pin"
                  checked={form.is_pinned}
                  onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
                />
                <i className="fa-solid fa-thumbtack" />
                Pin this notice to top of notice board
                <span className={s("checkRowDesc")}>Important</span>
              </label>
            </div>

            {/* Modal Footer */}
            <div className={s("modalFooter")}>
              <button
                className={cx(s("btn"), s("btnOutline"))}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className={cx(s("btn"), s("btnPrimary"))}
                onClick={handleSubmit}
                disabled={creating || updating}
                id="notice-submit-btn"
              >
                {creating || updating ? (
                  <Spinner size={16} color="#fff" />
                ) : (
                  <><i className="fa-solid fa-paper-plane" /> {editNotice ? "Save Changes" : "Post Notice"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
