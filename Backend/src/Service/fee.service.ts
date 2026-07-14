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

// ── FEE STRUCTURE SERVICES ──────────────────────────────────────────────────

export const createFeeStructureService = async (
  school_id: number,
  data: ICreateFeeStructure
) => {
  await assertFeeManagementEnabled(school_id);

  if (data.due_date_type === 'fixed_day' && !data.due_day) {
    throw new AppError('due_day is required when due_date_type is fixed_day.', 400);
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

// ── P3 FIX: Miscellaneous / one-time fee collection (no fee_structure_id) ──
// Used by AddStudentForm for school store items (dress, books, ID card, etc.)
// fee_type = 'academic', fee_structure_id = null, fee_name from caller.
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
  student_id: number,
  school_id:  number
) => {
  const student = await getStudentById(student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);
  return await getFeeCollectionsByStudent(student_id, school_id);
};

export const updateFeeCollectionService = async (
  id:        number,
  school_id: number,
  data:      IUpdateFeeCollection
) => {
  const collection = await updateFeeCollection(id, school_id, data);
  if (!collection) throw new AppError('Fee collection not found.', 404);
  return collection;
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

  return await createFeePaymentAtomic(school_id, collected_by, data, {
    id:               collection.id,
    paid_amount:      collection.paid_amount,
    net_amount:       collection.net_amount,
    remaining_amount: collection.remaining_amount,
  });
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
  billing_month:    string
) => {
  await assertFeeManagementEnabled(school_id);

  const due_date = `${billing_month}-01`;
  const [billYearStr, billMonthStr] = billing_month.split('-');
  const billYear  = parseInt(billYearStr,  10);
  const billMonth = parseInt(billMonthStr, 10) - 1;

  const enrollments = await getEnrollmentsBySchool(school_id, academic_year_id);
  if (!enrollments.length) return { created: 0, skipped: 0, errors: [] };

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const en of enrollments) {
    try {
      const structures      = await getFeeStructuresByClass(en.class_id, school_id, academic_year_id);
      const monthlyStructures = structures.filter(s => s.frequency === 'monthly' && s.is_active);
      if (!monthlyStructures.length) { skipped++; continue; }

      const admissionDate  = new Date(en.admission_date);
      const admissionYear  = admissionDate.getFullYear();
      const admissionMonth = admissionDate.getMonth();
      const admissionDay   = admissionDate.getDate();

      for (const structure of monthlyStructures) {
        let isEligible = false;
        const rule = (structure as any).billing_start_rule || 'next_month';

        if (rule === 'academic_year') {
          isEligible = true;
        } else {
          const monthsDiff = (billYear - admissionYear) * 12 + (billMonth - admissionMonth);
          if (rule === 'next_month') {
            if (monthsDiff > 1)       isEligible = true;
            else if (monthsDiff === 1) isEligible = true;
            else if (monthsDiff === 0 && admissionDay <= 15) isEligible = true;
          } else if (rule === 'skip_two_months') {
            if (monthsDiff > 2)       isEligible = true;
            else if (monthsDiff === 2) isEligible = true;
          }
        }

        if (!isEligible) { skipped++; continue; }

        const existingResult = await getAcademicFeeForPeriod(school_id, en.student_id, structure.id, due_date);
        if (existingResult) { skipped++; continue; }

        const amount = Number(structure.amount);
        let discount        = 0;
        let discount_reason = '';
        if (en.scholarship_percent && Number(en.scholarship_percent) > 0) {
          discount        = (amount * Number(en.scholarship_percent)) / 100;
          discount_reason = `Scholarship: ${en.scholarship_percent}% (${en.scholarship_type || 'Custom'})`;
        }
        const net_amount = amount - discount;
        const fee_name   = `${structure.fee_name} — ${billing_month}`;

        await createFeeCollection(
          school_id, created_by,
          {
            student_id:       en.student_id,
            enrollment_id:    en.id,
            fee_structure_id: structure.id,
            academic_year_id,
            due_date,
            total_amount:     amount,
            discount_amount:  discount > 0 ? discount : undefined,
            discount_reason:  discount_reason || undefined,
          },
          fee_name, net_amount, net_amount, 'academic'
        );
        created++;
      }
    } catch (err: any) {
      errors.push(`Student ${en.student_id}: ${err.message}`);
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
        errors.push(`Student ${assignment.student_id}: ${err.message}`);
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
        errors.push(`Student ${assignment.student_id}: ${err.message}`);
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
