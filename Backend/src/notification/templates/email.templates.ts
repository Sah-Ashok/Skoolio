// ─────────────────────────────────────────────────────────────────────────────
// Email Templates — HTML
// Used with Azure Communication Services Email (all schools)
// Consistent with existing emailService.ts brand style:
//   Primary dark:  #25343F  /  #314653
//   Accent orange: #FF9B51  /  #e87a2f
//   Light bg:      #f1f5f9
// ─────────────────────────────────────────────────────────────────────────────

import type {
  StudentContext,
  FeeReminderPayload,
  PaymentConfirmationPayload,
  AttendanceSummaryPayload,
  ExamResultPayload,
  AnnouncementPayload,
} from './whatsapp.templates';

// ─── Shared HTML helpers ─────────────────────────────────────────────────────
function emailShell(schoolName: string, badgeText: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:40px 20px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(37,52,63,0.13);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#25343F,#314653);padding:28px 36px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:46px;height:46px;background:linear-gradient(135deg,#FF9B51,#e87a2f);border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0;">🎓</div>
        <div>
          <div style="color:#EAEFEF;font-size:19px;font-weight:800;letter-spacing:-0.4px;">${schoolName}</div>
          <div style="color:#7a96a6;font-size:11.5px;font-weight:600;margin-top:2px;">Powered by Skoolio</div>
        </div>
      </div>
    </div>

    <!-- Badge + Body -->
    <div style="padding:36px;">
      <div style="display:inline-block;padding:5px 13px;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;font-size:11.5px;font-weight:700;color:#c2410c;margin-bottom:20px;">
        ${badgeText}
      </div>
      ${bodyHtml}
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:11.5px;">© ${new Date().getFullYear()} ${schoolName} · Powered by <a href="https://skoolio.in" style="color:#FF9B51;text-decoration:none;">Skoolio</a></p>
    </div>
  </div>
</body>
</html>`;
}

function studentBadge(ctx: StudentContext): string {
  return `<div style="background:#f8fafc;border-radius:12px;padding:14px 18px;margin-bottom:24px;border-left:3px solid #FF9B51;">
    <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">Student</span><br/>
    <span style="color:#1e293b;font-size:15px;font-weight:800;">${ctx.student_name}</span>
    <span style="color:#64748b;font-size:13px;"> · ${ctx.class_name}-${ctx.section_name}</span>
  </div>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;width:140px;">${label}</td>
    <td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:700;">${value}</td>
  </tr>`;
}

function infoTable(rows: string): string {
  return `<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:14px;padding:0;margin-bottom:24px;">
    <tbody style="display:block;padding:16px 20px;">${rows}</tbody>
  </table>`;
}

// ─── 1. Fee Reminder ─────────────────────────────────────────────────────────
export interface FeeReminderEmailOutput {
  subject: string;
  html: string;
}

export function buildFeeReminderEmail(
  ctx: StudentContext,
  payload: FeeReminderPayload
): FeeReminderEmailOutput {
  const isOverdue = (payload.months_overdue ?? 0) > 0;
  const subject = isOverdue
    ? `⚠️ Fee Overdue: ${payload.fee_name} — ${ctx.student_name}`
    : `💰 Fee Reminder: ${payload.fee_name} — ${ctx.student_name}`;

  const alertBox = isOverdue
    ? `<div style="padding:14px 18px;background:#fff1f2;border:1px solid #fecdd3;border-left:3px solid #ef4444;border-radius:10px;margin-bottom:24px;">
        <p style="margin:0;color:#be123c;font-size:13px;font-weight:700;">⚠️ This fee is ${payload.months_overdue} month(s) overdue. Late fines may apply.</p>
      </div>`
    : `<div style="padding:14px 18px;background:#fff7ed;border:1px solid #fed7aa;border-left:3px solid #f97316;border-radius:10px;margin-bottom:24px;">
        <p style="margin:0;color:#9a3412;font-size:13px;font-weight:700;">📅 Please pay before the due date to avoid late fines.</p>
      </div>`;

  const bodyHtml = `
    <h2 style="margin:0 0 6px;color:#1e293b;font-size:22px;font-weight:800;">${isOverdue ? '⚠️ Fee Overdue' : '💰 Fee Due Reminder'}</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.7;">Dear ${ctx.guardian_name}, this is a reminder about a pending fee for your child.</p>
    ${studentBadge(ctx)}
    ${infoTable(
      infoRow('Fee Name', payload.fee_name) +
      infoRow('Amount Due', `<strong style="color:#ef4444;">${payload.amount}</strong>`) +
      infoRow('Due Date', payload.due_date) +
      (isOverdue ? infoRow('Overdue By', `${payload.months_overdue} month(s)`) : '')
    )}
    ${alertBox}
    <p style="margin:0;color:#94a3b8;font-size:12.5px;line-height:1.65;">Please visit the school office or your school portal to make the payment. If already paid, please ignore this message.</p>`;

  return { subject, html: emailShell(ctx.school_name, '💰 Fee Reminder', bodyHtml) };
}

// ─── 2. Payment Confirmation ─────────────────────────────────────────────────
export interface PaymentConfirmationEmailOutput {
  subject: string;
  html: string;
}

export function buildPaymentConfirmationEmail(
  ctx: StudentContext,
  payload: PaymentConfirmationPayload
): PaymentConfirmationEmailOutput {
  const subject = `✅ Payment Confirmed: ${payload.fee_name} — ${ctx.student_name}`;

  const remainingNote = payload.remaining_amount
    ? `<div style="padding:14px 18px;background:#fff7ed;border:1px solid #fed7aa;border-left:3px solid #f97316;border-radius:10px;margin-bottom:24px;">
        <p style="margin:0;color:#9a3412;font-size:13px;font-weight:700;">⚠️ Partial payment received. Remaining due: <strong>${payload.remaining_amount}</strong></p>
      </div>`
    : `<div style="padding:14px 18px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:3px solid #22c55e;border-radius:10px;margin-bottom:24px;">
        <p style="margin:0;color:#15803d;font-size:13px;font-weight:700;">✅ Account fully cleared. Thank you!</p>
      </div>`;

  const bodyHtml = `
    <h2 style="margin:0 0 6px;color:#1e293b;font-size:22px;font-weight:800;">✅ Payment Confirmed</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.7;">Dear ${ctx.guardian_name}, we have successfully received your payment.</p>
    ${studentBadge(ctx)}
    ${infoTable(
      infoRow('Fee Name', payload.fee_name) +
      infoRow('Amount Paid', `<strong style="color:#16a34a;">${payload.paid_amount}</strong>`) +
      infoRow('Payment Date', payload.payment_date) +
      infoRow('Receipt No.', `<strong>${payload.receipt_number}</strong>`) +
      infoRow('Payment Mode', payload.payment_method) +
      (payload.remaining_amount ? infoRow('Remaining Due', `<strong style="color:#ef4444;">${payload.remaining_amount}</strong>`) : '')
    )}
    ${remainingNote}
    <p style="margin:0;color:#94a3b8;font-size:12.5px;line-height:1.65;">Please keep your receipt number for future reference. Contact the school office if you have any queries.</p>`;

  return { subject, html: emailShell(ctx.school_name, '💳 Payment Confirmation', bodyHtml) };
}

// ─── 3. Monthly Attendance Summary ───────────────────────────────────────────
export interface AttendanceSummaryEmailOutput {
  subject: string;
  html: string;
}

export function buildAttendanceSummaryEmail(
  ctx: StudentContext,
  payload: AttendanceSummaryPayload
): AttendanceSummaryEmailOutput {
  const subject = `📊 Attendance Report — ${ctx.student_name} | ${payload.month_name}`;

  // Colour-code attendance bar
  const pct = parseFloat(payload.attendance_percent);
  const barColor = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f97316' : '#ef4444';
  const statusLabel = pct >= 80 ? '✅ Good Standing' : pct >= 60 ? '⚠️ Needs Improvement' : '❌ Critical — Immediate Attention Required';
  const statusBg    = pct >= 80 ? '#f0fdf4' : pct >= 60 ? '#fff7ed' : '#fff1f2';
  const statusBorder= pct >= 80 ? '#22c55e' : pct >= 60 ? '#f97316' : '#ef4444';
  const statusText  = pct >= 80 ? '#15803d' : pct >= 60 ? '#9a3412'  : '#be123c';

  const bodyHtml = `
    <h2 style="margin:0 0 6px;color:#1e293b;font-size:22px;font-weight:800;">📊 Monthly Attendance Report</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.7;">Dear ${ctx.guardian_name}, here is the attendance summary for <strong>${payload.month_name}</strong>.</p>
    ${studentBadge(ctx)}
    ${infoTable(
      infoRow('Month', payload.month_name) +
      infoRow('School Days', String(payload.total_days)) +
      infoRow('Present', `<strong style="color:#16a34a;">${payload.present_days} days</strong>`) +
      infoRow('Absent', `<strong style="color:#ef4444;">${payload.absent_days} days</strong>`) +
      infoRow('Attendance', `<strong style="color:${barColor};">${payload.attendance_percent}</strong>`)
    )}
    <!-- Progress bar -->
    <div style="margin-bottom:24px;">
      <div style="height:10px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${payload.attendance_percent};background:${barColor};border-radius:99px;"></div>
      </div>
    </div>
    <div style="padding:14px 18px;background:${statusBg};border:1px solid ${statusBorder};border-left:3px solid ${statusBorder};border-radius:10px;margin-bottom:24px;">
      <p style="margin:0;color:${statusText};font-size:13px;font-weight:700;">${statusLabel}</p>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:12.5px;line-height:1.65;">Regular attendance is essential for academic progress. Please contact the class teacher if your child was absent due to medical reasons.</p>`;

  return { subject, html: emailShell(ctx.school_name, '📊 Attendance Summary', bodyHtml) };
}

