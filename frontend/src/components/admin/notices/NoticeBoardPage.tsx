"use client";

import { useState, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
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

interface Section {
  id: number;
  name: string;
  class_id: number;
  class_name?: string;
}

// formatDate now comes from useDateFormat hook (BS/AD aware)

const isExpired = (expires_at: string | null) =>
  expires_at ? new Date(expires_at) < new Date() : false;

export default function NoticeBoardPage() {
  const dispatch = useAppDispatch();
  const { formatDate } = useDateFormat();

  const { data: notices, loading, refetch } = useApi<Notice[]>("/notices/admin");
  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: sections }   = useApi<Section[]>(
    activeYear ? `/classes?academic_year_id=${activeYear.id}&include_sections=true` : ""
  );

  // Flatten sections from classes response (backend returns classes with sections)
  const allSections = useMemo(() => {
    if (!sections) return [];
    // If backend returns flat sections array
    if (Array.isArray(sections) && sections[0]?.name !== undefined) return sections as Section[];
    return [];
  }, [sections]);

  const { execute: createNotice, loading: creating } = useMutation("/notices/admin", "POST");
  const { execute: updateNotice, loading: updating } = useMutation("/notices", "PATCH");
  const { execute: deleteNotice }                     = useMutation("/notices", "DELETE");

  const [selected, setSelected]   = useState<Notice | null>(null);
  const [search, setSearch]        = useState("");
  const [filterStatus, setFilter]  = useState<"all" | "active" | "archived" | "pinned">("all");
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
      <Topbar title="Notice Board" subtitle="Post and manage school-wide announcements and notices" />
      <main className={s("content")}>

        {/* Head */}
        <section className={s("head")}>
          <div>
            <h1>Notice Board</h1>
            <p>Create, pin, and manage announcements for your school.</p>
          </div>
          <div className={s("actions")}>
            <button className={cx(s("btn"), s("btnPrimary"))} onClick={openCreate}>
              <i className="fa-solid fa-plus" /> New Notice
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className={s("stats")}>
          <article className={cx(s("stat"), s("green"))}>
            <div><i className="fa-solid fa-bullhorn" /></div>
            <span>Active</span>
            <strong>{totalActive}</strong>
            <small>Published</small>
          </article>
          <article className={cx(s("stat"), s("orange"))}>
            <div><i className="fa-solid fa-thumbtack" /></div>
            <span>Pinned</span>
            <strong>{totalPinned}</strong>
            <small>Important</small>
          </article>
          <article className={cx(s("stat"), s("blue"))}>
            <div><i className="fa-solid fa-box-archive" /></div>
            <span>Archived</span>
            <strong>{totalArchived}</strong>
            <small>Old notices</small>
          </article>
          <article className={cx(s("stat"), s("purple"))}>
            <div><i className="fa-solid fa-clock-rotate-left" /></div>
            <span>Expired</span>
            <strong>{totalExpired}</strong>
            <small>Past date</small>
          </article>
        </section>

        {/* Toolbar */}
        <section className={s("toolbar")}>
          <label className={s("search")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              placeholder="Search notice..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <select value={filterStatus} onChange={e => setFilter(e.target.value as any)}>
            <option value="all">All Notices</option>
            <option value="active">Active</option>
            <option value="pinned">Pinned</option>
            <option value="archived">Archived</option>
          </select>
        </section>

        {/* Main grid */}
        <section className={s("grid")}>

          {/* Notice list */}
          <article className={s("card")}>
            <div className={s("cardHead")}>
              <div>
                <h3><i className="fa-solid fa-list" />All Notices</h3>
                <p>{filtered.length} notice{filtered.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className={s("noticeList")}>
              {loading && (
                <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={28} /></div>
              )}
              {!loading && filtered.length === 0 && (
                <div className={s("emptyState")}>
                  <i className="fa-solid fa-bullhorn" />
                  <p>No notices found. Click "New Notice" to post one.</p>
                </div>
              )}
              {!loading && filtered.map((notice) => (
                <div
                  key={notice.id}
                  className={cx(s("noticeItem"), selected?.id === notice.id && s("noticeItemActive"))}
                  onClick={() => setSelected(notice)}
                >
                  <div className={s("noticeItemTop")}>
                    <span className={s("noticeItemTitle")}>
                      {notice.is_pinned && <i className={cx("fa-solid fa-thumbtack", s("pinIcon"))} />}
                      {notice.title}
                    </span>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button
                        className={cx(s("btn"), s("btnSoft"), s("btnSm"))}
                        title={notice.is_pinned ? "Unpin" : "Pin"}
                        onClick={e => handleTogglePin(notice, e)}
                        style={{ color: notice.is_pinned ? "#ff9b51" : "#6a7882" }}
                      >
                        <i className="fa-solid fa-thumbtack" />
                      </button>
                      <button
                        className={cx(s("btn"), s("btnSoft"), s("btnSm"))}
                        title="Edit"
                        onClick={e => openEdit(notice, e)}
                      >
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button
                        className={cx(s("btn"), s("btnDanger"), s("btnSm"))}
                        title="Delete"
                        onClick={e => handleDelete(notice, e)}
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>
                  <div className={s("noticeMeta")}>
                    <span className={cx(s("badge"), notice.status === "active" ? s("badgeGreen") : s("badgeGray"))}>
                      {notice.status}
                    </span>
                    {notice.created_by_role === "faculty" && (
                      <span className={cx(s("badge"), s("badgeBlue"))}>Teacher</span>
                    )}
                    {notice.target_type === "section" && notice.section_name && (
                      <span className={cx(s("badge"), s("badgeOrange"))}>
                        {notice.class_name} – {notice.section_name}
                      </span>
                    )}
                    {isExpired(notice.expires_at) && (
                      <span className={cx(s("badge"), s("badgeRed"))}>Expired</span>
                    )}
                    <span className={s("noticeDate")}>{formatDate(notice.created_at)}</span>
                  </div>
                  <p className={s("noticePreview")}>{notice.content}</p>
                </div>
              ))}
            </div>
          </article>

          {/* Detail panel */}
          <article className={s("card")}>
            {!selected ? (
              <div className={s("noSelection")}>
                <i className="fa-solid fa-newspaper" />
                <p>Select a notice to view its full content.</p>
              </div>
            ) : (
              <div className={s("detailPanel")}>
                <div className={s("detailTitle")}>
                  <h2>
                    {selected.is_pinned && <i className={cx("fa-solid fa-thumbtack", s("pinIcon"))} />}
                    {selected.title}
                  </h2>
                  <div className={s("detailActions")}>
                    <button
                      className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                      onClick={e => handleToggleArchive(selected, e)}
                    >
                      <i className={`fa-solid fa-${selected.status === "active" ? "box-archive" : "rotate-left"}`} />
                      {selected.status === "active" ? "Archive" : "Restore"}
                    </button>
                    <button
                      className={cx(s("btn"), s("btnPrimary"), s("btnSm"))}
                      onClick={e => openEdit(selected, e)}
                    >
                      <i className="fa-solid fa-pen" /> Edit
                    </button>
                  </div>
                </div>

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
                  {selected.target_type === "section" && selected.section_name && (
                    <span className={s("metaItem")}>
                      <i className="fa-solid fa-users" />
                      {selected.class_name} – {selected.section_name}
                    </span>
                  )}
                  {!selected.target_type && (
                    <span className={s("metaItem")}>
                      <i className="fa-solid fa-school" />
                      School-wide
                    </span>
                  )}
                  <span className={cx(s("badge"), selected.status === "active" ? s("badgeGreen") : s("badgeGray"))}>
                    {selected.status}
                  </span>
                  {isExpired(selected.expires_at) && (
                    <span className={cx(s("badge"), s("badgeRed"))}>Expired</span>
                  )}
                </div>

                <div className={s("detailContent")}>{selected.content}</div>
              </div>
            )}
          </article>
        </section>
      </main>

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className={s("overlay")} onClick={() => setShowModal(false)}>
          <div className={s("modal")} onClick={e => e.stopPropagation()}>
            <div className={s("modalHead")}>
              <h3><i className="fa-solid fa-bullhorn" style={{ color: "#ff9b51", marginRight: 8 }} />
                {editNotice ? "Edit Notice" : "New Notice"}
              </h3>
              <button className={s("closeBtn")} onClick={() => setShowModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className={s("modalBody")}>
              <div className={s("field")}>
                <span>Title <b>*</b></span>
                <input
                  placeholder="Notice title..."
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className={s("field")}>
                <span>Content <b>*</b></span>
                <textarea
                  placeholder="Write the full notice content here..."
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                />
              </div>
              <div className={s("field")}>
                <span>Expiry Date <span style={{ color: "#6a7882", fontWeight: 700 }}>(optional — leave blank to never expire)</span></span>
                <DateInput
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                />
              </div>
              <label className={s("checkRow")}>
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
                />
                <i className="fa-solid fa-thumbtack" style={{ color: "#ff9b51" }} />
                Pin this notice (show at top)
              </label>
            </div>
            <div className={s("modalFooter")}>
              <button className={cx(s("btn"), s("btnOutline"))} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                className={cx(s("btn"), s("btnPrimary"))}
                onClick={handleSubmit}
                disabled={creating || updating}
              >
                {creating || updating ? <Spinner size={16} /> : <i className="fa-solid fa-paper-plane" />}
                {editNotice ? "Save Changes" : "Post Notice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
