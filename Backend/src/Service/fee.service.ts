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

  // Prevent duplicate fee structures at the service layer with a clear 409 error
  // The DB has a unique constraint (school_id, academic_year_id, class_id, fee_name)
  // but checking before insert allows a friendlier response and avoids noisy DB errors.
  if (!data.class_id || !data.academic_year_id || !data.fee_name) {
    // Defensive: let the DB/service validation handle missing fields if any required
    return await createFeeStructure(school_id, data);
  }

  const existing = await getFeeStructuresByClass(data.class_id, school_id, data.academic_year_id);
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
  id:        number,
  school_id: number,
  data:      IUpdateFeeStructure
) => {
  validateFeeStructure(data);
  const structure = await updateFeeStructure(id, school_id, data);
  if (!structure) throw new AppError('Fee structure not found.', 404);
  return structure;
};

export const deleteFeeStructureService = async (
  id:        number,
  school_id: number
) => {
  const structure = await getFeeStructureById(id, school_id);
  if (!structure) throw new AppError('Fee structure not found.', 404);

  const deleted = await deleteFeeStructure(id, school_id);
  if (!deleted) throw new AppError('Failed to delete fee structure.', 500);
};

// ── TRANSPORT FEE AUTO-ADD ──────────────────────────────────────────────────
const autoAddTransportFee = async (
  school_id:        number,
  created_by:       number,
  student_id:       number,
  academic_year_id: number
): Promise<boolean> => {
  const assignment = await getAssignmentByStudent(student_id, school_id, academic_year_id);
  if (!assignment) return false;

  const monthly_fee = Number(assignment.monthly_fee);
  if (!monthly_fee || monthly_fee <= 0) return false;

  const today    = new Date();
  const due_date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

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
  school_id:        number,
  created_by:       number,
  student_id:       number,
  academic_year_id: number
): Promise<boolean> => {
  const assignment = await getHostelAssignmentByStudent(student_id, school_id, academic_year_id);
  if (!assignment) return false;

  const monthly_fee = Number(assignment.monthly_fee);
  if (!monthly_fee || monthly_fee <= 0) return false;

  const today    = new Date();
  const due_date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

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

const calculateDueDate = (
  due_date_type:  string,
  due_day:        number | undefined,
  admission_date: Date
): Date => {
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth();

  if (due_date_type === 'fixed_day' && due_day) {
    return new Date(year, month, due_day);
  }
  const admissionDay = new Date(admission_date).getDate();
  return new Date(year, month, admissionDay);
};

// ── Academic fee collection (requires fee_structure_id) ──
export const createFeeCollectionService = async (
  school_id:  number,
  created_by: number,
  data:       ICreateFeeCollection
) => {
  if (!data.fee_structure_id) {
    throw new AppError('fee_structure_id is required for academic fee collections.', 400);
  }

  const structure = await getFeeStructureById(data.fee_structure_id, school_id);
  if (!structure) throw new AppError('Fee structure not found.', 404);

  const student = await getStudentById(data.student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);

  const due_date   = calculateDueDate(structure.due_date_type, structure.due_day, student.admission_date as unknown as Date);
  const discount   = data.discount_amount || 0;
  const fine       = data.fine_amount     || 0;
  const net_amount = data.total_amount - discount + fine;

  const collection = await createFeeCollection(
    school_id, created_by,
    { ...data, due_date },
    structure.fee_name,
    net_amount, net_amount, 'academic'
  );

  const transport_fee_added = await autoAddTransportFee(school_id, created_by, data.student_id, data.academic_year_id);
  const hostel_fee_added    = await autoAddHostelFee(school_id, created_by, data.student_id, data.academic_year_id);

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
      student_id:       data.student_id,
      enrollment_id:    data.enrollment_id,
      fee_structure_id: null,
      academic_year_id: data.academic_year_id,
      due_date:         data.due_date,
      total_amount:     data.total_amount,
      discount_amount:  discount > 0 ? discount   : undefined,
      discount_reason:  discount > 0 ? data.discount_reason : undefined,
    },
    data.fee_name,
    net_amount,
    net_amount,
    'academic'
  );
};

export const getFeeCollectionsService = async (
  school_id:        number,
  academic_year_id: number
) => {
  return await getFeeCollectionsBySchool(school_id, academic_year_id);
};

export const getStudentFeeCollectionsService = async (
  student_id:        number,
  school_id:         number,
  academic_year_id?: number
) => {
  const student = await getStudentById(student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);
  return await getFeeCollectionsByStudent(student_id, school_id, academic_year_id);
};

