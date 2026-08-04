import pool from '../config/db';
import {
  IHostel, ICreateHostel, IUpdateHostel,
  IHostelRoom, ICreateRoom, IUpdateRoom,
  IHostelAssignment, ICreateAssignment, IUpdateAssignment,
} from '../types/hostel.types';

// ── HOSTELS ──

export const createHostel = async (school_id: number, data: ICreateHostel): Promise<IHostel> => {
  const result = await pool.query(
    `INSERT INTO hostels
      (school_id, name, hostel_type, total_capacity, warden_name,
       warden_phone, warden_email, address, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [school_id, data.name, data.hostel_type, data.total_capacity,
     data.warden_name||null, data.warden_phone||null, data.warden_email||null,
     data.address||null, data.status||'active']
  );
  return result.rows[0];
};

export const getHostelsBySchool = async (school_id: number): Promise<IHostel[]> => {
  const result = await pool.query(
    `SELECT h.*,
            COUNT(DISTINCT r.id)                                    AS total_rooms,
            SUM(r.capacity)                                         AS total_bed_capacity,
            COUNT(DISTINCT ha.id) FILTER (WHERE ha.status='active') AS occupied_beds
     FROM hostels h
     LEFT JOIN hostel_rooms r        ON r.hostel_id  = h.id
     LEFT JOIN hostel_assignments ha ON ha.hostel_id = h.id
     WHERE h.school_id = $1
     GROUP BY h.id
     ORDER BY h.name ASC`,
    [school_id]
  );
  return result.rows;
};

export const getHostelById = async (id: number, school_id: number): Promise<IHostel | null> => {
  const result = await pool.query(
    `SELECT h.*,
            COUNT(DISTINCT r.id)                                    AS total_rooms,
            SUM(r.capacity)                                         AS total_bed_capacity,
            COUNT(DISTINCT ha.id) FILTER (WHERE ha.status='active') AS occupied_beds
     FROM hostels h
     LEFT JOIN hostel_rooms r        ON r.hostel_id  = h.id
     LEFT JOIN hostel_assignments ha ON ha.hostel_id = h.id
     WHERE h.id = $1 AND h.school_id = $2
     GROUP BY h.id`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateHostel = async (id: number, school_id: number, data: IUpdateHostel): Promise<IHostel | null> => {
  const result = await pool.query(
    `UPDATE hostels SET
      name           = COALESCE($1, name),
      hostel_type    = COALESCE($2, hostel_type),
      total_capacity = COALESCE($3, total_capacity),
      warden_name    = COALESCE($4, warden_name),
      warden_phone   = COALESCE($5, warden_phone),
      warden_email   = COALESCE($6, warden_email),
      address        = COALESCE($7, address),
      status         = COALESCE($8, status),
      updated_at     = NOW()
     WHERE id = $9 AND school_id = $10
     RETURNING *`,
    [data.name||null, data.hostel_type||null, data.total_capacity||null,
     data.warden_name||null, data.warden_phone||null, data.warden_email||null,
     data.address||null, data.status||null, id, school_id]
  );
  return result.rows[0] || null;
};

export const deleteHostel = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM hostels WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── ROOMS ──

export const createRoom = async (school_id: number, data: ICreateRoom): Promise<IHostelRoom> => {
  const result = await pool.query(
    `INSERT INTO hostel_rooms
      (school_id, hostel_id, room_number, floor, room_type, capacity, monthly_fee, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [school_id, data.hostel_id, data.room_number, data.floor||1,
     data.room_type||'non_ac', data.capacity||2, data.monthly_fee||0,
     data.status||'available', data.notes||null]
  );
  return result.rows[0];
};

export const getRoomsByHostel = async (hostel_id: number, school_id: number): Promise<IHostelRoom[]> => {
  const result = await pool.query(
    `SELECT r.*,
            COUNT(ha.id) FILTER (WHERE ha.status = 'active') AS occupied_count
     FROM hostel_rooms r
     LEFT JOIN hostel_assignments ha ON ha.room_id = r.id
     WHERE r.hostel_id = $1 AND r.school_id = $2
     GROUP BY r.id
     ORDER BY r.floor ASC, r.room_number ASC`,
    [hostel_id, school_id]
  );
  return result.rows;
};

export const getRoomById = async (id: number, school_id: number): Promise<IHostelRoom | null> => {
  const result = await pool.query(
    `SELECT * FROM hostel_rooms WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateRoom = async (id: number, school_id: number, data: IUpdateRoom): Promise<IHostelRoom | null> => {
  const result = await pool.query(
    `UPDATE hostel_rooms SET
      room_number = COALESCE($1, room_number),
      floor       = COALESCE($2, floor),
      room_type   = COALESCE($3, room_type),
      capacity    = COALESCE($4, capacity),
      monthly_fee = COALESCE($5, monthly_fee),
      status      = COALESCE($6, status),
      notes       = COALESCE($7, notes),
      updated_at  = NOW()
     WHERE id = $8 AND school_id = $9
     RETURNING *`,
    [data.room_number||null, data.floor||null, data.room_type||null,
     data.capacity||null, data.monthly_fee||null, data.status||null,
     data.notes||null, id, school_id]
  );
  return result.rows[0] || null;
};

export const deleteRoom = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM hostel_rooms WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── ASSIGNMENTS ──

export const createAssignment = async (school_id: number, data: ICreateAssignment): Promise<IHostelAssignment> => {
  const result = await pool.query(
    `INSERT INTO hostel_assignments
      (school_id, student_id, hostel_id, room_id, academic_year_id,
       joining_date, leaving_date, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [school_id, data.student_id, data.hostel_id, data.room_id,
     data.academic_year_id, data.joining_date, data.leaving_date||null,
     data.status||'active', data.notes||null]
  );
  return result.rows[0];
};

export const getAssignmentsByHostel = async (hostel_id: number, school_id: number, academic_year_id?: number): Promise<any[]> => {
  const params: any[] = [hostel_id, school_id];
  const yearFilter = academic_year_id
    ? `AND ha.academic_year_id = $${params.push(academic_year_id)}`
    : '';
  const result = await pool.query(
    `SELECT ha.*,
            s.full_name, s.admission_number, s.photo, s.gender,
            r.room_number, r.floor, r.room_type, r.monthly_fee
     FROM hostel_assignments ha
     INNER JOIN students     s ON s.id = ha.student_id
     INNER JOIN hostel_rooms r ON r.id = ha.room_id
     WHERE ha.hostel_id = $1 AND ha.school_id = $2 AND ha.status = 'active'
     ${yearFilter}
     ORDER BY r.floor ASC, r.room_number ASC, s.full_name ASC`,
    params
  );
  return result.rows;
};

export const getAssignmentsByRoom = async (room_id: number, school_id: number): Promise<any[]> => {
  const result = await pool.query(
    `SELECT ha.*,
            s.full_name, s.admission_number, s.photo, s.gender
     FROM hostel_assignments ha
     INNER JOIN students s ON s.id = ha.student_id
     WHERE ha.room_id = $1 AND ha.school_id = $2 AND ha.status = 'active'
     ORDER BY s.full_name ASC`,
    [room_id, school_id]
  );
  return result.rows;
};

export const getAssignmentByStudent = async (
  student_id: number,
  school_id: number,
  academic_year_id: number
): Promise<any | null> => {
  const result = await pool.query(
    `SELECT ha.*,
            h.name AS hostel_name, h.hostel_type, h.warden_name, h.warden_phone,
            r.room_number, r.floor, r.room_type, r.monthly_fee, r.capacity
     FROM hostel_assignments ha
     INNER JOIN hostels      h ON h.id = ha.hostel_id
     INNER JOIN hostel_rooms r ON r.id = ha.room_id
     WHERE ha.student_id      = $1
       AND ha.school_id        = $2
       AND ha.academic_year_id = $3
       AND ha.status           = 'active'`,
    [student_id, school_id, academic_year_id]
  );
  return result.rows[0] || null;
};

export const updateAssignment = async (
  id: number,
  school_id: number,
  data: IUpdateAssignment
): Promise<IHostelAssignment | null> => {
  const result = await pool.query(
    `UPDATE hostel_assignments SET
      leaving_date = COALESCE($1, leaving_date),
      status       = COALESCE($2, status),
      notes        = COALESCE($3, notes),
      updated_at   = NOW()
     WHERE id = $4 AND school_id = $5
     RETURNING *`,
    [data.leaving_date||null, data.status||null, data.notes||null, id, school_id]
  );
  return result.rows[0] || null;
};

export const getHostelSummary = async (school_id: number): Promise<any> => {
  const result = await pool.query(
    `SELECT
       COUNT(DISTINCT h.id)  FILTER (WHERE h.status = 'active')     AS active_hostels,
       COUNT(DISTINCT r.id)  FILTER (WHERE r.status = 'available')  AS available_rooms,
       COUNT(DISTINCT r.id)                                          AS total_rooms,
       SUM(r.capacity)                                               AS total_beds,
       COUNT(DISTINCT ha.id) FILTER (WHERE ha.status = 'active')    AS occupied_beds
     FROM hostels h
     LEFT JOIN hostel_rooms r        ON r.hostel_id  = h.id
     LEFT JOIN hostel_assignments ha ON ha.hostel_id = h.id
     WHERE h.school_id = $1`,
    [school_id]
  );
  return result.rows[0];
};