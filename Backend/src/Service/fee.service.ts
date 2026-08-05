import pool from '../config/db';
import {
  createFeeStructure, getFeeStructuresByClass, getFeeStructureById,
  updateFeeStructure, deleteFeeStructure,
  createFeeCollection, getFeeCollectionsByStudent, getFeeCollectionsBySchool,
  getFeeCollectionById, updateFeeCollection,
  createFeePaymentAtomic, getPaymentsByCollection, getPaymentsByStudent,
  getTransportFeeForPeriod, getTransportFeeSummary,
  getHostelFeeForPeriod, getHostelFeeSummary,
  getAcademicFeeForPeriod,
  getPaymentWithDetails,
  waiveFeeCollection,
  getYearlyFeeForAcademicYear,
  assignOneTimeFees,
  getMonthlyBillingStatus,
} from '../Repositories/fee.repository';
import {
  ICreateFeeStructure, IUpdateFeeStructure,
  ICreateFeeCollection, IUpdateFeeCollection, ICreateFeePayment,
} from '../types/fee.types';
import { getStudentById, getEnrollmentsBySchool } from '../Repositories/student.repository';
import { IStudentEnrollmentWithStudent } from '../types/student.types';
import { getAssignmentByStudent, getAssignmentsByRoute, getRoutesBySchool } from '../Repositories/transport.repository';
import { getAssignmentByStudent as getHostelAssignmentByStudent, getAssignmentsByHostel, getHostelsBySchool } from '../Repositories/hostel.repository';
import { assertFeeManagementEnabled } from './subscription.service';
import { getFeeBillingPolicy } from '../Repositories/fee_billing_policy.repository';
import AppError from '../utils/AppError';
import { getAcademicYearById } from '../Repositories/academic.repository';

const validateFeeStructure = (data: ICreateFeeStructure | IUpdateFeeStructure) => {
  const validFrequencies = new Set(['monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time']);
  if (data.amount !== undefined && (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0)) {
    throw new AppError('Fee amount must be greater than zero.', 400);
  }
  if (data.frequency !== undefined && !validFrequencies.has(data.frequency)) {
    throw new AppError('Invalid fee frequency.', 400);
  }
  if (data.due_date_type !== undefined && !['fixed_day', 'admission_date'].includes(data.due_date_type)) {
    throw new AppError('Invalid due date type.', 400);
  }
  if (data.due_day !== undefined && (!Number.isInteger(Number(data.due_day)) || Number(data.due_day) < 1 || Number(data.due_day) > 31)) {
    throw new AppError('Due day must be between 1 and 31.', 400);
  }
};

const assertBillingMonthInAcademicYear = async (school_id: number, academic_year_id: number, billing_month: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billing_month)) {
    throw new AppError('billing_month must use YYYY-MM.', 400);
  }
  const year = await getAcademicYearById(academic_year_id, school_id);
  if (!year) throw new AppError('Academic year not found.', 404);
  const billingDate = new Date(`${billing_month}-01T00:00:00`);
  const start = new Date(`${String(year.start_date).slice(0, 10)}T00:00:00`);
  const end = new Date(`${String(year.end_date).slice(0, 10)}T23:59:59`);
  if (billingDate < new Date(start.getFullYear(), start.getMonth(), 1) || billingDate > end) {
    throw new AppError('Billing month must be within the academic year.', 400);
  }
};

// ── FEE STRUCTURE SERVICES ──────────────────────────────────────────────────

export const createFeeStructureService = async (
  school_id: number,
  data: ICreateFeeStructure
) => {
  await assertFeeManagementEnabled(school_id);
  validateFeeStructure(data);

  if (data.due_date_type === 'fixed_day' && !data.due_day) {
    throw new AppError('due_day is required when due_date_type is fixed_day.', 400);
  }

  if (!data.class_id || !data.academic_year_id || !data.fee_name) {
    return await createFeeStructure(school_id, data);
  }

  const existing  = await getFeeStructuresByClass(data.class_id, school_id, data.academic_year_id);
  const duplicate = existing.find(s => String(s.fee_name).trim().toLowerCase() === String(data.fee_name).trim().toLowerCase());
  if (duplicate) {
    throw new AppError('Fee structure with this name already exists for the selected class and academic year.', 409);
  }

  return await createFeeStructure(school_id, data);
};

