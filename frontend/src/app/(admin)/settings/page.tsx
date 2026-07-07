'use client';

import { useState, useEffect } from 'react';
import Topbar from '@/components/shared/Topbar';
import { useApi } from '@/lib/useApi';
import { apiRequest } from '@/lib/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/toastSlice';
import { Spinner } from '@/components/shared/Loader';
import styles from './settings.module.css';

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(' ');

type Tab = 'school' | 'security';

const SCHOOL_TYPES = ['Primary', 'Secondary', 'Higher_Secondary', 'College', 'University', 'Other'];
const TIMEZONES    = ['Asia/Kathmandu', 'Asia/Kolkata', 'Asia/Dhaka', 'UTC', 'Asia/Bangkok', 'Asia/Singapore'];

export default function AdminSettingsPage() {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>('school');

  const { data: school, loading, refetch } = useApi<any>('/school/settings');

  // ── School Info form ──────────────────────────────────────────────────────
  const [info, setInfo] = useState({
    school_name: '', school_type: '', established_year: '',
    city: '', state: '', country: '', pincode: '', phone: '',
    owner_full_name: '', timezone: '', logo: '',
  });
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    if (!school) return;
    setInfo({
      school_name:      school.school_name      || '',
      school_type:      school.school_type      || '',
      established_year: school.established_year ? String(school.established_year) : '',
      city:             school.city             || '',
      state:            school.state            || '',
      country:          school.country          || '',
      pincode:          school.pincode          || '',
      phone:            school.phone            || '',
      owner_full_name:  school.owner_full_name  || '',
      timezone:         school.timezone         || 'Asia/Kathmandu',
      logo:             school.logo             || '',
    });
  }, [school]);

  const handleSaveInfo = async () => {
    if (!info.school_name.trim()) {
      dispatch(showToast({ type: 'error', title: 'Required', message: 'School name cannot be empty.' }));
      return;
    }
    setSavingInfo(true);
    try {
      await apiRequest('/school/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          ...info,
          established_year: info.established_year ? Number(info.established_year) : null,
        }),
      });
      dispatch(showToast({ type: 'success', title: 'Saved', message: 'School settings updated successfully.' }));
      refetch();
    } catch (e: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: e.message || 'Could not save settings.' }));
    } finally { setSavingInfo(false); }
  };

  // ── Change Password form ──────────────────────────────────────────────────
  const [pwForm, setPwForm]       = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingPw, setSavingPw]   = useState(false);
  const [showPw, setShowPw]       = useState(false);

  const handleChangePassword = async () => {
    if (!pwForm.current_password)                  { dispatch(showToast({ type: 'error', title: 'Required', message: 'Enter your current password.' })); return; }
    if (pwForm.new_password.length < 6)            { dispatch(showToast({ type: 'error', title: 'Too Short', message: 'New password must be at least 6 characters.' })); return; }
    if (pwForm.new_password !== pwForm.confirm_password) { dispatch(showToast({ type: 'error', title: 'Mismatch', message: 'Passwords do not match.' })); return; }

    setSavingPw(true);
    try {
      await apiRequest('/school/change-password', {
        method: 'PATCH',
        body: JSON.stringify({ current_password: pwForm.current_password, new_password: pwForm.new_password }),
      });
      dispatch(showToast({ type: 'success', title: 'Password Changed', message: 'Your password has been updated.' }));
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: e.message || 'Could not change password.' }));
    } finally { setSavingPw(false); }
  };

  const initials = school?.school_name
    ? school.school_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className={s('page')}>
      <Topbar title="Settings" subtitle="Manage your school profile and security settings" />

      <main className={s('content')}>
        {/* Hero */}
        <section className={s('hero')}>
          <div className={s('school-badge')}>
            {school?.logo
              ? <img src={school.logo} alt="logo" className={s('school-logo')}/>
              : <span>{initials}</span>
            }
          </div>
          <div>
            <div className={s('eyebrow')}>School Settings</div>
            <h1>{school?.school_name || 'My School'}</h1>
            <p>
              {school?.email}
              {school?.school_code && <span className={s('code-chip')}>{school.school_code}</span>}
            </p>
          </div>
        </section>

        {/* Tabs */}
        <div className={s('tabs')}>
          {([
            ['school',   'fa-school',        'School Info'     ],
            ['security', 'fa-lock',          'Security'        ],
          ] as const).map(([key, icon, label]) => (
            <button
              key={key}
              className={cx(s('tab'), tab === key && s('tab-active'))}
              onClick={() => setTab(key)}
            >
              <i className={`fa-solid ${icon}`}/> {label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51"/></div>
        )}

        {/* ── School Info Tab ── */}
        {!loading && tab === 'school' && (
          <div className={s('panel')}>
            <div className={s('panel-head')}>
              <div>
                <h2><i className="fa-solid fa-school" style={{ color: '#ff9b51', marginRight: 8 }}/>School Information</h2>
                <p>Update your school profile, contact and location details</p>
              </div>
            </div>

            <div className={s('form-grid')}>
              <label className={cx(s('field'), s('full'))}>
                <span>School Name <em>*</em></span>
                <input value={info.school_name} onChange={e => setInfo({ ...info, school_name: e.target.value })} placeholder="e.g. Sunrise Public School"/>
              </label>

              <label className={s('field')}>
                <span>School Type</span>
                <select value={info.school_type} onChange={e => setInfo({ ...info, school_type: e.target.value })}>
                  <option value="">— Select —</option>
                  {SCHOOL_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </label>

              <label className={s('field')}>
                <span>Established Year</span>
                <input type="number" min="1900" max={new Date().getFullYear()} value={info.established_year} onChange={e => setInfo({ ...info, established_year: e.target.value })} placeholder="e.g. 2005"/>
              </label>

              <label className={s('field')}>
                <span>Phone</span>
                <input value={info.phone} onChange={e => setInfo({ ...info, phone: e.target.value })} placeholder="+977-98XXXXXXXX"/>
              </label>

              <label className={s('field')}>
                <span>Owner / Principal</span>
                <input value={info.owner_full_name} onChange={e => setInfo({ ...info, owner_full_name: e.target.value })} placeholder="Full name"/>
              </label>

              <label className={s('field')}>
                <span>Timezone</span>
                <select value={info.timezone} onChange={e => setInfo({ ...info, timezone: e.target.value })}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </label>

              <label className={s('field')}>
                <span>City</span>
                <input value={info.city} onChange={e => setInfo({ ...info, city: e.target.value })} placeholder="e.g. Kathmandu"/>
              </label>

              <label className={s('field')}>
                <span>State / Province</span>
                <input value={info.state} onChange={e => setInfo({ ...info, state: e.target.value })} placeholder="e.g. Bagmati"/>
              </label>

              <label className={s('field')}>
                <span>Country</span>
                <input value={info.country} onChange={e => setInfo({ ...info, country: e.target.value })} placeholder="e.g. Nepal"/>
              </label>

              <label className={s('field')}>
                <span>Pincode / ZIP</span>
                <input value={info.pincode} onChange={e => setInfo({ ...info, pincode: e.target.value })} placeholder="e.g. 44600"/>
              </label>

              {/* Logo URL */}
              <label className={cx(s('field'), s('full'))}>
                <span>Logo URL</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {info.logo && (
                    <img src={info.logo} alt="logo preview" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <input
                    value={info.logo}
                    onChange={e => setInfo({ ...info, logo: e.target.value })}
                    placeholder="https://your-school.com/logo.png"
                    style={{ flex: 1 }}
                  />
                </div>
                <small style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>
                  Paste a public image URL. This appears in the sidebar and emails.
                </small>
              </label>
            </div>

            {/* Read-only info */}
            <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                ['Email', school?.email],
                ['School Code', school?.school_code],
                ['2FA Status', school?.two_fa_enabled ? 'Enabled by admin' : 'Disabled'],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: '12px 14px', border: '1px solid rgba(191,201,209,0.5)', borderRadius: 9, background: '#f8fbfb' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#6b7b86', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{val || '—'}</div>
                </div>
              ))}
            </div>

            <div className={s('form-actions')}>
              <button className={cx(s('btn'), s('btn-primary'))} onClick={handleSaveInfo} disabled={savingInfo}>
                {savingInfo ? <><Spinner size={14}/> Saving…</> : <><i className="fa-solid fa-check"/> Save Changes</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Security Tab ── */}
        {!loading && tab === 'security' && (
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Change Password */}
            <div className={s('panel')}>
              <div className={s('panel-head')}>
                <div>
                  <h2><i className="fa-solid fa-lock" style={{ color: '#ff9b51', marginRight: 8 }}/>Change Password</h2>
                  <p>Update your admin account password</p>
                </div>
              </div>
              <div className={s('form-grid')} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <label className={s('field')}>
                  <span>Current Password <em>*</em></span>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.current_password}
                      onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })}
                      placeholder="Your current password"
                      style={{ paddingRight: 40 }}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>
                      <i className={`fa-solid ${showPw ? 'fa-eye-slash' : 'fa-eye'}`}/>
                    </button>
                  </div>
                </label>
                <label className={s('field')}>
                  <span>New Password <em>*</em></span>
                  <input type={showPw ? 'text' : 'password'} value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} placeholder="Min. 6 characters"/>
                </label>
                <label className={s('field')}>
                  <span>Confirm New Password <em>*</em></span>
                  <input type={showPw ? 'text' : 'password'} value={pwForm.confirm_password} onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })} placeholder="Re-enter new password"/>
                </label>
              </div>
              <div className={s('form-actions')}>
                <button className={cx(s('btn'), s('btn-primary'))} onClick={handleChangePassword} disabled={savingPw}>
                  {savingPw ? <><Spinner size={14}/> Updating…</> : <><i className="fa-solid fa-lock"/> Update Password</>}
                </button>
              </div>
            </div>

            {/* 2FA Info */}
            <div className={s('panel')}>
              <div className={s('panel-head')}>
                <div>
                  <h2><i className="fa-solid fa-shield-halved" style={{ color: '#ff9b51', marginRight: 8 }}/>Two-Factor Authentication</h2>
                  <p>2FA is managed by the platform super admin</p>
                </div>
              </div>
              <div style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 11, background: school?.two_fa_enabled ? '#f0fdf4' : '#f8fafc', border: `1px solid ${school?.two_fa_enabled ? '#bbf7d0' : '#e2e8f0'}` }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: school?.two_fa_enabled ? '#dcfce7' : '#eaecef', color: school?.two_fa_enabled ? '#15803d' : '#6b7b86', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    <i className={`fa-solid ${school?.two_fa_enabled ? 'fa-shield-check' : 'fa-shield'}`}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>
                      2FA is currently <strong style={{ color: school?.two_fa_enabled ? '#15803d' : '#6b7b86' }}>{school?.two_fa_enabled ? 'ENABLED' : 'DISABLED'}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7b86', fontWeight: 700, marginTop: 3 }}>
                      {school?.two_fa_enabled
                        ? 'Every login requires a 6-digit code sent to your email.'
                        : 'Contact your platform administrator to enable 2FA for added security.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Info */}
            <div className={s('panel')}>
              <div className={s('panel-head')}>
                <div>
                  <h2><i className="fa-solid fa-circle-info" style={{ color: '#ff9b51', marginRight: 8 }}/>Account Information</h2>
                  <p>Read-only account details</p>
                </div>
              </div>
              <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  ['Registered Email', school?.email],
                  ['School Code',      school?.school_code],
                  ['Account Status',   school?.is_account],
                  ['Account Verified', school?.is_verified ? 'Yes' : 'No'],
                  ['Joined',           school?.created_at ? new Date(school.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                  ['Timezone',         school?.timezone],
                ].map(([label, val]) => (
                  <div key={label} style={{ padding: '12px 14px', border: '1px solid rgba(191,201,209,0.5)', borderRadius: 9, background: '#f8fbfb' }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#6b7b86', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'capitalize' }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
