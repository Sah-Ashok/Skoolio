'use client';

import { useState, useEffect } from 'react';
import ImageUpload from '@/components/shared/ImageUpload';
import { useApi } from '@/lib/useApi';
import { apiRequest } from '@/lib/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/toastSlice';
import { setUser } from '@/store/authSlice';
import { Loader, Spinner } from '@/components/shared/Loader';
import styles from './settings.module.css';
import PayrollPolicyTab from '@/components/admin/settings/PayrollPolicyTab';
import FeeBillingPolicyTab from '@/components/admin/settings/FeeBillingPolicyTab';
import FinanceAccountTab from '@/components/admin/settings/FinanceAccountTab';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { useDateFormat } from '@/lib/useDateFormat';

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(' ');

type Tab = 'school' | 'payment' | 'payroll' | 'fees' | 'finance';

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

function BankAccountCard({ account, region, onToggle, onDelete, onEdit }: {
  account: any; region: 'NP' | 'IN' | 'OTHER';
  onToggle: (id: number, is_active: boolean) => void;
  onDelete: (id: number) => void;
  onEdit:   (account: any) => void;
}) {
  return (
    <div className={cx(s('bankCard'), account.is_active && s('bankCardActive'))}>
      <div className={s('bankCardTop')}>
        <div className={s('bankCardLeft')}>
          <div className={s('bankIcon')}>
            <i className="fa-solid fa-building-columns" />
          </div>
          <div>
            <div className={s('bankName')}>{account.bank_name}</div>
            <div className={s('bankSub')}>{account.account_name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className={cx(s('bankStatusBadge'), account.is_active ? s('bankStatusActive') : s('bankStatusInactive'))}>
            {account.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
          <button 
            type="button"
            onClick={() => onEdit(account)} 
            className={cx(s('btn'), s('btnOutline'))}
            style={{ height: 32, padding: '0 10px', fontSize: 12 }}
          >
            <i className="fa-solid fa-pen" /> Edit
          </button>
          <button 
            type="button"
            onClick={() => onToggle(account.id, !account.is_active)} 
            className={cx(s('btn'), s('btnOutline'))}
            style={{ height: 32, padding: '0 10px', fontSize: 12 }}
          >
            {account.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button 
            type="button"
            onClick={() => onDelete(account.id)} 
            style={{ 
              height: 32, width: 32, borderRadius: 8, 
              border: '1px solid #fecaca', background: '#fef2f2', 
              color: '#dc2626', cursor: 'pointer', display: 'flex', 
              alignItems: 'center', justifyContent: 'center' 
            }}
            title="Delete Account"
          >
            <i className="fa-solid fa-trash" />
          </button>
        </div>
      </div>

      <div className={s('bankGrid')}>
        {[
          { label: 'Account Number', val: account.account_number },
          account.branch    && { label: 'Branch', val: account.branch },
          account.ifsc_code && { label: region === 'NP' ? 'SWIFT/Code' : 'IFSC Code', val: account.ifsc_code },
          account.upi_id    && { label: region === 'NP' ? 'eSewa / Khalti' : 'UPI ID', val: account.upi_id },
          account.notes     && { label: 'Notes', val: account.notes },
        ].filter(Boolean).map((item: any) => (
          <div key={item.label} className={s('bankDetailItem')}>
            <div className={s('bankDetailLabel')}>{item.label}</div>
            <div className={s('bankDetailVal')}>{item.val}</div>
          </div>
        ))}
      </div>

      {account.qr_image_url && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <img 
            src={account.qr_image_url} 
            alt="Payment QR" 
            style={{ width: 56, height: 56, objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }} 
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>QR Code / Payment QR</span>
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const dispatch = useAppDispatch();
  const { formatDate } = useDateFormat();
  const [tab, setTab] = useState<Tab>('school');

  // School profile
  const { data: school, loading, refetch: refetchSchool } = useApi<any>('/school/settings');
  const [savingInfo, setSavingInfo] = useState(false);
  const [info, setInfo] = useState({
    school_name: '', school_type: '', established_year: '',
    phone: '', owner_full_name: '', timezone: 'Asia/Kathmandu',
    address: '', city: '', state: '', country: 'Nepal', pincode: '',
    logo: '',
  });

  useEffect(() => {
    if (!school) return;
    setInfo({
      school_name:      school.school_name      ?? '',
      school_type:      school.school_type      ?? '',
      established_year: school.established_year ? String(school.established_year) : '',
      phone:            school.phone            ?? '',
      owner_full_name:  school.owner_full_name  ?? '',
      timezone:         school.timezone         ?? 'Asia/Kathmandu',
      address:          school.address          ?? '',
      city:             school.city             ?? '',
      state:            school.state            ?? '',
      country:          school.country          ?? 'Nepal',
      pincode:          school.pincode          ?? '',
      logo:             school.logo             ?? '',
    });
  }, [school]);

  const region = getCountryRegion(info.country);

  const handleSaveInfo = async () => {
    if (!info.school_name.trim()) {
      return dispatch(showToast({ type: 'error', title: 'Validation', message: 'School name is required.' }));
    }
    setSavingInfo(true);
    try {
      await apiRequest('/school/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...info,
          established_year: info.established_year ? Number(info.established_year) : undefined,
        }),
      });
      dispatch(showToast({ type: 'success', title: 'Settings Saved', message: 'School profile updated successfully.' }));
      refetchSchool();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Save Failed', message: err.message || 'Could not update settings.' }));
    } finally {
      setSavingInfo(false);
    }
  };

  // Bank accounts — fetched on-demand only when Payment Setup tab is selected
  const { data: bankAccounts, loading: bankLoading, refetch: refetchBanks } = useApi<any[]>(
    tab === 'payment' ? '/school/bank-accounts' : "",
    [tab]
  );
  const [showBankForm, setShowBankForm] = useState(false);
  const [editingBank, setEditingBank]   = useState<any | null>(null);
  const [bankForm, setBankForm]         = useState(emptyBankForm);
  const [savingBank, setSavingBank]     = useState(false);

  const openAddBank = () => {
    setEditingBank(null);
    setBankForm(emptyBankForm);
    setShowBankForm(true);
  };

  const openEditBank = (acc: any) => {
    setEditingBank(acc);
    setBankForm({
      bank_name:      acc.bank_name      ?? '',
      account_name:   acc.account_name   ?? '',
      account_number: acc.account_number ?? '',
      branch:         acc.branch         ?? '',
      ifsc_code:      acc.ifsc_code      ?? '',
      upi_id:         acc.upi_id         ?? '',
      qr_image_url:   acc.qr_image_url   ?? '',
      notes:          acc.notes          ?? '',
    });
    setShowBankForm(true);
  };

  const handleSaveBank = async () => {
    if (!bankForm.bank_name.trim() || !bankForm.account_name.trim() || !bankForm.account_number.trim()) {
      return dispatch(showToast({ type: 'error', title: 'Validation', message: 'Bank name, account name, and account number are required.' }));
    }
    setSavingBank(true);
    try {
      if (editingBank) {
        await apiRequest(`/school/bank-accounts/${editingBank.id}`, {
          method: 'PUT',
          body: JSON.stringify(bankForm),
        });
        dispatch(showToast({ type: 'success', title: 'Updated', message: 'Bank account updated.' }));
      } else {
        await apiRequest('/school/bank-accounts', {
          method: 'POST',
          body: JSON.stringify(bankForm),
        });
        dispatch(showToast({ type: 'success', title: 'Added', message: 'Bank account added.' }));
      }
      setShowBankForm(false);
      refetchBanks();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Error', message: err.message || 'Failed to save bank account.' }));
    } finally {
      setSavingBank(false);
    }
  };

  const handleToggleBank = async (id: number, is_active: boolean) => {
    try {
      await apiRequest(`/school/bank-accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active }),
      });
      dispatch(showToast({ type: 'success', title: 'Updated', message: `Account ${is_active ? 'activated' : 'deactivated'}.` }));
      refetchBanks();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Error', message: err.message }));
    }
  };

  const [bankToDeleteId, setBankToDeleteId] = useState<number | null>(null);
  const [showConfirm2FA,  setShowConfirm2FA]  = useState(false);

  const handleDeleteBank = (id: number) => {
    setBankToDeleteId(id);
  };

  const confirmDeleteBank = async () => {
    if (!bankToDeleteId) return;
    try {
      await apiRequest(`/school/bank-accounts/${bankToDeleteId}`, { method: 'DELETE' });
      dispatch(showToast({ type: 'success', title: 'Deleted', message: 'Bank account deleted.' }));
      refetchBanks();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Error', message: err.message }));
    } finally {
      setBankToDeleteId(null);
    }
  };

  const initials = school?.school_name
    ? school.school_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'SC';

  const handleLogoUploaded = (url: string) => {
    setInfo(prev => ({ ...prev, logo: url }));
    dispatch(setUser({ logo: url } as any));
    dispatch(showToast({ type: 'success', title: 'Logo Updated', message: 'School logo has been updated successfully.' }));
  };

  return (
    <div className={s('page')}>
      <main className={s('content')}>
        {/* ── Page Header ── */}
        <section className={s('pageHead')}>
          <div className={s('headLeft')}>
            <div className={s('headIcon')}>
              <i className="fa-solid fa-gear" />
            </div>
            <div>
              <h1>School Settings</h1>
              <p>Manage your institutional profile, branding, payments, and system preferences.</p>
            </div>
          </div>
        </section>

        {/* ── School Profile Hero Card ── */}
        <section className={s('hero')}>
          <div className={s('heroLeft')}>
            <div className={s('schoolLogoWrapper')}>
              <ImageUpload 
                currentUrl={info.logo} 
                endpoint="/upload/logo" 
                onSuccess={handleLogoUploaded} 
                shape="rounded" 
                size={76} 
                initials={initials} 
                label="Change Logo" 
              />
            </div>
            <div className={s('heroDetails')}>
              <span className={s('heroEyebrow')}>Institution Identity</span>
              <h2 className={s('heroTitle')}>{school?.school_name || 'My School'}</h2>
              <div className={s('heroMeta')}>
                <span><i className="fa-regular fa-envelope" style={{ marginRight: 6 }} />{school?.email || '—'}</span>
                {school?.school_code && (
                  <span className={s('codeChip')}>CODE: {school.school_code}</span>
                )}
                {info.school_type && (
                  <span style={{ color: '#ea580c', fontWeight: 800 }}>• {info.school_type.replace('_', ' ')}</span>
                )}
              </div>
            </div>
          </div>

          <div className={s('heroRight')}>
            <div className={s('statChip')}>
              <div className={cx(s('statChipIcon'), s('statChipIconOrange'))}>
                <i className="fa-solid fa-globe" />
              </div>
              <div className={s('statChipText')}>
                <span>Region</span>
                <strong>{info.country || 'India'}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* ── Navigation Pill Tabs ── */}
        <div className={s('tabs')}>
          {([
            ['school',   'fa-school',                'School Info'      ],
            ['payment',  'fa-building-columns',      'Payment Setup'    ],
            ['payroll',  'fa-money-check-dollar',    'Payroll Policy'   ],
            ['fees',     'fa-file-invoice-dollar',   'Fee Billing'      ],
            ['finance',  'fa-calculator',            'Finance Account'  ],
          ] as const).map(([key, icon, label]) => (
            <button 
              key={key} 
              type="button"
              className={cx(s('tab'), tab === key && s('tabActive'))} 
              onClick={() => setTab(key)}
            >
              <i className={`fa-solid ${icon}`} /> {label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
            <Loader fullScreen={false} size="md" text="Loading settings…" />
          </div>
        )}

        {/* ── Tab 1: School Info ── */}
        {!loading && tab === 'school' && (
          <div className={s('panel')}>
            <div className={s('panelHead')}>
              <div className={s('panelHeadTitle')}>
                <i className="fa-solid fa-school" />
                <div>
                  <h2>School Information & Profile</h2>
                  <p>Update official institution contact, location, and administrative details</p>
                </div>
              </div>
            </div>

            <div className={s('formBody')}>
              {/* General Info */}
              <div>
                <div className={s('sectionHeader')}>
                  <i className="fa-solid fa-circle-info" /> Basic Information
                </div>
                <div className={s('formGrid')} style={{ marginTop: 14 }}>
                  <label className={cx(s('field'), s('full'))}>
                    <span>School Name <em>*</em></span>
                    <input 
                      value={info.school_name} 
                      onChange={e => setInfo({ ...info, school_name: e.target.value })} 
                      placeholder="e.g. Sunrise Public School" 
                    />
                  </label>

                  <label className={s('field')}>
                    <span>School Type</span>
                    <select value={info.school_type} onChange={e => setInfo({ ...info, school_type: e.target.value })}>
                      <option value="">— Select Type —</option>
                      {SCHOOL_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </label>

                  <label className={s('field')}>
                    <span>Established Year</span>
                    <input 
                      type="number" 
                      min="1900" 
                      max={new Date().getFullYear() + 10} 
                      value={info.established_year} 
                      onChange={e => setInfo({ ...info, established_year: e.target.value })} 
                      placeholder="e.g. 2056" 
                    />
                  </label>

                  <label className={s('field')}>
                    <span>Owner / Principal Name</span>
                    <input 
                      value={info.owner_full_name} 
                      onChange={e => setInfo({ ...info, owner_full_name: e.target.value })} 
                      placeholder="e.g. Ashok Sharma" 
                    />
                  </label>
                </div>
              </div>

              {/* Contact & Location */}
              <div>
                <div className={s('sectionHeader')}>
                  <i className="fa-solid fa-location-dot" /> Contact & Location
                </div>
                <div className={s('formGrid')} style={{ marginTop: 14 }}>
                  <label className={s('field')}>
                    <span>Phone Number</span>
                    <input 
                      value={info.phone} 
                      onChange={e => setInfo({ ...info, phone: e.target.value })} 
                      placeholder="+977-98XXXXXXXX" 
                    />
                  </label>

                  <label className={s('field')}>
                    <span>Timezone</span>
                    <select value={info.timezone} onChange={e => setInfo({ ...info, timezone: e.target.value })}>
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </label>

                  <label className={s('field')}>
                    <span>City</span>
                    <input 
                      value={info.city} 
                      onChange={e => setInfo({ ...info, city: e.target.value })} 
                      placeholder="e.g. Mirchaiya / Kathmandu" 
                    />
                  </label>

                  <label className={s('field')}>
                    <span>State / Province</span>
                    <input 
                      value={info.state} 
                      onChange={e => setInfo({ ...info, state: e.target.value })} 
                      placeholder="e.g. Siraha / Madhesh" 
                    />
                  </label>

                  <label className={s('field')}>
                    <span>Country</span>
                    <input 
                      value={info.country} 
                      onChange={e => setInfo({ ...info, country: e.target.value })} 
                      placeholder="e.g. Nepal" 
                    />
                  </label>

                  <label className={s('field')}>
                    <span>Pincode / ZIP</span>
                    <input 
                      value={info.pincode} 
                      onChange={e => setInfo({ ...info, pincode: e.target.value })} 
                      placeholder="e.g. 565150" 
                    />
                  </label>
                </div>
              </div>

              {/* Logo URL Direct Input */}
              <div>
                <div className={s('sectionHeader')}>
                  <i className="fa-solid fa-image" /> School Logo & Emblem URL
                </div>
                <div style={{ marginTop: 14 }}>
                  <label className={cx(s('field'), s('full'))}>
                    <span>Logo Image URL (or upload via Change Logo above)</span>
                    <input 
                      value={info.logo} 
                      onChange={e => setInfo({ ...info, logo: e.target.value })} 
                      placeholder="https://your-school.com/logo.png" 
                    />
                  </label>
                  <small style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginTop: 4, display: 'block' }}>
                    Click "Change Logo" on the top emblem badge to upload directly from your device (JPEG/PNG/WebP, max 2 MB).
                  </small>
                </div>
              </div>
            </div>

            {/* Read-only Meta Info Row */}
            <div className={s('infoGrid')}>
              <div className={s('infoCard')}>
                <span className={s('infoCardLabel')}>Registered Email</span>
                <span className={s('infoCardValue')}>{school?.email || '—'}</span>
              </div>
              <div className={s('infoCard')}>
                <span className={s('infoCardLabel')}>Unique School Code</span>
                <span className={s('infoCardValue')}>{school?.school_code || '—'}</span>
              </div>
              <div className={s('infoCard')}>
                <span className={s('infoCardLabel')}>Account Status</span>
                <span className={s('infoCardValue')} style={{ textTransform: 'capitalize' }}>{school?.is_account || 'Active'}</span>
              </div>
            </div>

            {/* Form Footer */}
            <div className={s('formActions')}>
              <button 
                className={cx(s('btn'), s('btnPrimary'))} 
                onClick={handleSaveInfo} 
                disabled={savingInfo}
              >
                {savingInfo ? <><Spinner size={14} color="#fff" /> Saving…</> : <><i className="fa-solid fa-check" /> Save Changes</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Tab 2: Payment Setup ── */}
        {!loading && tab === 'payment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ padding: '16px 20px', borderRadius: 12, background: '#fff7ed', border: '1px solid #fed7aa', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <i className="fa-solid fa-circle-info" style={{ color: '#ea580c', marginTop: 2, fontSize: 16, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 900, color: '#9a3412', marginBottom: 3 }}>How Online Payments Work</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9a3412', lineHeight: 1.6 }}>
                  Add your school bank accounts and digital payment receivers below. Students will see active payment methods on their fee portal.
                  {region === 'NP' && ' Supports eSewa, Khalti, ConnectIPS, and Bank QR for Nepal.'}
                  {region === 'IN' && ' Supports UPI ID, QR, and IFSC codes for India.'}
                </div>
              </div>
            </div>

            <div className={s('panel')}>
              <div className={s('panelHead')}>
                <div className={s('panelHeadTitle')}>
                  <i className="fa-solid fa-building-columns" />
                  <div>
                    <h2>Active Bank Accounts</h2>
                    <p>Accounts visible to students for online fee submissions</p>
                  </div>
                </div>
                <button className={cx(s('btn'), s('btnPrimary'))} onClick={openAddBank}>
                  <i className="fa-solid fa-plus" /> Add Account
                </button>
              </div>

              <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {bankLoading && (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                    <Loader fullScreen={false} size="sm" text="Loading bank accounts…" />
                  </div>
                )}
                {!bankLoading && (!bankAccounts || bankAccounts.length === 0) && (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    <i className="fa-solid fa-building-columns" style={{ fontSize: 36, display: 'block', marginBottom: 10, opacity: 0.3 }} />
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#475569' }}>No bank accounts added yet.</div>
                    <div style={{ fontSize: 12.5, marginTop: 4 }}>Add your school bank account so students can pay fees online.</div>
                  </div>
                )}
                {(bankAccounts ?? []).map((acc: any) => (
                  <BankAccountCard 
                    key={acc.id} 
                    account={acc} 
                    region={region} 
                    onToggle={handleToggleBank} 
                    onDelete={handleDeleteBank} 
                    onEdit={openEditBank} 
                  />
                ))}
              </div>
            </div>

            {showBankForm && (
              <div className={s('panel')}>
                <div className={s('panelHead')}>
                  <div className={s('panelHeadTitle')}>
                    <i className="fa-solid fa-plus" />
                    <div>
                      <h2>{editingBank ? 'Edit Bank Account' : 'Add Bank Account'}</h2>
                      <p>Fill in account details and digital payment options</p>
                    </div>
                  </div>
                  <button className={cx(s('btn'), s('btnOutline'))} onClick={() => setShowBankForm(false)}>
                    <i className="fa-solid fa-xmark" /> Cancel
                  </button>
                </div>

                <div className={s('formBody')}>
                  <div className={s('formGrid')}>
                    <label className={s('field')}>
                      <span>Bank Name <em>*</em></span>
                      <input 
                        value={bankForm.bank_name} 
                        onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })}
                        placeholder={region === 'NP' ? 'e.g. Nepal Investment Mega Bank' : 'e.g. State Bank of India'} 
                      />
                    </label>

                    <label className={s('field')}>
                      <span>Account Name <em>*</em></span>
                      <input 
                        value={bankForm.account_name} 
                        onChange={e => setBankForm({ ...bankForm, account_name: e.target.value })} 
                        placeholder="Name on account (e.g. Nepal Test School)" 
                      />
                    </label>

                    <label className={s('field')}>
                      <span>Account Number <em>*</em></span>
                      <input 
                        value={bankForm.account_number} 
                        onChange={e => setBankForm({ ...bankForm, account_number: e.target.value })} 
                        placeholder="Account number" 
                      />
                    </label>

                    {region !== 'IN' && (
                      <label className={s('field')}>
                        <span>Branch Name</span>
                        <input 
                          value={bankForm.branch} 
                          onChange={e => setBankForm({ ...bankForm, branch: e.target.value })} 
                          placeholder="e.g. Mirchaiya Branch" 
                        />
                      </label>
                    )}

                    {region === 'IN' && (
                      <label className={s('field')}>
                        <span>IFSC Code</span>
                        <input 
                          value={bankForm.ifsc_code} 
                          onChange={e => setBankForm({ ...bankForm, ifsc_code: e.target.value })} 
                          placeholder="e.g. SBIN0001234" 
                        />
                      </label>
                    )}

                    <label className={s('field')}>
                      <span>{region === 'NP' ? 'eSewa / Khalti Number' : 'UPI ID'}</span>
                      <input 
                        value={bankForm.upi_id} 
                        onChange={e => setBankForm({ ...bankForm, upi_id: e.target.value })}
                        placeholder={region === 'NP' ? 'e.g. 98XXXXXXXX (eSewa)' : 'e.g. school@upi'} 
                      />
                    </label>

                    <label className={s('field')}>
                      <span>QR Code Image URL</span>
                      <input 
                        value={bankForm.qr_image_url} 
                        onChange={e => setBankForm({ ...bankForm, qr_image_url: e.target.value })} 
                        placeholder="https://… (paste direct QR image link)" 
                      />
                    </label>

                    <label className={cx(s('field'), s('full'))}>
                      <span>Notes / Instructions for Students</span>
                      <input 
                        value={bankForm.notes} 
                        onChange={e => setBankForm({ ...bankForm, notes: e.target.value })}
                        placeholder="e.g. Write student admission roll number in payment remarks." 
                      />
                    </label>
                  </div>
                </div>

                <div className={s('formActions')}>
                  <button className={cx(s('btn'), s('btnOutline'))} onClick={() => setShowBankForm(false)}>
                    Cancel
                  </button>
                  <button 
                    className={cx(s('btn'), s('btnPrimary'))} 
                    onClick={handleSaveBank} 
                    disabled={savingBank}
                  >
                    {savingBank ? <><Spinner size={14} color="#fff" /> Saving…</> : <><i className="fa-solid fa-check" /> {editingBank ? 'Update Account' : 'Save Account'}</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 3: Payroll Policy ── */}
        {!loading && tab === 'payroll' && (
          <div className={s('panel')}>
            <PayrollPolicyTab />
          </div>
        )}

        {/* ── Tab 4: Fee Billing Policy ── */}
        {!loading && tab === 'fees' && (
          <div className={s('panel')}>
            <FeeBillingPolicyTab />
          </div>
        )}

        {/* ── Tab 5: Finance Account ── */}
        {!loading && tab === 'finance' && (
          <div className={s('panel')}>
            <FinanceAccountTab />
          </div>
        )}

        {/* ── Confirmation Modals ── */}
        <ConfirmModal
          isOpen={bankToDeleteId !== null}
          onClose={() => setBankToDeleteId(null)}
          onConfirm={confirmDeleteBank}
          title="Delete Bank Account?"
          message="Are you sure you want to permanently delete this bank account? This action cannot be undone."
          confirmText="Delete Account"
          confirmVariant="danger"
          icon="fa-trash-can"
        />
      </main>
    </div>
  );
}