export const waiveFeeCollectionService = async (
  id:        number,
  school_id: number,
  reason:    string
) => {
  const collection = await getFeeCollectionById(id, school_id);
  if (!collection) throw new AppError('Fee collection not found.', 404);
  if (collection.status === 'paid') throw new AppError('Cannot waive a fully paid collection.', 400);
  const waived = await waiveFeeCollection(id, school_id, reason);
  if (!waived) throw new AppError('Failed to waive fee collection.', 500);
  return waived;
};

export const updateFeeCollectionService = async (
  id:        number,
  school_id: number,
  data:      IUpdateFeeCollection
) => {
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
  school_id:    number,
  collected_by: number,
  data:         ICreateFeePayment
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
      `Payment amount (${data.paid_amount}) cannot exceed remaining amount of ${collection.remaining_amount}.`,
      400
    );
  }

  return await createFeePaymentAtomic(school_id, collected_by, data);
};

export const getPaymentsByCollectionService = async (
  collection_id: number,
  school_id:     number
) => {
  return await getPaymentsByCollection(collection_id, school_id);
};

export const getStudentPaymentsService = async (
  student_id: number,
  school_id:  number
) => {
  const student = await getStudentById(student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);
  return await getPaymentsByStudent(student_id, school_id);
};

// ── GENERATE MONTHLY ACADEMIC BILLS (batch) ───────────────────────────────
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

  const academicYear = await getAcademicYearById(academic_year_id, school_id);
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

  // How many months from the academic year start to this billing month
  const monthsFromYearStart =
    (billYear - yearStart.getFullYear()) * 12 + (billMonth - yearStart.getMonth());

  // Is this frequency due in this billing month?
  const isFrequencyDue = (frequency: string): boolean => {
    if (frequency === 'monthly')                                             return true;
    if (frequency === 'quarterly'   && monthsFromYearStart % 3 === 0)       return true;
    if (frequency === 'half_yearly' && monthsFromYearStart % 6 === 0)       return true;
    if (frequency === 'yearly'      || frequency === 'one_time')            return true; // idempotency handled below
    return false;
  };

  const enrollments = await getEnrollmentsBySchool(school_id, academic_year_id);
  if (!enrollments.length) return { created: 0, skipped: 0, errors: [] };

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const en of enrollments) {
    try {
      const structures       = await getFeeStructuresByClass(en.class_id, school_id, academic_year_id);
      const activeStructures = structures.filter(s => s.is_active && isFrequencyDue(s.frequency));
      if (!activeStructures.length) { skipped++; continue; }

      const admissionDate  = new Date(en.admission_date);
      const admissionYear  = admissionDate.getFullYear();
      const admissionMonth = admissionDate.getMonth(); // 0-indexed
      const admissionDay   = admissionDate.getDate();

      for (const structure of activeStructures) {
        // ── Due date for this billing month ─────────────────────────────────
        const preferredDay = structure.due_date_type === 'admission_date'
          ? admissionDay
          : Number(structure.due_day || 1);
        const lastDay  = new Date(billYear, billMonth + 1, 0).getDate();
        const due_date = `${billing_month}-${String(Math.min(Math.max(preferredDay, 1), lastDay)).padStart(2, '0')}`;

        // ── Eligibility: when does billing START for this student? ──────────
        // For yearly / one_time: ALWAYS eligible if enrolled — the year has started
        // and idempotency (checked below) prevents double billing.
        const isYearlyOrOneTime =
          structure.frequency === 'yearly' || structure.frequency === 'one_time';

        let isEligible = false;

        if (isYearlyOrOneTime) {
          // Eligible as long as student is enrolled this academic year.
          // We do NOT restrict by admission month — the school set up this
          // structure for the whole class, so every enrolled student owes it.
          isEligible = true;
        } else {
          // Recurring fees: apply billing_start_rule
          const rule       = (structure as any).billing_start_rule || 'next_month';
          const monthsDiff = (billYear - admissionYear) * 12 + (billMonth - admissionMonth);

          if (rule === 'academic_year') {
            // Bill from day 1 of the academic year regardless of admission date
            isEligible = true;
          } else if (rule === 'next_month') {
            // Bill from the month after admission (if admitted before 15th, bill same month)
            isEligible = monthsDiff > 0 || (monthsDiff === 0 && admissionDay <= 15);
          } else if (rule === 'skip_two_months') {
            // Bill starting from 2 months after admission
            isEligible = monthsDiff >= 2;
          } else {
            isEligible = monthsDiff >= 1;
          }
        }

        if (!isEligible) { skipped++; continue; }

        // ── Idempotency: don't double-bill ──────────────────────────────────
        if (isYearlyOrOneTime) {
          // For yearly/one_time: only one bill allowed per academic year per structure
          const alreadyBilled = await getYearlyFeeForAcademicYear(
            school_id, en.student_id, structure.id, academic_year_id
          );
          if (alreadyBilled) { skipped++; continue; }
        } else {
          // For recurring: one bill per due_date per structure
          const alreadyBilled = await getAcademicFeeForPeriod(
            school_id, en.student_id, structure.id, due_date
          );
          if (alreadyBilled) { skipped++; continue; }
        }

        // ── Scholarship discount ─────────────────────────────────────────────
        // Only apply scholarship to fees where scholarship_applies = true
        // (stored on fee_structure; defaults true for backward compat).
        // If not set on structure, default = apply to all (safe legacy behaviour).
        const scholarshipApplies =
          (structure as any).scholarship_applies !== false; // undefined or true → apply

        const amount = Number(structure.amount);
        let discount        = 0;
        let discount_reason = '';

        if (
          scholarshipApplies &&
          en.scholarship_percent &&
          Number(en.scholarship_percent) > 0
        ) {
          discount        = Math.round((amount * Number(en.scholarship_percent)) / 100 * 100) / 100;
          discount_reason = `${en.scholarship_type || 'Scholarship'}: ${en.scholarship_percent}% discount`;
        }

        const net_amount = amount - discount;

        // For yearly/one_time fees the fee_name has no month suffix
        const fee_name = isYearlyOrOneTime
          ? structure.fee_name
          : `${structure.fee_name} — ${billing_month}`;

        await createFeeCollection(
          school_id, created_by,
          {
            student_id:       en.student_id,
            enrollment_id:    en.id,
            fee_structure_id: structure.id,
            academic_year_id,
            due_date,
            total_amount:     amount,
            discount_amount:  discount > 0 ? discount    : undefined,
            discount_reason:  discount > 0 ? discount_reason : undefined,
          },
          fee_name, net_amount, net_amount, 'academic'
        );
        created++;
      }
    } catch (err: any) {
      if (err?.code === '23505') skipped++; // unique constraint = already billed
      else errors.push(`Student ${en.student_id}: ${err.message}`);
    }
  }

  return { created, skipped, errors };
};

