"use client";

import { useState, useMemo } from "react";
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
      <main className={s("content")}>

        {/* Head */}
        <section className={s("head")}>
          <div className={s("headLeft")}>
            <div className={s("headIcon")}>
              <i className="fa-solid fa-bullhorn" />
            </div>
            <div>
              <h1>Notice Board</h1>
              <p>School-wide notices and announcements for your sections.</p>
            </div>
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
          <article className={cx(s("stat"), s("blue"))} onClick={() => setFilterType("school")} style={{ cursor: "pointer" }}>
            <div className={s("statInfo")}>
              <span className={s("statLabel")}>School-wide</span>
              <div className={s("statValue")}>{totalSchool}</div>
              <span className={s("statSub")}>From Admin</span>
            </div>
            <div className={s("statIcon")}>
              <i className="fa-solid fa-school" />
            </div>
          </article>
          <article className={cx(s("stat"), s("green"))} onClick={() => setFilterType("section")} style={{ cursor: "pointer" }}>
            <div className={s("statInfo")}>
              <span className={s("statLabel")}>Section</span>
              <div className={s("statValue")}>{totalSection}</div>
              <span className={s("statSub")}>Targeted</span>
            </div>
            <div className={s("statIcon")}>
              <i className="fa-solid fa-users" />
            </div>
          </article>
          <article className={cx(s("stat"), s("orange"))}>
            <div className={s("statInfo")}>
              <span className={s("statLabel")}>Pinned</span>
              <div className={s("statValue")}>{totalPinned}</div>
              <span className={s("statSub")}>Important</span>
            </div>
            <div className={s("statIcon")}>
              <i className="fa-solid fa-thumbtack" />
            </div>
          </article>
          <article className={cx(s("stat"), s("purple"))} onClick={() => setFilterType("mine")} style={{ cursor: "pointer" }}>
            <div className={s("statInfo")}>
              <span className={s("statLabel")}>My Notices</span>
              <div className={s("statValue")}>{totalMine}</div>
              <span className={s("statSub")}>Posted by me</span>
            </div>
            <div className={s("statIcon")}>
              <i className="fa-solid fa-pen-to-square" />
            </div>
          </article>
        </section>

        {/* Toolbar */}
        <section className={s("toolbar")}>
          <label className={s("search")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              placeholder="Search notices by title or content..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <div className={s("filterGroup")}>
            <button
              type="button"
              className={cx(s("filterBtn"), filterType === "all" && s("filterBtnActive"))}
              onClick={() => setFilterType("all")}
            >
              <i className="fa-solid fa-layer-group" />
              <span>All Notices</span>
            </button>
            <button
              type="button"
              className={cx(s("filterBtn"), filterType === "school" && s("filterBtnActive"))}
              onClick={() => setFilterType("school")}
            >
              <i className="fa-solid fa-school" />
              <span>School-wide</span>
            </button>
            <button
              type="button"
              className={cx(s("filterBtn"), filterType === "section" && s("filterBtnActive"))}
              onClick={() => setFilterType("section")}
            >
              <i className="fa-solid fa-users" />
              <span>Section Notices</span>
            </button>
            <button
              type="button"
              className={cx(s("filterBtn"), filterType === "mine" && s("filterBtnActive"))}
              onClick={() => setFilterType("mine")}
            >
              <i className="fa-solid fa-pen-to-square" />
              <span>My Notices</span>
            </button>
          </div>
        </section>

        {/* Main grid */}
        <section className={s("grid")}>

          {/* List */}
          <article className={s("card")}>
            <div className={s("cardHead")}>
              <div className={s("cardHeadLeft")}>
                <h3>
                  <i className="fa-solid fa-list-ul" style={{ color: "#ff9148" }} />
                  <span>Notices</span>
                </h3>
                <span style={{
                  fontSize: 11.5,
                  padding: "3px 10px",
                  borderRadius: 99,
                  background: "#fff7ed",
                  color: "#c2410c",
                  border: "1px solid #fed7aa",
                  fontWeight: 800,
                }}>
                  {filtered.length} {filtered.length === 1 ? "notice" : "notices"}
                </span>
              </div>
            </div>
            <div className={s("noticeList")}>
              {loading && <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={28} color="#ff9148" /></div>}
              {!loading && filtered.length === 0 && (
                <div style={{ padding: "3rem 1.5rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: "1px solid #fed7aa" }}>
                    <i className="fa-solid fa-bullhorn" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>No notices found</h4>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b", fontWeight: 600 }}>Try changing your filter or search keyword.</p>
                  </div>
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
              <div style={{ padding: "4rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, minHeight: 380, justifyContent: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "#f8fafc", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: "1px solid #e2e8f0" }}>
                  <i className="fa-regular fa-newspaper" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Select a notice to read</h4>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b", fontWeight: 600, maxWidth: 300 }}>Choose any announcement from the list on the left to view full details.</p>
                </div>
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
