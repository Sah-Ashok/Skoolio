import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createClassService, getClassesService, getClassByIdService,
  updateClassService, deleteClassService,
  addSectionService, getSectionsService, getMySectionsService,
  updateSectionService, deleteSectionService,
  createSubjectService, getSubjectsService, updateSubjectService, deleteSubjectService,
  assignSubjectService, getClassSubjectsService, removeSubjectService,
  assignSubjectTeacherService, removeSubjectTeacherService,
  getSubjectTeachersService, getMySubjectClassesService,
} from '../Service/class.service';

// ── CLASS ─────────────────────────────────────────────────────────────────────

export const createClass = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  sendResponse(res, 201, true, 'Class created', await createClassService(school_id, req.body));
});

export const getClasses = catchAsync(async (req, res) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const { academic_year_id } = req.query;
  if (!academic_year_id) return sendResponse(res, 400, false, 'academic_year_id is required', null);
  sendResponse(res, 200, true, 'Classes fetched', await getClassesService(school_id, Number(academic_year_id)));
});

export const getClassById = catchAsync(async (req, res) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  sendResponse(res, 200, true, 'Class fetched', await getClassByIdService(Number(req.params.id), school_id));
});

export const updateClass = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  sendResponse(res, 200, true, 'Class updated', await updateClassService(Number(req.params.id), school_id, req.body));
});

export const deleteClass = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteClassService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Class deleted', null);
});

// ── SECTION ───────────────────────────────────────────────────────────────────

export const addSection = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  sendResponse(res, 201, true, 'Section added', await addSectionService(school_id, Number(req.params.classId), req.body));
});

export const getSections = catchAsync(async (req, res) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  sendResponse(res, 200, true, 'Sections fetched', await getSectionsService(Number(req.params.classId), school_id));
});

export const getMySections = catchAsync(async (req, res) => {
  const { id: teacher_id, school_id } = req.user as IJwtUserPayload;
  sendResponse(res, 200, true, 'Your sections fetched', await getMySectionsService(teacher_id, school_id));
});

export const updateSection = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  sendResponse(res, 200, true, 'Section updated', await updateSectionService(Number(req.params.id), school_id, req.body));
});

export const deleteSection = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteSectionService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Section deleted', null);
});

// ── SUBJECT ───────────────────────────────────────────────────────────────────

export const createSubject = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  sendResponse(res, 201, true, 'Subject created', await createSubjectService(school_id, req.body));
});

export const getSubjects = catchAsync(async (req, res) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  sendResponse(res, 200, true, 'Subjects fetched', await getSubjectsService(school_id));
});

export const updateSubject = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  sendResponse(res, 200, true, 'Subject updated', await updateSubjectService(Number(req.params.id), school_id, req.body));
});

export const deleteSubject = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteSubjectService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Subject deleted', null);
});

// ── CLASS SUBJECTS ────────────────────────────────────────────────────────────

export const assignSubject = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { class_id, subject_id, teacher_id, academic_year_id } = req.body;
  sendResponse(
    res, 201, true, 'Subject assigned',
    await assignSubjectService(school_id, class_id, subject_id, teacher_id, academic_year_id)
  );
});

export const getClassSubjects = catchAsync(async (req, res) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  sendResponse(res, 200, true, 'Class subjects fetched', await getClassSubjectsService(Number(req.params.classId), school_id));
});

export const removeSubject = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { class_id, subject_id } = req.body;
  await removeSubjectService(class_id, subject_id, school_id);
  sendResponse(res, 200, true, 'Subject removed', null);
});

// ── CLASS SUBJECT TEACHERS ────────────────────────────────────────────────────

export const assignSubjectTeacher = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  sendResponse(res, 201, true, 'Teacher assigned to subject', await assignSubjectTeacherService(school_id, req.body));
});

export const removeSubjectTeacher = catchAsync(async (req, res) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { class_id, subject_id, academic_year_id } = req.body;
  await removeSubjectTeacherService(school_id, class_id, subject_id, academic_year_id);
  sendResponse(res, 200, true, 'Teacher unassigned from subject', null);
});

export const getSubjectTeachers = catchAsync(async (req, res) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  sendResponse(res, 200, true, 'Subject teachers fetched', await getSubjectTeachersService(Number(req.params.classId), school_id));
});

export const getMySubjectClasses = catchAsync(async (req, res) => {
  const { id: teacher_id, school_id } = req.user as IJwtUserPayload;
  sendResponse(res, 200, true, 'Your subject assignments fetched', await getMySubjectClassesService(teacher_id, school_id));
});
