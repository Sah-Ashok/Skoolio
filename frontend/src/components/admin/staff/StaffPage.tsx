"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Spinner } from "@/components/shared/Loader";
import { useApi, useMutation } from "@/lib/useApi";
import styles from "./staff.module.css";
import DateInput from "@/components/shared/DateInput";
import { useDateFormat } from "@/lib/useDateFormat";

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
  address?: string;
  date_of_birth?: string;
  citizen_id?: string;
  license_number?: string;
  current_salary?: { basic_salary: number };
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:     { bg: "#e2f6ee", color: "#12805c" },
  on_leave:   { bg: "#fff1df", color: "#a85f12" },
  terminated: { bg: "#fde7e7", color: "#b42318" },
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active", on_leave: "On Leave", terminated: "Terminated",
};

const fmt = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(Number(n) || 0);

const initials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

// ── Shared Staff Form Fields ──────────────────────────────────────────────────
type StaffForm = {
  full_name: string; phone: string; gender: string; status: string;
  staff_role_id: string; joined_date: string; address: string;
  date_of_birth: string; citizen_id: string; license_number: string;
};

const emptyForm = (): StaffForm => ({
  full_name: "", phone: "", gender: "", status: "active",
  staff_role_id: "", joined_date: new Date().toISOString().split("T")[0],
  address: "", date_of_birth: "", citizen_id: "", license_number: "",
});

function StaffFormFields({
  form, set, roles,
}: {
  form: StaffForm;
  set: (k: keyof StaffForm, v: string) => void;
  roles: StaffRole[];
}) {
  return (
    <>
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
        <DateInput value={form.joined_date} onChange={e => set("joined_date", e.target.value)} />
      </div>

      <div className={s("field")}>
        <label>Date of Birth</label>
        <DateInput value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} />
      </div>

      <div className={s("field")}>
        <label>Status</label>
        <select value={form.status} onChange={e => set("status", e.target.value)}>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {/* Documents section */}
      <div className={s("full")}>
        <p style={{ margin: "4px 0 10px", fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 1 }}>
          <i className="fa-solid fa-id-card" style={{ marginRight: 6, color: "#ff9b51" }} />
          Documents (Optional)
        </p>
      </div>

      <div className={s("field")}>
        <label>
          <i className="fa-solid fa-id-card" style={{ marginRight: 5, color: "#3b5bdb", fontSize: 11 }} />
          Citizenship / National ID No.
        </label>
        <input
          value={form.citizen_id}
          onChange={e => set("citizen_id", e.target.value)}
          placeholder="e.g. 12-34-56-78901"
        />
      </div>

      <div className={s("field")}>
        <label>
          <i className="fa-solid fa-car" style={{ marginRight: 5, color: "#7c3aed", fontSize: 11 }} />
          Driving Licence No.
        </label>
        <input
          value={form.license_number}
          onChange={e => set("license_number", e.target.value)}
          placeholder="e.g. 03-01-0123456"
        />
      </div>

      <div className={cx(s("field"), s("full"))}>
        <label>Address</label>
        <textarea value={form.address} onChange={e => set("address", e.target.value)} placeholder="Home address…" />
      </div>
    </>
  );
}

