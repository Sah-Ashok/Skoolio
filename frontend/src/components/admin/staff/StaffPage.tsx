"use client";

import { useState, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import { Spinner } from "@/components/shared/Loader";
import { useApi, useMutation } from "@/lib/useApi";
import styles from "./staff.module.css";

const s  = (n: string) => styles[n] || n;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

// ── Types ─────────────────────────────────────────────────────────────────────
type StaffRole = { id: number; role_name: string };

type Staff = {
  id: number;
  full_name: string;
  phone?: string;
  gender?: string;
  joined_date: string;
  status: "active" | "on_leave" | "terminated";
  staff_role_id: number;
  role_name?: string;
  current_salary?: { basic_salary: number };
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:      { bg: "#e2f6ee", color: "#12805c" },
  on_leave:    { bg: "#fff1df", color: "#a85f12" },
  terminated:  { bg: "#fde7e7", color: "#b42318" },
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active", on_leave: "On Leave", terminated: "Terminated",
};

const fmt = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(Number(n) || 0);

const initials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

// ── Add Staff Modal ───────────────────────────────────────────────────────────
function AddStaffModal({
  roles,
  onClose,
  onSaved,
}: {
  roles: StaffRole[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: "", phone: "", gender: "", status: "active",
    staff_role_id: "", joined_date: new Date().toISOString().split("T")[0],
    address: "", date_of_birth: "",
  });
  const [err, setErr] = useState("");
  const { execute, loading } = useMutation("/staff", "POST");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.full_name.trim()) return setErr("Full name is required.");
    if (!form.staff_role_id)    return setErr("Please select a role.");
    if (!form.joined_date)      return setErr("Joined date is required.");
    setErr("");
    try {
      await execute({ ...form, staff_role_id: Number(form.staff_role_id) });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Failed to add staff member.");
    }
  };

  return (
    <div className={s("overlay")} onClick={onClose}>
      <div className={s("modal")} onClick={e => e.stopPropagation()}>
        <div className={s("modalHead")}>
          <div>
            <h2>Add Staff Member</h2>
            <p>Fill in the details for the new staff member.</p>
          </div>
          <button className={s("closeBtn")} onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className={s("formGrid")}>
          <div className={cx(s("field"), s("full"))}>
            <label>Full Name *</label>
            <input value={form.full_name} onChange={e => set("full_name", e.target.value)} placeholder="e.g. Ram Bahadur Thapa" />
          </div>

          <div className={s("field")}>
            <label>Role *</label>
            <select value={form.staff_role_id} onChange={e => set("staff_role_id", e.target.value)}>
              <option value="">Select role…</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
            </select>
          </div>

          <div className={s("field")}>
            <label>Phone</label>
            <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="98XXXXXXXX" />
          </div>

          <div className={s("field")}>
            <label>Gender</label>
            <select value={form.gender} onChange={e => set("gender", e.target.value)}>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className={s("field")}>
            <label>Joined Date *</label>
            <input type="date" value={form.joined_date} onChange={e => set("joined_date", e.target.value)} />
          </div>

          <div className={s("field")}>
            <label>Date of Birth</label>
            <input type="date" value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} />
          </div>

          <div className={s("field")}>
            <label>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>

          <div className={cx(s("field"), s("full"))}>
            <label>Address</label>
            <textarea value={form.address} onChange={e => set("address", e.target.value)} placeholder="Home address…" />
          </div>

          {err && (
            <p className={s("full")} style={{ margin: 0, color: "#b42318", fontSize: 13, fontWeight: 800 }}>
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }} />{err}
            </p>
          )}
        </div>

        <div className={s("modalFoot")}>
          <button className={cx(s("btn"), s("btnOutline"))} onClick={onClose}>Cancel</button>
          <button className={cx(s("btn"), s("btnPrimary"))} onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size={14} color="#fff" /> : <><i className="fa-solid fa-plus" /> Add Staff</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Role Modal ────────────────────────────────────────────────────────────
function AddRoleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [err, setErr]   = useState("");
  const { execute, loading } = useMutation("/staff/roles", "POST");

  const handleSubmit = async () => {
    if (!name.trim()) return setErr("Role name is required.");
    setErr("");
    try {
      await execute({ role_name: name.trim() });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Failed to create role.");
    }
  };

  return (
    <div className={s("overlay")} onClick={onClose}>
      <div className={s("modal")} style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className={s("modalHead")}>
          <div><h2>New Staff Role</h2><p>e.g. Cleaner, Warden, Security Guard</p></div>
          <button className={s("closeBtn")} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className={s("formGrid")}>
          <div className={cx(s("field"), s("full"))}>
            <label>Role Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Cleaner, Cook, Warden…" autoFocus />
          </div>
          {err && <p className={s("full")} style={{ margin: 0, color: "#b42318", fontSize: 13, fontWeight: 800 }}>{err}</p>}
        </div>
        <div className={s("modalFoot")}>
          <button className={cx(s("btn"), s("btnOutline"))} onClick={onClose}>Cancel</button>
          <button className={cx(s("btn"), s("btnPrimary"))} onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size={14} color="#fff" /> : "Create Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function StaffPage() {
  const { data: staff,   loading: loadingStaff,  refetch: refetchStaff }  = useApi<Staff[]>("/staff");
  const { data: roles,   loading: loadingRoles,  refetch: refetchRoles }  = useApi<StaffRole[]>("/staff/roles");

  const [search,     setSearch]     = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [modal,      setModal]      = useState<"add_staff" | "add_role" | null>(null);

  const filtered = useMemo(() => {
    return (staff ?? []).filter(m => {
      const matchSearch = !search || m.full_name.toLowerCase().includes(search.toLowerCase()) || (m.phone ?? "").includes(search);
      const matchRole   = !filterRole   || String(m.staff_role_id) === filterRole;
      const matchStatus = !filterStatus || m.status === filterStatus;
      return matchSearch && matchRole && matchStatus;
    });
  }, [staff, search, filterRole, filterStatus]);

  const totalActive     = (staff ?? []).filter(m => m.status === "active").length;
  const totalOnLeave    = (staff ?? []).filter(m => m.status === "on_leave").length;
  const totalTerminated = (staff ?? []).filter(m => m.status === "terminated").length;

  return (
    <div className={s("page")}>
      <Topbar title="Staff Management" subtitle="Non-teaching staff: cleaners, wardens, security, cooks & more" />
      <main className={s("content")}>

        {/* Head */}
        <section className={s("head")}>
          <div>
            <h1>Staff Members</h1>
            <p>Manage all non-teaching staff, their attendance and salary.</p>
          </div>
          <div className={s("actions")}>
            <button className={cx(s("btn"), s("btnOutline"))} onClick={() => setModal("add_role")}>
              <i className="fa-solid fa-tag" /> New Role
            </button>
            <button className={cx(s("btn"), s("btnPrimary"))} onClick={() => setModal("add_staff")}>
              <i className="fa-solid fa-plus" /> Add Staff
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className={s("stats")}>
          {[
            { label: "Total Staff",   value: (staff ?? []).length, sub: "All roles",       cls: "blue",   icon: "fa-users" },
            { label: "Active",        value: totalActive,          sub: "Currently working", cls: "green",  icon: "fa-circle-check" },
            { label: "On Leave",      value: totalOnLeave,         sub: "Temporary absence", cls: "orange", icon: "fa-circle-pause" },
            { label: "Staff Roles",   value: (roles ?? []).length, sub: "Defined categories", cls: "purple", icon: "fa-tag" },
          ].map(({ label, value, sub, cls, icon }) => (
            <article key={label} className={cx(s("stat"), s(cls))}>
              <div><i className={`fa-solid ${icon}`} /></div>
              <span>{label}</span>
              <strong>{loadingStaff ? "—" : value}</strong>
              <small>{sub}</small>
            </article>
          ))}
        </section>

        {/* Toolbar */}
        <div className={s("toolbar")}>
          <div className={s("search")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              placeholder="Search by name or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="">All Roles</option>
            {(roles ?? []).map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        {/* Table */}
        <div className={s("card")}>
          <div className={s("cardHead")}>
            <div>
              <h3><i className="fa-solid fa-users" />Staff List</h3>
              <p>{filtered.length} member{filtered.length !== 1 ? "s" : ""} shown</p>
            </div>
          </div>

          <div className={s("tableWrap")}>
            {loadingStaff ? (
              <div className={s("empty")}><Spinner size={28} color="#FF9B51" /></div>
            ) : filtered.length === 0 ? (
              <div className={s("empty")}>
                <i className="fa-solid fa-users-slash" />
                <p>No staff members found</p>
                <small>{search ? "Try a different search." : "Click \"Add Staff\" to get started."}</small>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Gender</th>
                    <th>Joined</th>
                    <th>Monthly Salary</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div className={s("staffCell")}>
                          <div className={s("avatar")}>{initials(m.full_name)}</div>
                          <div>
                            <strong>{m.full_name}</strong>
                            <small>#{m.id}</small>
                          </div>
                        </div>
                      </td>
                      <td>{m.role_name ?? "—"}</td>
                      <td>{m.phone ?? <span style={{ color: "#aab5bb" }}>—</span>}</td>
                      <td style={{ textTransform: "capitalize" }}>{m.gender ?? <span style={{ color: "#aab5bb" }}>—</span>}</td>
                      <td>{m.joined_date ? new Date(m.joined_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                      <td>
                        {m.current_salary
                          ? <strong style={{ color: "#12805c" }}>{fmt(m.current_salary.basic_salary)}</strong>
                          : <span style={{ color: "#c46a14", fontWeight: 900, fontSize: 12 }}>Not set</span>
                        }
                      </td>
                      <td>
                        <span
                          className={s("badge")}
                          style={{
                            background: STATUS_STYLE[m.status]?.bg ?? "#e5ebee",
                            color:      STATUS_STYLE[m.status]?.color ?? "#6a7882",
                          }}
                        >
                          {STATUS_LABELS[m.status] ?? m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Roles quick view */}
        {(roles ?? []).length > 0 && (
          <div className={s("card")}>
            <div className={s("cardHead")}>
              <div>
                <h3><i className="fa-solid fa-tag" />Staff Roles</h3>
                <p>All roles defined for your school</p>
              </div>
            </div>
            <div style={{ padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: 10 }}>
              {(roles ?? []).map(r => (
                <span
                  key={r.id}
                  style={{
                    padding: "6px 14px",
                    border: "1px solid #dce5e9",
                    borderRadius: 8,
                    background: "#f8fbfc",
                    fontSize: 13,
                    fontWeight: 900,
                    color: "#1f2d36",
                  }}
                >
                  <i className="fa-solid fa-circle-dot" style={{ color: "#ff9148", marginRight: 7, fontSize: 9 }} />
                  {r.role_name}
                  <small style={{ marginLeft: 8, color: "#6a7882", fontWeight: 800 }}>
                    ({(staff ?? []).filter(m => m.staff_role_id === r.id).length})
                  </small>
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      {modal === "add_staff" && (
        <AddStaffModal
          roles={roles ?? []}
          onClose={() => setModal(null)}
          onSaved={() => refetchStaff()}
        />
      )}
      {modal === "add_role" && (
        <AddRoleModal
          onClose={() => setModal(null)}
          onSaved={() => refetchRoles()}
        />
      )}
    </div>
  );
}
