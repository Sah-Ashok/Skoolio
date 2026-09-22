'use client';

import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { apiRequest } from '@/lib/api';

interface IDevice {
  id: number;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  location: string | null;
  is_trusted: boolean;
  created_at: string;
  last_login_at: string;
}

interface ISecurityOverview {
  totp_enabled: boolean;
  has_recovery_codes: boolean;
  active_devices_count: number;
  securityScore: number;
  protectionStatus: 'HIGH' | 'MEDIUM' | 'LOW';
  devices: IDevice[];
}

interface I2FASetupData {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
  recoveryCodes: string[];
}

export default function SecurityDashboardPage() {
  const { data: overviewRes, loading, refetch } = useApi<{ success: boolean; data: ISecurityOverview }>('/security/overview');
  const overview = overviewRes?.data || null;

  const [activeTab, setActiveTab] = useState<'2fa' | 'devices' | 'protection'>('2fa');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 2FA Setup state
  const [setupModalOpen, setSetupModalOpen] = useState<boolean>(false);
  const [setupData, setSetupData] = useState<I2FASetupData | null>(null);
  const [verifyCode, setVerifyCode] = useState<string>('');
  const [verifyLoading, setVerifyLoading] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Disable 2FA state
  const [disableModalOpen, setDisableModalOpen] = useState<boolean>(false);
  const [disablePassword, setDisablePassword] = useState<string>('');
  const [disableCode, setDisableCode] = useState<string>('');
  const [disableLoading, setDisableLoading] = useState<boolean>(false);

  // Initiate 2FA Setup
  const handleStartSetup = async () => {
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: I2FASetupData }>('/security/2fa/setup');
      if (res?.success) {
        setSetupData(res.data);
        setSetupModalOpen(true);
      }
    } catch (err: any) {
      setError(err.message || 'Could not initiate 2FA setup.');
    }
  };

  // Enable 2FA after entering 6-digit code
  const handleEnable2FA = async () => {
    if (!verifyCode || verifyCode.trim().length < 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }
    setVerifyLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/security/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      if (res?.success) {
        setSuccessMsg('Google Authenticator 2FA enabled successfully!');
        setSetupModalOpen(false);
        setVerifyCode('');
        refetch();
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Check your authenticator app code.');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async () => {
    if (!disablePassword || !disableCode) {
      setError('Both password and current 2FA code are required.');
      return;
    }
    setDisableLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/security/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({
          password: disablePassword,
          code: disableCode.trim(),
        }),
      });
      if (res?.success) {
        setSuccessMsg('2FA protection has been disabled.');
        setDisableModalOpen(false);
        setDisablePassword('');
        setDisableCode('');
        refetch();
      }
    } catch (err: any) {
      setError(err.message || 'Could not disable 2FA. Check credentials.');
    } finally {
      setDisableLoading(false);
    }
  };

  // Revoke device session
  const handleRevokeDevice = async (deviceId: number) => {
    if (!confirm('Are you sure you want to revoke this device access?')) return;
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/security/devices/${deviceId}`, {
        method: 'DELETE',
      });
      if (res?.success) {
        setSuccessMsg('Device session revoked successfully.');
        refetch();
      }
    } catch (err: any) {
      setError(err.message || 'Could not revoke device.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <i className="fa-solid fa-shield-halved text-indigo-600"></i> Security & 2FA Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage 2FA Authenticator app, active device history, and threat alerts
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between text-red-700 dark:text-red-300">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-circle-exclamation text-lg"></i>
            <span className="font-medium text-sm">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-circle-check text-lg"></i>
            <span className="font-medium text-sm">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Security Health Score Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg border ${
              overview?.protectionStatus === 'HIGH'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              <i className={`fa-solid ${overview?.protectionStatus === 'HIGH' ? 'fa-shield-check' : 'fa-shield-heart'}`}></i>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold tracking-tight">Account Protection Status</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  overview?.protectionStatus === 'HIGH'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {overview?.protectionStatus === 'HIGH' ? '🟢 High Security' : '🟡 Medium Protection'}
                </span>
              </div>
              <p className="text-slate-300 text-sm mt-1">
                {overview?.totp_enabled
                  ? 'Two-Factor Authentication is ACTIVE with Google Authenticator and Device Fingerprinting.'
                  : 'Enable 2FA Authenticator to shield your portal from session hijacking and password leaks.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-800">
            <div className="text-center px-4">
              <span className="block text-2xl font-black text-indigo-400">{overview?.securityScore ?? 50}%</span>
              <span className="text-xs text-slate-400 font-medium">Security Rating</span>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div className="text-center px-4">
              <span className="block text-2xl font-black text-emerald-400">{overview?.active_devices_count ?? 1}</span>
              <span className="text-xs text-slate-400 font-medium">Active Devices</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('2fa')}
          className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === '2fa'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <i className="fa-solid fa-mobile-screen-button"></i>
          <span>2FA Authenticator App</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'devices'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <i className="fa-solid fa-laptop-code"></i>
          <span>Logged-in Devices & History</span>
          <span className="ml-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs">
            {overview?.active_devices_count ?? 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('protection')}
          className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'protection'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <i className="fa-solid fa-user-shield"></i>
          <span>Threat Defense Policy</span>
        </button>
      </div>

      {/* TAB 1: 2FA AUTHENTICATOR APP */}
      {activeTab === '2fa' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0">
                  <i className="fa-solid fa-qrcode"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Google / Microsoft Authenticator (TOTP)
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                    Secure your account with 6-digit time-based one-time passwords from Google Authenticator, Authy, or 1Password every time you sign in.
                  </p>
                </div>
              </div>

              {overview?.totp_enabled ? (
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <i className="fa-solid fa-check"></i> 2FA Enabled
                  </span>
                  <button
                    onClick={() => setDisableModalOpen(true)}
                    className="px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold text-sm transition-all"
                  >
                    Disable 2FA
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartSetup}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-key"></i> Enable 2FA Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOGGED IN DEVICES */}
      {activeTab === 'devices' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Logged-in Devices & History</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Instant alert emails are sent whenever your account is accessed from an unrecognized device.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Refresh Devices"
            >
              <i className="fa-solid fa-arrows-rotate"></i>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {overview?.devices?.map((dev, idx) => (
              <div key={dev.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-lg">
                    <i className={`fa-solid ${dev.os?.toLowerCase().includes('windows') ? 'fa-desktop' : dev.os?.toLowerCase().includes('android') || dev.os?.toLowerCase().includes('ios') ? 'fa-mobile-screen' : 'fa-laptop'}`}></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {dev.browser || 'Unknown Browser'} on {dev.os || 'Unknown OS'}
                      </span>
                      {idx === 0 && (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-md text-[11px] font-bold">
                          Current Session
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3">
                      <span><i className="fa-solid fa-network-wired text-slate-400 mr-1"></i> {dev.ip_address}</span>
                      <span>•</span>
                      <span><i className="fa-solid fa-clock text-slate-400 mr-1"></i> Last active: {new Date(dev.last_login_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {idx !== 0 && (
                  <button
                    onClick={() => handleRevokeDevice(dev.id)}
                    className="px-3 py-1.5 border border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-ban"></i> Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: THREAT DEFENSE POLICY */}
      {activeTab === 'protection' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-shield-virus"></i>
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Anti-DDoS & Edge Defense</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Global rate limiting (150 req/min), automated IP telemetry monitoring, and instant lockout protection active.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-fingerprint"></i>
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Smart Device Fingerprinting</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Calculates SHA256 browser/subnet fingerprints. Real-time email alerts dispatched for logins from new devices.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-lock"></i>
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">RFC 6238 TOTP Standard</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Compatible with Google Authenticator, Authy, and 1Password with single-use emergency recovery backup codes.
            </p>
          </div>
        </div>
      )}

      {/* 2FA SETUP MODAL */}
      {setupModalOpen && setupData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-qrcode text-indigo-600"></i> Set up Google Authenticator
              </h3>
              <button
                onClick={() => setSetupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                1. Open <strong>Google Authenticator</strong> or your preferred TOTP app on your smartphone.<br />
                2. Tap <strong>+</strong> and choose <strong>Scan a QR code</strong>:
              </p>

              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <img src={setupData.qrCodeDataUrl} alt="2FA QR Code" className="w-48 h-48 rounded-lg shadow-sm" />
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold">
                    {setupData.secret}
                  </span>
                  <button
                    onClick={() => copyToClipboard(setupData.secret)}
                    className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all"
                  >
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  3. Enter the 6-digit code generated by your app:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-center text-2xl font-mono tracking-widest bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Recovery codes preview */}
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold block mb-1">Emergency Recovery Codes:</span>
                <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
                  {setupData.recoveryCodes.map((c, i) => (
                    <span key={i}>{c}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                onClick={() => setSetupModalOpen(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEnable2FA}
                disabled={verifyLoading || verifyCode.length < 6}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50"
              >
                {verifyLoading ? 'Verifying...' : 'Verify & Enable 2FA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISABLE 2FA MODAL */}
      {disableModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white text-red-600 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation"></i> Disable 2FA Protection
            </h3>
            <p className="text-xs text-slate-500">
              Disabling 2FA reduces your account security. Please verify your identity:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Current Account Password
                </label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  6-Digit Authenticator Code
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="000000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-mono bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setDisableModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDisable2FA}
                disabled={disableLoading || !disablePassword || !disableCode}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50"
              >
                {disableLoading ? 'Disabling...' : 'Confirm Disable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