export const getFeeStructuresService = async (
  class_id:         number,
  school_id:        number,
  academic_year_id: number
) => {
  return await getFeeStructuresByClass(class_id, school_id, academic_year_id);
};

export const updateFeeStructureService = async (
  id: number, school_id: number, data: IUpdateFeeStructure
) => {
  validateFeeStructure(data);
  const structure = await updateFeeStructure(id, school_id, data);
  if (!structure) throw new AppError('Fee structure not found.', 404);
  return structure;
};

export const deleteFeeStructureService = async (id: number, school_id: number) => {
  const structure = await getFeeStructureById(id, school_id);
  if (!structure) throw new AppError('Fee structure not found.', 404);

  const collectionCheck = await pool.query(
    `SELECT id FROM fee_collections WHERE fee_structure_id = $1 AND school_id = $2 LIMIT 1`,
    [id, school_id]
  );
  if ((collectionCheck.rowCount ?? 0) > 0) {
    throw new AppError(
      'Cannot delete this fee structure because bills have already been generated from it. ' +
      'Deactivate it instead by contacting support, or waive/delete the existing collections first.',
      409
    );
  }

  const deleted = await deleteFeeStructure(id, school_id);
  if (!deleted) throw new AppError('Failed to delete fee structure.', 500);
};

// ── TRANSPORT FEE AUTO-ADD ──────────────────────────────────────────────────
// Called when an admin manually creates an academic fee for a student.
// Adds a transport bill for the SAME billing month as the academic fee so the
// bills appear together in the student's fee history.
const autoAddTransportFee = async (
  school_id: number, created_by: number, student_id: number,
  academic_year_id: number, billing_month_date: string  // YYYY-MM-DD of the academic bill
): Promise<boolean> => {
  const assignment = await getAssignmentByStudent(student_id, school_id, academic_year_id);
  if (!assignment) return false;

  const monthly_fee = Number(assignment.monthly_fee);
  if (!monthly_fee || monthly_fee <= 0) return false;

  // Use the same month as the academic bill — day 1 of that month
  const due_date = billing_month_date.slice(0, 7) + '-01';

  const existing = await getTransportFeeForPeriod(school_id, student_id, academic_year_id, due_date);
  if (existing) return false;

  const fee_name = `Transport Fee — ${assignment.route_name} (${assignment.stop_name})`;
  await createFeeCollection(
    school_id, created_by,
    { student_id, enrollment_id: null, fee_structure_id: null, academic_year_id, due_date, total_amount: monthly_fee },
    fee_name, monthly_fee, monthly_fee, 'transport'
  );
  return true;
};

// ── HOSTEL FEE AUTO-ADD ─────────────────────────────────────────────────────
const autoAddHostelFee = async (
  school_id: number, created_by: number, student_id: number,
  academic_year_id: number, billing_month_date: string  // YYYY-MM-DD of the academic bill
): Promise<boolean> => {
  const assignment = await getHostelAssignmentByStudent(student_id, school_id, academic_year_id);
  if (!assignment) return false;

  const monthly_fee = Number(assignment.monthly_fee);
  if (!monthly_fee || monthly_fee <= 0) return false;

  // Use same month as the academic bill — day 1 of that month
  const due_date = billing_month_date.slice(0, 7) + '-01';

  const existing = await getHostelFeeForPeriod(school_id, student_id, academic_year_id, due_date);
  if (existing) return false;

  const fee_name = `Hostel Fee — ${assignment.hostel_name} (Room ${assignment.room_number})`;
  await createFeeCollection(
    school_id, created_by,
    { student_id, enrollment_id: null, fee_structure_id: null, academic_year_id, due_date, total_amount: monthly_fee },
    fee_name, monthly_fee, monthly_fee, 'hostel'
  );
  return true;
};

// ── FEE COLLECTION SERVICES ────────────────────────────────────────────────

const calculateDueDate = (due_date_type: string, due_day: number | undefined, admission_date: Date): Date => {
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth();
  if (due_date_type === 'fixed_day' && due_day) {
    return new Date(year, month, due_day);
  }
  const admissionDay = new Date(admission_date).getDate();
  return new Date(year, month, admissionDay);
};