// ─── 4. Exam Result ──────────────────────────────────────────────────────────
export interface ExamResultEmailOutput {
  subject: string;
  html: string;
}

export function buildExamResultEmail(
  ctx: StudentContext,
  payload: ExamResultPayload
): ExamResultEmailOutput {
  const subject = `📝 Result Published: ${payload.exam_name} — ${ctx.student_name}`;

  const pct = parseFloat(payload.percentage);
  const resultBg     = payload.is_passed ? '#f0fdf4' : '#fff1f2';
  const resultBorder = payload.is_passed ? '#22c55e' : '#ef4444';
  const resultText   = payload.is_passed ? '#15803d' : '#be123c';
  const resultLabel  = payload.is_passed ? '✅ PASSED' : '❌ FAILED';

  const bodyHtml = `
    <h2 style="margin:0 0 6px;color:#1e293b;font-size:22px;font-weight:800;">📝 Exam Result Published</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.7;">Dear ${ctx.guardian_name}, the results for <strong>${payload.exam_name}</strong> have been published.</p>
    ${studentBadge(ctx)}
    ${infoTable(
      infoRow('Exam', payload.exam_name) +
      infoRow('Marks Obtained', `<strong>${payload.marks_obtained} / ${payload.total_marks}</strong>`) +
      infoRow('Percentage', `<strong style="color:#25343F;">${payload.percentage}</strong>`) +
      infoRow('Grade', `<strong>${payload.grade}</strong>`) +
      infoRow('GPA', payload.gpa) +
      (payload.rank ? infoRow('Class Rank', `🏆 ${payload.rank}`) : '')
    )}
    <div style="padding:16px 20px;background:${resultBg};border:1px solid ${resultBorder};border-left:3px solid ${resultBorder};border-radius:10px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;color:${resultText};font-size:18px;font-weight:800;">${resultLabel}</p>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:12.5px;line-height:1.65;">For detailed subject-wise marks, please visit the school portal or contact the class teacher.</p>`;

  return { subject, html: emailShell(ctx.school_name, '📝 Exam Result', bodyHtml) };
}

