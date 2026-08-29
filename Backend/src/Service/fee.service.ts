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
  voidMonthBilling,
  getUnbilledStudents,
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

export const getFeeCollectionsService = async (school_id: number, academic_year_id: number, billing_month?: string, pending_only?: boolean) => {
  return await getFeeCollectionsBySchool(school_id, academic_year_id, billing_month, pending_only);
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

// ── SEQUENTIAL PAYMENT ENFORCEMENT ────────────────────────────────────────────
// For monthly recurring fees (same fee_structure_id), we enforce chronological
// payment order: an older unpaid bill must be paid or waived before a newer one.
// This prevents the scenario where Feb is paid but Jan is still unpaid.
// Transport / hostel / one-time / yearly fees: NO sequential enforcement.
const assertSequentialPayment = async (
  school_id:    number,
  collection:   any,  // the collection being paid
): Promise<void> => {
  // Only enforce for academic fees with a fee_structure_id (recurring monthly bills)
  if (!collection.fee_structure_id) return;
  if (collection.fee_type && collection.fee_type !== 'academic') return;

  const due_date = String(collection.due_date).slice(0, 10); // YYYY-MM-DD
  const billing_month = due_date.slice(0, 7);               // YYYY-MM

  // Find any earlier unpaid bill for the SAME fee structure for this student
  const result = await pool.query(
    `SELECT id, due_date, fee_name
     FROM fee_collections
     WHERE school_id        = $1
       AND student_id       = $2
       AND fee_structure_id = $3
       AND academic_year_id = $4
       AND status NOT IN ('paid', 'waived')
       AND to_char(due_date, 'YYYY-MM') < $5
     ORDER BY due_date ASC
     LIMIT 1`,
    [school_id, collection.student_id, collection.fee_structure_id, collection.academic_year_id, billing_month]
  );

  if (result.rows.length > 0) {
    const earliest = result.rows[0];
    const earliestMonth = String(earliest.due_date).slice(0, 7);
    throw new AppError(
      `Cannot pay ${billing_month} before earlier dues are cleared. ` +
      `Please pay or waive "${earliest.fee_name}" (${earliestMonth}) first.`,
      400
    );
  }
};

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

  // Enforce sequential payment: older unpaid bills must be cleared first
  await assertSequentialPayment(school_id, collection);

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

// ── GENERATE MONTHLY ACADEMIC BILLS — fully batched, O(classes) not O(students) ──
export const generateMonthlyFeeBillsService = async (
  school_id:        number,
  created_by:       number,
  academic_year_id: number,
  billing_month:    string,   // YYYY-MM (AD)
  custom_due_date?: string,
  from_month?:      string,
  to_month?:        string,
  class_id?:        number | null,
  section_id?:      number | null,
  onProgress?:      (processed: number, total: number) => Promise<void> | void
) => {
  await assertFeeManagementEnabled(school_id);

  const startMonthStr = from_month || billing_month;
  const endMonthStr   = to_month   || billing_month;

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonthStr) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(endMonthStr)) {
    throw new AppError('billing_month must use YYYY-MM.', 400);
  }

  const [academicYear, policy] = await Promise.all([
    getAcademicYearById(academic_year_id, school_id),
    getFeeBillingPolicy(school_id),
  ]);
  if (!academicYear) throw new AppError('Academic year not found.', 404);

  const [fromYStr, fromMStr] = startMonthStr.split('-');
  const fromYear  = parseInt(fromYStr,  10);
  const fromMonth = parseInt(fromMStr, 10) - 1; // 0-indexed

  const [toYStr, toMStr] = endMonthStr.split('-');
  const toYear  = parseInt(toYStr,  10);
  const toMonth = parseInt(toMStr, 10) - 1; // 0-indexed

  const yearStart   = new Date(`${String(academicYear.start_date).slice(0, 10)}T00:00:00`);
  const yearEnd     = new Date(`${String(academicYear.end_date).slice(0, 10)}T23:59:59`);
  const billingStartDate = new Date(fromYear, fromMonth, 1);
  const billingEndDate   = new Date(toYear,   toMonth,   1);

  if (
    billingEndDate < new Date(yearStart.getFullYear(), yearStart.getMonth(), 1) ||
    billingStartDate > yearEnd
  ) {
    throw new AppError('Billing month must be within the academic year.', 400);
  }

  const ayStart = yearStart.getFullYear();
  const ayEnd   = yearEnd.getFullYear();
  const ayLabel = ayStart === ayEnd ? `AY ${ayStart}` : `AY ${ayStart}/${String(ayEnd).slice(-2)}`;

  // Helper: build an inclusive list of YYYY-MM strings from (fromY, fromM 0-indexed) to (toY, toM 0-indexed)
  const buildMonthList = (fromY: number, fromM: number): string[] => {
    const months: string[] = [];
    let y = fromY, m = fromM;
    while (y < toYear || (y === toYear && m <= toMonth)) {
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
    // yearly/one_time: always eligible if not yet billed in this AY (alreadyBilledYearly prevents double billing)
    if (frequency === 'yearly' || frequency === 'one_time') return true;
    return false;
  };

  let enrollments = await getEnrollmentsBySchool(school_id, academic_year_id);
  if (class_id) {
    enrollments = enrollments.filter(e => Number(e.class_id) === Number(class_id));
  }
  if (section_id) {
    enrollments = enrollments.filter(e => Number(e.section_id) === Number(section_id));
  }

  if (!enrollments.length) return {
    created: 0, skipped: 0, errors: [],
    policy: { billing_start_from: policy.billing_start_from, monthly_bill_window: policy.monthly_bill_window },
  };

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  // ── BATCH OPTIMISATION ────────────────────────────────────────────────────
  const byClass = new Map<number, typeof enrollments>();
  for (const en of enrollments) {
    if (!byClass.has(en.class_id)) byClass.set(en.class_id, []);
    byClass.get(en.class_id)!.push(en);
  }

  // Rows to bulk-insert at end
  type BillRow = {
    student_id: number; enrollment_id: number; fee_structure_id: number;
    academic_year_id: number; fee_name: string; due_date: string;
    total_amount: number; discount_amount: number; discount_reason: string | null;
    net_amount: number;
    billing_from_month: string | null;
    billing_to_month: string | null;
    months_count: number;
  };
  const toInsert: BillRow[] = [];

  for (const [class_id, classEnrollments] of byClass) {
    const structures = await getFeeStructuresByClass(class_id, school_id, academic_year_id);
    if (!structures.length) continue;

    const studentIds = classEnrollments.map(e => e.student_id);

    for (const structure of structures) {
      if (!structure.is_active) continue;

      const isYearlyOrOneTime = structure.frequency === 'yearly' || structure.frequency === 'one_time';
      const scholarshipApplies =
        structure.scholarship_applies !== false &&
        (structure as any).scholarship_applies !== 'false';

      // ── Determine months to process for this structure ──────────────────
      const monthsArePerStudent =
        !isYearlyOrOneTime &&
        policy.monthly_bill_window === 'bill_past_due' &&
        policy.billing_start_from === 'join_date' &&
        !from_month;

      const sharedMonths: string[] = (!monthsArePerStudent && !isYearlyOrOneTime)
        ? (from_month && to_month
            ? buildMonthList(fromYear, fromMonth)
            : (policy.monthly_bill_window === 'bill_current'
                ? [billing_month]
                : buildMonthList(yearStart.getFullYear(), yearStart.getMonth())))
        : [];

      // ── BATCH idempotency check for all students in this class ──────────
      let alreadyBilledYearly = new Set<number>(); // student_ids already billed (yearly)
      let alreadyBilledMonthly = new Set<string>();  // `${student_id}-${YYYY-MM}` already billed

      if (isYearlyOrOneTime) {
        const res = await pool.query(
          `SELECT student_id FROM fee_collections
           WHERE school_id        = $1
             AND fee_structure_id = $2
             AND academic_year_id = $3
             AND student_id       = ANY($4)`,
          [school_id, structure.id, academic_year_id, studentIds]
        );
        alreadyBilledYearly = new Set(res.rows.map((r: any) => Number(r.student_id)));
      } else {
        const res = await pool.query(
          `SELECT student_id, to_char(due_date, 'YYYY-MM') AS billing_month,
                  billing_from_month, billing_to_month
           FROM fee_collections
           WHERE school_id        = $1
             AND fee_structure_id = $2
             AND student_id       = ANY($3)
             AND academic_year_id = $4`,
          [school_id, structure.id, studentIds, academic_year_id]
        );
        for (const r of res.rows) {
          if (r.billing_from_month && r.billing_to_month) {
            const [fYStr, fMStr] = r.billing_from_month.split('-');
            const [tYStr, tMStr] = r.billing_to_month.split('-');
            let y = parseInt(fYStr, 10), m = parseInt(fMStr, 10) - 1;
            const endY = parseInt(tYStr, 10), endM = parseInt(tMStr, 10) - 1;
            while (y < endY || (y === endY && m <= endM)) {
              alreadyBilledMonthly.add(`${r.student_id}-${y}-${String(m + 1).padStart(2, '0')}`);
              m++; if (m > 11) { m = 0; y++; }
            }
          } else if (r.billing_month) {
            alreadyBilledMonthly.add(`${r.student_id}-${r.billing_month}`);
          }
        }
      }

      // ── BATCH advance balance check ─────────────────────────────────────
      const advanceMap = new Map<number, number>(); // student_id → advance_balance
      if (!isYearlyOrOneTime) {
        const advRes = await pool.query(
          `SELECT student_id,
                  GREATEST(0, COALESCE(SUM(paid_amount) - SUM(net_amount), 0)) AS advance_balance
           FROM fee_collections
           WHERE school_id        = $1
             AND fee_structure_id = $2
             AND academic_year_id = $3
             AND student_id       = ANY($4)
             AND status IN ('paid', 'partial')
             AND paid_amount > 0
           GROUP BY student_id`,
          [school_id, structure.id, academic_year_id, studentIds]
        );
        for (const r of advRes.rows) {
          advanceMap.set(Number(r.student_id), Math.max(0, Number(r.advance_balance)));
        }
      }

      // ── Per-student bill generation (consolidated period per student) ──────
      for (const en of classEnrollments) {
        const admissionDate = new Date(en.admission_date);
        const admYear  = admissionDate.getFullYear();
        const admMonth = admissionDate.getMonth(); // 0-indexed
        const admDay   = admissionDate.getDate();

        // Months to process for THIS student
        let monthsToProcess: string[];
        if (isYearlyOrOneTime) {
          monthsToProcess = [billing_month];
        } else if (monthsArePerStudent) {
          monthsToProcess = buildMonthList(admYear, admMonth);
        } else {
          monthsToProcess = sharedMonths;
        }

        // Collect all eligible unbilled months for this student
        const eligibleMonths: string[] = [];

        for (const monthStr of monthsToProcess) {
          const [mYStr, mMStr] = monthStr.split('-');
          const mYear  = parseInt(mYStr, 10);
          const mMonth = parseInt(mMStr, 10) - 1; // 0-indexed

          // Frequency cadence check
          const offsetFromAY = (mYear - yearStart.getFullYear()) * 12 + (mMonth - yearStart.getMonth());
          if (!isFrequencyDueAt(structure.frequency, offsetFromAY)) { skipped++; continue; }

          // Eligibility (pure computation — no DB)
          let isEligible = false;
          if (isYearlyOrOneTime) {
            isEligible = true;
          } else {
            const rule = (structure as any).billing_start_rule || 'next_month';
            if (rule === 'academic_year') {
              isEligible = true;
            } else if (rule === 'next_month') {
              const diffFromAdm = (mYear - admYear) * 12 + (mMonth - admMonth);
              isEligible = diffFromAdm > 0 || (diffFromAdm === 0 && admDay <= 15);
              if (isEligible && policy.billing_start_from === 'academic_year') {
                const diffFromAY = (mYear - yearStart.getFullYear()) * 12 + (mMonth - yearStart.getMonth());
                isEligible = diffFromAY >= 0;
              }
            } else if (rule === 'skip_two_months') {
              const diffFromAdm = (mYear - admYear) * 12 + (mMonth - admMonth);
              isEligible = diffFromAdm >= 2;
            } else {
              const diffFromAdm = (mYear - admYear) * 12 + (mMonth - admMonth);
              isEligible = diffFromAdm >= 1;
            }
          }
          if (!isEligible) { skipped++; continue; }

          // Idempotency check — uses pre-fetched sets (no DB)
          if (isYearlyOrOneTime) {
            if (alreadyBilledYearly.has(en.student_id)) { skipped++; continue; }
          } else {
            if (alreadyBilledMonthly.has(`${en.student_id}-${monthStr}`)) { skipped++; continue; }
          }

          eligibleMonths.push(monthStr);
        }

        if (eligibleMonths.length === 0) continue;

        // ── Consolidate eligible months into ONE bill entry per student ──────
        const monthsCount = eligibleMonths.length;
        const fromMonth   = eligibleMonths[0];
        const toMonth     = eligibleMonths[monthsCount - 1];

        // Due date calculation
        let due_date: string;
        if (custom_due_date && custom_due_date.slice(0, 7) === toMonth) {
          due_date = custom_due_date;
        } else {
          const [tYStr, tMStr] = toMonth.split('-');
          const tY = parseInt(tYStr, 10);
          const tM = parseInt(tMStr, 10) - 1;
          const lastDayInMonth = new Date(tY, tM + 1, 0).getDate();
          const calcDay = structure.due_date_type === 'fixed_day' && structure.due_day
            ? Math.min(structure.due_day, lastDayInMonth)
            : (structure.due_date_type === 'admission_date' ? Math.min(admDay, lastDayInMonth) : 10);
          due_date = `${toMonth}-${String(calcDay).padStart(2, '0')}`;
        }

        // Scholarship discount (computed per month × monthsCount)
        const unitAmount = Number(structure.amount);
        let unitDiscount = 0;
        let discount_reason: string | null = null;
        if (scholarshipApplies && en.scholarship_percent && Number(en.scholarship_percent) > 0) {
          unitDiscount    = Math.round((unitAmount * Number(en.scholarship_percent)) / 100 * 100) / 100;
          discount_reason = `${en.scholarship_type || 'Scholarship'}: ${en.scholarship_percent}% discount`;
        }

        const total_amount    = unitAmount * monthsCount;
        const discount_amount = unitDiscount * monthsCount;
        const net_unit        = unitAmount - unitDiscount;
        const total_net       = net_unit * monthsCount;

        // Advance balance check
        const advanceBalance = advanceMap.get(en.student_id) ?? 0;
        if (advanceBalance >= total_net) { skipped += monthsCount; continue; }
        const effectiveNetAmount = Math.max(0, total_net - advanceBalance);

        // Human-readable period label
        let periodLabel = "";
        if (isYearlyOrOneTime) {
          periodLabel = structure.frequency === 'yearly' ? ` (${ayLabel})` : "";
        } else if (fromMonth === toMonth) {
          periodLabel = ` (${fromMonth})`;
        } else {
          periodLabel = ` (${fromMonth} to ${toMonth} · ${monthsCount} Months)`;
        }

        const fee_name = `${structure.fee_name}${periodLabel}`;

        toInsert.push({
          student_id:         en.student_id,
          enrollment_id:      en.id,
          fee_structure_id:   structure.id,
          academic_year_id,
          fee_name,
          due_date,
          total_amount,
          discount_amount,
          discount_reason,
          net_amount:         effectiveNetAmount,
          billing_from_month: fromMonth || null,
          billing_to_month:   toMonth || null,
          months_count:       monthsCount || 1,
        });

        // Mark all eligible months as billed in memory
        if (isYearlyOrOneTime) {
          alreadyBilledYearly.add(en.student_id);
        } else {
          for (const m of eligibleMonths) {
            alreadyBilledMonthly.add(`${en.student_id}-${m}`);
          }
        }
      }
    }

    if (onProgress) {
      const processedCount = Array.from(byClass.entries())
        .slice(0, Array.from(byClass.keys()).indexOf(class_id) + 1)
        .reduce((sum, [, ens]) => sum + ens.length, 0);
      await onProgress(processedCount, enrollments.length);
    }
  }

  // ── BULK INSERT — one batched statement per 500 rows ─────────────────────
  const CHUNK = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    if (!chunk.length) continue;

    const flatValues: any[] = [];
    const flatPlaceholders = chunk.map((row) => {
      const base = flatValues.length;
      flatValues.push(
        school_id,
        row.student_id,
        row.enrollment_id,
        row.fee_structure_id,
        row.academic_year_id,
        row.fee_name,
        row.due_date,
        row.total_amount,
        row.discount_amount,
        row.discount_reason,
        row.net_amount,
        row.net_amount,
        created_by,
        row.billing_from_month,
        row.billing_to_month,
        row.months_count
      );
      const p = (offset: number) => `$${base + offset + 1}`;
      return `(${p(0)},${p(1)},${p(2)},${p(3)},${p(4)},${p(5)},'academic',${p(6)},${p(7)},${p(8)},${p(9)},0,NULL,${p(10)},0,${p(11)},'unpaid',${p(12)},${p(13)},${p(14)},${p(15)})`;
    });

    try {
      await pool.query(
        `INSERT INTO fee_collections
          (school_id, student_id, enrollment_id, fee_structure_id, academic_year_id,
           fee_name, fee_type, due_date, total_amount, discount_amount, discount_reason,
           fine_amount, fine_reason, net_amount, paid_amount, remaining_amount,
           status, created_by, billing_from_month, billing_to_month, months_count)
         VALUES ${flatPlaceholders.join(',')}
         ON CONFLICT DO NOTHING`,
        flatValues
      );
      created += chunk.length;
    } catch (err: any) {
      // On bulk insert error fall back to per-row to isolate the bad row
      for (const row of chunk) {
        try {
          await pool.query(
            `INSERT INTO fee_collections
              (school_id, student_id, enrollment_id, fee_structure_id, academic_year_id,
               fee_name, fee_type, due_date, total_amount, discount_amount, discount_reason,
               fine_amount, fine_reason, net_amount, paid_amount, remaining_amount,
               status, created_by, billing_from_month, billing_to_month, months_count)
             VALUES ($1,$2,$3,$4,$5,$6,'academic',$7,$8,$9,$10,0,NULL,$11,0,$12,'unpaid',$13,$14,$15,$16)
             ON CONFLICT DO NOTHING`,
            [
              school_id, row.student_id, row.enrollment_id, row.fee_structure_id,
              row.academic_year_id, row.fee_name, row.due_date, row.total_amount,
              row.discount_amount, row.discount_reason, row.net_amount, row.net_amount, created_by,
              row.billing_from_month, row.billing_to_month, row.months_count
            ]
          );
          created++;
        } catch (rowErr: any) {
          if (rowErr?.code === '23505') skipped++;
          else errors.push(`Student ${row.student_id} / ${row.fee_name}: ${rowErr.message}`);
        }
      }
    }
  }

  skipped += (enrollments.length > 0 ? 0 : 0); // base skipped already counted above

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
  due_day:          number = 10,
  student_ids:      number[] = [],
  custom_due_date?: string
) => {
  await assertFeeManagementEnabled(school_id);
  await assertBillingMonthInAcademicYear(school_id, academic_year_id, billing_month);
  if (!student_ids.length) throw new AppError('Select at least one student before generating bills.', 400);
  const selected = new Set(student_ids.map(Number));

  const [ymYear, ymMonth] = billing_month.split('-').map(Number);
  const lastDayOfMonth = new Date(ymYear, ymMonth, 0).getDate();
  const clampedDay     = Math.min(Math.max(due_day, 1), lastDayOfMonth);
  const due_date       = custom_due_date || `${billing_month}-${String(clampedDay).padStart(2, '0')}`;
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
  due_day:          number = 10,
  student_ids:      number[] = [],
  custom_due_date?: string
) => {
  await assertFeeManagementEnabled(school_id);
  await assertBillingMonthInAcademicYear(school_id, academic_year_id, billing_month);
  if (!student_ids.length) throw new AppError('Select at least one student before generating bills.', 400);
  const selected = new Set(student_ids.map(Number));

  const [ymYear, ymMonth] = billing_month.split('-').map(Number);
  const lastDayOfMonth = new Date(ymYear, ymMonth, 0).getDate();
  const clampedDay     = Math.min(Math.max(due_day, 1), lastDayOfMonth);
  const due_date       = custom_due_date || `${billing_month}-${String(clampedDay).padStart(2, '0')}`;
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

// ── VOID (UNDO) MONTHLY BILLING ───────────────────────────────────────────
// Only deletes unpaid bills with zero payments. Paid/partial bills are NEVER touched.
export const voidMonthBillingService = async (
  school_id:        number,
  academic_year_id: number,
  billing_month:    string,
  fee_type:         string
) => {
  await assertFeeManagementEnabled(school_id);

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billing_month)) {
    throw new AppError('billing_month must use YYYY-MM.', 400);
  }
  if (!['academic', 'transport', 'hostel'].includes(fee_type)) {
    throw new AppError('fee_type must be academic, transport, or hostel.', 400);
  }

  const result = await voidMonthBilling(school_id, academic_year_id, billing_month, fee_type);
  const protectedCount = result.protected_paid + result.protected_partial;

  return {
    ...result,
    message: result.voided === 0
      ? protectedCount > 0
        ? `No bills removed. ${protectedCount} bill(s) have payments and are protected.`
        : 'No unpaid bills found to remove for this month.'
      : protectedCount > 0
        ? `${result.voided} unpaid bill(s) removed. ${protectedCount} bill(s) with payments were kept (protected).`
        : `${result.voided} unpaid bill(s) removed successfully.`,
  };
};