// ── GENERATE TRANSPORT BILLS (batch) ──────────────────────────────────────
export const generateTransportBillsService = async (
  school_id:        number,
  created_by:       number,
  academic_year_id: number,
  billing_month:    string
) => {
  await assertFeeManagementEnabled(school_id);

  await assertBillingMonthInAcademicYear(school_id, academic_year_id, billing_month);

  const due_date = `${billing_month}-01`;
  const routes   = await getRoutesBySchool(school_id, academic_year_id);
  if (!routes.length) return { created: 0, skipped: 0, errors: [] };

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const route of routes) {
    const assignments = await getAssignmentsByRoute(route.id, school_id);
    for (const assignment of assignments) {
      try {
        const monthly_fee = Number(assignment.monthly_fee);
        if (!monthly_fee || monthly_fee <= 0) { skipped++; continue; }

        const existing = await getTransportFeeForPeriod(school_id, assignment.student_id, academic_year_id, due_date);
        if (existing) { skipped++; continue; }

        const fee_name = `Transport Fee — ${route.name} (${assignment.stop_name}) — ${billing_month}`;
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

// ── GENERATE HOSTEL BILLS (batch) ───────────────────────────────────────
export const generateHostelBillsService = async (
  school_id:        number,
  created_by:       number,
  academic_year_id: number,
  billing_month:    string
) => {
  await assertFeeManagementEnabled(school_id);

  await assertBillingMonthInAcademicYear(school_id, academic_year_id, billing_month);

  const due_date = `${billing_month}-01`;
  const hostels  = await getHostelsBySchool(school_id);
  if (!hostels.length) return { created: 0, skipped: 0, errors: [] };

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const hostel of hostels) {
    const assignments = await getAssignmentsByHostel(hostel.id, school_id);
    for (const assignment of assignments) {
      try {
        const monthly_fee = Number(assignment.monthly_fee);
        if (!monthly_fee || monthly_fee <= 0) { skipped++; continue; }

        const existing = await getHostelFeeForPeriod(school_id, assignment.student_id, academic_year_id, due_date);
        if (existing) { skipped++; continue; }

        const fee_name = `Hostel Fee — ${hostel.name} (Room ${assignment.room_number}) — ${billing_month}`;
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
  school_id:        number,
  academic_year_id: number,
  billing_month:    string
) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billing_month)) {
    throw new AppError('billing_month must use YYYY-MM format.', 400);
  }
  return await getMonthlyBillingStatus(school_id, academic_year_id, billing_month);
};
