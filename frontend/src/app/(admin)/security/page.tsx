'use client';

import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { apiRequest } from '@/lib/api';
import styles from './security.module.css';

const s = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(' ');

interface IDevice {
  id: number;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  location: string | null;
  is_trusted: boolean;
  is_current_device?: boolean;
  created_at: string;
  last_login_at: string;
}

interface IPasskey {
  id: number;
  device_name: string;
  credential_id: string;
  counter: number;
  transports?: string[];
  created_at: string;
  last_used_at: string | null;
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

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export default function SecurityDashboardPage() {
  const { data: overviewData, loading: overviewLoading, refetch: refetchOverview } = useApi<ISecurityOverview>('/security/overview');
  const overview: ISecurityOverview | null = (overviewData as any)?.data ?? overviewData ?? null;

  const { data: passkeysData, loading: passkeysLoading, refetch: refetchPasskeys } = useApi<IPasskey[]>('/security/passkey/list');
  const passkeys: IPasskey[] = Array.isArray(passkeysData) ? passkeysData : ((passkeysData as any)?.data ?? []);

  const [activeTab, setActiveTab] = useState<'devices' | 'passkeys' | '2fa' | 'password'>('devices');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Passkey Registration state
  const [passkeyRegLoading, setPasskeyRegLoading] = useState<boolean>(false);

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

  // Change Password state
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingPw, setSavingPw] = useState<boolean>(false);

  // ── Register Passkey ──
  const handleRegisterPasskey = async () => {
    setPasskeyRegLoading(true);
    setError(null);
    try {
      const optRes = await apiRequest<{ success: boolean; data: any }>('/security/passkey/register-options');
      if (!optRes?.success || !optRes.data) {
        throw new Error('Failed to obtain registration challenge from server.');
      }

      const { startRegistration } = await import('@simplewebauthn/browser');
      const regResponse = await startRegistration({ optionsJSON: optRes.data });

      const verifyRes = await apiRequest<{ success: boolean; message: string }>('/security/passkey/verify-register', {
        method: 'POST',
        body: JSON.stringify({ response: regResponse }),
      });

      if (verifyRes?.success) {
        setSuccessMsg('Passkey added successfully. You can now use biometrics to sign in.');
        refetchPasskeys();
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Biometric registration was cancelled.');
      } else if (err.name === 'InvalidStateError' || err.message?.toLowerCase().includes('previously registered')) {
        setError('This passkey or device was already registered. If you need to re-register it, remove the old key from your browser or Windows Settings first.');
      } else {
        setError(err.message || 'Passkey registration failed.');
      }
    } finally {
      setPasskeyRegLoading(false);
    }
  };

