'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '@/lib/api';
import { useDateFormat } from '@/lib/useDateFormat';

interface ActivityLog {
  id: number;
  actor_id: number | null;
  actor_role: string;
  actor_name: string | null;
  module: string;
  action: string;
  entity_id: number | null;
  entity_label: string | null;
  description: string;
  ip_address: string | null;
  created_at: string;
}

interface HistoryResponse {
  logs: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE:   '#16a34a',
  UPDATE:   '#2563eb',
  DELETE:   '#dc2626',
  LOGIN:    '#7c3aed',
  LOGOUT:   '#6b7280',
  GENERATE: '#d97706',
};

const ACTION_ICONS: Record<string, string> = {
  CREATE:   'fa-plus-circle',
  UPDATE:   'fa-pen',
  DELETE:   'fa-trash',
  LOGIN:    'fa-right-to-bracket',
  LOGOUT:   'fa-right-from-bracket',
  GENERATE: 'fa-bolt',
};

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? '#6b7280';
  const icon  = ACTION_ICONS[action]  ?? 'fa-circle-dot';
  return (
    <span
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           '5px',
        padding:       '2px 10px',
        borderRadius:  '999px',
        fontSize:      '11px',
        fontWeight:    600,
        background:    `${color}1a`,
        color,
        border:        `1px solid ${color}44`,
        whiteSpace:    'nowrap',
      }}
    >
      <i className={`fa-solid ${icon}`} style={{ fontSize: '10px' }} />
      {action}
    </span>
  );
}

function ModuleBadge({ module }: { module: string }) {
  return (
    <span
      style={{
        display:       'inline-block',
        padding:       '2px 8px',
        borderRadius:  '4px',
        fontSize:      '11px',
        fontWeight:    500,
        background:    '#f1f5f9',
        color:         '#475569',
        border:        '1px solid #e2e8f0',
        textTransform: 'capitalize',
      }}
    >
      {module.replace(/-/g, ' ')}
    </span>
  );
}

// formatDate moved into component via useDateFormat hook

