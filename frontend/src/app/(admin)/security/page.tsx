'use client';

import { useState, useEffect } from 'react';
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

// Client-side detection helper
function detectClientDevice(): { browser: string; os: string } {
  if (typeof window === 'undefined' || !navigator) {
    return { browser: 'Web Browser', os: 'Desktop' };
  }
  const ua = navigator.userAgent.toLowerCase();
  let os = 'Windows';
  if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';

  let browser = 'Google Chrome';
  if (ua.includes('brave')) browser = 'Brave Browser';
  else if (ua.includes('edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Apple Safari';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';

  return { browser, os };
}

export default function SecurityDashboardPage() {
  const { data: overviewRes, loading, refetch } = useApi<{ success: boolean; data: ISecurityOverview }>('/security/overview');
  const overview = overviewRes?.data || null;

  const [clientInfo, setClientInfo] = useState<{ browser: string; os: string }>({ browser: 'Google Chrome', os: 'Windows' });

  useEffect(() => {
    setClientInfo(detectClientDevice());
  }, []);

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

  const is2FAActive = overview?.totp_enabled;
  const rawDevices = overview?.devices || [];
  const currentDevice = rawDevices.find((d) => d.is_current_device) || rawDevices[0] || null;
  const otherDevices = rawDevices.filter((d) => d.id !== currentDevice?.id);
  const activeDeviceCount = rawDevices.length > 0 ? rawDevices.length : 1;

  return (
    <div className={s('page')}>
      <div className={s('content')}>
        {/* ── Page Header ── */}
        <div className={s('pageHead')}>
          <div className={s('headLeft')}>
            <div className={s('headIcon')}>
              <i className="fa-solid fa-shield-halved" />
            </div>
            <div>
              <h1>Security & 2FA</h1>
              <p>Google Authenticator (TOTP), active device history, and login threat protection</p>
            </div>
          </div>
        </div>

        {/* ── Alerts ── */}
        {error && (
          <div className={s('alertError')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-circle-exclamation" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className={s('closeBtn')}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className={s('alertSuccess')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-circle-check" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className={s('closeBtn')}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        {/* ── Overview Hero Card ── */}
        <div className={s('heroCard')}>
          <div className={s('heroLeft')}>
            <div className={cx(s('heroIcon'), is2FAActive ? s('heroIconGreen') : s('heroIconOrange'))}>
              <i className={`fa-solid ${is2FAActive ? 'fa-shield-check' : 'fa-shield'}`} />
            </div>
            <div className={s('heroDetails')}>
              <div className={s('heroTitleRow')}>
                <h2 className={s('heroTitle')}>Account Protection Status</h2>
                <span className={is2FAActive ? s('badgeHigh') : s('badgeMed')}>
                  {is2FAActive ? 'High Protection' : 'Standard Protection'}
                </span>
              </div>
              <p className={s('heroDesc')}>
                {is2FAActive
                  ? 'Two-Factor Authentication is active with Google Authenticator and smart device fingerprinting.'
                  : 'Enable 2FA Authenticator app to protect your school data from session hijacking and password theft.'}
              </p>
            </div>
          </div>

          <div className={s('heroRight')}>
            <div className={s('statChip')}>
              <div className={cx(s('statChipIcon'), is2FAActive ? s('statChipIconGreen') : s('statChipIconOrange'))}>
                <i className={`fa-solid ${is2FAActive ? 'fa-lock' : 'fa-lock-open'}`} />
              </div>
              <div className={s('statChipText')}>
                <span>2FA Status</span>
                <strong>{is2FAActive ? 'ENABLED' : 'DISABLED'}</strong>
              </div>
            </div>

            <div className={s('statChip')}>
              <div className={cx(s('statChipIcon'), s('statChipIconOrange'))}>
                <i className="fa-solid fa-laptop-code" />
              </div>
              <div className={s('statChipText')}>
                <span>Active Devices</span>
                <strong>{activeDeviceCount} Device{activeDeviceCount > 1 ? 's' : ''}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className={s('tabs')}>
          <button
            onClick={() => setActiveTab('2fa')}
            className={cx(s('tab'), activeTab === '2fa' && s('tabActive'))}
          >
            <i className="fa-solid fa-mobile-screen-button" />
            <span>Authenticator App (2FA)</span>
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={cx(s('tab'), activeTab === 'devices' && s('tabActive'))}
          >
            <i className="fa-solid fa-laptop-code" />
            <span>Active Devices</span>
            <span className={s('badgeCount')}>{activeDeviceCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('protection')}
            className={cx(s('tab'), activeTab === 'protection' && s('tabActive'))}
          >
            <i className="fa-solid fa-user-shield" />
            <span>Threat Defense & Policy</span>
          </button>
        </div>

        {/* ── TAB 1: 2FA AUTHENTICATOR APP ── */}
        {activeTab === '2fa' && (
          <div className={s('card')}>
            <div className={s('cardHead')}>
              <div>
                <h3>
                  <i className="fa-solid fa-qrcode" style={{ color: '#ea580c' }} />
                  Google / Microsoft Authenticator (TOTP)
                </h3>
                <p>Use a mobile authenticator app to generate single-use verification codes at login.</p>
              </div>
            </div>

            <div className={s('twofaBox')}>
              <div className={cx(s('twofaStatusCard'), is2FAActive && s('twofaStatusActive'))}>
                <div className={s('twofaStatusLeft')}>
                  <div className={cx(s('twofaStatusIcon'), is2FAActive ? s('iconActive') : s('iconInactive'))}>
                    <i className={`fa-solid ${is2FAActive ? 'fa-circle-check' : 'fa-key'}`} />
                  </div>
                  <div>
                    <h4 className={s('twofaTitle')}>
                      {is2FAActive ? 'Authenticator App 2FA is Active' : '2FA is Currently Disabled'}
                    </h4>
                    <p className={s('twofaDesc')}>
                      {is2FAActive
                        ? 'Your account is secured. Every sign in requires your password and a 6-digit TOTP code.'
                        : 'Protect your portal against brute force attacks and credential stuffing by enabling 2FA.'}
                    </p>
                  </div>
                </div>

                <div>
                  {is2FAActive ? (
                    <button onClick={() => setDisableModalOpen(true)} className={s('btnDangerOutline')}>
                      <i className="fa-solid fa-ban" style={{ marginRight: 6 }} />
                      Disable 2FA
                    </button>
                  ) : (
                    <button onClick={handleStartSetup} className={s('btnPrimary')}>
                      <i className="fa-solid fa-shield-halved" />
                      Set Up 2FA Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: ACTIVE DEVICES & LOGIN HISTORY ── */}
        {activeTab === 'devices' && (
          <div className={s('card')}>
            <div className={s('cardHead')}>
              <div>
                <h3>
                  <i className="fa-solid fa-laptop-code" style={{ color: '#ea580c' }} />
                  Logged-in Devices & History
                </h3>
                <p>We send an instant email notification whenever a new or unrecognized device logs in.</p>
              </div>
              <button onClick={() => refetch()} className={s('btnIcon')} title="Refresh Device List">
                <i className="fa-solid fa-arrows-rotate" />
              </button>
            </div>

            {/* 1. CURRENT ACTIVE DEVICE CARD */}
            <div className={cx(s('currentDeviceBox'), s('currentDeviceBoxActive'))}>
              <div className={s('currentDeviceTop')}>
                <div className={s('currentDeviceLeft')}>
                  <div className={s('currentDeviceIcon')}>
                    <i className={`fa-solid ${(currentDevice?.os || clientInfo.os).toLowerCase().includes('windows') ? 'fa-desktop' : (currentDevice?.os || clientInfo.os).toLowerCase().includes('android') || (currentDevice?.os || clientInfo.os).toLowerCase().includes('ios') ? 'fa-mobile-screen' : 'fa-laptop'}`} />
                  </div>
                  <div>
                    <h4 className={s('currentDeviceTitle')}>
                      {currentDevice?.browser || clientInfo.browser} on {currentDevice?.os || clientInfo.os}
                    </h4>
                    <p className={s('currentDeviceSub')}>
                      This Device • Your Current Active Session
                    </p>
                  </div>
                </div>

                <span className={s('activeNowBadge')}>
                  <span className={s('pulseDot')} /> Active Now
                </span>
              </div>

              <div className={s('deviceDetailGrid')}>
                <div className={s('detailCell')}>
                  <span className={s('detailLabel')}>Browser</span>
                  <span className={s('detailVal')}>{currentDevice?.browser || clientInfo.browser}</span>
                </div>
                <div className={s('detailCell')}>
                  <span className={s('detailLabel')}>Operating System</span>
                  <span className={s('detailVal')}>{currentDevice?.os || clientInfo.os}</span>
                </div>
                <div className={s('detailCell')}>
                  <span className={s('detailLabel')}>IP Address</span>
                  <span className={s('detailVal')}>{currentDevice?.ip_address || '127.0.0.1'}</span>
                </div>
                <div className={s('detailCell')}>
                  <span className={s('detailLabel')}>Location</span>
                  <span className={s('detailVal')}>{currentDevice?.location || 'Local Network'}</span>
                </div>
                <div className={s('detailCell')}>
                  <span className={s('detailLabel')}>Last Active</span>
                  <span className={s('detailVal')}>
                    {currentDevice?.last_login_at ? new Date(currentDevice.last_login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. OTHER RECOGNIZED DEVICES */}
            {otherDevices.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 12px' }}>
                  Other Recognized Devices ({otherDevices.length})
                </h4>
                <div className={s('deviceList')}>
                  {otherDevices.map((dev) => (
                    <div key={dev.id} className={s('deviceItem')}>
                      <div className={s('deviceLeft')}>
                        <div className={s('deviceIcon')}>
                          <i className={`fa-solid ${dev.os?.toLowerCase().includes('windows') ? 'fa-desktop' : dev.os?.toLowerCase().includes('android') || dev.os?.toLowerCase().includes('ios') ? 'fa-mobile-screen' : 'fa-laptop'}`} />
                        </div>
                        <div>
                          <div className={s('deviceTitleRow')}>
                            <span className={s('deviceName')}>
                              {dev.browser || 'Web Browser'} on {dev.os || 'Device'}
                            </span>
                          </div>
                          <div className={s('deviceMeta')}>
                            <span><i className="fa-solid fa-network-wired" style={{ marginRight: 4, color: '#94a3b8' }} /> {dev.ip_address || '127.0.0.1'}</span>
                            <span>•</span>
                            <span><i className="fa-solid fa-location-dot" style={{ marginRight: 4, color: '#94a3b8' }} /> {dev.location || 'Local Network'}</span>
                            <span>•</span>
                            <span><i className="fa-solid fa-clock" style={{ marginRight: 4, color: '#94a3b8' }} /> Last active: {dev.last_login_at ? new Date(dev.last_login_at).toLocaleString() : 'Recent'}</span>
                          </div>
                        </div>
                      </div>

                      <button onClick={() => handleRevokeDevice(dev.id)} className={s('btnDangerOutline')}>
                        <i className="fa-solid fa-ban" style={{ marginRight: 4 }} /> Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: THREAT DEFENSE & POLICY ── */}
        {activeTab === 'protection' && (
          <div className={s('policyGrid')}>
            <div className={s('policyCard')}>
              <div className={cx(s('policyIconWrap'), s('policyIconOrange'))}>
                <i className="fa-solid fa-fingerprint" />
              </div>
              <h4 className={s('policyTitle')}>Smart Device Fingerprinting</h4>
              <p className={s('policyDesc')}>
                Calculates cryptographic SHA256 browser and IP subnet fingerprints. Dispatches instant email alerts when a login from an unrecognized device occurs.
              </p>
            </div>

            <div className={s('policyCard')}>
              <div className={cx(s('policyIconWrap'), s('policyIconGreen'))}>
                <i className="fa-solid fa-shield-halved" />
              </div>
              <h4 className={s('policyTitle')}>RFC 6238 TOTP Standard</h4>
              <p className={s('policyDesc')}>
                Compatible with Google Authenticator, Authy, and Microsoft Authenticator with 8 single-use emergency backup recovery codes.
              </p>
            </div>

            <div className={s('policyCard')}>
              <div className={cx(s('policyIconWrap'), s('policyIconBlue'))}>
                <i className="fa-solid fa-shield-virus" />
              </div>
              <h4 className={s('policyTitle')}>Edge & DDoS Defense</h4>
              <p className={s('policyDesc')}>
                Global rate limiting (150 req/min per IP), automated IP telemetry monitoring, and instant lockout protection against brute-force attacks.
              </p>
            </div>
          </div>
        )}

        {/* ── 2FA SETUP MODAL ── */}
        {setupModalOpen && setupData && (
          <div className={s('modalOverlay')}>
            <div className={s('modalContent')}>
              <div className={s('modalHeader')}>
                <h3 className={s('modalTitle')}>
                  <i className="fa-solid fa-qrcode" style={{ color: '#ea580c' }} /> Set up Authenticator App
                </h3>
                <button onClick={() => setSetupModalOpen(false)} className={s('closeBtn')}>
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              <div>
                <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                  1. Open <strong>Google Authenticator</strong> or your preferred TOTP app.<br />
                  2. Tap <strong>+</strong> and scan this QR code:
                </p>

                <div className={s('qrBox')}>
                  <img src={setupData.qrCodeDataUrl} alt="2FA QR Code" className={s('qrImage')} />
                  <div className={s('secretRow')}>
                    <span className={s('secretCode')}>{setupData.secret}</span>
                    <button onClick={() => copyToClipboard(setupData.secret)} className={s('btnSecondary')} style={{ minHeight: 30, padding: '0 10px', fontSize: 12 }}>
                      {copySuccess ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    3. Enter the 6-digit code from your app:
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
                  <span className={s('recoveryTitle')}>Emergency Backup Recovery Codes:</span>
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
                  {verifyLoading ? 'Verifying...' : 'Verify & Enable 2FA'}
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
                <h3 className={s('modalTitle')} style={{ color: '#dc2626' }}>
                  <i className="fa-solid fa-triangle-exclamation" /> Disable 2FA Protection
                </h3>
                <button onClick={() => setDisableModalOpen(false)} className={s('closeBtn')}>
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px 0' }}>
                Disabling 2FA reduces your account security. Please verify your credentials:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Enter your current password"
                    className={s('inputField')}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
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
