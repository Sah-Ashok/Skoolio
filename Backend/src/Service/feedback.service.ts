import AppError from '../utils/AppError';
import { ICreateFeedback, IUpdateFeedbackStatus, FeedbackRole } from '../types/feedback.types';
import {
  createFeedback, getFeedbackBySchool, getFeedbackByTeacher,
  getFeedbackById, getAllFeedbackSuperAdmin, updateFeedbackStatus,
  deleteFeedback, getFeedbackStats,
} from '../Repositories/feedback.repository';

export const submitFeedbackService = async (
  school_id: number, submitted_by: number, role: FeedbackRole,
  submitter_name: string, data: ICreateFeedback
) => {
  if (!data.title?.trim())       throw new AppError('Title is required.',       400);
  if (!data.description?.trim()) throw new AppError('Description is required.', 400);
  if (!data.category)            throw new AppError('Category is required.',    400);
  if (data.rating != null && (data.rating < 1 || data.rating > 5))
    throw new AppError('Rating must be 1–5.', 400);
  return createFeedback(school_id, submitted_by, role, submitter_name, data);
};

export const getSchoolFeedbackService = async (
  school_id: number,
  filters: { status?: string; category?: string; role?: string } = {}
) => getFeedbackBySchool(school_id, filters);

export const getMyFeedbackService = async (school_id: number, teacher_id: number) =>
  getFeedbackByTeacher(school_id, teacher_id);

export const getAllFeedbackService = async (
  filters: { status?: string; category?: string } = {}
) => getAllFeedbackSuperAdmin(filters);

export const updateFeedbackService = async (id: number, data: IUpdateFeedbackStatus) => {
  const updated = await updateFeedbackStatus(id, data);
  if (!updated) throw new AppError('Feedback not found.', 404);
  return updated;
};

export const deleteFeedbackService = async (
  id: number, school_id: number, requester_id: number, is_super_admin: boolean
) => {
  if (!is_super_admin) {
    const fb = await getFeedbackById(id, school_id);
    if (!fb) throw new AppError('Feedback not found.', 404);
    if (fb.submitted_by !== requester_id)
      throw new AppError('You can only delete your own feedback.', 403);
  }
  const deleted = await deleteFeedback(id);
  if (!deleted) throw new AppError('Feedback not found.', 404);
};

export const getFeedbackStatsService = async () => getFeedbackStats();