export const createFeeCollectionService = async (
  school_id: number, created_by: number, data: ICreateFeeCollection
) => {
  if (!data.fee_structure_id) {
    throw new AppError('fee_structure_id is required for academic fee collections.', 400);
  }

  const structure = await getFeeStructureById(data.fee_structure_id, school_id);
  if (!structure) throw new AppError('Fee structure not found.', 404);

  const student = await getStudentById(data.student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);

  const due_date_obj = calculateDueDate(structure.due_date_type, structure.due_day, student.admission_date as unknown as Date);
  const due_date_str = `${due_date_obj.getFullYear()}-${String(due_date_obj.getMonth() + 1).padStart(2, '0')}-${String(due_date_obj.getDate()).padStart(2, '0')}`;
  const discount   = data.discount_amount || 0;
  const fine       = data.fine_amount     || 0;
  const net_amount = data.total_amount - discount + fine;

  const collection = await createFeeCollection(
    school_id, created_by, { ...data, due_date: due_date_str }, structure.fee_name, net_amount, net_amount, 'academic'
  );

  // Pass billing_month_date so transport/hostel bills align with this academic bill's month
  const transport_fee_added = await autoAddTransportFee(school_id, created_by, data.student_id, data.academic_year_id, due_date_str);
  const hostel_fee_added    = await autoAddHostelFee(school_id, created_by, data.student_id, data.academic_year_id, due_date_str);

  return { collection, transport_fee_added, hostel_fee_added };
};

export const createMiscFeeCollectionService = async (
  school_id:  number,
  created_by: number,
  data: {
    student_id:       number;
    enrollment_id:    number | null;
    academic_year_id: number;
    fee_name:         string;
    due_date:         string;
    total_amount:     number;
    discount_amount?: number;
    discount_reason?: string;
  }
) => {
  await assertFeeManagementEnabled(school_id);

  if (!data.fee_name?.trim())   throw new AppError('fee_name is required for miscellaneous collections.', 400);
  if (data.total_amount <= 0)   throw new AppError('total_amount must be greater than 0.', 400);
  if (data.discount_amount !== undefined &&
      (!Number.isFinite(data.discount_amount) || data.discount_amount < 0 || data.discount_amount > data.total_amount)) {
    throw new AppError('Discount must be between zero and the fee amount.', 400);
  }

  const student = await getStudentById(data.student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);

  const discount   = data.discount_amount || 0;
  const net_amount = data.total_amount - discount;

  return await createFeeCollection(
    school_id, created_by,
    {
      student_id: data.student_id, enrollment_id: data.enrollment_id,
      fee_structure_id: null, academic_year_id: data.academic_year_id,
      due_date: data.due_date, total_amount: data.total_amount,
      discount_amount: discount > 0 ? discount : undefined,
      discount_reason: discount > 0 ? data.discount_reason : undefined,
    },
    data.fee_name, net_amount, net_amount, 'academic'
  );
};

export const getFeeCollectionsService = async (school_id: number, academic_year_id: number, billing_month?: string) => {
  return await getFeeCollectionsBySchool(school_id, academic_year_id, billing_month);
};

export const getStudentFeeCollectionsService = async (
  student_id: number, school_id: number, academic_year_id?: number
) => {
  const student = await getStudentById(student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);
  return await getFeeCollectionsByStudent(student_id, school_id, academic_year_id);
};

export const waiveFeeCollectionService = async (id: number, school_id: number, reason: string) => {
  const collection = await getFeeCollectionById(id, school_id);
  if (!collection) throw new AppError('Fee collection not found.', 404);
  if (collection.status === 'paid') throw new AppError('Cannot waive a fully paid collection.', 400);
  const waived = await waiveFeeCollection(id, school_id, reason);
  if (!waived) throw new AppError('Failed to waive fee collection.', 500);
  return waived;
};

