// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Template Variable Builders
// Used with Azure Communication Services WhatsApp channel (Plus schools only)
//
// Template body text lives in Meta Business Manager — NOT here.
// This file only maps trigger data → { templateName, variables[] }
// Variables are ordered to match {{1}}, {{2}} ... as registered in Meta.
// ─────────────────────────────────────────────────────────────────────────────

export type WhatsAppTrigger =
  | 'fee_reminder'
  | 'payment_confirmation'
  | 'attendance_summary'
  | 'exam_result'
  | 'announcement';

// ─── Shared student/school context ───────────────────────────────────────────
export interface StudentContext {
  student_name:   string;   // e.g. "Sita Sharma"
  class_name:     string;   // e.g. "Class 8"
  section_name:   string;   // e.g. "A"
  school_name:    string;   // e.g. "Sunshine Academy"
  guardian_name:  string;   // e.g. "Ram Sharma"
  guardian_phone: string;   // e.g. "+977-9812345678"
}

// ─── Per-trigger payload types ───────────────────────────────────────────────
export interface FeeReminderPayload {
  fee_name:        string;   // e.g. "Tuition Fee"
  amount:          string;   // e.g. "Rs. 3,500"
  due_date:        string;   // e.g. "2082-05-15"
  months_overdue?: number;   // present = overdue reminder
}

export interface PaymentConfirmationPayload {
  fee_name:          string;   // e.g. "Tuition Fee"
  paid_amount:       string;   // e.g. "Rs. 3,500"
  payment_date:      string;   // e.g. "2082-05-10"
  receipt_number:    string;   // e.g. "RCP-2026-00142"
  payment_method:    string;   // e.g. "Cash"
  remaining_amount?: string;   // present = partial payment
}

export interface AttendanceSummaryPayload {
  month_name:          string;   // e.g. "Shrawan 2082"
  total_days:          number;   // e.g. 26
  present_days:        number;   // e.g. 22
  absent_days:         number;   // e.g. 4
  attendance_percent:  string;   // e.g. "84.6%"
}

export interface ExamResultPayload {
  exam_name:       string;   // e.g. "First Terminal Examination"
  marks_obtained:  number;   // e.g. 423
  total_marks:     number;   // e.g. 500
  percentage:      string;   // e.g. "84.6%"
  grade:           string;   // e.g. "A"
  gpa:             string;   // e.g. "3.6"
  is_passed:       boolean;
  rank?:           number;   // e.g. 3
}

export interface AnnouncementPayload {
  title:       string;   // e.g. "School Closed Tomorrow"
  message:     string;   // e.g. "Due to local elections..."
  expires_at?: string;   // e.g. "2082-05-20"
}

// ─── Output shape sent to ACS WhatsApp channel ───────────────────────────────
export interface WhatsAppTemplateOutput {
  templateName: string;
  variables:    string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDERS — each returns templateName + variables only
// ─────────────────────────────────────────────────────────────────────────────

// 1. Fee Reminder → Meta template: skoolio_fee_reminder
// {{1}} guardian_name  {{2}} fee_name  {{3}} amount  {{4}} due_date
// {{5}} student_name   {{6}} class-section  {{7}} school_name
export function buildFeeReminderWA(
  ctx: StudentContext,
  payload: FeeReminderPayload
): WhatsAppTemplateOutput {
  return {
    templateName: 'skoolio_fee_reminder',
    variables: [
      ctx.guardian_name,
      payload.fee_name,
      payload.amount,
      payload.due_date,
      ctx.student_name,
      `${ctx.class_name}-${ctx.section_name}`,
      ctx.school_name,
    ],
  };
}

// 2. Payment Confirmation → Meta template: skoolio_payment_confirmation
// {{1}} guardian_name  {{2}} paid_amount  {{3}} fee_name  {{4}} payment_date
// {{5}} receipt_number {{6}} payment_method  {{7}} student_name
// {{8}} class-section  {{9}} remaining note  {{10}} school_name
export function buildPaymentConfirmationWA(
  ctx: StudentContext,
  payload: PaymentConfirmationPayload
): WhatsAppTemplateOutput {
  return {
    templateName: 'skoolio_payment_confirmation',
    variables: [
      ctx.guardian_name,
      payload.paid_amount,
      payload.fee_name,
      payload.payment_date,
      payload.receipt_number,
      payload.payment_method,
      ctx.student_name,
      `${ctx.class_name}-${ctx.section_name}`,
      payload.remaining_amount
        ? `Remaining due: ${payload.remaining_amount}`
        : 'Account is fully cleared. Thank you!',
      ctx.school_name,
    ],
  };
}

// 3. Monthly Attendance Summary → Meta template: skoolio_attendance_summary
// {{1}} month_name  {{2}} student_name  {{3}} class-section
// {{4}} total_days  {{5}} present_days  {{6}} absent_days
// {{7}} attendance_percent  {{8}} school_name
export function buildAttendanceSummaryWA(
  ctx: StudentContext,
  payload: AttendanceSummaryPayload
): WhatsAppTemplateOutput {
  return {
    templateName: 'skoolio_attendance_summary',
    variables: [
      payload.month_name,
      ctx.student_name,
      `${ctx.class_name}-${ctx.section_name}`,
      String(payload.total_days),
      String(payload.present_days),
      String(payload.absent_days),
      payload.attendance_percent,
      ctx.school_name,
    ],
  };
}

// 4. Exam Result → Meta template: skoolio_exam_result
// {{1}} guardian_name  {{2}} exam_name  {{3}} student_name  {{4}} class-section
// {{5}} marks_obtained  {{6}} total_marks  {{7}} percentage
// {{8}} grade  {{9}} gpa  {{10}} PASSED/FAILED  {{11}} rank or ''  {{12}} school_name
export function buildExamResultWA(
  ctx: StudentContext,
  payload: ExamResultPayload
): WhatsAppTemplateOutput {
  return {
    templateName: 'skoolio_exam_result',
    variables: [
      ctx.guardian_name,
      payload.exam_name,
      ctx.student_name,
      `${ctx.class_name}-${ctx.section_name}`,
      String(payload.marks_obtained),
      String(payload.total_marks),
      payload.percentage,
      payload.grade,
      payload.gpa,
      payload.is_passed ? 'PASSED' : 'FAILED',
      payload.rank ? `Rank: ${payload.rank}` : '',
      ctx.school_name,
    ],
  };
}

// 5. Announcement → Meta template: skoolio_announcement
// {{1}} title  {{2}} message  {{3}} expiry note or ''  {{4}} school_name
export function buildAnnouncementWA(
  ctx: StudentContext,
  payload: AnnouncementPayload
): WhatsAppTemplateOutput {
  return {
    templateName: 'skoolio_announcement',
    variables: [
      payload.title,
      payload.message,
      payload.expires_at ? `Valid until: ${payload.expires_at}` : '',
      ctx.school_name,
    ],
  };
}
