import pool from '../config/db';
import {
  ITransportVehicle, ICreateVehicle, IUpdateVehicle,
  ITransportRoute, ICreateRoute, IUpdateRoute,
  ITransportStop, ICreateStop, IUpdateStop,
  ITransportAssignment, ICreateAssignment, IUpdateAssignment,
} from '../types/transport.types';

// ── VEHICLES ──

export const createVehicle = async (school_id: number, data: ICreateVehicle): Promise<ITransportVehicle> => {
  const result = await pool.query(
    `INSERT INTO transport_vehicles
      (school_id, vehicle_number, vehicle_type, capacity, driver_name, driver_phone,
       driver_license, helper_name, helper_phone, gps_tracking, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [school_id, data.vehicle_number, data.vehicle_type, data.capacity, data.driver_name,
     data.driver_phone||null, data.driver_license||null, data.helper_name||null,
     data.helper_phone||null, data.gps_tracking||false, data.status||'active', data.notes||null]
  );
  return result.rows[0];
};

export const getVehiclesBySchool = async (school_id: number): Promise<ITransportVehicle[]> => {
  const result = await pool.query(
    `SELECT v.*, r.name AS assigned_route_name
     FROM transport_vehicles v
     LEFT JOIN transport_routes r ON r.vehicle_id = v.id AND r.status = 'active'
     WHERE v.school_id = $1 ORDER BY v.vehicle_number ASC`,
    [school_id]
  );
  return result.rows;
};

export const getVehicleById = async (id: number, school_id: number): Promise<ITransportVehicle | null> => {
  const result = await pool.query(
    `SELECT * FROM transport_vehicles WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateVehicle = async (id: number, school_id: number, data: IUpdateVehicle): Promise<ITransportVehicle | null> => {
  const result = await pool.query(
    `UPDATE transport_vehicles SET
      vehicle_number = COALESCE($1, vehicle_number),
      vehicle_type   = COALESCE($2, vehicle_type),
      capacity       = COALESCE($3, capacity),
      driver_name    = COALESCE($4, driver_name),
      driver_phone   = COALESCE($5, driver_phone),
      driver_license = COALESCE($6, driver_license),
      helper_name    = COALESCE($7, helper_name),
      helper_phone   = COALESCE($8, helper_phone),
      gps_tracking   = COALESCE($9, gps_tracking),
      status         = COALESCE($10, status),
      notes          = COALESCE($11, notes),
      updated_at     = NOW()
     WHERE id = $12 AND school_id = $13
     RETURNING *`,
    [data.vehicle_number||null, data.vehicle_type||null, data.capacity||null,
     data.driver_name||null, data.driver_phone||null, data.driver_license||null,
     data.helper_name||null, data.helper_phone||null, data.gps_tracking??null,
     data.status||null, data.notes||null, id, school_id]
  );
  return result.rows[0] || null;
};

export const deleteVehicle = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM transport_vehicles WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── ROUTES ──

export const createRoute = async (school_id: number, data: ICreateRoute): Promise<ITransportRoute> => {
  const result = await pool.query(
    `INSERT INTO transport_routes
      (school_id, academic_year_id, name, description, vehicle_id, status)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [school_id, data.academic_year_id, data.name, data.description||null,
     data.vehicle_id||null, data.status||'active']
  );
  return result.rows[0];
};

export const getRoutesBySchool = async (school_id: number, academic_year_id: number): Promise<ITransportRoute[]> => {
  const result = await pool.query(
    `SELECT r.*,
            v.vehicle_number, v.driver_name, v.capacity,
            COUNT(DISTINCT s.id) AS stop_count,
            COUNT(DISTINCT ta.id) AS student_count
     FROM transport_routes r
     LEFT JOIN transport_vehicles v ON v.id = r.vehicle_id
     LEFT JOIN transport_stops s ON s.route_id = r.id
     LEFT JOIN transport_assignments ta ON ta.route_id = r.id AND ta.status = 'active'
     WHERE r.school_id = $1 AND r.academic_year_id = $2
     GROUP BY r.id, v.vehicle_number, v.driver_name, v.capacity
     ORDER BY r.name ASC`,
    [school_id, academic_year_id]
  );
  return result.rows;
};

export const getRouteById = async (id: number, school_id: number): Promise<ITransportRoute | null> => {
  const result = await pool.query(
    `SELECT r.*,
            v.vehicle_number, v.driver_name, v.driver_phone, v.capacity
     FROM transport_routes r
     LEFT JOIN transport_vehicles v ON v.id = r.vehicle_id
     WHERE r.id = $1 AND r.school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateRoute = async (id: number, school_id: number, data: IUpdateRoute): Promise<ITransportRoute | null> => {
  const result = await pool.query(
    `UPDATE transport_routes SET
      name             = COALESCE($1, name),
      description      = COALESCE($2, description),
      vehicle_id       = COALESCE($3, vehicle_id),
      status           = COALESCE($4, status),
      updated_at       = NOW()
     WHERE id = $5 AND school_id = $6
     RETURNING *`,
    [data.name||null, data.description||null, data.vehicle_id||null,
     data.status||null, id, school_id]
  );
  return result.rows[0] || null;
};

export const deleteRoute = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM transport_routes WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── STOPS ──

export const createStop = async (school_id: number, data: ICreateStop): Promise<ITransportStop> => {
  const result = await pool.query(
    `INSERT INTO transport_stops
      (school_id, route_id, name, pickup_time, drop_time, monthly_fee, stop_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [school_id, data.route_id, data.name, data.pickup_time||null,
     data.drop_time||null, data.monthly_fee||0, data.stop_order||1]
  );
  return result.rows[0];
};

export const getStopsByRoute = async (route_id: number, school_id: number): Promise<ITransportStop[]> => {
  const result = await pool.query(
    `SELECT s.*, COUNT(ta.id) AS student_count
     FROM transport_stops s
     LEFT JOIN transport_assignments ta ON ta.stop_id = s.id AND ta.status = 'active'
     WHERE s.route_id = $1 AND s.school_id = $2
     GROUP BY s.id
     ORDER BY s.stop_order ASC`,
    [route_id, school_id]
  );
  return result.rows;
};

export const updateStop = async (id: number, school_id: number, data: IUpdateStop): Promise<ITransportStop | null> => {
  const result = await pool.query(
    `UPDATE transport_stops SET
      name        = COALESCE($1, name),
      pickup_time = COALESCE($2, pickup_time),
      drop_time   = COALESCE($3, drop_time),
      monthly_fee = COALESCE($4, monthly_fee),
      stop_order  = COALESCE($5, stop_order),
      updated_at  = NOW()
     WHERE id = $6 AND school_id = $7
     RETURNING *`,
    [data.name||null, data.pickup_time||null, data.drop_time||null,
     data.monthly_fee||null, data.stop_order||null, id, school_id]
  );
  return result.rows[0] || null;
};

export const deleteStop = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM transport_stops WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── ASSIGNMENTS ──

export const createAssignment = async (school_id: number, data: ICreateAssignment): Promise<ITransportAssignment> => {
  const result = await pool.query(
    `INSERT INTO transport_assignments
      (school_id, student_id, route_id, stop_id, academic_year_id, start_date, end_date, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [school_id, data.student_id, data.route_id, data.stop_id, data.academic_year_id,
     data.start_date, data.end_date||null, data.status||'active', data.notes||null]
  );
  return result.rows[0];
};

export const getAssignmentsByRoute = async (route_id: number, school_id: number): Promise<any[]> => {
  const result = await pool.query(
    `SELECT ta.*,
            s.full_name, s.admission_number, s.photo,
            ts.name AS stop_name, ts.pickup_time, ts.monthly_fee
     FROM transport_assignments ta
     INNER JOIN students s ON s.id = ta.student_id
     INNER JOIN transport_stops ts ON ts.id = ta.stop_id
     WHERE ta.route_id = $1 AND ta.school_id = $2 AND ta.status = 'active'
     ORDER BY ts.stop_order ASC, s.full_name ASC`,
    [route_id, school_id]
  );
  return result.rows;
};

export const getAssignmentByStudent = async (student_id: number, school_id: number, academic_year_id: number): Promise<any | null> => {
  const result = await pool.query(
    `SELECT ta.*,
            r.name AS route_name,
            ts.name AS stop_name, ts.pickup_time, ts.drop_time, ts.monthly_fee,
            v.vehicle_number, v.driver_name, v.driver_phone
     FROM transport_assignments ta
     INNER JOIN transport_routes r ON r.id = ta.route_id
     INNER JOIN transport_stops ts ON ts.id = ta.stop_id
     LEFT  JOIN transport_vehicles v ON v.id = r.vehicle_id
     WHERE ta.student_id = $1 AND ta.school_id = $2
       AND ta.academic_year_id = $3 AND ta.status = 'active'`,
    [student_id, school_id, academic_year_id]
  );
  return result.rows[0] || null;
};

export const updateAssignment = async (id: number, school_id: number, data: IUpdateAssignment): Promise<ITransportAssignment | null> => {
  const result = await pool.query(
    `UPDATE transport_assignments SET
      end_date   = COALESCE($1, end_date),
      status     = COALESCE($2, status),
      notes      = COALESCE($3, notes),
      updated_at = NOW()
     WHERE id = $4 AND school_id = $5
     RETURNING *`,
    [data.end_date||null, data.status||null, data.notes||null, id, school_id]
  );
  return result.rows[0] || null;
};

export const getTransportSummary = async (school_id: number, academic_year_id: number): Promise<any> => {
  const result = await pool.query(
    `SELECT
       COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'active') AS active_vehicles,
       COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'active') AS active_routes,
       COUNT(DISTINCT ta.student_id) FILTER (WHERE ta.status = 'active') AS students_assigned
     FROM transport_vehicles v
     FULL JOIN transport_routes r ON r.school_id = v.school_id
     LEFT JOIN transport_assignments ta ON ta.route_id = r.id AND ta.academic_year_id = $2
     WHERE COALESCE(v.school_id, r.school_id) = $1`,
    [school_id, academic_year_id]
  );
  return result.rows[0];
};