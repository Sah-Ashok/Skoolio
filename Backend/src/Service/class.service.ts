import {
  createClass, getClassesBySchool, getClassById, updateClass, deleteClass,
  createSection, getSectionsByClass, getSectionById, getSectionsByCoordinator,
  updateSection, deleteSection,
  createSubject, getSubjectsBySchool, getSubjectById, updateSubject, deleteSubject,
  assignSubjectToClass, getSubjectsByClass, removeSubjectFromClass,
  assignTeacherToSubject, removeTeacherFromSubject,
  getSubjectTeachersByClass, getTeacherSubjectClasses,
} from '../Repositories/class.repository';
import { ICreateClass, IUpdateClass, ICreateSection, IUpdateSection,
         ICreateSubject, IUpdateSubject, IAssignSubjectTeacher } from '../types/class.types';
import AppError from '../utils/AppError';

// ── CLASS ─────────────────────────────────────────────────────────────────────

export const createClassService = async (school_id: number, data: ICreateClass) => {
  const newClass = await createClass(school_id, data);
  const sections = data.sections?.length
    ? data.sections
    : [{ name: 'A', capacity: 40, status: 'active' as const }];
  const createdSections = [];
  for (const section of sections) {
    createdSections.push(await createSection(school_id, newClass.id, section));
  }
  return { ...newClass, sections: createdSections };
};

export const getClassesService = async (school_id: number, academic_year_id: number) =>
  getClassesBySchool(school_id, academic_year_id);

export const getClassByIdService = async (id: number, school_id: number) => {
  const cls = await getClassById(id, school_id);
  if (!cls) throw new AppError('Class not found.', 404);
  const [sections, subjects] = await Promise.all([
    getSectionsByClass(id, school_id),
    getSubjectsByClass(id, school_id),
  ]);
  return { ...cls, sections, subjects };
};

export const updateClassService = async (id: number, school_id: number, data: IUpdateClass) => {
  const cls = await updateClass(id, school_id, data);
  if (!cls) throw new AppError('Class not found.', 404);
  return cls;
};

export const deleteClassService = async (id: number, school_id: number) => {
  const cls = await getClassById(id, school_id);
  if (!cls) throw new AppError('Class not found.', 404);
  if (!await deleteClass(id, school_id)) throw new AppError('Failed to delete class.', 500);
};

// ── SECTION ───────────────────────────────────────────────────────────────────

export const addSectionService = async (school_id: number, class_id: number, data: ICreateSection) => {
  const cls = await getClassById(class_id, school_id);
  if (!cls) throw new AppError('Class not found.', 404);
  return createSection(school_id, class_id, data);
};

export const getSectionsService = async (class_id: number, school_id: number) =>
  getSectionsByClass(class_id, school_id);

export const getMySectionsService = async (teacher_id: number, school_id: number) =>
  getSectionsByCoordinator(teacher_id, school_id);

export const updateSectionService = async (id: number, school_id: number, data: IUpdateSection) => {
  const section = await updateSection(id, school_id, data);
  if (!section) throw new AppError('Section not found.', 404);
  return section;
};

export const deleteSectionService = async (id: number, school_id: number) => {
  const section = await getSectionById(id, school_id);
  if (!section) throw new AppError('Section not found.', 404);
  const sections = await getSectionsByClass(section.class_id, school_id);
  if (sections.length === 1) throw new AppError('Cannot delete the only section of a class.', 400);
  if (!await deleteSection(id, school_id)) throw new AppError('Failed to delete section.', 500);
};

// ── SUBJECT ───────────────────────────────────────────────────────────────────

export const createSubjectService = async (school_id: number, data: ICreateSubject) =>
  createSubject(school_id, data);

export const getSubjectsService = async (school_id: number) =>
  getSubjectsBySchool(school_id);

export const updateSubjectService = async (id: number, school_id: number, data: IUpdateSubject) => {
  const subject = await updateSubject(id, school_id, data);
  if (!subject) throw new AppError('Subject not found.', 404);
  return subject;
};

export const deleteSubjectService = async (id: number, school_id: number) => {
  const subject = await getSubjectById(id, school_id);
  if (!subject) throw new AppError('Subject not found.', 404);
  if (!await deleteSubject(id, school_id)) throw new AppError('Failed to delete subject.', 500);
};

// ── CLASS SUBJECTS ────────────────────────────────────────────────────────────

export const assignSubjectService = async (
  school_id: number,
  class_id: number,
  subject_id: number,
  teacher_id?: number,
  academic_year_id?: number
) => {
  if (!await getClassById(class_id, school_id))     throw new AppError('Class not found.', 404);
  if (!await getSubjectById(subject_id, school_id)) throw new AppError('Subject not found.', 404);

  // Assign subject to class
  const classSubject = await assignSubjectToClass(school_id, class_id, subject_id);

  // If teacher_id provided, also wire up the class_subject_teachers record
  // This is the main assignment path from the subject form.
  if (teacher_id && academic_year_id) {
    await assignTeacherToSubject(school_id, {
      class_id,
      subject_id,
      teacher_id,
      academic_year_id,
    });
  }

  return classSubject;
};

export const getClassSubjectsService = async (class_id: number, school_id: number) =>
  getSubjectsByClass(class_id, school_id);

export const removeSubjectService = async (class_id: number, subject_id: number, school_id: number) => {
  if (!await removeSubjectFromClass(class_id, subject_id, school_id))
    throw new AppError('Subject not assigned to this class.', 404);
};

// ── CLASS SUBJECT TEACHERS ────────────────────────────────────────────────────

export const assignSubjectTeacherService = async (school_id: number, data: IAssignSubjectTeacher) => {
  if (!await getClassById(data.class_id, school_id))     throw new AppError('Class not found.', 404);
  if (!await getSubjectById(data.subject_id, school_id)) throw new AppError('Subject not found.', 404);
  return assignTeacherToSubject(school_id, data);
};

export const removeSubjectTeacherService = async (
  school_id: number, class_id: number, subject_id: number, academic_year_id: number
) => {
  await removeTeacherFromSubject(school_id, class_id, subject_id, academic_year_id);
};

export const getSubjectTeachersService = async (class_id: number, school_id: number) =>
  getSubjectTeachersByClass(class_id, school_id);

export const getMySubjectClassesService = async (teacher_id: number, school_id: number) =>
  getTeacherSubjectClasses(teacher_id, school_id);

export const getMyCoordinatedSectionsService = async (teacher_id: number, school_id: number) =>
  getSectionsByCoordinator(teacher_id, school_id);
