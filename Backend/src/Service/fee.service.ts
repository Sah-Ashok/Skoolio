import {
  createFeeStructure, getFeeStructuresByClass, getFeeStructureById,
  updateFeeStructure, deleteFeeStructure,
  createFeeCollection, getFeeCollectionsByStudent, getFeeCollectionsBySchool,
  getFeeCollectionById, updateFeeCollection,
  createFeePaymentAtomic, getPaymentsByCollection, getPaymentsByStudent,
  getTransportFeeForPeriod, getTransportFeeSummary,
  getHostelFeeForPeriod, getHostelFeeSummary,
} from '../Repositories/fee.repository';
import {
  ICreateFeeStructure, IUpdateFeeStructure,
  ICreateFeeCollection, IUpdateFeeCollection, ICreateFeePayment,
} from '../types/fee.types';
import { getStudentById } from '../Repositories/student.repository';
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
// Called after every academic fee collection is created.
// If the student has an active transport assignment and hasn't been billed
// for this month yet, auto-creates a separate transport fee_collection row.
const autoAddTransportFee = async (
  school_id:        number,
  created_by:       number,
  student_id:       number,
  academic_year_id: number
): Promise<boolean> => {
  // 1. Active transport assignment for this student this year?
  const assignment = await getAssignmentByStudent(student_id, school_id, academic_year_id);
  if (!assignment) return false;

  const monthly_fee = Number(assignment.monthly_fee);
  if (!monthly_fee || monthly_fee <= 0) return false;

  // 2. due_date = 1st of current month
  const today    = new Date();
  const due_date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  // 3. Already billed this period?
  const existing = await getTransportFeeForPeriod(
    school_id, student_id, academic_year_id, due_date
  );
  if (existing) return false;

  // 4. Create transport fee collection.
  //    fee_structure_id = null  — no fee_structure row exists for transport fees.
  //    enrollment_id    = null  — transport billing is not enrollment-specific.
  const fee_name = `Transport Fee — ${assignment.route_name} (${assignment.stop_name})`;
  await createFeeCollection(
    school_id,
    created_by,
    {
      student_id,
      enrollment_id:    null,   // no enrollment link for transport
      fee_structure_id: null,   // no fee_structure row for transport
      academic_year_id,
      due_date,
      total_amount:     monthly_fee,
    },
    fee_name,
    monthly_fee,   // net_amount (no discount/fine on auto-add)
    monthly_fee,   // remaining_amount
    'transport'
  );

  return true;
};

// ── HOSTEL FEE AUTO-ADD ─────────────────────────────────────────────────────
// Called after every academic fee collection is created.
const autoAddHostelFee = async (
  school_id:        number,
  created_by:       number,
  student_id:       number,
  academic_year_id: number
): Promise<boolean> => {
  // 1. Active hostel assignment for this student this year?
  const assignment = await getHostelAssignmentByStudent(student_id, school_id, academic_year_id);
  if (!assignment) return false;

  const monthly_fee = Number(assignment.monthly_fee);
  if (!monthly_fee || monthly_fee <= 0) return false;

  // 2. due_date = 1st of current month
  const today    = new Date();
  const due_date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  // 3. Already billed this period?
  const existing = await getHostelFeeForPeriod(
    school_id, student_id, academic_year_id, due_date
  );
  if (existing) return false;

  // 4. Create hostel fee collection
  const fee_name = `Hostel Fee — ${assignment.hostel_name} (Room ${assignment.room_number})`;
  await createFeeCollection(
    school_id,
    created_by,
    {
      student_id,
      enrollment_id:    null,
      fee_structure_id: null,
      academic_year_id,
      due_date,
      total_amount:     monthly_fee,
    },
    fee_name,
    monthly_fee,
    monthly_fee,
    'hostel'
  );

  return true;
};

// ── FEE COLLECTION SERVICES ────────────────────────────────────────────────

