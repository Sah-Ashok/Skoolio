import pool from '../config/db';
import {
  ITeacher, ICreateTeacher, IUpdateTeacher,
  ITeacherSubject, ITeacherSalary, ICreateSalary, IUpdateSalary
} from '../types/teacher.types';

// ── TEACHER QUERIES ──

export const createTeacher = async (
  school_id: number,
  data: ICreateTeacher
): Promise<ITeacher> => {
  const result = await pool.query(
    `INSERT INTO teachers
      (school_id, full_name, email, phone, password, gender, date_of_birth, city, state, country, qualification, experience_years, join_date, status, photo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id, school_id, full_name, email, phone, gender, date_of_birth::text, city, state, country, qualification, experience_years, join_date::text, status, photo, role, created_at, updated_at`,
    [
      school_id,
      data.full_name,
      data.email,
      data.phone,
      data.password,
      data.gender,
      data.date_of_birth || null,
      data.city || null,
      data.state || null,
      data.country || null,
      data.qualification || null,
      data.experience_years || 0,
      data.join_date,
      data.status || 'active',
      data.photo || null,
    ]
  );
  return result.rows[0];
};

export const getTeachersBySchool = async (
  school_id: number
): Promise<ITeacher[]> => {
  const result = await pool.query(
    `SELECT id, school_id, full_name, email, phone, gender, date_of_birth::text, city, state, country, qualification, experience_years, join_date::text, status, photo, role, created_at, updated_at
     FROM teachers WHERE school_id = $1
     ORDER BY full_name ASC`,
    [school_id]
  );
  return result.rows;
};

