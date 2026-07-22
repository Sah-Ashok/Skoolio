import bcrypt from 'bcrypt';
import {
  createTeacher, getTeachersBySchool, getTeacherById,
  getTeacherByEmail, getTeacherByPhone, updateTeacher, deleteTeacher,
  assignSubjectToTeacher, getSubjectsByTeacher, removeSubjectFromTeacher,
  createSalary, getSalariesByTeacher, getSalaryById, updateSalary,
  getSalarySummaryBySchool,
  getTeacherAttendanceSummaryByMonth, getTeacherAttendanceByMonth,
  getSectionsByCoordinator,
  markTeacherPersonalAttendance, getTeacherPersonalAttendanceByDate,
} from '../Repositories/teacher.repository';
import { ICreateTeacher, IUpdateTeacher, ICreateSalary, IUpdateSalary } from '../types/teacher.types';
import AppError from '../utils/AppError';
import { assertCanAddTeacher } from './subscription.service';

// ── TEACHER SERVICES ──

export const createTeacherService = async (school_id: number, data: ICreateTeacher) => {
  await assertCanAddTeacher(school_id);
  const existingEmail = await getTeacherByEmail(data.email, school_id);
  if (existingEmail) throw new AppError('Email already exists.', 400);
  const existingPhone = await getTeacherByPhone(data.phone, school_id);
  if (existingPhone) throw new AppError('Phone number already exists.', 400);
  const hashedPassword = await bcrypt.hash(data.password, 10);
  return createTeacher(school_id, { ...data, password: hashedPassword });
};

export const getTeachersService = async (school_id: number) => {
  return getTeachersBySchool(school_id);
};

export const getTeacherByIdService = async (id: number, school_id: number) => {
  const teacher = await getTeacherById(id, school_id);
  if (!teacher) throw new AppError('Teacher not found.', 404);
  const subjects = await getSubjectsByTeacher(id, school_id);
  return { ...teacher, subjects };
};

export const updateTeacherService = async (id: number, school_id: number, data: IUpdateTeacher) => {
  if (data.phone) {
    const existingPhone = await getTeacherByPhone(data.phone, school_id);
    if (existingPhone && existingPhone.id !== id) throw new AppError('Phone number already exists.', 400);
  }
  const teacher = await updateTeacher(id, school_id, data);
  if (!teacher) throw new AppError('Teacher not found.', 404);
  return teacher;
};

export const deleteTeacherService = async (id: number, school_id: number) => {
  const teacher = await getTeacherById(id, school_id);
  if (!teacher) throw new AppError('Teacher not found.', 404);
  const deleted = await deleteTeacher(id, school_id);
  if (!deleted) throw new AppError('Failed to delete teacher.', 500);
};

// ── TEACHER SUBJECT SERVICES ──

export const assignSubjectToTeacherService = async (school_id: number, teacher_id: number, subject_id: number) => {
  const teacher = await getTeacherById(teacher_id, school_id);
  if (!teacher) throw new AppError('Teacher not found.', 404);
  return assignSubjectToTeacher(school_id, teacher_id, subject_id);
};

export const getTeacherSubjectsService = async (teacher_id: number, school_id: number) => {
  const teacher = await getTeacherById(teacher_id, school_id);
  if (!teacher) throw new AppError('Teacher not found.', 404);
  return getSubjectsByTeacher(teacher_id, school_id);
};

export const removeTeacherSubjectService = async (teacher_id: number, subject_id: number, school_id: number) => {
  const removed = await removeSubjectFromTeacher(teacher_id, subject_id, school_id);
  if (!removed) throw new AppError('Subject not assigned to this teacher.', 404);
};

// ── SALARY SERVICES ──

export const createSalaryService = async (school_id: number, paid_by: number, data: ICreateSalary) => {
  const teacher = await getTeacherById(data.teacher_id, school_id);
  if (!teacher) throw new AppError('Teacher not found.', 404);
  return createSalary(school_id, paid_by, data);
};

export const getTeacherSalariesService = async (teacher_id: number, school_id: number) => {
  const teacher = await getTeacherById(teacher_id, school_id);
  if (!teacher) throw new AppError('Teacher not found.', 404);
  return getSalariesByTeacher(teacher_id, school_id);
};

export const updateSalaryService = async (id: number, school_id: number, data: IUpdateSalary) => {
  const salary = await updateSalary(id, school_id, data);
  if (!salary) throw new AppError('Salary record not found.', 404);
  return salary;
};

// ── SALARY SUMMARY SERVICE ──────────────────────────────────────────────────

export const getSalarySummaryService = async (school_id: number) => {
  return getSalarySummaryBySchool(school_id);
};

export const getAttendanceSummaryForSalaryService = async (
  school_id: number,
  teacher_id: number,
  year: number,
  month: number
) => {
  const teacher = await getTeacherById(teacher_id, school_id);
  if (!teacher) throw new AppError('Teacher not found.', 404);
  const summary = await getTeacherAttendanceSummaryByMonth(school_id, teacher_id, year, month);
  const records = await getTeacherAttendanceByMonth(school_id, teacher_id, year, month);
  return { summary, records, teacher };
};

// ── TEACHER PERSONAL ATTENDANCE ──────────────────────────────────────────────

export const bulkMarkTeacherAttendanceService = async (
  school_id: number,
  date: string,
  records: Array<{ teacher_id: number; status: string; check_in?: string; check_out?: string; note?: string }>
) => {
  const results = await Promise.all(
    records.map(r =>
      markTeacherPersonalAttendance(school_id, r.teacher_id, date, r.status, r.check_in, r.check_out, r.note)
    )
  );
  return results;
};

export const getTeacherAttendanceByDateService = async (school_id: number, date: string) => {
  return getTeacherPersonalAttendanceByDate(school_id, date);
};

// ── COORDINATOR SECTIONS (faculty self-service) ──

export const getMyCoordinatorSectionsService = async (teacher_id: number, school_id: number) => {
  return getSectionsByCoordinator(teacher_id, school_id);
};
