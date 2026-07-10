"use client";

import { useState, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi, useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import styles from "@/components/admin/notices/notices.module.css";

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

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const isExpired = (expires_at: string | null) =>
  expires_at ? new Date(expires_at) < new Date() : false;

export default function TeacherNoticeBoardPage() {
  const dispatch = useAppDispatch();

  const { data: notices, loading, refetch } = useApi<Notice[]>("/notices/teacher");
  // Teacher's coordinator sections — for posting notices
  const { data: mySections } = useApi<Section[]>("/teachers/me/sections");

  const { execute: createNotice, loading: creating } = useMutation("/notices/teacher", "POST");
  const { execute: updateNotice, loading: updating } = useMutation("/notices", "PATCH");
  const { execute: deleteNotice }                     = useMutation("/notices", "DELETE");

  const [selected, setSelected]    = useState<Notice | null>(null);
  const [search, setSearch]         = useState("");
  const [filterType, setFilterType] = useState<"all" | "school" | "section" | "mine">("all");
  const [showModal, setShowModal]   = useState(false);
  const [editNotice, setEditNotice] = useState<Notice | null>(null);

  const [form, setForm] = useState({
    title: "", content: "", is_pinned: false, expires_at: "",
    target_section_id: "",
  });

  // Store teacher id from notices (notices posted by me have created_by_role = 'faculty')
  // We infer "my" notices by looking at who created them
  const filtered = useMemo(() => {
    if (!notices) return [];
    return notices.filter((n) => {
      if (filterType === "school"  && n.target_type !== null)         return false;
      if (filterType === "section" && n.target_type !== "section")    return false;
      if (filterType === "mine"    && n.created_by_role !== "faculty") return false;
      if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [notices, filterType, search]);

  const totalSchool  = notices?.filter(n => !n.target_type).length         ?? 0;
  const totalSection = notices?.filter(n => n.target_type === "section").length ?? 0;
  const totalPinned  = notices?.filter(n => n.is_pinned).length             ?? 0;
  const totalMine    = notices?.filter(n => n.created_by_role === "faculty").length ?? 0;

  const openCreate = () => {
    setEditNotice(null);
    setForm({ title: "", content: "", is_pinned: false, expires_at: "", target_section_id: "" });
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
      target_section_id: String(notice.target_section_id ?? ""),
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Title and content are required." }));
      return;
    }
    if (!editNotice && !form.target_section_id) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Please select a section for your notice." }));
      return;
    }
    const payload: any = {
      title: form.title.trim(),
      content: form.content.trim(),
      is_pinned: form.is_pinned,
      expires_at: form.expires_at || null,
    };
    if (!editNotice) {
      payload.target_section_id = Number(form.target_section_id);
      payload.target_type = "section";
    }
    try {
      if (editNotice) {
        await updateNotice(payload, `/notices/${editNotice.id}`);
        dispatch(showToast({ type: "success", title: "Updated", message: "Notice updated." }));
      } else {
        await createNotice(payload);
        dispatch(showToast({ type: "success", title: "Posted", message: "Notice posted to section." }));
      }
      setShowModal(false);
      refetch();
      if (selected && editNotice && selected.id === editNotice.id) setSelected(null);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed." }));
    }
  };

  const handleDelete = async (notice: Notice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${notice.title}"?`)) return;
    try {
      await deleteNotice(undefined, `/notices/${notice.id}`);
      dispatch(showToast({ type: "success", title: "Deleted", message: "Notice deleted." }));
      refetch();
      if (selected?.id === notice.id) setSelected(null);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message }));
    }
  };

  const canEdit = (notice: Notice) => notice.created_by_role === "faculty";

  return (
    <div className={s("page")}>
      <Topbar title="Notice Board" subtitle="View school announcements and post notices to your sections" />
      <main className={s("content")}>

        {/* Head */}
        <section className={s("head")}>
          <div>
            <h1>Notice Board</h1>
            <p>School-wide notices and notices for your sections.</p>
          </div>
          <div className={s("actions")}>
            {(mySections && mySections.length > 0) && (
              <button className={cx(s("btn"), s("btnPrimary"))} onClick={openCreate}>
                <i className="fa-solid fa-plus" /> Post Notice
              </button>
            )}
          </div>
        </section>

        {/* Stats */}
        <section className={s("stats")}>
          <article className={cx(s("stat"), s("blue"))}>
            <div><i className="fa-solid fa-school" /></div>
            <span>School-wide</span>
            <strong>{totalSchool}</strong>
            <small>From Admin</small>
          </article>
          <article className={cx(s("stat"), s("green"))}>
            <div><i className="fa-solid fa-users" /></div>
            <span>Section</span>
            <strong>{totalSection}</strong>
            <small>Targeted</small>
          </article>
          <article className={cx(s("stat"), s("orange"))}>
            <div><i className="fa-solid fa-thumbtack" /></div>
            <span>Pinned</span>
            <strong>{totalPinned}</strong>
            <small>Important</small>
          </article>
          <article className={cx(s("stat"), s("purple"))}>
            <div><i className="fa-solid fa-pen" /></div>
            <span>My Notices</span>
            <strong>{totalMine}</strong>
            <small>Posted by me</small>
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
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)}>
            <option value="all">All Notices</option>
            <option value="school">School-wide</option>
            <option value="section">Section Notices</option>
            <option value="mine">My Notices</option>
          </select>
        </section>

        {/* Main grid */}
        <section className={s("grid")}>

          {/* List */}
          <article className={s("card")}>
            <div className={s("cardHead")}>
              <div>
                <h3><i className="fa-solid fa-list" />Notices</h3>
                <p>{filtered.length} notice{filtered.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className={s("noticeList")}>
              {loading && <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={28} /></div>}
              {!loading && filtered.length === 0 && (
                <div className={s("emptyState")}>
                  <i className="fa-solid fa-bullhorn" />
                  <p>No notices found.</p>
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
                    {canEdit(notice) && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
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
                    )}
                  </div>
                  <div className={s("noticeMeta")}>
                    {notice.target_type === null && (
                      <span className={cx(s("badge"), s("badgeBlue"))}>School-wide</span>
                    )}
                    {notice.target_type === "section" && notice.section_name && (
                      <span className={cx(s("badge"), s("badgeOrange"))}>
                        {notice.class_name} – {notice.section_name}
                      </span>
                    )}
                    {notice.created_by_role === "faculty" && (
                      <span className={cx(s("badge"), s("badgeGreen"))}>
                        {canEdit(notice) ? "You" : notice.created_by_name}
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

          {/* Detail */}
          <article className={s("card")}>
            {!selected ? (
              <div className={s("noSelection")}>
                <i className="fa-solid fa-newspaper" />
                <p>Click a notice to read it.</p>
              </div>
            ) : (
              <div className={s("detailPanel")}>
                <div className={s("detailTitle")}>
                  <h2>
                    {selected.is_pinned && <i className={cx("fa-solid fa-thumbtack", s("pinIcon"))} />}
                    {selected.title}
                  </h2>
                  {canEdit(selected) && (
                    <div className={s("detailActions")}>
                      <button
                        className={cx(s("btn"), s("btnPrimary"), s("btnSm"))}
                        onClick={e => openEdit(selected, e)}
                      >
                        <i className="fa-solid fa-pen" /> Edit
                      </button>
                    </div>
                  )}
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
                <div className={s("detailContent")}>{selected.content}</div>
              </div>
            )}
          </article>
        </section>
      </main>

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className={s("overlay")} onClick={() => setShowModal(false)}>
          <div className={s("modal")} onClick={e => e.stopPropagation()}>
            <div className={s("modalHead")}>
              <h3>
                <i className="fa-solid fa-bullhorn" style={{ color: "#ff9b51", marginRight: 8 }} />
                {editNotice ? "Edit Notice" : "Post Notice to Section"}
              </h3>
              <button className={s("closeBtn")} onClick={() => setShowModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className={s("modalBody")}>
              {!editNotice && (
                <div className={s("field")}>
                  <span>Target Section <b>*</b></span>
                  <select
                    value={form.target_section_id}
                    onChange={e => setForm(f => ({ ...f, target_section_id: e.target.value }))}
                  >
                    <option value="">— Select section —</option>
                    {mySections?.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {sec.class_name ? `${sec.class_name} – ${sec.name}` : sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                  placeholder="Write the notice content..."
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                />
              </div>
              <div className={s("field")}>
                <span>Expiry Date <span style={{ color: "#6a7882", fontWeight: 700 }}>(optional)</span></span>
                <input
                  type="date"
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
                Pin this notice
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