// ─── 5. School Announcement ──────────────────────────────────────────────────
export interface AnnouncementEmailOutput {
  subject: string;
  html: string;
}

export function buildAnnouncementEmail(
  ctx: StudentContext,
  payload: AnnouncementPayload
): AnnouncementEmailOutput {
  const subject = `📢 ${payload.title} — ${ctx.school_name}`;

  const expiryRow = payload.expires_at
    ? `<div style="margin-top:20px;padding:10px 16px;background:#f8fafc;border-radius:8px;">
        <span style="color:#94a3b8;font-size:12px;font-weight:700;">VALID UNTIL: </span>
        <span style="color:#1e293b;font-size:13px;font-weight:700;">${payload.expires_at}</span>
      </div>`
    : '';

  const bodyHtml = `
    <h2 style="margin:0 0 6px;color:#1e293b;font-size:22px;font-weight:800;">📢 ${payload.title}</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.7;">Dear ${ctx.guardian_name},</p>
    <div style="background:#f8fafc;border-left:3px solid #FF9B51;border-radius:0 12px 12px 0;padding:20px 24px;color:#334155;font-size:14px;line-height:1.8;white-space:pre-wrap;margin-bottom:24px;">${payload.message}</div>
    ${expiryRow}
    <p style="margin-top:24px;color:#94a3b8;font-size:12.5px;line-height:1.65;">This announcement is for ${ctx.student_name} (${ctx.class_name}-${ctx.section_name}). For queries, please contact the school directly.</p>`;

  return { subject, html: emailShell(ctx.school_name, '📢 Announcement', bodyHtml) };
}
