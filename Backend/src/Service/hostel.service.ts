import {
  createHostel, getHostelsBySchool, getHostelById, updateHostel, deleteHostel,
  createRoom, getRoomsByHostel, getRoomById, updateRoom, deleteRoom,
  createAssignment, getAssignmentsByHostel, getAssignmentsByRoom,
  getAssignmentByStudent, updateAssignment, getHostelSummary,
} from '../Repositories/hostel.repository';
import {
  ICreateHostel, IUpdateHostel,
  ICreateRoom, IUpdateRoom,
  ICreateAssignment, IUpdateAssignment,
} from '../types/hostel.types';
import AppError from '../utils/AppError';

// ── HOSTELS ───────────────────────────────────────────────────────────────────

export const createHostelService = async (school_id: number, data: ICreateHostel) => {
  if (!data.name)          throw new AppError('Hostel name is required.', 400);
  if (!data.hostel_type)   throw new AppError('Hostel type is required.', 400);
  if (!data.total_capacity) throw new AppError('Capacity is required.', 400);
  return createHostel(school_id, data);
};

export const getHostelsService = async (school_id: number) =>
  getHostelsBySchool(school_id);

export const getHostelByIdService = async (id: number, school_id: number) => {
  const hostel = await getHostelById(id, school_id);
  if (!hostel) throw new AppError('Hostel not found.', 404);
  const rooms = await getRoomsByHostel(id, school_id);
  return { ...hostel, rooms };
};

export const updateHostelService = async (id: number, school_id: number, data: IUpdateHostel) => {
  const hostel = await updateHostel(id, school_id, data);
  if (!hostel) throw new AppError('Hostel not found.', 404);
  return hostel;
};

export const deleteHostelService = async (id: number, school_id: number) => {
  const ok = await deleteHostel(id, school_id);
  if (!ok) throw new AppError('Hostel not found.', 404);
};

// ── ROOMS ─────────────────────────────────────────────────────────────────────

export const createRoomService = async (school_id: number, data: ICreateRoom) => {
  if (!data.hostel_id)    throw new AppError('Hostel ID is required.', 400);
  if (!data.room_number)  throw new AppError('Room number is required.', 400);

  // Check capacity vs existing occupancy
  const rooms    = await getRoomsByHostel(data.hostel_id, school_id);
  const hostel   = await getHostelById(data.hostel_id, school_id);
  if (!hostel) throw new AppError('Hostel not found.', 404);
  const total    = rooms.reduce((s, r) => s + r.capacity, 0) + (data.capacity || 2);
  if (total > hostel.total_capacity) {
    throw new AppError(`Adding this room exceeds hostel capacity of ${hostel.total_capacity}.`, 400);
  }

  return createRoom(school_id, data);
};

export const getRoomsService = async (hostel_id: number, school_id: number) =>
  getRoomsByHostel(hostel_id, school_id);

export const updateRoomService = async (id: number, school_id: number, data: IUpdateRoom) => {
  const room = await updateRoom(id, school_id, data);
  if (!room) throw new AppError('Room not found.', 404);
  return room;
};

export const deleteRoomService = async (id: number, school_id: number) => {
  const room = await getRoomById(id, school_id);
  if (!room) throw new AppError('Room not found.', 404);

  // Check no active students
  const assignments = await getAssignmentsByRoom(id, school_id);
  if (assignments.length > 0)
    throw new AppError('Cannot delete room with active students assigned.', 400);

  const ok = await deleteRoom(id, school_id);
  if (!ok) throw new AppError('Failed to delete room.', 500);
};

// ── ASSIGNMENTS ───────────────────────────────────────────────────────────────

export const assignStudentService = async (school_id: number, data: ICreateAssignment) => {
  const joining_date = data.joining_date || (data as any).joined_date;
  if (!data.student_id)       throw new AppError('Student is required.', 400);
  if (!data.hostel_id)        throw new AppError('Hostel is required.', 400);
  if (!data.room_id)          throw new AppError('Room is required.', 400);
  if (!data.academic_year_id) throw new AppError('Academic year is required.', 400);
  if (!joining_date)          throw new AppError('Joining date is required.', 400);

  // Check room capacity
  const room       = await getRoomById(data.room_id, school_id);
  if (!room) throw new AppError('Room not found.', 404);
  const current    = await getAssignmentsByRoom(data.room_id, school_id);
  if (current.length >= room.capacity)
    throw new AppError(`Room ${room.room_number} is full (capacity: ${room.capacity}).`, 400);

  return createAssignment(school_id, { ...data, joining_date });
};

export const getHostelAssignmentsService = async (hostel_id: number, school_id: number) =>
  getAssignmentsByHostel(hostel_id, school_id);

export const getRoomAssignmentsService = async (room_id: number, school_id: number) =>
  getAssignmentsByRoom(room_id, school_id);

export const getStudentHostelService = async (
  student_id: number, school_id: number, academic_year_id: number
) => {
  if (!academic_year_id) throw new AppError('Academic year is required.', 400);
  const a = await getAssignmentByStudent(student_id, school_id, academic_year_id);
  if (!a) throw new AppError('No hostel assignment found for this student.', 404);
  return a;
};

export const updateHostelAssignmentService = async (
  id: number, school_id: number, data: IUpdateAssignment
) => {
  const a = await updateAssignment(id, school_id, data);
  if (!a) throw new AppError('Assignment not found.', 404);
  return a;
};

export const getHostelSummaryService = async (school_id: number) =>
  getHostelSummary(school_id);