export const updateFeeCollectionService = async (id: number, school_id: number, data: IUpdateFeeCollection) => {
  const collection = await getFeeCollectionById(id, school_id);
  if (!collection) throw new AppError('Fee collection not found.', 404);
  if (collection.status === 'paid' || collection.status === 'waived') {
    throw new AppError('Paid or waived fee collections cannot be adjusted.', 400);
  }
  if (data.status !== undefined) {
    throw new AppError('Fee status is calculated from payments and cannot be changed directly.', 400);
  }
  if (data.discount_amount !== undefined) {
    const discount = Number(data.discount_amount);
    if (!Number.isFinite(discount) || discount < 0 || discount > Number(collection.total_amount)) {
      throw new AppError('Discount must be between zero and the original fee amount.', 400);
    }
  }
  if (data.fine_amount !== undefined) {
    const fine = Number(data.fine_amount);
    if (!Number.isFinite(fine) || fine < 0) {
      throw new AppError('Fine amount must be zero or greater.', 400);
    }
  }
  const updated = await updateFeeCollection(id, school_id, data);
  if (!updated) throw new AppError('Fee collection not found.', 404);
  return updated;
};

// ── FEE PAYMENT SERVICES ───────────────────────────────────────────────────

export const createFeePaymentService = async (
  school_id: number, collected_by: number, data: ICreateFeePayment
) => {
  await assertFeeManagementEnabled(school_id);

  const collection = await getFeeCollectionById(data.collection_id, school_id);
  if (!collection) throw new AppError('Fee collection not found.', 404);

  if (Number(collection.student_id) !== Number(data.student_id)) {
    throw new AppError('Payment student does not match the fee collection.', 400);
  }
  if (collection.status === 'paid') {
    throw new AppError('This fee is already fully paid.', 400);
  }
  if (data.paid_amount <= 0) {
    throw new AppError('Payment amount must be greater than 0.', 400);
  }
  if (data.paid_amount > collection.remaining_amount) {
    throw new AppError(
      `Payment amount (${data.paid_amount}) cannot exceed remaining amount of ${collection.remaining_amount}.`, 400
    );
  }

  return await createFeePaymentAtomic(school_id, collected_by, data);
};

export const getPaymentsByCollectionService = async (collection_id: number, school_id: number) => {
  return await getPaymentsByCollection(collection_id, school_id);
};

export const getStudentPaymentsService = async (student_id: number, school_id: number) => {
  const student = await getStudentById(student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);
  return await getPaymentsByStudent(student_id, school_id);
};

