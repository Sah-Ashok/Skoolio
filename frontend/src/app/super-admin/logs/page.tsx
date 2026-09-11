'use client';

import { useState, useEffect, useRef } from 'react';
import { useApi } from '@/lib/useApi';
import Loader from '@/components/shared/Loader';

type LogType = 'error' | 'crash' | 'combined';

interface LogResponse {
  type: string;
  lines: string[];
  totalLines: number;
  sizeBytes: number;
  lastModified: string;
}

export default function SystemLogsPage() {
  const [activeTab, setActiveTab] = useState<LogType>('error');
  const [lineLimit, setLineLimit] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Fetch from backend /platform/logs endpoint
  const { data, loading, error, refetch } = useApi<LogResponse>(
    `/platform/logs?type=${activeTab}&lines=${lineLimit}`,
    [activeTab, lineLimit],
    { skipCache: true }
  );

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  const handleDownload = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    window.open(`${apiUrl}/platform/logs/download?type=${activeTab}`, '_blank');
  };

  const handleClear = async () => {
    if (!confirm(`Are you sure you want to clear ${activeTab}.log? This cannot be undone.`)) return;
    try {
      const token = document.cookie
        .split('; ')
        .find((row) => row.startsWith('token='))
        ?.split('=')[1];

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const res = await fetch(`${apiUrl}/platform/logs?type=${activeTab}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        credentials: 'include',
      });
      if (res.ok) {
        refetch();
      } else {
        alert('Failed to clear log file.');
      }
    } catch (err: any) {
      alert('Error clearing log: ' + err.message);
    }
  };

  const filteredLines = (data?.lines || []).filter((line) =>
    searchQuery ? line.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyLine = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              System Logs
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 700, background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '999px' }}>
              Host VM Logs
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
            Live file-based logging with instant email alerts on critical exceptions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: autoRefresh ? '1px solid #22c55e' : '1px solid #cbd5e1',
              background: autoRefresh ? '#f0fdf4' : '#ffffff',
              color: autoRefresh ? '#15803d' : '#475569',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <i className={`fa-solid fa-arrows-rotate ${autoRefresh ? 'fa-spin' : ''}`} />
            {autoRefresh ? 'Auto (5s)' : 'Auto-refresh'}
          </button>

          <button
            onClick={() => refetch()}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-sync" style={{ marginRight: '6px' }} /> Refresh
          </button>

          <button
            onClick={handleDownload}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-download" style={{ marginRight: '6px' }} /> Download
          </button>

          <button
            onClick={handleClear}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              background: '#fff1f2',
              color: '#b91c1c',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-trash-can" style={{ marginRight: '6px' }} /> Clear
          </button>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px 12px 0 0', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('error')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              background: activeTab === 'error' ? '#ef4444' : '#f1f5f9',
              color: activeTab === 'error' ? '#ffffff' : '#475569',
              transition: 'all 0.15s',
            }}
          >
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }} />
            Errors ({activeTab === 'error' ? data?.totalLines ?? 0 : 'error.log'})
          </button>

          <button
            onClick={() => setActiveTab('crash')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              background: activeTab === 'crash' ? '#991b1b' : '#f1f5f9',
              color: activeTab === 'crash' ? '#ffffff' : '#475569',
              transition: 'all 0.15s',
            }}
          >
            <i className="fa-solid fa-bomb" style={{ marginRight: '6px' }} />
            Crashes ({activeTab === 'crash' ? data?.totalLines ?? 0 : 'crash.log'})
          </button>

          <button
            onClick={() => setActiveTab('combined')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              background: activeTab === 'combined' ? '#0f172a' : '#f1f5f9',
              color: activeTab === 'combined' ? '#ffffff' : '#475569',
              transition: 'all 0.15s',
            }}
          >
            <i className="fa-solid fa-list-check" style={{ marginRight: '6px' }} />
            HTTP Traffic ({activeTab === 'combined' ? data?.totalLines ?? 0 : 'combined.log'})
          </button>
        </div>

        {/* Filter & Lines selection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="text"
            placeholder="Search in log..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              width: '200px',
            }}
          />

          <select
            value={lineLimit}
            onChange={(e) => setLineLimit(Number(e.target.value))}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#334155',
            }}
          >
            <option value={50}>Last 50 lines</option>
            <option value={100}>Last 100 lines</option>
            <option value={250}>Last 250 lines</option>
            <option value={500}>Last 500 lines</option>
          </select>
        </div>
      </div>

      {/* Meta Bar */}
      <div style={{ background: '#f8fafc', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '8px 18px', fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
        <span>
          Showing <strong>{filteredLines.length}</strong> of <strong>{data?.totalLines || 0}</strong> total lines
        </span>
        <span>
          File size: <strong>{formatBytes(data?.sizeBytes || 0)}</strong>
        </span>
      </div>

      {/* Terminal View */}
      <div
        style={{
          background: '#090d16',
          color: '#e2e8f0',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: '12.5px',
          lineHeight: '1.6',
          padding: '16px',
          borderRadius: '0 0 12px 12px',
          minHeight: '480px',
          maxHeight: '680px',
          overflowY: 'auto',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
          border: '1px solid #1e293b',
        }}
      >
        {loading && !data ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '300px' }}>
            <Loader fullScreen={false} size="md" text="Reading log file..." />
          </div>
        ) : filteredLines.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '300px', color: '#64748b' }}>
            <div style={{ textAlign: 'center' }}>
              <i className="fa-solid fa-check-circle" style={{ fontSize: '32px', color: '#22c55e', marginBottom: '8px' }} />
              <p style={{ margin: 0, fontWeight: 700 }}>No entries found in this log.</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Everything is operating normally.</p>
            </div>
          </div>
        ) : (
          filteredLines.map((line, idx) => {
            const isError = line.includes('[ERROR]') || line.includes('FATAL') || line.includes('Error:');
            const isWarn = line.includes('[WARN]');
            const isCrash = line.includes('CRASH');

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  background: isCrash ? 'rgba(239,68,68,0.15)' : isError ? 'rgba(239,68,68,0.06)' : 'transparent',
                  color: isCrash ? '#fca5a5' : isError ? '#f87171' : isWarn ? '#fde047' : '#cbd5e1',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ color: '#475569', fontSize: '11px', width: '36px', textAlign: 'right', userSelect: 'none', flexShrink: 0 }}>
                  {idx + 1}
                </span>

                <span style={{ flex: 1, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                  {line}
                </span>

                <button
                  onClick={() => copyLine(line, idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: copiedIndex === idx ? '#22c55e' : '#475569',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '2px 4px',
                  }}
                  title="Copy line"
                >
                  <i className={copiedIndex === idx ? 'fa-solid fa-check' : 'fa-regular fa-copy'} />
                </button>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
