import AppError from '../utils/AppError';
import pool from '../config/db';
import {
  createNotice,
  getAllNoticesForSchool,
  getNoticesForTeacher,
  getNoticesForStudent,
  getStudentActiveSectionId,
  getNoticeById,
  updateNotice,
  deleteNotice,
  getTeacherSectionIds,
} from '../Repositories/notice.repository';
import { ICreateNotice, IUpdateNotice, INotice } from '../types/notice.types';

// Fetch teacher full_name from DB (JWT doesn't carry full_name)
const getTeacherName = async (teacher_id: number, school_id: number): Promise<string> => {
  const res = await pool.query(
    `SELECT full_name FROM teachers WHERE id = $1 AND school_id = $2`,
    [teacher_id, school_id]
  );
  return res.rows[0]?.full_name || 'Teacher';
};

// ── ADMIN: Create notice (school-wide) ────────────────────────

export const createNoticeAdminService = async (
  school_id: number,
  admin_name: string,
  data: ICreateNotice
): Promise<INotice> => {
  // Admin notices are always school-wide (no section targeting)
  const noticeData: ICreateNotice = {
    ...data,
    target_type: null,
    target_section_id: null,
  };
  return createNotice(school_id, 'admin', school_id, admin_name, noticeData);
};

// ── TEACHER: Create notice (section-scoped) ───────────────────

export const createNoticeTeacherService = async (
  school_id: number,
  teacher_id: number,
  data: ICreateNotice
): Promise<INotice> => {
  const teacher_name = await getTeacherName(teacher_id, school_id);
  // Validate teacher is coordinator of the given section
  if (!data.target_section_id) {
    throw new AppError('Teachers must specify a target section for their notices.', 400);
  }

  const sectionIds = await getTeacherSectionIds(teacher_id, school_id);
  if (!sectionIds.includes(data.target_section_id)) {
    throw new AppError('You can only post notices for sections you coordinate.', 403);
  }

  const noticeData: ICreateNotice = {
    ...data,
    target_type: 'section',
  };
  return createNotice(school_id, 'faculty', teacher_id, teacher_name, noticeData);
};

// ── GET: Admin — all notices ──────────────────────────────────

export const getNoticesAdminService = async (school_id: number): Promise<INotice[]> => {
  return getAllNoticesForSchool(school_id);
};

// ── GET: Teacher — visible notices ───────────────────────────

export const getNoticesTeacherService = async (
  school_id: number,
  teacher_id: number
): Promise<INotice[]> => {
  const sectionIds = await getTeacherSectionIds(teacher_id, school_id);
  return getNoticesForTeacher(school_id, teacher_id, sectionIds);
};

// ── UPDATE ────────────────────────────────────────────────────

export const updateNoticeService = async (
  id: number,
  school_id: number,
  requester_role: 'admin' | 'faculty',
  requester_id: number,
  data: IUpdateNotice
): Promise<INotice> => {
  const notice = await getNoticeById(id, school_id);
  if (!notice) throw new AppError('Notice not found.', 404);

  // Teachers can only update their own notices
  if (requester_role === 'faculty') {
    if (notice.created_by_role !== 'faculty' || notice.created_by_id !== requester_id) {
      throw new AppError('You can only edit your own notices.', 403);
    }
    // Teachers cannot change section targeting to something they don't coordinate
    if (data.target_section_id && data.target_section_id !== notice.target_section_id) {
      const sectionIds = await getTeacherSectionIds(requester_id, school_id);
      if (!sectionIds.includes(data.target_section_id)) {
        throw new AppError('You can only target sections you coordinate.', 403);
      }
    }
    // Teachers cannot remove section targeting (must always target a section)
    if (data.target_type === null || data.target_section_id === null) {
      throw new AppError('Teacher notices must target a section.', 400);
    }
  }

  const updated = await updateNotice(id, school_id, data);
  if (!updated) throw new AppError('Notice not found.', 404);
  return updated;
};

// ── DELETE ────────────────────────────────────────────────────

export const deleteNoticeService = async (
  id: number,
  school_id: number,
  requester_role: 'admin' | 'faculty',
  requester_id: number
): Promise<void> => {
  const notice = await getNoticeById(id, school_id);
  if (!notice) throw new AppError('Notice not found.', 404);

  // Teachers can only delete their own notices
  if (requester_role === 'faculty') {
    if (notice.created_by_role !== 'faculty' || notice.created_by_id !== requester_id) {
      throw new AppError('You can only delete your own notices.', 403);
    }
  }

  const deleted = await deleteNotice(id, school_id);
  if (!deleted) throw new AppError('Notice not found.', 404);
};

// ── GET: Student — visible notices (school-wide + own section) ──

export const getNoticesStudentService = async (
  school_id: number,
  student_id: number
): Promise<INotice[]> => {
  const section_id = await getStudentActiveSectionId(student_id, school_id);
  return getNoticesForStudent(school_id, section_id);
};