// ── STUDENT BILLING TIMELINE — shows missing months per student ─────────────
// Returns for each enrolled student: which months have been billed vs missing
// between their effective billing start and today.
export const getStudentBillingTimelineService = async (
  school_id:        number,
  academic_year_id: number,
  billing_month:    string,  // YYYY-MM — the "up to" month to check
) => {
  await assertFeeManagementEnabled(school_id);

  const [academicYear, policy] = await Promise.all([
    getAcademicYearById(academic_year_id, school_id),
    getFeeBillingPolicy(school_id),
  ]);
  if (!academicYear) throw new AppError('Academic year not found.', 404);

  const yearStart   = new Date(`${String(academicYear.start_date).slice(0, 10)}T00:00:00`);
  const yearEnd     = new Date(`${String(academicYear.end_date).slice(0, 10)}T23:59:59`);

  const [targetYear, targetMonth] = billing_month.split('-').map(Number);
  const targetDate = new Date(targetYear, targetMonth - 1, 1);

  // Cap target at yearEnd
  const capDate = targetDate < yearEnd ? targetDate : yearEnd;

  const buildRange = (fromY: number, fromM: number): string[] => {
    const months: string[] = [];
    let y = fromY, m = fromM;
    while (y < capDate.getFullYear() || (y === capDate.getFullYear() && m <= capDate.getMonth() + 1)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++; if (m > 12) { m = 1; y++; }
    }
    return months;
  };

  const enrollments = await getEnrollmentsBySchool(school_id, academic_year_id);
  const results: any[] = [];

  for (const en of enrollments) {
    const structures = await getFeeStructuresByClass(en.class_id, school_id, academic_year_id);
    const monthlyStructures = structures.filter(s => s.is_active && s.frequency === 'monthly');
    if (!monthlyStructures.length) continue;

    const admDate  = new Date(en.admission_date);
    const admYear  = admDate.getFullYear();
    const admMonth = admDate.getMonth() + 1; // 1-indexed
    const admDay   = admDate.getDate();

    // Determine effective billing start month (1-indexed)
    let startYear  = yearStart.getFullYear();
    let startMonth = yearStart.getMonth() + 1; // 1-indexed

    if (policy.billing_start_from === 'join_date') {
      startYear  = admYear;
      startMonth = admMonth;
    }

    // Apply billing_start_rule from first structure
    const rule = (monthlyStructures[0] as any).billing_start_rule || 'next_month';

    if (rule === 'academic_year') {
      // Bill from AY start — don't adjust by admission date
      // startYear/startMonth already set to AY start above
    } else if (rule === 'next_month') {
      // ALWAYS use actual admission day for the 15-day rule:
      // If joined after 15th, first bill is next month.
      // If joined on or before 15th, first bill is the admission month itself.
      // This applies regardless of billing_start_from policy.
      if (admDay > 15) {
        // First billable month = month AFTER admission
        let sm = admMonth + 1, sy = admYear;
        if (sm > 12) { sm = 1; sy++; }
        // But never before AY start
        if (sy < yearStart.getFullYear() || (sy === yearStart.getFullYear() && sm < yearStart.getMonth() + 1)) {
          sy = yearStart.getFullYear(); sm = yearStart.getMonth() + 1;
        }
        startYear = sy; startMonth = sm;
      } else {
        // First billable month = admission month (but not before AY start)
        let sm = admMonth, sy = admYear;
        if (sy < yearStart.getFullYear() || (sy === yearStart.getFullYear() && sm < yearStart.getMonth() + 1)) {
          sy = yearStart.getFullYear(); sm = yearStart.getMonth() + 1;
        }
        startYear = sy; startMonth = sm;
      }
    } else if (rule === 'skip_two_months') {
      startMonth += 2;
      while (startMonth > 12) { startMonth -= 12; startYear++; }
    }

    const expectedMonths = buildRange(startYear, startMonth);

    // Get all academic bills for this student in this AY
    const billedRes = await pool.query(
      `SELECT to_char(due_date, 'YYYY-MM') AS billing_month,
              billing_from_month, billing_to_month, status, remaining_amount
       FROM fee_collections
       WHERE school_id        = $1
         AND student_id       = $2
         AND academic_year_id = $3
         AND fee_type         = 'academic'
         AND fee_structure_id IS NOT NULL
       ORDER BY due_date ASC`,
      [school_id, en.student_id, academic_year_id]
    );

    const billedSet = new Set<string>();
    for (const r of billedRes.rows) {
      if (r.billing_from_month && r.billing_to_month) {
        const [fYStr, fMStr] = r.billing_from_month.split('-');
        const [tYStr, tMStr] = r.billing_to_month.split('-');
        let y = parseInt(fYStr, 10), m = parseInt(fMStr, 10) - 1;
        const endY = parseInt(tYStr, 10), endM = parseInt(tMStr, 10) - 1;
        while (y < endY || (y === endY && m <= endM)) {
          billedSet.add(`${y}-${String(m + 1).padStart(2, '0')}`);
          m++; if (m > 11) { m = 0; y++; }
        }
      } else if (r.billing_month) {
        billedSet.add(r.billing_month);
      }
    }
    const missingMonths = expectedMonths.filter(m => !billedSet.has(m));

    if (missingMonths.length === 0) continue;

    // Build a compact range label: e.g. "Baishakh – Bhadra 2083" or "Baishakh 2083, Ashadh 2083"
    results.push({
      student_id:       en.student_id,
      full_name:        en.full_name,
      admission_number: en.admission_number,
      class_id:         en.class_id,
      class_name:       en.class_name || '',
      section_name:     en.section_name || '',
      missing_months:   missingMonths,
      missing_count:    missingMonths.length,
      effective_start:  `${startYear}-${String(startMonth).padStart(2, '0')}`,
    });
  }

  return {
    students: results,
    total_students_with_missing: results.length,
    billing_up_to: billing_month,
    policy: { billing_start_from: policy.billing_start_from, monthly_bill_window: policy.monthly_bill_window },
  };
};

// ── MONTHLY BILLING STATUS (which students have bills for a given month) ──────
export const getMonthlyBillingStatusService = async (
  school_id: number, academic_year_id: number, billing_month: string
) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billing_month)) {
    throw new AppError('billing_month must use YYYY-MM format.', 400);
  }
  return await getMonthlyBillingStatus(school_id, academic_year_id, billing_month);
};

// ── UNBILLED STUDENTS ─────────────────────────────────────────────────────────
// Returns active students who have NO bill for any of the given months + fee_type.
export const getUnbilledStudentsService = async (
  school_id:        number,
  academic_year_id: number,
  billing_months:   string[],
  fee_type:         string
) => {
  const validMonths = billing_months.filter(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m));
  if (!validMonths.length) throw new AppError('At least one valid billing_month (YYYY-MM) is required.', 400);
  const validTypes = ['academic', 'transport', 'hostel'];
  if (!validTypes.includes(fee_type)) throw new AppError('fee_type must be academic, transport, or hostel.', 400);
  return await getUnbilledStudents(school_id, academic_year_id, validMonths, fee_type);
};