// ── GENERATE MONTHLY ACADEMIC BILLS (batch) — B3 fixed ────────────────────
export const generateMonthlyFeeBillsService = async (
  school_id:        number,
  created_by:       number,
  academic_year_id: number,
  billing_month:    string   // YYYY-MM (AD)
) => {
  await assertFeeManagementEnabled(school_id);

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billing_month)) {
    throw new AppError('billing_month must use YYYY-MM.', 400);
  }

  // B3: read billing policy alongside academic year
  const [academicYear, policy] = await Promise.all([
    getAcademicYearById(academic_year_id, school_id),
    getFeeBillingPolicy(school_id),
  ]);
  if (!academicYear) throw new AppError('Academic year not found.', 404);

  const [billYearStr, billMonthStr] = billing_month.split('-');
  const billYear  = parseInt(billYearStr,  10);
  const billMonth = parseInt(billMonthStr, 10) - 1; // 0-indexed

  const yearStart   = new Date(`${String(academicYear.start_date).slice(0, 10)}T00:00:00`);
  const yearEnd     = new Date(`${String(academicYear.end_date).slice(0, 10)}T23:59:59`);
  const billingDate = new Date(billYear, billMonth, 1);

  if (
    billingDate < new Date(yearStart.getFullYear(), yearStart.getMonth(), 1) ||
    billingDate > yearEnd
  ) {
    throw new AppError('Billing month must be within the academic year.', 400);
  }

  const ayStart = yearStart.getFullYear();
  const ayEnd   = yearEnd.getFullYear();
  const ayLabel = ayStart === ayEnd ? `AY ${ayStart}` : `AY ${ayStart}/${String(ayEnd).slice(-2)}`;

  // Helper: build an inclusive list of YYYY-MM strings from (fromY, fromM 0-indexed) to (billYear, billMonth 0-indexed)
  const buildMonthList = (fromY: number, fromM: number): string[] => {
    const months: string[] = [];
    let y = fromY, m = fromM;
    while (y < billYear || (y === billYear && m <= billMonth)) {
      months.push(`${y}-${String(m + 1).padStart(2, '0')}`);
      m++;
      if (m > 11) { m = 0; y++; }
    }
    return months;
  };

  // Helper: is a given frequency due in the given month-offset from AY start?
  const isFrequencyDueAt = (frequency: string, offset: number): boolean => {
    if (frequency === 'monthly')     return true;
    if (frequency === 'quarterly'   && offset % 3 === 0) return true;
    if (frequency === 'half_yearly' && offset % 6 === 0) return true;
    // yearly/one_time: only at month 0 — idempotency prevents double creation on re-runs
    if ((frequency === 'yearly' || frequency === 'one_time') && offset === 0) return true;
    return false;
  };

  const enrollments = await getEnrollmentsBySchool(school_id, academic_year_id);
  if (!enrollments.length) return { created: 0, skipped: 0, errors: [], policy: { billing_start_from: policy.billing_start_from, monthly_bill_window: policy.monthly_bill_window } };

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const en of enrollments) {
    try {
      const structures = await getFeeStructuresByClass(en.class_id, school_id, academic_year_id);
      if (!structures.length) continue;

      const admissionDate  = new Date(en.admission_date);
      const admYear        = admissionDate.getFullYear();
      const admMonth       = admissionDate.getMonth(); // 0-indexed
      const admDay         = admissionDate.getDate();

      for (const structure of structures) {
        if (!structure.is_active) continue;

        const isYearlyOrOneTime = structure.frequency === 'yearly' || structure.frequency === 'one_time';

        // B3: Determine month window to process for this structure
        // - yearly/one_time: always single month (idempotency handles re-runs)
        // - bill_current: only the requested billing_month
        // - bill_past_due: catch up from policy start month to billing_month
        let monthsToProcess: string[];

        if (isYearlyOrOneTime || policy.monthly_bill_window === 'bill_current') {
          monthsToProcess = [billing_month];
        } else {
          // bill_past_due: start from whichever is later — AY start or student join
          const windowFromY = policy.billing_start_from === 'join_date' ? admYear  : yearStart.getFullYear();
          const windowFromM = policy.billing_start_from === 'join_date' ? admMonth : yearStart.getMonth();
          monthsToProcess = buildMonthList(windowFromY, windowFromM);
        }

        for (const monthStr of monthsToProcess) {
          const [mYStr, mMStr] = monthStr.split('-');
          const mYear  = parseInt(mYStr, 10);
          const mMonth = parseInt(mMStr, 10) - 1; // 0-indexed

          // Offset from AY start to determine quarterly/half-yearly cadence
          const offsetFromAY = (mYear - yearStart.getFullYear()) * 12 + (mMonth - yearStart.getMonth());
          if (!isFrequencyDueAt(structure.frequency, offsetFromAY)) continue;

          // ── Due date for this billing month ──────────────────────────────
          const preferredDay = structure.due_date_type === 'admission_date'
            ? admDay
            : Number(structure.due_day || 1);
          const lastDayOfM = new Date(mYear, mMonth + 1, 0).getDate();
          const due_date   = `${monthStr}-${String(Math.min(Math.max(preferredDay, 1), lastDayOfM)).padStart(2, '0')}`;

          // ── Eligibility check ────────────────────────────────────────────
          let isEligible = false;

          if (isYearlyOrOneTime) {
            isEligible = true; // idempotency check below prevents actual double billing
          } else {
            // B3: billing_start_from policy overrides per-structure billing_start_rule
            // when set to 'academic_year' — it always bills from AY start regardless of join date.
            // When set to 'join_date' — per-structure billing_start_rule applies.
            const rule = (structure as any).billing_start_rule || 'next_month';

            // Effective start: AY start (if policy=academic_year) or admission date (if policy=join_date)
            const effStartY = policy.billing_start_from === 'academic_year' ? yearStart.getFullYear() : admYear;
            const effStartM = policy.billing_start_from === 'academic_year' ? yearStart.getMonth()    : admMonth;
            const monthsDiff = (mYear - effStartY) * 12 + (mMonth - effStartM);

            if (rule === 'academic_year') {
              isEligible = true;
            } else if (rule === 'next_month') {
              // Bill same month if joined by 15th, else next month
              isEligible = monthsDiff > 0 || (monthsDiff === 0 && admDay <= 15);
            } else if (rule === 'skip_two_months') {
              isEligible = monthsDiff >= 2;
            } else {
              isEligible = monthsDiff >= 1;
            }
          }

          if (!isEligible) { skipped++; continue; }

          // ── Idempotency: never double-bill ───────────────────────────────
          if (isYearlyOrOneTime) {
            const alreadyBilled = await getYearlyFeeForAcademicYear(
              school_id, en.student_id, structure.id, academic_year_id
            );
            if (alreadyBilled) { skipped++; continue; }
          } else {
            const alreadyBilled = await getAcademicFeeForPeriod(
              school_id, en.student_id, structure.id, due_date
            );
            if (alreadyBilled) { skipped++; continue; }
          }

          // ── Scholarship discount ─────────────────────────────────────────
          const scholarshipApplies =
            structure.scholarship_applies !== false &&
            (structure as any).scholarship_applies !== 'false';

          const amount = Number(structure.amount);
          let discount        = 0;
          let discount_reason = '';

          if (scholarshipApplies && en.scholarship_percent && Number(en.scholarship_percent) > 0) {
            discount        = Math.round((amount * Number(en.scholarship_percent)) / 100 * 100) / 100;
            discount_reason = `${en.scholarship_type || 'Scholarship'}: ${en.scholarship_percent}% discount`;
          }

          const net_amount = amount - discount;

          const fee_name = structure.frequency === 'yearly'
            ? `${structure.fee_name} (${ayLabel})`
            : structure.frequency === 'one_time'
              ? structure.fee_name
              : `${structure.fee_name} - ${monthStr}`;

          // ── Advance credit offset ────────────────────────────────────────
          const advanceRes = await pool.query(
            `SELECT COALESCE(SUM(paid_amount) - SUM(net_amount), 0) AS advance_balance
             FROM fee_collections
             WHERE school_id = $1 AND student_id = $2 AND academic_year_id = $3
               AND fee_structure_id = $4 AND status IN ('paid', 'partial') AND paid_amount > 0`,
            [school_id, en.student_id, academic_year_id, structure.id]
          );
          const advanceBalance     = Math.max(0, Number(advanceRes.rows[0]?.advance_balance || 0));
          if (advanceBalance >= net_amount) { skipped++; continue; }
          const effectiveNetAmount = Math.max(0, net_amount - advanceBalance);

          await createFeeCollection(
            school_id, created_by,
            {
              student_id:       en.student_id,
              enrollment_id:    en.id,
              fee_structure_id: structure.id,
              academic_year_id,
              due_date,
              total_amount:     amount,
              discount_amount:  discount > 0 ? discount        : undefined,
              discount_reason:  discount > 0 ? discount_reason : undefined,
            },
            fee_name, effectiveNetAmount, effectiveNetAmount, 'academic'
          );
          created++;
        } // end monthsToProcess
      } // end structures
    } catch (err: any) {
      if (err?.code === '23505') skipped++;
      else errors.push(`Student ${en.student_id}: ${err.message}`);
    }
  }

  return {
    created,
    skipped,
    errors,
    policy: { billing_start_from: policy.billing_start_from, monthly_bill_window: policy.monthly_bill_window },
  };
};

