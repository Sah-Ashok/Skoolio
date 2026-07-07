import bcrypt from 'bcrypt';
import {
  createStudent, getStudentsBySchool, getStudentById,
  getStudentByAdmissionNumber, getStudentByEmail, updateStudent, deleteStudent,
  createEnrollment, getEnrollmentsBySchool, getEnrollmentByStudent,
  getEnrollmentById, updateEnrollment,
} from '../Repositories/student.repository';
import { ICreateStudent, IUpdateStudent, ICreateEnrollment, IUpdateEnrollment } from '../types/student.types';
import AppError from '../utils/AppError';
import { assertCanAddStudent } from './subscription.service';
// ── STUDENT SERVICES ──

export const createStudentService = async (school_id: number, data: ICreateStudent) => {
  
    await assertCanAddStudent(school_id);
  // 1. Check duplicate admission number
  const existingAdmission = await getStudentByAdmissionNumber(data.admission_number, school_id);
  if (existingAdmission) throw new AppError('Admission number already exists.', 400);

  // 2. Check duplicate email if provided
  if (data.email) {
    const existingEmail = await getStudentByEmail(data.email, school_id);
    if (existingEmail) throw new AppError('Email already exists.', 400);
  }

  // 3. Hash password
  const hashedPassword = await bcrypt.hash(data.password, 10);

  // 4. Create student
  const student = await createStudent(school_id, {
    ...data,
    password: hashedPassword,
  });

  return student;
};

export const getStudentsService = async (school_id: number) => {
  const students = await getStudentsBySchool(school_id);
  return students;
};

export const getStudentByIdService = async (id: number, school_id: number) => {
  const student = await getStudentById(id, school_id);
  if (!student) throw new AppError('Student not found.', 404);

  // Get enrollment history
  const enrollments = await getEnrollmentByStudent(id, school_id);

  return { ...student, enrollments };
};

export const getStudentProfileService = async (id: number, school_id: number) => {
  const student = await getStudentById(id, school_id);
  if (!student) throw new AppError('Student not found.', 404);
  return student;
};

export const updateStudentService = async (
  id: number,
  school_id: number,
  data: IUpdateStudent
) => {
  const student = await updateStudent(id, school_id, data);
  if (!student) throw new AppError('Student not found.', 404);
  return student;
};

export const deleteStudentService = async (id: number, school_id: number) => {
  const student = await getStudentById(id, school_id);
  if (!student) throw new AppError('Student not found.', 404);

  const deleted = await deleteStudent(id, school_id);
  if (!deleted) throw new AppError('Failed to delete student.', 500);
};

// ── ENROLLMENT SERVICES ──

export const createEnrollmentService = async (
  school_id: number,
  data: ICreateEnrollment
) => {
  // 1. Check student exists
  const student = await getStudentById(data.student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);

  // 2. Check if already enrolled in this academic year
  const enrollments = await getEnrollmentByStudent(data.student_id, school_id);
  const alreadyEnrolled = enrollments.find(
    e => e.academic_year_id === data.academic_year_id
  );
  if (alreadyEnrolled) {
    throw new AppError('Student is already enrolled in this academic year.', 400);
  }

  // 3. Create enrollment
  const enrollment = await createEnrollment(school_id, data);
  return enrollment;
};

export const getEnrollmentsService = async (
  school_id: number,
  academic_year_id: number,
  section_id?: number
) => {
  return getEnrollmentsBySchool(school_id, academic_year_id, section_id);
};

export const getStudentEnrollmentsService = async (
  student_id: number,
  school_id: number
) => {
  const student = await getStudentById(student_id, school_id);
  if (!student) throw new AppError('Student not found.', 404);

  const enrollments = await getEnrollmentByStudent(student_id, school_id);
  return enrollments;
};

export const updateEnrollmentService = async (
  id: number,
  school_id: number,
  data: IUpdateEnrollment
) => {
  const enrollment = await updateEnrollment(id, school_id, data);
  if (!enrollment) throw new AppError('Enrollment not found.', 404);
  return enrollment;
};