'use client';

import { useState, useEffect } from 'react';
import Topbar from '@/components/shared/Topbar';
import ImageUpload from '@/components/shared/ImageUpload';
import { useApi } from '@/lib/useApi';
import { apiRequest } from '@/lib/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/toastSlice';
import { setUser } from '@/store/authSlice';
import { Spinner } from '@/components/shared/Loader';
import styles from './settings.module.css';
import PayrollPolicyTab from '@/components/admin/settings/PayrollPolicyTab';
import FeeBillingPolicyTab from '@/components/admin/settings/FeeBillingPolicyTab';

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(' ');

type Tab = 'school' | 'payment' | 'security' | 'payroll' | 'fees';

const SCHOOL_TYPES = ['Primary', 'Secondary', 'Higher_Secondary', 'College', 'University', 'Other'];
const TIMEZONES    = ['Asia/Kathmandu', 'Asia/Kolkata', 'Asia/Dhaka', 'UTC', 'Asia/Bangkok', 'Asia/Singapore'];

function getCountryRegion(country: string): 'NP' | 'IN' | 'OTHER' {
  const c = (country || '').toLowerCase().trim();
  if (c === 'nepal' || c === 'np') return 'NP';
  if (c === 'india' || c === 'in') return 'IN';
  return 'OTHER';
}

const emptyBankForm = {
  bank_name: '', account_name: '', account_number: '',
  branch: '', ifsc_code: '', upi_id: '', qr_image_url: '', notes: '',
};
type BankForm = typeof emptyBankForm;