// ── GENERATE TRANSPORT BILLS (batch) — B1 fixed ───────────────────────────
export const generateTransportBillsService = async (
  school_id:        number,
  created_by:       number,
  academic_year_id: number,
  billing_month:    string,
  due_day:          number = 1,
  student_ids:      number[] = [],
) => {
  await assertFeeManagementEnabled(school_id);
  await assertBillingMonthInAcademicYear(school_id, academic_year_id, billing_month);
  if (!student_ids.length) throw new AppError('Select at least one student before generating bills.', 400);
  const selected = new Set(student_ids.map(Number));

  const [ymYear, ymMonth] = billing_month.split('-').map(Number);
  const lastDayOfMonth = new Date(ymYear, ymMonth, 0).getDate();
  const clampedDay     = Math.min(Math.max(due_day, 1), lastDayOfMonth);
  const due_date       = `${billing_month}-${String(clampedDay).padStart(2, '0')}`;
  const routes         = await getRoutesBySchool(school_id, academic_year_id);
  if (!routes.length) return { created: 0, skipped: 0, errors: [] };

  let created = 0, skipped = 0;
  const errors: string[] = [];

  for (const route of routes) {
    // B1: pass academic_year_id so only current-AY assignments are billed
    const assignments = await getAssignmentsByRoute(route.id, school_id, academic_year_id);
    for (const assignment of assignments) {
      try {
        if (!selected.has(Number(assignment.student_id))) { skipped++; continue; }
        if ((assignment.start_date && String(assignment.start_date).slice(0, 10) > due_date) ||
            (assignment.end_date && String(assignment.end_date).slice(0, 10) < `${billing_month}-01`)) { skipped++; continue; }
        const monthly_fee = Number(assignment.monthly_fee);
        if (!monthly_fee || monthly_fee <= 0) { skipped++; continue; }

        const existing = await getTransportFeeForPeriod(school_id, assignment.student_id, academic_year_id, due_date);
        if (existing) { skipped++; continue; }

        const fee_name = `Transport — ${route.name} · ${assignment.stop_name} (${billing_month})`;
        await createFeeCollection(
          school_id, created_by,
          { student_id: assignment.student_id, enrollment_id: null, fee_structure_id: null, academic_year_id, due_date, total_amount: monthly_fee },
          fee_name, monthly_fee, monthly_fee, 'transport'
        );
        created++;
      } catch (err: any) {
        if (err?.code === '23505') skipped++;
        else errors.push(`Student ${assignment.student_id}: ${err.message}`);
      }
    }
  }

  return { created, skipped, errors };
};