export const getTeacherById = async (
  id: number,
  school_id: number
): Promise<ITeacher | null> => {
  const result = await pool.query(
    `SELECT id, school_id, full_name, email, phone, gender, date_of_birth::text, city, state, country, qualification, experience_years, join_date::text, status, photo, role, created_at, updated_at
     FROM teachers WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const getTeacherByEmail = async (
  email: string,
  school_id: number
): Promise<ITeacher | null> => {
  const result = await pool.query(
    `SELECT * FROM teachers WHERE email = $1 AND school_id = $2`,
    [email, school_id]
  );
  return result.rows[0] || null;
};

// Used for login — teacher doesn't know their school_id upfront
export const findTeacherByEmailGlobal = async (
  email: string
): Promise<(ITeacher & { school_name: string; school_logo: string | null; school_timezone: string; school_account_status: string }) | null> => {
  const result = await pool.query(
    `SELECT t.*, s.school_name, s.logo as school_logo, s.timezone as school_timezone, s.is_account as school_account_status
     FROM teachers t
     INNER JOIN schools s ON s.id = t.school_id
     WHERE t.email = $1`,
    [email]
  );
  return result.rows[0] || null;
};

export const getTeacherByPhone = async (
  phone: string,
  school_id: number
): Promise<ITeacher | null> => {
  const result = await pool.query(
    `SELECT * FROM teachers WHERE phone = $1 AND school_id = $2`,
    [phone, school_id]
  );
  return result.rows[0] || null;
};

export const updateTeacher = async (
  id: number,
  school_id: number,
  data: IUpdateTeacher
): Promise<ITeacher | null> => {
  const result = await pool.query(
    `UPDATE teachers SET
      full_name        = COALESCE($1, full_name),
      phone            = COALESCE($2, phone),
      gender           = COALESCE($3, gender),
      date_of_birth    = COALESCE($4, date_of_birth),
      city             = COALESCE($5, city),
      state            = COALESCE($6, state),
      country          = COALESCE($7, country),
      qualification    = COALESCE($8, qualification),
      experience_years = COALESCE($9, experience_years),
      join_date        = COALESCE($10, join_date),
      status           = COALESCE($11, status),
      photo            = COALESCE($12, photo),
      updated_at       = NOW()
     WHERE id = $13 AND school_id = $14
     RETURNING id, school_id, full_name, email, phone, gender, date_of_birth::text, city, state, country, qualification, experience_years, join_date::text, status, photo, role, created_at, updated_at`,
    [
      data.full_name || null,
      data.phone || null,
      data.gender || null,
      data.date_of_birth || null,
      data.city || null,
      data.state || null,
      data.country || null,
      data.qualification || null,
      data.experience_years || null,
      data.join_date || null,
      data.status || null,
      data.photo || null,
      id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

export const deleteTeacher = async (
  id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM teachers WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── TEACHER SUBJECT QUERIES ──

export const assignSubjectToTeacher = async (
  school_id: number,
  teacher_id: number,
  subject_id: number
): Promise<ITeacherSubject> => {
  const result = await pool.query(
    `INSERT INTO teacher_subjects (school_id, teacher_id, subject_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [school_id, teacher_id, subject_id]
  );
  return result.rows[0];
};

export const getSubjectsByTeacher = async (
  teacher_id: number,
  school_id: number
): Promise<ITeacherSubject[]> => {
  const result = await pool.query(
    `SELECT s.* FROM subjects s
     INNER JOIN teacher_subjects ts ON ts.subject_id = s.id
     WHERE ts.teacher_id = $1 AND ts.school_id = $2
     ORDER BY s.name ASC`,
    [teacher_id, school_id]
  );
  return result.rows;
};

export const removeSubjectFromTeacher = async (
  teacher_id: number,
  subject_id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM teacher_subjects
     WHERE teacher_id = $1 AND subject_id = $2 AND school_id = $3`,
    [teacher_id, subject_id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── SALARY QUERIES ──

export const createSalary = async (
  school_id: number,
  paid_by: number,
  data: ICreateSalary
): Promise<ITeacherSalary> => {
  const result = await pool.query(
    `INSERT INTO teacher_salaries
      (school_id, academic_year_id, teacher_id, basic_salary, bonus, deduction, month, year, payment_date, payment_method, status, paid_by, remarks)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *, net_salary`,
    [
      school_id,
      data.academic_year_id,
      data.teacher_id,
      data.basic_salary,
      data.bonus || 0,
      data.deduction || 0,
      data.month,
      data.year,
      data.payment_date || null,
      data.payment_method || null,
      data.status || 'pending',
      paid_by,
      data.remarks || null,
    ]
  );
  return result.rows[0];
};

export const getSalariesByTeacher = async (
  teacher_id: number,
  school_id: number
): Promise<ITeacherSalary[]> => {
  const result = await pool.query(
    `SELECT *, net_salary FROM teacher_salaries
     WHERE teacher_id = $1 AND school_id = $2
     ORDER BY year DESC, month DESC`,
    [teacher_id, school_id]
  );
  return result.rows;
};

export const getSalaryById = async (
  id: number,
  school_id: number
): Promise<ITeacherSalary | null> => {
  const result = await pool.query(
    `SELECT *, net_salary FROM teacher_salaries WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateSalary = async (
  id: number,
  school_id: number,
  data: IUpdateSalary
): Promise<ITeacherSalary | null> => {
  const result = await pool.query(
    `UPDATE teacher_salaries SET
      basic_salary   = COALESCE($1, basic_salary),
      bonus          = COALESCE($2, bonus),
      deduction      = COALESCE($3, deduction),
      payment_date   = COALESCE($4, payment_date),
      payment_method = COALESCE($5, payment_method),
      status         = COALESCE($6, status),
      remarks        = COALESCE($7, remarks),
      updated_at     = NOW()
     WHERE id = $8 AND school_id = $9
     RETURNING *, net_salary`,
    [
      data.basic_salary || null,
      data.bonus || null,
      data.deduction || null,
      data.payment_date || null,
      data.payment_method || null,
      data.status || null,
      data.remarks || null,
      id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

// ── COORDINATOR SECTIONS ──

export const getSectionsByCoordinator = async (
  teacher_id: number,
  school_id: number
): Promise<any[]> => {
  const result = await pool.query(
    `SELECT
       s.*,
       c.name AS class_name,
       c.id   AS class_id
     FROM sections s
     INNER JOIN classes c ON c.id = s.class_id
     WHERE s.coordinator_id = $1
       AND s.school_id      = $2
       AND s.status         = 'active'
     ORDER BY c.name ASC, s.name ASC`,
    [teacher_id, school_id]
  );
  return result.rows;
};

