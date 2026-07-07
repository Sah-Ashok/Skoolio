import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createVehicleService, getVehiclesService, getVehicleByIdService,
  updateVehicleService, deleteVehicleService,
  createRouteService, getRoutesService, getRouteByIdService,
  updateRouteService, deleteRouteService,
  createStopService, getStopsService, updateStopService, deleteStopService,
  assignStudentService, getAssignmentsByRouteService, getStudentTransportService,
  updateAssignmentService, getTransportSummaryService,
} from '../Service/transport.service';

const getSchoolId = (req: Request) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  return 'school_id' in user ? user.school_id : user.id;
};

// ── VEHICLES ──────────────────────────────────────────────────────────────────
export const createVehicle     = catchAsync(async (req, res) => { sendResponse(res, 201, true, 'Vehicle created',   await createVehicleService(getSchoolId(req), req.body)); });
export const getVehicles       = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Vehicles fetched',  await getVehiclesService(getSchoolId(req))); });
export const getVehicleById    = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Vehicle fetched',   await getVehicleByIdService(Number(req.params.id), getSchoolId(req))); });
export const updateVehicle     = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Vehicle updated',   await updateVehicleService(Number(req.params.id), getSchoolId(req), req.body)); });
export const deleteVehicle     = catchAsync(async (req, res) => { await deleteVehicleService(Number(req.params.id), getSchoolId(req)); sendResponse(res, 200, true, 'Vehicle deleted', null); });

// ── ROUTES ────────────────────────────────────────────────────────────────────
export const createRoute       = catchAsync(async (req, res) => { sendResponse(res, 201, true, 'Route created',     await createRouteService(getSchoolId(req), req.body)); });
export const getRoutes         = catchAsync(async (req, res) => {
  const { academic_year_id } = req.query;
  sendResponse(res, 200, true, 'Routes fetched', await getRoutesService(getSchoolId(req), Number(academic_year_id)));
});
export const getRouteById      = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Route fetched',     await getRouteByIdService(Number(req.params.id), getSchoolId(req))); });
export const updateRoute       = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Route updated',     await updateRouteService(Number(req.params.id), getSchoolId(req), req.body)); });
export const deleteRoute       = catchAsync(async (req, res) => { await deleteRouteService(Number(req.params.id), getSchoolId(req)); sendResponse(res, 200, true, 'Route deleted', null); });

// ── STOPS ─────────────────────────────────────────────────────────────────────
export const createStop        = catchAsync(async (req, res) => { sendResponse(res, 201, true, 'Stop created',      await createStopService(getSchoolId(req), req.body)); });
export const getStops          = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Stops fetched',     await getStopsService(Number(req.params.routeId), getSchoolId(req))); });
export const updateStop        = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Stop updated',      await updateStopService(Number(req.params.id), getSchoolId(req), req.body)); });
export const deleteStop        = catchAsync(async (req, res) => { await deleteStopService(Number(req.params.id), getSchoolId(req)); sendResponse(res, 200, true, 'Stop deleted', null); });

// ── ASSIGNMENTS ───────────────────────────────────────────────────────────────
export const assignStudent     = catchAsync(async (req, res) => { sendResponse(res, 201, true, 'Student assigned',  await assignStudentService(getSchoolId(req), req.body)); });
export const getRouteAssignments = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Assignments fetched', await getAssignmentsByRouteService(Number(req.params.routeId), getSchoolId(req))); });
export const updateAssignment  = catchAsync(async (req, res) => { sendResponse(res, 200, true, 'Assignment updated', await updateAssignmentService(Number(req.params.id), getSchoolId(req), req.body)); });

export const getStudentTransport = catchAsync(async (req, res) => {
  const { academic_year_id } = req.query;
  sendResponse(res, 200, true, 'Transport details fetched', await getStudentTransportService(Number(req.params.studentId), getSchoolId(req), Number(academic_year_id)));
});

// ── SUMMARY ───────────────────────────────────────────────────────────────────
export const getSummary = catchAsync(async (req, res) => {
  const { academic_year_id } = req.query;
  sendResponse(res, 200, true, 'Summary fetched', await getTransportSummaryService(getSchoolId(req), Number(academic_year_id)));
});
