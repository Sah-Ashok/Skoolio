"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "../../../components/super-admin/sa.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

const s = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

export default function SuperAdminSubscriptionPlansPage() {
  const { data: plans, loading, refetch } = useApi<any[]>('/subscriptions/plans/all');
  const [editingPlan, setEditingPlan] = useState<any | null>(null);

  return (
    <div className={s("sa-page")}>
      <Topbar title="Subscription Plans" subtitle="Manage Free, Pro, and Plus plan definitions" />
      <main className={s("page-content")}>
        <div className={s("page-head")}>
          <div>
            <h1>Subscription Plans</h1>
            <p>Editing a plan here updates the limits and pricing for every school currently on that plan.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner size={32} color="#FF9B51" /></div>
        ) : (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            {plans?.map((plan) => (
              <article key={plan.id} className={s("plan-card")} style={{ opacity: plan.is_active ? 1 : 0.55 }}>
                <p className={s("plan-kicker")}>{plan.name}</p>
                {!plan.is_active && (
                  <span style={{ display: 'inline-block', marginBottom: '6px' }} className={cx(s("badge"), s("badge-red"))}>Inactive</span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '10px 0' }}>
                  <Row label="Max Students" value={plan.max_students ?? 'Unlimited'} />
                  <Row label="Max Teachers" value={plan.max_teachers ?? 'Unlimited'} />
                  <Row label="Fee Management" value={plan.fee_management_enabled ? 'Enabled' : 'Disabled'} />
                  <Row label="NPR Monthly" value={`Rs ${plan.price_npr_monthly}`} />
                  <Row label="NPR Yearly" value={`Rs ${plan.price_npr_yearly}`} />
                  <Row label="INR Monthly" value={`\u20b9 ${plan.price_inr_monthly}`} />
                  <Row label="INR Yearly" value={`\u20b9 ${plan.price_inr_yearly}`} />
                </div>
                <button className={cx(s("btn"), s("btn-primary"))} onClick={() => setEditingPlan(plan)}>
                  <i className="fa-solid fa-pen" /> Edit Plan
                </button>
              </article>
            ))}
          </section>
        )}
      </main>

      {editingPlan && (
        <EditPlanModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={() => { setEditingPlan(null); refetch(); }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
      <span style={{ color: '#6b7b86' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EditPlanModal({ plan, onClose, onSaved }: { plan: any; onClose: () => void; onSaved: () => void; }) {
  const dispatch = useAppDispatch();
  const { execute: updatePlan, loading } = useMutation(`/subscriptions/plans/${plan.id}`, 'PATCH');

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' };

  const [form, setForm] = useState({
    max_students: plan.max_students ?? "",
    max_teachers: plan.max_teachers ?? "",
    fee_management_enabled: plan.fee_management_enabled,
    price_npr_monthly: plan.price_npr_monthly,
    price_npr_yearly: plan.price_npr_yearly,
    price_inr_monthly: plan.price_inr_monthly,
    price_inr_yearly: plan.price_inr_yearly,
    is_active: plan.is_active,
  });

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      await updatePlan({
        max_students: form.max_students === "" ? null : Number(form.max_students),
        max_teachers: form.max_teachers === "" ? null : Number(form.max_teachers),
        fee_management_enabled: form.fee_management_enabled,
        price_npr_monthly: Number(form.price_npr_monthly),
        price_npr_yearly: Number(form.price_npr_yearly),
        price_inr_monthly: Number(form.price_inr_monthly),
        price_inr_yearly: Number(form.price_inr_yearly),
        is_active: form.is_active,
      });
      dispatch(showToast({ type: 'success', title: 'Saved', message: `${plan.name} plan updated successfully.` }));
      onSaved();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Error', message: err.message || 'Failed to update plan' }));
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>Edit {plan.name} Plan</h2>

        <div style={{ display: 'grid', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Max Students (blank = unlimited)">
              <input type="number" value={form.max_students} onChange={(e) => handleChange('max_students', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Max Teachers (blank = unlimited)">
              <input type="number" value={form.max_teachers} onChange={(e) => handleChange('max_teachers', e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 700 }}>
            <input type="checkbox" checked={form.fee_management_enabled} onChange={(e) => handleChange('fee_management_enabled', e.target.checked)} />
            Fee Management Enabled
          </label>

          <p style={{ fontSize: '12px', fontWeight: 800, color: '#6b7b86', marginTop: '4px' }}>NEPAL PRICING (NPR)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Monthly"><input type="number" value={form.price_npr_monthly} onChange={(e) => handleChange('price_npr_monthly', e.target.value)} style={inputStyle} /></Field>
            <Field label="Yearly"><input type="number" value={form.price_npr_yearly} onChange={(e) => handleChange('price_npr_yearly', e.target.value)} style={inputStyle} /></Field>
          </div>

          <p style={{ fontSize: '12px', fontWeight: 800, color: '#6b7b86', marginTop: '4px' }}>INDIA PRICING (INR)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Monthly"><input type="number" value={form.price_inr_monthly} onChange={(e) => handleChange('price_inr_monthly', e.target.value)} style={inputStyle} /></Field>
            <Field label="Yearly"><input type="number" value={form.price_inr_yearly} onChange={(e) => handleChange('price_inr_yearly', e.target.value)} style={inputStyle} /></Field>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 700 }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => handleChange('is_active', e.target.checked)} />
            Plan is Active (visible to schools)
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button className={cx(s("btn"), s("btn-soft"))} onClick={onClose}>Cancel</button>
          <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size={16} /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '4px' }}>
      <span style={{ fontSize: '12px', fontWeight: 700 }}>{label}</span>
      <div style={{ display: 'contents' }}>{children}</div>
    </label>
  );
}
