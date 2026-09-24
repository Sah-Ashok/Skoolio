import {
  getStreamsBySchool,
  getStreamById,
  findStreamByName,
  createStream,
  updateStream,
  deleteStream,
} from '../Repositories/stream.repository';
import { ICreateStream, IUpdateStream, IStream } from '../types/stream.types';
import AppError from '../utils/AppError';

export const getStreamsService = async (schoolId: number): Promise<IStream[]> => {
  return await getStreamsBySchool(schoolId);
};

export const createStreamService = async (
  schoolId: number,
  data: ICreateStream
): Promise<IStream> => {
  if (!data.name || !data.name.trim()) {
    throw new AppError('Stream name is required.', 400);
  }

  const trimmedName = data.name.trim();
  const existing = await findStreamByName(schoolId, trimmedName);
  if (existing) {
    throw new AppError(`A stream with the name "${trimmedName}" already exists.`, 409);
  }

  return await createStream(schoolId, {
    ...data,
    name: trimmedName,
  });
};

export const updateStreamService = async (
  id: number,
  schoolId: number,
  data: IUpdateStream
): Promise<IStream> => {
  const existing = await getStreamById(id, schoolId);
  if (!existing) {
    throw new AppError('Stream not found.', 404);
  }

  if (data.name && data.name.trim()) {
    const trimmedName = data.name.trim();
    const duplicate = await findStreamByName(schoolId, trimmedName);
    if (duplicate && duplicate.id !== id) {
      throw new AppError(`A stream with the name "${trimmedName}" already exists.`, 409);
    }
    data.name = trimmedName;
  }

  const updated = await updateStream(id, schoolId, data);
  if (!updated) {
    throw new AppError('Failed to update stream.', 500);
  }

  return updated;
};

export const deleteStreamService = async (
  id: number,
  schoolId: number
): Promise<{ message: string }> => {
  const existing = await getStreamById(id, schoolId);
  if (!existing) {
    throw new AppError('Stream not found.', 404);
  }

  const deleted = await deleteStream(id, schoolId);
  if (!deleted) {
    throw new AppError('Failed to delete stream.', 500);
  }

  return { message: 'Stream deleted successfully.' };
};