const calculateDueDate = (
  due_date_type: string,
  due_day:       number | undefined,
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

export const createFeeCollectionService = async (
  school_id:  number,
  created_by: number,
  data:       ICreateFeeCollection
) => {
  // fee_structure_id must be set for academic fees
  if (!data.fee_structure_id) {
    throw new AppError('fee_structure_id is required for academic fee collections.', 400);
  }

  // 1. Get fee structure
  const structure = await getFeeStructureById(data.fee_structure_id, school_id);
  if (!structure) throw new AppError('Fee structure not found.', 404);

  // 2. Get student
  const student = await getStudentById(data.student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);

  // 3. Calculate due date from structure config
  const due_date = calculateDueDate(
    structure.due_date_type,
    structure.due_day,
    student.admission_date as unknown as Date
  );

  // 4. Amounts
  const discount      = data.discount_amount || 0;
  const fine          = data.fine_amount     || 0;
  const net_amount    = data.total_amount - discount + fine;
  const remaining     = net_amount;

  // 5. Create academic fee collection
  const collection = await createFeeCollection(
    school_id,
    created_by,
    { ...data, due_date },
    structure.fee_name,
    net_amount,
    remaining,
    'academic'
  );

  // 6. Auto-add transport and hostel fee if the student has an active assignment
  //    and hasn't been billed for it this month yet.
  const transport_fee_added = await autoAddTransportFee(
    school_id,
    created_by,
    data.student_id,
    data.academic_year_id
  );

  const hostel_fee_added = await autoAddHostelFee(
    school_id,
    created_by,
    data.student_id,
    data.academic_year_id
  );

  return { collection, transport_fee_added, hostel_fee_added };
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
  // Guard: fee management must be enabled on this school's plan
  await assertFeeManagementEnabled(school_id);

  // 1. Get collection — validate before entering the transaction
  const collection = await getFeeCollectionById(data.collection_id, school_id);
  if (!collection) throw new AppError('Fee collection not found.', 404);

  // 2. Already fully paid?
  if (collection.status === 'paid') {
    throw new AppError('This fee is already fully paid.', 400);
  }

  // 3. Validate amount
  if (data.paid_amount <= 0) {
    throw new AppError('Payment amount must be greater than 0.', 400);
  }
  if (data.paid_amount > collection.remaining_amount) {
    throw new AppError(
      `Payment amount (${data.paid_amount}) cannot exceed remaining amount of ${collection.remaining_amount}.`,
      400
    );
  }

  // 4. Atomic: receipt generation + payment insert + collection update in one transaction
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

// ── GENERATE TRANSPORT BILLS (batch) ──────────────────────────────────────
// Generates a transport fee_collection for every student with an active
// assignment who has NOT already been billed for the given month.
// @param billing_month  'YYYY-MM'  e.g. '2026-07'
export const generateTransportBillsService = async (
  school_id:        number,
  created_by:       number,
  academic_year_id: number,
  billing_month:    string
) => {
  await assertFeeManagementEnabled(school_id);

  // due_date = 1st day of the billing month
  const due_date = `${billing_month}-01`;

  const routes = await getRoutesBySchool(school_id, academic_year_id);
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

        // Already billed for this period?
        const existing = await getTransportFeeForPeriod(
          school_id, assignment.student_id, academic_year_id, due_date
        );
        if (existing) { skipped++; continue; }

        const fee_name = `Transport Fee — ${route.name} (${assignment.stop_name}) — ${billing_month}`;

        // fee_structure_id = null — no fee_structure row for transport
        // enrollment_id    = null — transport billing is not enrollment-specific
        await createFeeCollection(
          school_id,
          created_by,
          {
            student_id:       assignment.student_id,
            enrollment_id:    null,
            fee_structure_id: null,
            academic_year_id,
            due_date,
            total_amount:     monthly_fee,
          },
          fee_name,
          monthly_fee,
          monthly_fee,
          'transport'
        );
        created++;
      } catch (err: any) {
        errors.push(`Student ${assignment.student_id}: ${err.message}`);
      }
    }
  }

  return { created, skipped, errors };
};

// ── TRANSPORT FEE SUMMARY ──────────────────────────────────────────────────
export const getTransportFeeSummaryService = async (
  school_id:        number,
  academic_year_id: number
) => {
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
  const hostels = await getHostelsBySchool(school_id);
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

        const existing = await getHostelFeeForPeriod(
          school_id, assignment.student_id, academic_year_id, due_date
        );
        if (existing) { skipped++; continue; }

        const fee_name = `Hostel Fee — ${hostel.name} (Room ${assignment.room_number}) — ${billing_month}`;
        await createFeeCollection(
          school_id,
          created_by,
          {
            student_id:       assignment.student_id,
            enrollment_id:    null,
            fee_structure_id: null,
            academic_year_id,
            due_date,
            total_amount:     monthly_fee,
          },
          fee_name,
          monthly_fee,
          monthly_fee,
          'hostel'
        );
        created++;
      } catch (err: any) {
        errors.push(`Student ${assignment.student_id}: ${err.message}`);
      }
    }
  }

  return { created, skipped, errors };
};

// ── HOSTEL FEE SUMMARY ──────────────────────────────────────────────────
export const getHostelFeeSummaryService = async (
  school_id:        number,
  academic_year_id: number
) => {
  return getHostelFeeSummary(school_id, academic_year_id);
};