// ── Edit Staff Modal ──────────────────────────────────────────────────────────
function EditStaffModal({ staff, roles, onClose, onSaved }: { staff: Staff; roles: StaffRole[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<StaffForm>({
    full_name:      staff.full_name,
    phone:          staff.phone          ?? "",
    gender:         staff.gender         ?? "",
    status:         staff.status,
    staff_role_id:  String(staff.staff_role_id),
    joined_date:    staff.joined_date?.split("T")[0] ?? "",
    address:        staff.address        ?? "",
    date_of_birth:  staff.date_of_birth?.split("T")[0] ?? "",
    citizen_id:     staff.citizen_id     ?? "",
    license_number: staff.license_number ?? "",
  });
  const [err, setErr] = useState("");
  const { execute, loading } = useMutation(`/staff/${staff.id}`, "PATCH");

  const set = (k: keyof StaffForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.full_name.trim()) return setErr("Full name is required.");
    if (!form.staff_role_id)    return setErr("Please select a role.");
    setErr("");
    try {
      await execute({ ...form, staff_role_id: Number(form.staff_role_id) });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Failed to update staff member.");
    }
  };

  return (
    <div className={s("overlay")} onClick={onClose}>
      <div className={s("modal")} onClick={e => e.stopPropagation()}>
        <div className={s("modalHead")}>
          <div>
            <h2>Edit Staff Member</h2>
            <p>Update details for <strong>{staff.full_name}</strong></p>
          </div>
          <button className={s("closeBtn")} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className={s("formGrid")}>
          <StaffFormFields form={form} set={set} roles={roles} />
          {err && (
            <p className={s("full")} style={{ margin: 0, color: "#b42318", fontSize: 13, fontWeight: 800 }}>
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }} />{err}
            </p>
          )}
        </div>
        <div className={s("modalFoot")}>
          <button className={cx(s("btn"), s("btnOutline"))} onClick={onClose}>Cancel</button>
          <button className={cx(s("btn"), s("btnPrimary"))} onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size={14} color="#fff" /> : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Staff Detail Panel ────────────────────────────────────────────────────────
function StaffDetailPanel({ staff, onClose, onEdit }: { staff: Staff; onClose: () => void; onEdit: () => void }) {
  const { formatDate } = useDateFormat();
  return (
    <div className={s("overlay")} onClick={onClose}>
      <div className={s("modal")} style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className={s("modalHead")}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48, height: 48, borderRadius: 12,
                background: "#fff1df", color: "#c46a14",
                display: "grid", placeItems: "center",
                fontSize: 18, fontWeight: 900, flexShrink: 0,
              }}
            >
              {initials(staff.full_name)}
            </div>
            <div>
              <h2 style={{ marginBottom: 2 }}>{staff.full_name}</h2>
              <p style={{ margin: 0 }}>
                {staff.role_name ?? "Staff"} · #{staff.id}
              </p>
            </div>
          </div>
          <button className={s("closeBtn")} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div style={{ padding: "16px 22px", display: "grid", gap: 10 }}>
          {/* Status badge */}
          <div style={{ marginBottom: 4 }}>
            <span
              className={s("badge")}
              style={{ background: STATUS_STYLE[staff.status]?.bg, color: STATUS_STYLE[staff.status]?.color }}
            >
              {STATUS_LABELS[staff.status] ?? staff.status}
            </span>
          </div>

          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { icon: "fa-phone",        label: "Phone",         value: staff.phone ?? "—" },
              { icon: "fa-venus-mars",   label: "Gender",        value: staff.gender ? staff.gender.charAt(0).toUpperCase() + staff.gender.slice(1) : "—" },
              { icon: "fa-calendar",     label: "Joined",        value: staff.joined_date   ? formatDate(staff.joined_date.slice(0,10))   : "—" },
              { icon: "fa-cake-candles", label: "Date of Birth", value: staff.date_of_birth ? formatDate(staff.date_of_birth.slice(0,10)) : "—" },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{ padding: 12, border: "1px solid #e1e8eb", borderRadius: 9, background: "#f8fbfc" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#6a7882" }}>
                  <i className={`fa-solid ${icon}`} style={{ marginRight: 5 }} />{label}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 900, color: "#1f2d36" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Monthly salary */}
          {staff.current_salary && (
            <div style={{ padding: 12, border: "1px solid #bee8d6", borderRadius: 9, background: "#f6fdf9" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#6a7882" }}>
                <i className="fa-solid fa-money-bill-wave" style={{ marginRight: 5 }} />Monthly Salary
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 900, color: "#12805c" }}>
                {fmt(staff.current_salary.basic_salary)}
              </p>
            </div>
          )}

          {/* Documents */}
          {(staff.citizen_id || staff.license_number) && (
            <>
              <p style={{ margin: "6px 0 4px", fontSize: 11, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 1 }}>
                <i className="fa-solid fa-id-card" style={{ marginRight: 6, color: "#ff9b51" }} />Documents
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {staff.citizen_id && (
                  <div style={{ padding: 12, border: "1px solid #dce5ff", borderRadius: 9, background: "#f0f4ff" }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#3b5bdb" }}>
                      <i className="fa-solid fa-id-card" style={{ marginRight: 5 }} />Citizenship ID
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 900, color: "#1f2d36", wordBreak: "break-all" }}>
                      {staff.citizen_id}
                    </p>
                  </div>
                )}
                {staff.license_number && (
                  <div style={{ padding: 12, border: "1px solid #e8deff", borderRadius: 9, background: "#f5f0ff" }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#7c3aed" }}>
                      <i className="fa-solid fa-car" style={{ marginRight: 5 }} />Licence No.
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 900, color: "#1f2d36", wordBreak: "break-all" }}>
                      {staff.license_number}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Address */}
          {staff.address && (
            <div style={{ padding: 12, border: "1px solid #e1e8eb", borderRadius: 9, background: "#f8fbfc" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#6a7882" }}>
                <i className="fa-solid fa-location-dot" style={{ marginRight: 5 }} />Address
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: "#1f2d36" }}>{staff.address}</p>
            </div>
          )}
        </div>

        <div className={s("modalFoot")}>
          <button className={cx(s("btn"), s("btnOutline"))} onClick={onClose}>Close</button>
          <button className={cx(s("btn"), s("btnPrimary"))} onClick={onEdit}>
            <i className="fa-solid fa-pen" /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Role Modal ────────────────────────────────────────────────────────────
function AddRoleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [err,  setErr]  = useState("");
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

// ── Set Salary Modal ────────────────────────────────────────────────────────
function SetSalaryModal({ staff, onClose, onSaved }: { staff: Staff; onClose: () => void; onSaved: () => void }) {
  const [basic_salary, setBasicSalary] = useState(String(staff.current_salary?.basic_salary ?? ""));
  const [effective_from, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [err, setErr] = useState("");
  const { execute, loading } = useMutation("/staff/salary/structure", "POST");

  const handleSubmit = async () => {
    if (!basic_salary || isNaN(Number(basic_salary))) return setErr("Enter a valid salary amount.");
    setErr("");
    try {
      await execute({ staff_id: staff.id, basic_salary: Number(basic_salary), effective_from });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Failed to set salary.");
    }
  };

  return (
    <div className={s("overlay")} onClick={onClose}>
      <div className={s("modal")} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className={s("modalHead")}>
          <div>
            <h2>Set Salary</h2>
            <p>{staff.full_name} · {staff.role_name ?? "Staff"}</p>
          </div>
          <button className={s("closeBtn")} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className={s("formGrid")}>
          <div className={s("field")}>
            <label>Basic Salary (NPR) *</label>
            <input type="number" min="0" value={basic_salary} onChange={e => setBasicSalary(e.target.value)} placeholder="e.g. 15000" autoFocus />
          </div>
          <div className={s("field")}>
            <label>Effective From</label>
            <DateInput value={effective_from} onChange={e => setEffectiveFrom(e.target.value)} />
          </div>
          {err && <p className={s("full")} style={{ margin: 0, color: "#b42318", fontSize: 13, fontWeight: 800 }}>{err}</p>}
        </div>
        <div className={s("modalFoot")}>
          <button className={cx(s("btn"), s("btnOutline"))} onClick={onClose}>Cancel</button>
          <button className={cx(s("btn"), s("btnPrimary"))} onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size={14} color="#fff" /> : <><i className="fa-solid fa-floppy-disk" /> Save Salary</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type ModalState =
  | { type: "add_role" }
  | { type: "view";       staff: Staff }
  | { type: "edit";       staff: Staff }
  | { type: "set_salary"; staff: Staff }
  | null;

export function StaffPage() {
  const { formatDate } = useDateFormat();
  const { data: staff,  loading: loadingStaff, refetch: refetchStaff } = useApi<Staff[]>("/staff");
  const { data: roles,  loading: loadingRoles, refetch: refetchRoles } = useApi<StaffRole[]>("/staff/roles");

  const [search,       setSearch]       = useState("");
  const [filterRole,   setFilterRole]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [modal,        setModal]        = useState<ModalState>(null);

  const filtered = useMemo(() => {
    return (staff ?? []).filter(m => {
      const matchSearch = !search       || m.full_name.toLowerCase().includes(search.toLowerCase()) || (m.phone ?? "").includes(search);
      const matchRole   = !filterRole   || String(m.staff_role_id) === filterRole;
      const matchStatus = !filterStatus || m.status === filterStatus;
      return matchSearch && matchRole && matchStatus;
    });
  }, [staff, search, filterRole, filterStatus]);

  const totalOnLeave = (staff ?? []).filter(m => m.status === "on_leave").length;

  return (
    <div className={s("page")}>
      <main className={s("content")}>

        {/* Head */}
        <section className={s("head")}>
          <div>
            <h1>Staff Management</h1>
            <p>Manage all non-teaching staff, their attendance and salary records.</p>
          </div>
          <div className={s("actions")}>
            <Link href="/teachers/attendance" className={cx(s("btn"), s("btnOutline"))}>
              <i className="fa-solid fa-user-clock" /> Attendance
            </Link>
            <Link href="/staff/salary" className={cx(s("btn"), s("btnOutline"))}>
              <i className="fa-solid fa-money-bill-wave" /> Staff Salary
            </Link>
            <button className={cx(s("btn"), s("btnOutline"))} onClick={() => setModal({ type: "add_role" })}>
              <i className="fa-solid fa-tag" /> New Role
            </button>
            <Link href="/staff/add" className={cx(s("btn"), s("btnPrimary"))}>
              <i className="fa-solid fa-plus" /> Add Staff
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className={s("stats")}>
          {[
            { label: "Total Staff",   value: (staff ?? []).length,                                          sub: "All roles",           cls: "blue",   icon: "fa-users"         },
            { label: "Active",        value: (staff ?? []).filter(m => m.status === "active").length,       sub: "Currently working",   cls: "green",  icon: "fa-circle-check"  },
            { label: "On Leave",      value: totalOnLeave,                                                  sub: "Temporary absence",   cls: "orange", icon: "fa-circle-pause"  },
            { label: "Staff Roles",   value: (roles ?? []).length,                                          sub: "Defined categories",  cls: "purple", icon: "fa-tag"           },
          ].map(({ label, value, sub, cls, icon }) => (
            <article key={label} className={cx(s("stat"), s(cls))}>
              <div className={s("statHead")}>
                <span>{label}</span>
                <div><i className={`fa-solid ${icon}`} /></div>
              </div>
              <div className={s("statBody")}>
                <strong>{loadingStaff ? "—" : value}</strong>
                <small>{sub}</small>
              </div>
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
                    <th style={{ width: 44, textAlign: "center" }}>#</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Joined</th>
                    <th>Monthly Salary</th>
                    <th>Documents</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, idx) => (
                    <tr
                      key={m.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setModal({ type: "view", staff: m })}
                    >
                      <td style={{ textAlign: "center", color: "#6a7882", fontWeight: 800, fontSize: 12 }}>
                        {idx + 1}
                      </td>
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
                      <td>{m.joined_date ? formatDate(m.joined_date.slice(0,10)) : "—"}</td>
                      <td>
                        {m.current_salary
                          ? <strong style={{ color: "#12805c" }}>{fmt(m.current_salary.basic_salary)}</strong>
                          : <span style={{ color: "#c46a14", fontWeight: 900, fontSize: 12 }}>Not set</span>
                        }
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {m.citizen_id && (
                            <span title={`Citizenship: ${m.citizen_id}`} style={{ padding: "3px 8px", borderRadius: 6, background: "#f0f4ff", color: "#3b5bdb", fontSize: 11, fontWeight: 900, border: "1px solid #dce5ff" }}>
                              <i className="fa-solid fa-id-card" style={{ marginRight: 4 }} />ID
                            </span>
                          )}
                          {m.license_number && (
                            <span title={`Licence: ${m.license_number}`} style={{ padding: "3px 8px", borderRadius: 6, background: "#f5f0ff", color: "#7c3aed", fontSize: 11, fontWeight: 900, border: "1px solid #e8deff" }}>
                              <i className="fa-solid fa-car" style={{ marginRight: 4 }} />Lic
                            </span>
                          )}
                          {!m.citizen_id && !m.license_number && <span style={{ color: "#aab5bb" }}>—</span>}
                        </div>
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
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className={cx(s("btn"), s("btnSoft"), s("btnSm"))}
                            onClick={() => setModal({ type: "edit", staff: m })}
                            title="Edit staff member"
                          >
                            <i className="fa-solid fa-pen" />
                          </button>
                          <button
                            className={cx(s("btn"), s("btnSm"))}
                            style={{ background: "#e2f6ee", color: "#12805c", border: "1px solid #a7e1c8" }}
                            onClick={() => setModal({ type: "set_salary", staff: m })}
                            title="Set monthly salary"
                          >
                            <i className="fa-solid fa-money-bill" />
                          </button>
                        </div>
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
                    padding: "6px 14px", border: "1px solid #dce5e9",
                    borderRadius: 8, background: "#f8fbfc",
                    fontSize: 13, fontWeight: 900, color: "#1f2d36",
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

      {/* ── Modals ── */}
      {modal?.type === "add_role" && (
        <AddRoleModal
          onClose={() => setModal(null)}
          onSaved={() => refetchRoles()}
        />
      )}

      {modal?.type === "view" && (
        <StaffDetailPanel
          staff={modal.staff}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ type: "edit", staff: modal.staff })}
        />
      )}

      {modal?.type === "edit" && (
        <EditStaffModal
          staff={modal.staff}
          roles={roles ?? []}
          onClose={() => setModal(null)}
          onSaved={() => refetchStaff()}
        />
      )}

      {modal?.type === "set_salary" && (
        <SetSalaryModal
          staff={modal.staff}
          onClose={() => setModal(null)}
          onSaved={() => refetchStaff()}
        />
      )}
    </div>
  );
}
