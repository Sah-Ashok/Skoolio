import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createHostelService, getHostelsService, getHostelByIdService,
  updateHostelService, deleteHostelService,
  createRoomService, getRoomsService, updateRoomService, deleteRoomService,
  assignStudentService, getHostelAssignmentsService, getRoomAssignmentsService,
  getStudentHostelService, updateHostelAssignmentService, getHostelSummaryService,
} from '../Service/hostel.service';

const getSchoolId = (req: Request) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  return 'school_id' in user ? user.school_id : user.id;
};

// ── HOSTELS ───────────────────────────────────────────────────────────────────
export const createHostel      = catchAsync(async (req, res) => { sendResponse(res, 201, true, 'Hostel created',    await createHostelService(getSchoolId(req), req.body)); });
export const getHostels        = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Hostels fetched',   await getHostelsService(getSchoolId(req))); });
export const getHostelById     = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Hostel fetched',    await getHostelByIdService(Number(req.params.id), getSchoolId(req))); });
export const updateHostel      = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Hostel updated',    await updateHostelService(Number(req.params.id), getSchoolId(req), req.body)); });
export const deleteHostel      = catchAsync(async (req, res) => { await deleteHostelService(Number(req.params.id), getSchoolId(req)); sendResponse(res, 200, true, 'Hostel deleted', null); });

// ── ROOMS ─────────────────────────────────────────────────────────────────────
export const createRoom        = catchAsync(async (req, res) => { sendResponse(res, 201, true, 'Room created',      await createRoomService(getSchoolId(req), req.body)); });
export const getRooms          = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Rooms fetched',     await getRoomsService(Number(req.params.hostelId), getSchoolId(req))); });
export const updateRoom        = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Room updated',      await updateRoomService(Number(req.params.id), getSchoolId(req), req.body)); });
export const deleteRoom        = catchAsync(async (req, res) => { await deleteRoomService(Number(req.params.id), getSchoolId(req)); sendResponse(res, 200, true, 'Room deleted', null); });

// ── ASSIGNMENTS ───────────────────────────────────────────────────────────────
export const assignStudent        = catchAsync(async (req, res) => { sendResponse(res, 201, true, 'Student assigned',     await assignStudentService(getSchoolId(req), req.body)); });
export const getHostelAssignments = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Assignments fetched',  await getHostelAssignmentsService(Number(req.params.hostelId), getSchoolId(req))); });
export const getRoomAssignments   = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Room students fetched',await getRoomAssignmentsService(Number(req.params.roomId), getSchoolId(req))); });
export const updateAssignment     = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Assignment updated',   await updateHostelAssignmentService(Number(req.params.id), getSchoolId(req), req.body)); });

export const getStudentHostel = catchAsync(async (req, res) => {
  const { academic_year_id } = req.query;
  sendResponse(res, 200, true, 'Hostel details fetched', await getStudentHostelService(Number(req.params.studentId), getSchoolId(req), Number(academic_year_id)));
});

// ── SUMMARY ───────────────────────────────────────────────────────────────────
export const getSummary = catchAsync(async (req, res) => {
  sendResponse(res, 200, true, 'Hostel summary fetched', await getHostelSummaryService(getSchoolId(req)));
});