export default function HistoryPage() {
  const { formatDate } = useDateFormat();
  const [logs,       setLogs]       = useState<ActivityLog[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [modules,    setModules]    = useState<string[]>([]);

  // Filters
  const [filterModule,    setFilterModule]    = useState('');
  const [filterAction,    setFilterAction]    = useState('');
  const [filterActorRole, setFilterActorRole] = useState('');
  const [filterFrom,      setFilterFrom]      = useState('');
  const [filterTo,        setFilterTo]        = useState('');

  const LIMIT = 50;

  const fetchModules = useCallback(async () => {
    try {
      const res = await apiRequest<{ data: string[] }>('/history/modules');
      setModules(res.data || []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchLogs = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page',  String(pageNum));
      params.set('limit', String(LIMIT));
      if (filterModule)    params.set('module',     filterModule);
      if (filterAction)    params.set('action',     filterAction);
      if (filterActorRole) params.set('actor_role', filterActorRole);
      if (filterFrom)      params.set('from_date',  filterFrom);
      if (filterTo)        params.set('to_date',    filterTo);

      const res = await apiRequest<{ data: HistoryResponse }>(`/history?${params.toString()}`);
      const data = res.data;
      setLogs(data.logs);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [filterModule, filterAction, filterActorRole, filterFrom, filterTo]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  useEffect(() => {
    setPage(1);
    fetchLogs(1);
  }, [filterModule, filterAction, filterActorRole, filterFrom, filterTo]);

  const handlePageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    fetchLogs(p);
  };

  const clearFilters = () => {
    setFilterModule('');
    setFilterAction('');
    setFilterActorRole('');
    setFilterFrom('');
    setFilterTo('');
  };

  const hasFilters = filterModule || filterAction || filterActorRole || filterFrom || filterTo;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
          <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '10px', color: '#6366f1' }} />
          Activity History
        </h1>
        <p style={{ fontSize: '13px', color: '#64748b' }}>
          All changes made in your school — last 3 months. Read-only.
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          background:   '#f8fafc',
          border:       '1px solid #e2e8f0',
          borderRadius: '10px',
          padding:      '16px 20px',
          marginBottom: '20px',
          display:      'flex',
          flexWrap:     'wrap',
          gap:          '12px',
          alignItems:   'flex-end',
        }}
      >
        {/* Module filter */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
            MODULE
          </label>
          <select
            value={filterModule}
            onChange={e => setFilterModule(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Modules</option>
            {modules.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Action filter */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
            ACTION
          </label>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="GENERATE">GENERATE</option>
          </select>
        </div>

        {/* Role filter */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
            ACTOR ROLE
          </label>
          <select
            value={filterActorRole}
            onChange={e => setFilterActorRole(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="faculty">Faculty</option>
            <option value="student">Student</option>
          </select>
        </div>

        {/* Date from */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
            FROM DATE
          </label>
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Date to */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
            TO DATE
          </label>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Clear */}
        {hasFilters && (
          <button onClick={clearFilters} style={clearBtnStyle}>
            <i className="fa-solid fa-xmark" /> Clear
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', color: '#64748b' }}>
          {loading ? 'Loading...' : `${total} log${total !== 1 ? 's' : ''} found`}
        </span>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
          Page {page} of {totalPages}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', marginBottom: '16px', fontSize: '13px' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }} />
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Module</th>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>Actor</th>
              <th style={{ ...thStyle, width: '40%' }}>Description</th>
              <th style={thStyle}>Entity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
                  Loading activity logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                  <i className="fa-solid fa-inbox" style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }} />
                  No activity logs found
                  {hasFilters && (
                    <span style={{ display: 'block', marginTop: '6px', fontSize: '12px' }}>
                      Try clearing the filters
                    </span>
                  )}
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => (
                <tr
                  key={log.id}
                  style={{
                    borderBottom:  idx < logs.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background:    idx % 2 === 0 ? '#fff' : '#fafafa',
                  }}
                >
                  <td style={tdStyle}>
                    <span style={{ color: '#475569', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {formatDate(log.created_at?.slice(0,10))}{' '}
                      {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <ModuleBadge module={log.module} />
                  </td>
                  <td style={tdStyle}>
                    <ActionBadge action={log.action} />
                  </td>
                  <td style={tdStyle}>
                    <div style={{ lineHeight: '1.4' }}>
                      <span style={{ fontWeight: 500, color: '#1e293b' }}>
                        {log.actor_name || '—'}
                      </span>
                      <br />
                      <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'capitalize' }}>
                        {log.actor_role}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: '#374151', lineHeight: '1.5' }}>
                    {log.description}
                  </td>
                  <td style={tdStyle}>
                    {log.entity_label ? (
                      <span style={{ fontSize: '12px', color: '#6366f1' }}>{log.entity_label}</span>
                    ) : log.entity_id ? (
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>#{log.entity_id}</span>
                    ) : (
                      <span style={{ color: '#cbd5e1' }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px', alignItems: 'center' }}>
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            style={pageBtnStyle(page <= 1)}
          >
            <i className="fa-solid fa-chevron-left" />
          </button>

          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                style={pageBtnStyle(false, p === page)}
              >
                {p}
              </button>
            );
          })}

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            style={pageBtnStyle(page >= totalPages)}
          >
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
      )}

      {/* Footer note */}
      <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '24px' }}>
        <i className="fa-solid fa-lock" style={{ marginRight: '5px' }} />
        History is read-only. Logs are retained for 3 months.
      </p>
    </div>
  );
}

// ── Shared styles ──

const selectStyle: React.CSSProperties = {
  padding:      '7px 10px',
  borderRadius: '6px',
  border:       '1px solid #cbd5e1',
  fontSize:     '13px',
  color:        '#1e293b',
  background:   '#fff',
  minWidth:     '140px',
  cursor:       'pointer',
};

const inputStyle: React.CSSProperties = {
  padding:      '7px 10px',
  borderRadius: '6px',
  border:       '1px solid #cbd5e1',
  fontSize:     '13px',
  color:        '#1e293b',
  background:   '#fff',
};

const clearBtnStyle: React.CSSProperties = {
  padding:      '7px 14px',
  borderRadius: '6px',
  border:       '1px solid #e2e8f0',
  background:   '#fff',
  color:        '#64748b',
  fontSize:     '13px',
  cursor:       'pointer',
  display:      'flex',
  alignItems:   'center',
  gap:          '6px',
};

const thStyle: React.CSSProperties = {
  padding:    '10px 14px',
  textAlign:  'left',
  fontSize:   '11px',
  fontWeight: 600,
  color:      '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding:   '11px 14px',
  verticalAlign: 'middle',
};

const pageBtnStyle = (disabled: boolean, active = false): React.CSSProperties => ({
  padding:      '6px 12px',
  borderRadius: '6px',
  border:       '1px solid',
  borderColor:  active ? '#6366f1' : '#e2e8f0',
  background:   active ? '#6366f1' : disabled ? '#f8fafc' : '#fff',
  color:        active ? '#fff' : disabled ? '#cbd5e1' : '#374151',
  fontSize:     '13px',
  cursor:       disabled ? 'not-allowed' : 'pointer',
  fontWeight:   active ? 600 : 400,
});