function BankAccountCard({ account, region, onToggle, onDelete, onEdit }: {
  account: any; region: 'NP' | 'IN' | 'OTHER';
  onToggle: (id: number, is_active: boolean) => void;
  onDelete: (id: number) => void;
  onEdit:   (account: any) => void;
}) {
  return (
    <div style={{
      border: `1.5px solid ${account.is_active ? '#fed7aa' : '#e2e8f0'}`,
      borderRadius: 14, background: account.is_active ? '#fff' : '#f8fafc',
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
      opacity: account.is_active ? 1 : 0.7,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fff7ed', color: '#FF9B51', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
            <i className="fa-solid fa-building-columns" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#25343f' }}>{account.bank_name}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7b86', marginTop: 2 }}>{account.account_name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 900, background: account.is_active ? '#e2f6ee' : '#f1f5f9', color: account.is_active ? '#12805c' : '#94a3b8' }}>
            {account.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
          <button onClick={() => onEdit(account)} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #fed7aa', background: '#fffcf8', color: '#ea580c', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            <i className="fa-solid fa-pen" />
          </button>
          <button onClick={() => onToggle(account.id, !account.is_active)} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #fed7aa', background: '#fffcf8', color: '#ea580c', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            {account.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => onDelete(account.id)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff5f5', color: '#b42318', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            <i className="fa-solid fa-trash" />
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {[
          { label: 'Account Number', val: account.account_number },
          account.branch    && { label: 'Branch',                                      val: account.branch    },
          account.ifsc_code && { label: region === 'NP' ? 'SWIFT/Code' : 'IFSC Code', val: account.ifsc_code },
          account.upi_id    && { label: region === 'NP' ? 'eSewa / Khalti' : 'UPI ID',val: account.upi_id    },
          account.notes     && { label: 'Notes',                                       val: account.notes     },
        ].filter(Boolean).map((item: any) => (
          <div key={item.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#fff7ed', border: '1px solid #ffedd5' }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#25343f', marginTop: 2, wordBreak: 'break-all' }}>{item.val}</div>
          </div>
        ))}
      </div>
      {account.qr_image_url && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={account.qr_image_url} alt="QR Code" style={{ width: 64, height: 64, objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7b86' }}>QR Code / Payment QR</span>
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>('school');

  const { data: school, loading, refetch } = useApi<any>('/school/settings');
  const region = getCountryRegion(school?.country || '');

  // ── School Info ───────────────────────────────────────────────────────────
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
        body: JSON.stringify({ ...info, established_year: info.established_year ? Number(info.established_year) : null }),
      });
      dispatch(showToast({ type: 'success', title: 'Saved', message: 'School settings updated successfully.' }));
      refetch();
    } catch (e: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: e.message || 'Could not save settings.' }));
    } finally { setSavingInfo(false); }
  };

  // ── Password ──────────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [showPw, setShowPw]     = useState(false);

  const handleChangePassword = async () => {
    if (!pwForm.current_password)                        { dispatch(showToast({ type: 'error', title: 'Required',  message: 'Enter your current password.' }));        return; }
    if (pwForm.new_password.length < 6)                  { dispatch(showToast({ type: 'error', title: 'Too Short', message: 'New password must be at least 6 characters.' })); return; }
    if (pwForm.new_password !== pwForm.confirm_password) { dispatch(showToast({ type: 'error', title: 'Mismatch',  message: 'Passwords do not match.' }));              return; }
    setSavingPw(true);
    try {
      await apiRequest('/school/change-password', { method: 'PATCH', body: JSON.stringify({ current_password: pwForm.current_password, new_password: pwForm.new_password }) });
      dispatch(showToast({ type: 'success', title: 'Password Changed', message: 'Your password has been updated.' }));
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: e.message || 'Could not change password.' }));
    } finally { setSavingPw(false); }
  };

  // ── Bank Accounts ─────────────────────────────────────────────────────────
  const { data: bankAccounts, loading: bankLoading, refetch: refetchBanks } = useApi<any[]>('/online-payments/bank-accounts');
  const [showBankForm, setShowBankForm] = useState(false);
  const [editingBank,  setEditingBank]  = useState<any | null>(null);
  const [bankForm,     setBankForm]     = useState<BankForm>(emptyBankForm);
  const [savingBank,   setSavingBank]   = useState(false);

  const openAddBank  = () => { setEditingBank(null); setBankForm(emptyBankForm); setShowBankForm(true); };
  const openEditBank = (account: any) => {
    setEditingBank(account);
    setBankForm({
      bank_name:      account.bank_name      || '',
      account_name:   account.account_name   || '',
      account_number: account.account_number || '',
      branch:         account.branch         || '',
      ifsc_code:      account.ifsc_code      || '',
      upi_id:         account.upi_id         || '',
      qr_image_url:   account.qr_image_url   || '',
      notes:          account.notes          || '',
    });
    setShowBankForm(true);
  };

  const handleSaveBank = async () => {
    if (!bankForm.bank_name.trim() || !bankForm.account_name.trim() || !bankForm.account_number.trim()) {
      dispatch(showToast({ type: 'error', title: 'Required', message: 'Bank name, account name and account number are required.' }));
      return;
    }
    setSavingBank(true);
    try {
      if (editingBank) {
        await apiRequest(`/online-payments/bank-accounts/${editingBank.id}`, { method: 'PATCH', body: JSON.stringify(bankForm) });
        dispatch(showToast({ type: 'success', title: 'Updated', message: 'Bank account updated.' }));
      } else {
        await apiRequest('/online-payments/bank-accounts', { method: 'POST', body: JSON.stringify(bankForm) });
        dispatch(showToast({ type: 'success', title: 'Added', message: 'Bank account added.' }));
      }
      setShowBankForm(false);
      refetchBanks();
    } catch (e: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: e.message || 'Could not save bank account.' }));
    } finally { setSavingBank(false); }
  };

  const handleToggleBank = async (id: number, is_active: boolean) => {
    try {
      await apiRequest(`/online-payments/bank-accounts/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
      dispatch(showToast({ type: 'success', title: 'Updated', message: `Bank account ${is_active ? 'activated' : 'deactivated'}.` }));
      refetchBanks();
    } catch (e: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: e.message || 'Could not update bank account.' }));
    }
  };

  const handleDeleteBank = async (id: number) => {
    if (!confirm('Delete this bank account? This cannot be undone.')) return;
    try {
      await apiRequest(`/online-payments/bank-accounts/${id}`, { method: 'DELETE' });
      dispatch(showToast({ type: 'success', title: 'Deleted', message: 'Bank account removed.' }));
      refetchBanks();
    } catch (e: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: e.message || 'Could not delete bank account.' }));
    }
  };

  const initials = school?.school_name
    ? school.school_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const handleLogoUploaded = (url: string) => {
    setInfo(prev => ({ ...prev, logo: url }));
    dispatch(setUser({ logo: url } as any));
    dispatch(showToast({ type: 'success', title: 'Logo Updated', message: 'School logo has been uploaded successfully.' }));
  };

  return (
    <div className={s('page')}>
      <Topbar title="Settings" subtitle="Manage your school profile and security settings" />

      <main className={s('content')}>
        {/* Hero */}
        <section className={s('hero')}>
          <ImageUpload currentUrl={info.logo} endpoint="/upload/logo" onSuccess={handleLogoUploaded} shape="rounded" size={80} initials={initials} label="Change Logo" />
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
            ['school',   'fa-school',                'School Info'      ],
            ['payment',  'fa-building-columns',      'Payment Setup'    ],
            ['security', 'fa-lock',                  'Security'         ],
            ['payroll',  'fa-money-check-dollar',    'Payroll Policy'   ],
            ['fees',     'fa-file-invoice-dollar',   'Fee Billing'      ],
          ] as const).map(([key, icon, label]) => (
            <button key={key} className={cx(s('tab'), tab === key && s('tab-active'))} onClick={() => setTab(key)}>
              <i className={`fa-solid ${icon}`} /> {label}
            </button>
          ))}
        </div>

        {loading && <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51" /></div>}

        {/* ── School Info Tab ── */}
        {!loading && tab === 'school' && (
          <div className={s('panel')}>
            <div className={s('panel-head')}>
              <div>
                <h2><i className="fa-solid fa-school" style={{ color: '#ff9b51', marginRight: 8 }} />School Information</h2>
                <p>Update your school profile, contact and location details</p>
              </div>
            </div>
            <div className={s('form-grid')}>
              <label className={cx(s('field'), s('full'))}>
                <span>School Name <em>*</em></span>
                <input value={info.school_name} onChange={e => setInfo({ ...info, school_name: e.target.value })} placeholder="e.g. Sunrise Public School" />
              </label>
              <label className={s('field')}>
                <span>School Type</span>
                <select value={info.school_type} onChange={e => setInfo({ ...info, school_type: e.target.value })}>
                  <option value="">— Select —</option>
                  {SCHOOL_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label className={s('field')}>
                <span>Established Year</span>
                <input type="number" min="1900" max={new Date().getFullYear()} value={info.established_year} onChange={e => setInfo({ ...info, established_year: e.target.value })} placeholder="e.g. 2005" />
              </label>
              <label className={s('field')}>
                <span>Phone</span>
                <input value={info.phone} onChange={e => setInfo({ ...info, phone: e.target.value })} placeholder="+977-98XXXXXXXX" />
              </label>
              <label className={s('field')}>
                <span>Owner / Principal</span>
                <input value={info.owner_full_name} onChange={e => setInfo({ ...info, owner_full_name: e.target.value })} placeholder="Full name" />
              </label>
              <label className={s('field')}>
                <span>Timezone</span>
                <select value={info.timezone} onChange={e => setInfo({ ...info, timezone: e.target.value })}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </label>
              <label className={s('field')}>
                <span>City</span>
                <input value={info.city} onChange={e => setInfo({ ...info, city: e.target.value })} placeholder="e.g. Kathmandu" />
              </label>
              <label className={s('field')}>
                <span>State / Province</span>
                <input value={info.state} onChange={e => setInfo({ ...info, state: e.target.value })} placeholder="e.g. Bagmati" />
              </label>
              <label className={s('field')}>
                <span>Country</span>
                <input value={info.country} onChange={e => setInfo({ ...info, country: e.target.value })} placeholder="e.g. Nepal" />
              </label>
              <label className={s('field')}>
                <span>Pincode / ZIP</span>
                <input value={info.pincode} onChange={e => setInfo({ ...info, pincode: e.target.value })} placeholder="e.g. 44600" />
              </label>
              <div className={cx(s('field'), s('full'))} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 20 }}>
                <ImageUpload currentUrl={info.logo} endpoint="/upload/logo" onSuccess={handleLogoUploaded} shape="rounded" size={90} initials={initials} label="Upload Logo" />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, display: 'block' }}>Logo URL</span>
                  <input value={info.logo} onChange={e => setInfo({ ...info, logo: e.target.value })} placeholder="https://your-school.com/logo.png (or upload above)" />
                  <small style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginTop: 4, display: 'block' }}>
                    Click the logo to upload from device (JPEG/PNG/WebP, max 2 MB). Or paste a URL.
                  </small>
                </div>
              </div>
            </div>
            <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                ['Email',        school?.email],
                ['School Code',  school?.school_code],
                ['2FA Status',   school?.two_fa_enabled ? 'Enabled by admin' : 'Disabled'],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: '14px 16px', border: '1.5px solid #fed7aa', borderRadius: 12, background: '#fffcf8' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#6b7b86', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{val || '—'}</div>
                </div>
              ))}
            </div>
            <div className={s('form-actions')}>
              <button className={cx(s('btn'), s('btn-primary'))} onClick={handleSaveInfo} disabled={savingInfo}>
                {savingInfo ? <><Spinner size={14} /> Saving…</> : <><i className="fa-solid fa-check" /> Save Changes</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Payment Setup Tab ── */}
        {!loading && tab === 'payment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '14px 18px', borderRadius: 11, background: '#fff7ed', border: '1px solid #fed7aa', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <i className="fa-solid fa-circle-info" style={{ color: '#c2410c', marginTop: 2, fontSize: 15, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#92400e', marginBottom: 4 }}>How Online Payments Work</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', lineHeight: 1.6 }}>
                  Add your school bank account details below. Students will see these details in their portal and can pay via bank transfer or mobile banking.
                  After paying, students submit a form with their transaction ID and screenshot — you verify and approve to mark the fee as paid.
                  {region === 'NP' && ' eSewa/Khalti QR supported for Nepal schools.'}
                  {region === 'IN' && ' UPI ID and IFSC supported for India schools.'}
                </div>
              </div>
            </div>

            <div className={s('panel')}>
              <div className={s('panel-head')}>
                <div>
                  <h2><i className="fa-solid fa-building-columns" style={{ color: '#ff9b51', marginRight: 8 }} />Bank Accounts</h2>
                  <p>Students see active accounts when submitting payment</p>
                </div>
                <button className={cx(s('btn'), s('btn-primary'))} onClick={openAddBank}>
                  <i className="fa-solid fa-plus" /> Add Account
                </button>
              </div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bankLoading && <div style={{ padding: '2rem', textAlign: 'center' }}><Spinner size={24} color="#FF9B51" /></div>}
                {!bankLoading && (!bankAccounts || bankAccounts.length === 0) && (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    <i className="fa-solid fa-building-columns" style={{ fontSize: 32, display: 'block', marginBottom: 10, opacity: 0.2 }} />
                    <div style={{ fontSize: 13, fontWeight: 700 }}>No bank accounts added yet.</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Add your school bank account so students can pay online.</div>
                  </div>
                )}
                {(bankAccounts ?? []).map((acc: any) => (
                  <BankAccountCard key={acc.id} account={acc} region={region} onToggle={handleToggleBank} onDelete={handleDeleteBank} onEdit={openEditBank} />
                ))}
              </div>
            </div>

            {showBankForm && (
              <div className={s('panel')}>
                <div className={s('panel-head')}>
                  <div>
                    <h2><i className="fa-solid fa-plus" style={{ color: '#ff9b51', marginRight: 8 }} />{editingBank ? 'Edit Bank Account' : 'Add Bank Account'}</h2>
                    <p>
                      {region === 'NP' && 'Nepal — eSewa/Khalti supported'}
                      {region === 'IN' && 'India — UPI/IFSC supported'}
                      {region === 'OTHER' && 'International bank transfer fields'}
                    </p>
                  </div>
                  <button className={s('btn')} onClick={() => setShowBankForm(false)}><i className="fa-solid fa-xmark" /> Cancel</button>
                </div>
                <div className={s('form-grid')}>
                  <label className={s('field')}>
                    <span>Bank Name <em>*</em></span>
                    <input value={bankForm.bank_name} onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })}
                      placeholder={region === 'NP' ? 'e.g. Nepal Investment Bank' : region === 'IN' ? 'e.g. State Bank of India' : 'e.g. Commercial Bank'} />
                  </label>
                  <label className={s('field')}>
                    <span>Account Name <em>*</em></span>
                    <input value={bankForm.account_name} onChange={e => setBankForm({ ...bankForm, account_name: e.target.value })} placeholder="Name on the bank account" />
                  </label>
                  <label className={s('field')}>
                    <span>Account Number <em>*</em></span>
                    <input value={bankForm.account_number} onChange={e => setBankForm({ ...bankForm, account_number: e.target.value })} placeholder="Bank account number" />
                  </label>
                  {region !== 'IN' && (
                    <label className={s('field')}>
                      <span>Branch</span>
                      <input value={bankForm.branch} onChange={e => setBankForm({ ...bankForm, branch: e.target.value })} placeholder="e.g. Kathmandu Main Branch" />
                    </label>
                  )}
                  {region === 'IN' && (
                    <label className={s('field')}>
                      <span>IFSC Code</span>
                      <input value={bankForm.ifsc_code} onChange={e => setBankForm({ ...bankForm, ifsc_code: e.target.value })} placeholder="e.g. SBIN0001234" />
                    </label>
                  )}
                  <label className={s('field')}>
                    <span>{region === 'NP' ? 'eSewa / Khalti Number' : region === 'IN' ? 'UPI ID' : 'Digital Payment ID'}</span>
                    <input value={bankForm.upi_id} onChange={e => setBankForm({ ...bankForm, upi_id: e.target.value })}
                      placeholder={region === 'NP' ? 'e.g. 98XXXXXXXX (eSewa/Khalti)' : region === 'IN' ? 'e.g. school@upi' : 'Optional'} />
                  </label>
                  <label className={s('field')}>
                    <span>QR Code Image URL</span>
                    <input value={bankForm.qr_image_url} onChange={e => setBankForm({ ...bankForm, qr_image_url: e.target.value })} placeholder="https://… (paste QR image URL)" />
                  </label>
                  <label className={cx(s('field'), s('full'))}>
                    <span>Notes / Instructions for Students</span>
                    <input value={bankForm.notes} onChange={e => setBankForm({ ...bankForm, notes: e.target.value })}
                      placeholder="e.g. Transfer during bank hours (10am–3pm). Include your name in remarks." />
                  </label>
                </div>
                <div className={s('form-actions')}>
                  <button className={s('btn')} onClick={() => setShowBankForm(false)}>Cancel</button>
                  <button className={cx(s('btn'), s('btn-primary'))} onClick={handleSaveBank} disabled={savingBank}>
                    {savingBank ? <><Spinner size={14} /> Saving…</> : <><i className="fa-solid fa-check" /> {editingBank ? 'Update Account' : 'Add Account'}</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Security Tab ── */}
        {!loading && tab === 'security' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div className={s('panel')}>
              <div className={s('panel-head')}>
                <div>
                  <h2><i className="fa-solid fa-lock" style={{ color: '#ff9b51', marginRight: 8 }} />Change Password</h2>
                  <p>Update your admin account password</p>
                </div>
              </div>
              <div className={s('form-grid')} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <label className={s('field')}>
                  <span>Current Password <em>*</em></span>
                  <div style={{ position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'} value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} placeholder="Your current password" style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>
                      <i className={`fa-solid ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </label>
                <label className={s('field')}>
                  <span>New Password <em>*</em></span>
                  <input type={showPw ? 'text' : 'password'} value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} placeholder="Min. 6 characters" />
                </label>
                <label className={s('field')}>
                  <span>Confirm New Password <em>*</em></span>
                  <input type={showPw ? 'text' : 'password'} value={pwForm.confirm_password} onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })} placeholder="Re-enter new password" />
                </label>
              </div>
              <div className={s('form-actions')}>
                <button className={cx(s('btn'), s('btn-primary'))} onClick={handleChangePassword} disabled={savingPw}>
                  {savingPw ? <><Spinner size={14} /> Updating…</> : <><i className="fa-solid fa-lock" /> Update Password</>}
                </button>
              </div>
            </div>

            <div className={s('panel')}>
              <div className={s('panel-head')}>
                <div>
                  <h2><i className="fa-solid fa-shield-halved" style={{ color: '#ff9b51', marginRight: 8 }} />Two-Factor Authentication</h2>
                  <p>2FA is managed by the platform super admin</p>
                </div>
              </div>
              <div style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 11, background: school?.two_fa_enabled ? '#f0fdf4' : '#f8fafc', border: `1px solid ${school?.two_fa_enabled ? '#bbf7d0' : '#e2e8f0'}` }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: school?.two_fa_enabled ? '#dcfce7' : '#eaecef', color: school?.two_fa_enabled ? '#15803d' : '#6b7b86', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    <i className={`fa-solid ${school?.two_fa_enabled ? 'fa-shield-check' : 'fa-shield'}`} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>2FA is currently <strong style={{ color: school?.two_fa_enabled ? '#15803d' : '#6b7b86' }}>{school?.two_fa_enabled ? 'ENABLED' : 'DISABLED'}</strong></div>
                    <div style={{ fontSize: 12, color: '#6b7b86', fontWeight: 700, marginTop: 3 }}>
                      {school?.two_fa_enabled ? 'Every login requires a 6-digit code sent to your email.' : 'Contact your platform administrator to enable 2FA for added security.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={s('panel')}>
              <div className={s('panel-head')}>
                <div>
                  <h2><i className="fa-solid fa-circle-info" style={{ color: '#ff9b51', marginRight: 8 }} />Account Information</h2>
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
                  <div key={label} style={{ padding: '14px 16px', border: '1.5px solid #fed7aa', borderRadius: 12, background: '#fffcf8' }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#6b7b86', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'capitalize' }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Payroll Policy Tab ── */}
        {!loading && tab === 'payroll' && (
          <div className={s('panel')}>
            <PayrollPolicyTab />
          </div>
        )}

        {/* ── Fee Billing Policy Tab ── */}
        {!loading && tab === 'fees' && (
          <div className={s('panel')}>
            <FeeBillingPolicyTab />
          </div>
        )}

      </main>
    </div>
  );
}
