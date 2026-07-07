import {
  createVehicle, getVehiclesBySchool, getVehicleById, updateVehicle, deleteVehicle,
  createRoute, getRoutesBySchool, getRouteById, updateRoute, deleteRoute,
  createStop, getStopsByRoute, updateStop, deleteStop,
  createAssignment, getAssignmentsByRoute, getAssignmentByStudent,
  updateAssignment, getTransportSummary,
} from '../Repositories/transport.repository';
import {
  ICreateVehicle, IUpdateVehicle,
  ICreateRoute, IUpdateRoute,
  ICreateStop, IUpdateStop,
  ICreateAssignment, IUpdateAssignment,
} from '../types/transport.types';
import AppError from '../utils/AppError';

// ── VEHICLES ─────────────────────────────────────────────────────────────────

export const createVehicleService = async (school_id: number, data: ICreateVehicle) => {
  if (!data.vehicle_number) throw new AppError('Vehicle number is required.', 400);
  if (!data.driver_name)    throw new AppError('Driver name is required.', 400);
  return createVehicle(school_id, data);
};

export const getVehiclesService = async (school_id: number) =>
  getVehiclesBySchool(school_id);

export const getVehicleByIdService = async (id: number, school_id: number) => {
  const vehicle = await getVehicleById(id, school_id);
  if (!vehicle) throw new AppError('Vehicle not found.', 404);
  return vehicle;
};

export const updateVehicleService = async (id: number, school_id: number, data: IUpdateVehicle) => {
  const vehicle = await updateVehicle(id, school_id, data);
  if (!vehicle) throw new AppError('Vehicle not found.', 404);
  return vehicle;
};

export const deleteVehicleService = async (id: number, school_id: number) => {
  const ok = await deleteVehicle(id, school_id);
  if (!ok) throw new AppError('Vehicle not found.', 404);
};

// ── ROUTES ────────────────────────────────────────────────────────────────────

export const createRouteService = async (school_id: number, data: ICreateRoute) => {
  if (!data.name)             throw new AppError('Route name is required.', 400);
  if (!data.academic_year_id) throw new AppError('Academic year is required.', 400);
  return createRoute(school_id, data);
};

export const getRoutesService = async (school_id: number, academic_year_id: number) => {
  if (!academic_year_id) throw new AppError('Academic year is required.', 400);
  return getRoutesBySchool(school_id, academic_year_id);
};

export const getRouteByIdService = async (id: number, school_id: number) => {
  const route = await getRouteById(id, school_id);
  if (!route) throw new AppError('Route not found.', 404);
  const stops = await getStopsByRoute(id, school_id);
  const students = await getAssignmentsByRoute(id, school_id);
  return { ...route, stops, students };
};

export const updateRouteService = async (id: number, school_id: number, data: IUpdateRoute) => {
  const route = await updateRoute(id, school_id, data);
  if (!route) throw new AppError('Route not found.', 404);
  return route;
};

export const deleteRouteService = async (id: number, school_id: number) => {
  const ok = await deleteRoute(id, school_id);
  if (!ok) throw new AppError('Route not found.', 404);
};

// ── STOPS ─────────────────────────────────────────────────────────────────────

export const createStopService = async (school_id: number, data: ICreateStop) => {
  if (!data.name)     throw new AppError('Stop name is required.', 400);
  if (!data.route_id) throw new AppError('Route ID is required.', 400);
  return createStop(school_id, data);
};

export const getStopsService = async (route_id: number, school_id: number) =>
  getStopsByRoute(route_id, school_id);

export const updateStopService = async (id: number, school_id: number, data: IUpdateStop) => {
  const stop = await updateStop(id, school_id, data);
  if (!stop) throw new AppError('Stop not found.', 404);
  return stop;
};

export const deleteStopService = async (id: number, school_id: number) => {
  const ok = await deleteStop(id, school_id);
  if (!ok) throw new AppError('Stop not found.', 404);
};

// ── ASSIGNMENTS ───────────────────────────────────────────────────────────────

export const assignStudentService = async (school_id: number, data: ICreateAssignment) => {
  if (!data.student_id)       throw new AppError('Student is required.', 400);
  if (!data.route_id)         throw new AppError('Route is required.', 400);
  if (!data.stop_id)          throw new AppError('Stop is required.', 400);
  if (!data.academic_year_id) throw new AppError('Academic year is required.', 400);
  if (!data.start_date)       throw new AppError('Start date is required.', 400);
  return createAssignment(school_id, data);
};

export const getAssignmentsByRouteService = async (route_id: number, school_id: number) =>
  getAssignmentsByRoute(route_id, school_id);

export const getStudentTransportService = async (
  student_id: number, school_id: number, academic_year_id: number
) => {
  if (!academic_year_id) throw new AppError('Academic year is required.', 400);
  const assignment = await getAssignmentByStudent(student_id, school_id, academic_year_id);
  if (!assignment) throw new AppError('No transport assignment found for this student.', 404);
  return assignment;
};

export const updateAssignmentService = async (
  id: number, school_id: number, data: IUpdateAssignment
) => {
  const assignment = await updateAssignment(id, school_id, data);
  if (!assignment) throw new AppError('Assignment not found.', 404);
  return assignment;
};

export const getTransportSummaryService = async (
  school_id: number, academic_year_id: number
) => {
  if (!academic_year_id) throw new AppError('Academic year is required.', 400);
  return getTransportSummary(school_id, academic_year_id);
};