export const getTransportFeeSummaryService = async (school_id: number, academic_year_id: number) => {
  return getTransportFeeSummary(school_id, academic_year_id);
};

type SpecialFeeType = 'transport' | 'hostel';

/**
 * The review list is deliberately calculated on the server.  The browser may
 * display only selected students, but it must never be able to bill an
 * arbitrary student id.
 */
export const getSpecialFeeBillingPreviewService = async (
  school_id: number,
  academic_year_id: number,
  billing_month: string,
  type: SpecialFeeType,
) => {
  await assertFeeManagementEnabled(school_id);
  await assertBillingMonthInAcademicYear(school_id, academic_year_id, billing_month);

  const [year, month] = billing_month.split('-').map(Number);
  const firstDay = `${billing_month}-01`;
  const lastDay = `${billing_month}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const groups = type === 'transport'
    ? await getRoutesBySchool(school_id, academic_year_id)
    : await getHostelsBySchool(school_id);
  const entries: any[] = [];

  for (const group of groups) {
    const assignments = type === 'transport'
      ? await getAssignmentsByRoute(group.id, school_id, academic_year_id)
      : await getAssignmentsByHostel(group.id, school_id, academic_year_id);
    for (const assignment of assignments) {
      const startsOn = assignment.start_date || assignment.joining_date;
      const endsOn = assignment.end_date || assignment.leaving_date;
      if ((startsOn && String(startsOn).slice(0, 10) > lastDay) || (endsOn && String(endsOn).slice(0, 10) < firstDay)) continue;
      const amount = Number(assignment.monthly_fee);
      if (!amount || amount <= 0) continue;
      const exists = type === 'transport'
        ? await getTransportFeeForPeriod(school_id, assignment.student_id, academic_year_id, firstDay)
        : await getHostelFeeForPeriod(school_id, assignment.student_id, academic_year_id, firstDay);
      entries.push({
        student_id: assignment.student_id,
        full_name: assignment.full_name,
        admission_number: assignment.admission_number,
        amount,
        already_billed: Boolean(exists),
        assignment: type === 'transport'
          ? `${group.name} · ${assignment.stop_name}`
          : `${group.name} · Room ${assignment.room_number}`,
      });
    }
  }
  return entries.sort((a, b) => a.full_name.localeCompare(b.full_name));
};

// ── GENERATE HOSTEL BILLS (batch) — B1 fixed ─────────────────────────────
export const generateHostelBillsService = async (
  school_id:        number,
  created_by:       number,
  academic_year_id: number,
  billing_month:    string,
  due_day:          number = 1,
  student_ids:      number[] = [],
) => {
  await assertFeeManagementEnabled(school_id);
  await assertBillingMonthInAcademicYear(school_id, academic_year_id, billing_month);
  if (!student_ids.length) throw new AppError('Select at least one student before generating bills.', 400);
  const selected = new Set(student_ids.map(Number));

  const [ymYear, ymMonth] = billing_month.split('-').map(Number);
  const lastDayOfMonth = new Date(ymYear, ymMonth, 0).getDate();
  const clampedDay     = Math.min(Math.max(due_day, 1), lastDayOfMonth);
  const due_date       = `${billing_month}-${String(clampedDay).padStart(2, '0')}`;
  const hostels        = await getHostelsBySchool(school_id);
  if (!hostels.length) return { created: 0, skipped: 0, errors: [] };

  let created = 0, skipped = 0;
  const errors: string[] = [];

  for (const hostel of hostels) {
    // B1: pass academic_year_id so only current-AY assignments are billed
    const assignments = await getAssignmentsByHostel(hostel.id, school_id, academic_year_id);
    for (const assignment of assignments) {
      try {
        if (!selected.has(Number(assignment.student_id))) { skipped++; continue; }
        if ((assignment.joining_date && String(assignment.joining_date).slice(0, 10) > due_date) ||
            (assignment.leaving_date && String(assignment.leaving_date).slice(0, 10) < `${billing_month}-01`)) { skipped++; continue; }
        const monthly_fee = Number(assignment.monthly_fee);
        if (!monthly_fee || monthly_fee <= 0) { skipped++; continue; }

        const existing = await getHostelFeeForPeriod(school_id, assignment.student_id, academic_year_id, due_date);
        if (existing) { skipped++; continue; }

        const fee_name = `Hostel — ${hostel.name} · Room ${assignment.room_number} (${billing_month})`;
        await createFeeCollection(
          school_id, created_by,
          { student_id: assignment.student_id, enrollment_id: null, fee_structure_id: null, academic_year_id, due_date, total_amount: monthly_fee },
          fee_name, monthly_fee, monthly_fee, 'hostel'
        );
        created++;
      } catch (err: any) {
        if (err?.code === '23505') skipped++;
        else errors.push(`Student ${assignment.student_id}: ${err.message}`);
      }
    }
  }

  return { created, skipped, errors };
};

export const getHostelFeeSummaryService = async (school_id: number, academic_year_id: number) => {
  return getHostelFeeSummary(school_id, academic_year_id);
};

export const getPaymentReceiptService = async (payment_id: number, school_id: number) => {
  const receipt = await getPaymentWithDetails(payment_id, school_id);
  if (!receipt) throw new AppError('Payment not found.', 404);
  return receipt;
};

// ── ASSIGN ONE-TIME / YEARLY FEES ON ENROLLMENT ──────────────────────────────
export const assignOneTimeFeesService = async (
  school_id:           number,
  created_by:          number,
  student_id:          number,
  enrollment_id:       number,
  academic_year_id:    number,
  class_id:            number,
  scholarship_percent: number,
  scholarship_type:    string,
  admission_date:      string
) => {
  await assertFeeManagementEnabled(school_id);

  const student = await getStudentById(student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);

  return await assignOneTimeFees(
    school_id, created_by, student_id, enrollment_id, academic_year_id,
    class_id, scholarship_percent, scholarship_type, admission_date
  );
};

// ── MONTHLY BILLING STATUS REPORT ────────────────────────────────────────────
export const getMonthlyBillingStatusService = async (
  school_id: number, academic_year_id: number, billing_month: string
) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billing_month)) {
    throw new AppError('billing_month must use YYYY-MM format.', 400);
  }
  return await getMonthlyBillingStatus(school_id, academic_year_id, billing_month);
};