  // ── Delete Passkey ──
  const handleDeletePasskey = async (passkeyId: number) => {
    if (!confirm('Are you sure you want to delete this passkey?')) return;
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/security/passkey/${passkeyId}`, {
        method: 'DELETE',
      });
      if (res?.success) {
        setSuccessMsg('Passkey removed successfully.');
        refetchPasskeys();
      }
    } catch (err: any) {
      setError(err.message || 'Could not delete passkey.');
    }
  };

  // ── 2FA Handlers ──
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
        setSuccessMsg('Two-factor authentication enabled successfully.');
        setSetupModalOpen(false);
        setVerifyCode('');
        refetchOverview();
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Check your authenticator app code.');
    } finally {
      setVerifyLoading(false);
    }
  };

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
        refetchOverview();
      }
    } catch (err: any) {
      setError(err.message || 'Could not disable 2FA. Check credentials.');
    } finally {
      setDisableLoading(false);
    }
  };

  // ── Password Change Handler ──
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwForm.current_password || !pwForm.new_password) {
      setError('Please enter your current and new password.');
      return;
    }
    if (pwForm.new_password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      setError('New passwords do not match.');
      return;
    }
    setSavingPw(true);
    setError(null);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: pwForm.current_password,
          new_password: pwForm.new_password,
        }),
      });
      setSuccessMsg('Your account password has been updated successfully.');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setError(err.message || 'Could not change password.');
    } finally {
      setSavingPw(false);
    }
  };

  // ── Revoke Device Session ──
  const handleRevokeDevice = async (deviceId: number) => {
    if (!confirm('Are you sure you want to revoke access for this device?')) return;
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/security/devices/${deviceId}`, {
        method: 'DELETE',
      });
      if (res?.success) {
        setSuccessMsg('Device session revoked successfully.');
        refetchOverview();
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

  const is2FAActive = overview?.totp_enabled;
  const devices: IDevice[] = overview?.devices || [];

  return (
    <div className={s('page')}>
      <div className={s('content')}>
        {/* ── Page Header ── */}
        <div className={s('pageHead')}>
          <div className={s('headLeft')}>
            <h1>Security & Access</h1>
            <p>Manage account password, passkeys, two-factor authentication, and active device sessions.</p>
          </div>
        </div>

        {/* ── Alerts ── */}
        {error && (
          <div className={s('alertError')}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className={s('closeBtn')}>✕</button>
          </div>
        )}

        {successMsg && (
          <div className={s('alertSuccess')}>
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className={s('closeBtn')}>✕</button>
          </div>
        )}

        {/* ── Tab Navigation ── */}
        <div className={s('tabs')}>
          <button
            onClick={() => setActiveTab('devices')}
            className={cx(s('tab'), activeTab === 'devices' && s('tabActive'))}
          >
            <span>Active Devices</span>
            <span className={s('badgeCount')}>{devices.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('passkeys')}
            className={cx(s('tab'), activeTab === 'passkeys' && s('tabActive'))}
          >
            <span>Passkeys & Biometrics</span>
            <span className={s('badgeCount')}>{passkeys.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('2fa')}
            className={cx(s('tab'), activeTab === '2fa' && s('tabActive'))}
          >
            <span>Authenticator App (2FA)</span>
          </button>

          <button
            onClick={() => setActiveTab('password')}
            className={cx(s('tab'), activeTab === 'password' && s('tabActive'))}
          >
            <span>Change Password</span>
          </button>
        </div>

        {/* ── TAB 1: ACTIVE DEVICES TABLE ── */}
        {activeTab === 'devices' && (
          <div className={s('card')}>
            <div className={s('cardHead')}>
              <div>
                <h3>Logged-in Devices</h3>
                <p>Sessions currently authorized to access your account.</p>
              </div>
              <button onClick={() => refetchOverview()} className={s('btnRefresh')}>
                Refresh
              </button>
            </div>

            <div className={s('tableWrapper')}>
              <table className={s('deviceTable')}>
                <thead>
                  <tr>
                    <th>Device & OS</th>
                    <th>Browser</th>
                    <th>IP Address</th>
                    <th>Location</th>
                    <th>Last Active</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.length === 0 && !overviewLoading && (
                    <tr>
                      <td colSpan={6} className={s('emptyState')}>
                        No active sessions recorded yet.
                      </td>
                    </tr>
                  )}
                  {devices.map((dev: IDevice) => (
                    <tr key={dev.id} className={dev.is_current_device ? s('currentDeviceRow') : undefined}>
                      <td>
                        <div className={s('deviceCell')}>
                          <span>{dev.os || 'Unknown Device'}</span>
                          {dev.is_current_device && (
                            <span className={s('currentBadge')}>This device</span>
                          )}
                        </div>
                      </td>
                      <td>{dev.browser || 'Web Browser'}</td>
                      <td>
                        <span className={s('monoText')}>{dev.ip_address || '127.0.0.1'}</span>
                      </td>
                      <td>
                        <span className={s('locationText')}>{dev.location || 'Local Network'}</span>
                      </td>
                      <td>
                        <span className={s('dateText')}>{formatDate(dev.last_login_at || dev.created_at)}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {dev.is_current_device ? (
                          <span className={s('currentBadge')}>Active Now</span>
                        ) : (
                          <button
                            onClick={() => handleRevokeDevice(dev.id)}
                            className={s('btnDangerOutline')}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 2: PASSKEYS & BIOMETRICS ── */}
        {activeTab === 'passkeys' && (
          <div className={s('card')}>
            <div className={s('cardHead')}>
              <div>
                <h3>Passkeys & Biometric Credentials</h3>
                <p>Sign in instantly using Windows Hello, Touch ID, Face ID, or hardware security keys without typing passwords or OTPs.</p>
              </div>
              <button
                onClick={handleRegisterPasskey}
                disabled={passkeyRegLoading}
                className={s('btnPrimary')}
              >
                <i className="fa-solid fa-fingerprint" />
                <span>{passkeyRegLoading ? 'Setting up...' : '+ Add Passkey'}</span>
              </button>
            </div>

            <div className={s('tableWrapper')}>
              <table className={s('deviceTable')}>
                <thead>
                  <tr>
                    <th>Passkey Device</th>
                    <th>Type</th>
                    <th>Created On</th>
                    <th>Last Used</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {passkeys.length === 0 && !passkeysLoading && (
                    <tr>
                      <td colSpan={5} className={s('emptyState')}>
                        No passkeys registered yet. Click &quot;+ Add Passkey&quot; above to enable 1-click biometric sign-in.
                      </td>
                    </tr>
                  )}
                  {passkeys.map((pk: IPasskey) => (
                    <tr key={pk.id}>
                      <td>
                        <div className={s('deviceCell')}>
                          <i className="fa-solid fa-key" style={{ color: '#ea580c', fontSize: 13 }} />
                          <span>{pk.device_name || 'Passkey'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={s('currentBadge')} style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                          FIDO2 / WebAuthn
                        </span>
                      </td>
                      <td>
                        <span className={s('dateText')}>{formatDate(pk.created_at)}</span>
                      </td>
                      <td>
                        <span className={s('dateText')}>{pk.last_used_at ? formatDate(pk.last_used_at) : 'Never'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeletePasskey(pk.id)}
                          className={s('btnDangerOutline')}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: 2FA AUTHENTICATOR APP ── */}
        {activeTab === '2fa' && (
          <div className={s('card')}>
            <div className={s('cardHead')}>
              <div>
                <h3>Two-Factor Authentication (TOTP)</h3>
                <p>Add a backup layer of security using Google Authenticator or Microsoft Authenticator.</p>
              </div>
            </div>

            <div className={s('twofaRow')}>
              <div className={s('twofaInfo')}>
                <div className={cx(s('statusIndicator'), is2FAActive ? s('statusIndicatorOn') : s('statusIndicatorOff'))} />
                <div>
                  <h4 className={s('twofaTitle')}>
                    {is2FAActive ? 'Authenticator app is enabled' : 'Authenticator app is not enabled'}
                  </h4>
                  <p className={s('twofaDesc')}>
                    {is2FAActive
                      ? 'You will be prompted for a 6-digit verification code when signing in.'
                      : 'Secure your login by requiring a verification code from your authenticator app.'}
                  </p>
                </div>
              </div>

              <div>
                {is2FAActive ? (
                  <button onClick={() => setDisableModalOpen(true)} className={s('btnDangerOutline')}>
                    Disable 2FA
                  </button>
                ) : (
                  <button onClick={handleStartSetup} className={s('btnPrimary')}>
                    Set up 2FA
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: CHANGE PASSWORD ── */}
        {activeTab === 'password' && (
          <div className={s('card')}>
            <div className={s('cardHead')}>
              <div>
                <h3>Change Account Password</h3>
                <p>Update your master account login password.</p>
              </div>
            </div>

            <div className={s('cardBody')}>
              <form onSubmit={handleChangePassword} style={{ maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={pwForm.current_password}
                    onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                    placeholder="Enter current password"
                    className={s('inputField')}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={pwForm.new_password}
                    onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                    placeholder="Min. 6 characters"
                    className={s('inputField')}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={pwForm.confirm_password}
                    onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })}
                    placeholder="Re-enter new password"
                    className={s('inputField')}
                    required
                  />
                </div>

                <div style={{ marginTop: 6 }}>
                  <button
                    type="submit"
                    disabled={savingPw}
                    className={s('btnPrimary')}
                  >
                    {savingPw ? 'Updating Password...' : 'Save Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── 2FA SETUP MODAL ── */}
        {setupModalOpen && setupData && (
          <div className={s('modalOverlay')}>
            <div className={s('modalContent')}>
              <div className={s('modalHeader')}>
                <h3 className={s('modalTitle')}>Set Up Two-Factor Authentication</h3>
                <button onClick={() => setSetupModalOpen(false)} className={s('closeBtn')}>✕</button>
              </div>

              <div>
                <p style={{ fontSize: 13, color: '#475569', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                  1. Scan this QR code with Google Authenticator or your TOTP app:
                </p>

                <div className={s('qrBox')}>
                  <img src={setupData.qrCodeDataUrl} alt="2FA QR Code" className={s('qrImage')} />
                  <div className={s('secretRow')}>
                    <span className={s('secretCode')}>{setupData.secret}</span>
                    <button
                      onClick={() => copyToClipboard(setupData.secret)}
                      className={s('btnSecondary')}
                      style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                    >
                      {copySuccess ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    2. Enter the 6-digit code from your app:
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className={s('otpInput')}
                  />
                </div>

                <div className={s('recoveryBox')}>
                  <span className={s('recoveryTitle')}>Backup Recovery Codes:</span>
                  <div className={s('recoveryGrid')}>
                    {setupData.recoveryCodes.map((c, i) => (
                      <span key={i}>{c}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className={s('modalFooter')}>
                <button onClick={() => setSetupModalOpen(false)} className={s('btnSecondary')}>
                  Cancel
                </button>
                <button
                  onClick={handleEnable2FA}
                  disabled={verifyLoading || verifyCode.length < 6}
                  className={s('btnPrimary')}
                >
                  {verifyLoading ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DISABLE 2FA MODAL ── */}
        {disableModalOpen && (
          <div className={s('modalOverlay')}>
            <div className={s('modalContent')}>
              <div className={s('modalHeader')}>
                <h3 className={s('modalTitle')} style={{ color: '#dc2626' }}>Disable Two-Factor Authentication</h3>
                <button onClick={() => setDisableModalOpen(false)} className={s('closeBtn')}>✕</button>
              </div>

              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px 0' }}>
                Enter your current account password and 2FA code to confirm disabling protection.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Enter password"
                    className={s('inputField')}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    6-Digit Authenticator Code
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    placeholder="000000"
                    className={s('inputField')}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div className={s('modalFooter')}>
                <button onClick={() => setDisableModalOpen(false)} className={s('btnSecondary')}>
                  Cancel
                </button>
                <button
                  onClick={handleDisable2FA}
                  disabled={disableLoading || !disablePassword || !disableCode}
                  className={s('btnDangerFilled')}
                >
                  {disableLoading ? 'Disabling...' : 'Confirm Disable'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
