import pool from '../config/db';
import {
  IStudent, ICreateStudent, IUpdateStudent,
  IStudentEnrollment, IStudentEnrollmentWithStudent, ICreateEnrollment, IUpdateEnrollment
} from '../types/student.types';

// ── STUDENT QUERIES ──

export const createStudent = async (
  school_id: number,
  data: ICreateStudent
): Promise<IStudent> => {
  const result = await pool.query(
    `INSERT INTO students
      (school_id, admission_number, full_name, email, phone, password, gender,
       date_of_birth, blood_group, photo, nationality, religion, ethnicity,
       city, state, country, previous_school, admission_date, disability,
       disability_description, scholarship_type, scholarship_percent,
       scholarship_remarks, guardian_name, guardian_phone, guardian_email,
       guardian_relation, guardian_occupation, guardian_address, status)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
     RETURNING id, school_id, admission_number, full_name, email, phone, gender,
       date_of_birth::text, blood_group, photo, nationality, religion, ethnicity,
       city, state, country, previous_school, admission_date::text, disability,
       disability_description, scholarship_type, scholarship_percent, scholarship_remarks,
       guardian_name, guardian_phone, guardian_email,
       guardian_relation, guardian_occupation, guardian_address, status,
       created_at, updated_at`,
    [
      school_id, data.admission_number, data.full_name, data.email || null,
      data.phone || null, data.password, data.gender, data.date_of_birth,
      data.blood_group || null, data.photo || null, data.nationality || 'Nepali',
      data.religion || null, data.ethnicity || null, data.city || null,
      data.state || null, data.country || null, data.previous_school || null,
      data.admission_date, data.disability || false, data.disability_description || null,
      data.scholarship_type || null, data.scholarship_percent || null,
      data.scholarship_remarks || null, data.guardian_name, data.guardian_phone,
      data.guardian_email || null, data.guardian_relation, data.guardian_occupation || null,
      data.guardian_address || null, data.status || 'active',
    ]
  );
  return result.rows[0];
};

export const searchStudentsBySchool = async (
  school_id: number,
  q: string
): Promise<(Pick<IStudent, 'id' | 'full_name' | 'admission_number' | 'email' | 'phone' | 'scholarship_type' | 'scholarship_percent' | 'scholarship_remarks'> & { class_name?: string; section_name?: string; roll_number?: string | number; enrollment_id?: number; academic_year_id?: number })[]> => {
  const result = await pool.query(
    `SELECT s.id, s.full_name, s.admission_number, s.email, s.phone,
            s.scholarship_type, s.scholarship_percent, s.scholarship_remarks,
            se.id AS enrollment_id,
            se.academic_year_id,
            se.roll_number,
            cl.name AS class_name,
            sec.name AS section_name
     FROM students s
     LEFT JOIN LATERAL (
       SELECT id, class_id, section_id, academic_year_id, roll_number
       FROM student_enrollments
       WHERE student_id = s.id AND school_id = s.school_id
       ORDER BY (status = 'active') DESC, created_at DESC
       LIMIT 1
     ) se ON true
     LEFT JOIN classes cl ON cl.id = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     WHERE s.school_id = $1
       AND (
         s.full_name           ILIKE $2
         OR s.admission_number ILIKE $2
         OR s.email            ILIKE $2
         OR s.phone            ILIKE $2
         OR COALESCE(se.roll_number::text, '') ILIKE $2
         OR COALESCE(cl.name, '')              ILIKE $2
       )
     ORDER BY s.full_name ASC
     LIMIT 20`,
    [school_id, `%${q}%`]
  );
  return result.rows;
};

export const getStudentsBySchool = async (
  school_id: number,
  academic_year_id?: number,
  page?: number,
  limit?: number,
  search?: string,
  class_id?: number,
  section_id?: number,
  status?: string,
): Promise<{ data: IStudent[]; total: number; active_count: number; new_count: number } | IStudent[]> => {
  const params: any[] = [school_id];

  let lateralCondition = `student_id = s.id AND school_id = s.school_id`;
  let whereClause = `WHERE s.school_id = $1`;

  if (academic_year_id) {
    const ayParam = `$${params.push(academic_year_id)}`;
    lateralCondition += ` AND academic_year_id = ${ayParam}`;
    whereClause += ` AND EXISTS (
      SELECT 1 FROM student_enrollments
      WHERE student_id = s.id AND school_id = s.school_id AND academic_year_id = ${ayParam}
    )`;
  }

  if (search && search.trim()) {
    const sParam = `$${params.push(`%${search.trim().toLowerCase()}%`)}`;
    whereClause += ` AND (
      LOWER(s.full_name) ILIKE ${sParam}
      OR LOWER(s.admission_number) ILIKE ${sParam}
      OR LOWER(COALESCE(s.guardian_name, '')) ILIKE ${sParam}
      OR LOWER(COALESCE(s.phone, '')) ILIKE ${sParam}
      OR LOWER(COALESCE(cl.name, '')) ILIKE ${sParam}
    )`;
  }

  if (class_id) {
    const cParam = `$${params.push(class_id)}`;
    whereClause += ` AND se.class_id = ${cParam}`;
  }

  if (section_id) {
    const secParam = `$${params.push(section_id)}`;
    whereClause += ` AND se.section_id = ${secParam}`;
  }

  if (status && status !== 'all') {
    const stParam = `$${params.push(status)}`;
    whereClause += ` AND s.status = ${stParam}`;
  }

  const fromAndJoin = `
    FROM students s
    LEFT JOIN LATERAL (
      SELECT class_id, section_id, roll_number
      FROM student_enrollments
      WHERE ${lateralCondition}
      ORDER BY (status = 'active') DESC, created_at DESC
      LIMIT 1
    ) se ON true
    LEFT JOIN classes cl ON cl.id = se.class_id
    LEFT JOIN sections sec ON sec.id = se.section_id
    ${whereClause}
  `;

  if (page !== undefined || limit !== undefined) {
    const countRes = await pool.query(
      `SELECT 
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE s.status = 'active')::int AS active_count,
         COUNT(*) FILTER (WHERE s.admission_date >= CURRENT_DATE - INTERVAL '30 days')::int AS new_count
       ${fromAndJoin}`,
      params
    );
    const total = Number(countRes.rows[0]?.total ?? 0);
    const active_count = Number(countRes.rows[0]?.active_count ?? 0);
    const new_count = Number(countRes.rows[0]?.new_count ?? 0);

    const pageNum = Math.max(1, page || 1);
    const pageSize = Math.min(100, Math.max(1, limit || 15));
    const limitIdx = params.push(pageSize);
    const offsetIdx = params.push((pageNum - 1) * pageSize);

    const dataRes = await pool.query(
      `SELECT s.id, s.school_id, s.admission_number, s.full_name, s.email, s.phone, s.gender,
         s.date_of_birth::text, s.blood_group, s.photo, s.nationality, s.religion, s.ethnicity,
         s.city, s.state, s.country, s.previous_school, s.admission_date::text, s.disability,
         s.disability_description, s.scholarship_type, s.scholarship_percent, s.scholarship_remarks,
         s.guardian_name, s.guardian_phone, s.guardian_email,
         s.guardian_relation, s.guardian_occupation, s.guardian_address, s.status,
         s.created_at, s.updated_at,
         se.class_id, se.section_id, se.roll_number,
         cl.name AS class_name,
         sec.name AS section_name
       ${fromAndJoin}
       ORDER BY s.full_name ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return {
      data: dataRes.rows,
      total,
      active_count,
      new_count,
    };
  }

  const result = await pool.query(
    `SELECT s.id, s.school_id, s.admission_number, s.full_name, s.email, s.phone, s.gender,
       s.date_of_birth::text, s.blood_group, s.photo, s.nationality, s.religion, s.ethnicity,
       s.city, s.state, s.country, s.previous_school, s.admission_date::text, s.disability,
       s.disability_description, s.scholarship_type, s.scholarship_percent, s.scholarship_remarks,
       s.guardian_name, s.guardian_phone, s.guardian_email,
       s.guardian_relation, s.guardian_occupation, s.guardian_address, s.status,
       s.created_at, s.updated_at,
       se.class_id, se.section_id, se.roll_number,
       cl.name AS class_name,
       sec.name AS section_name
     ${fromAndJoin}
     ORDER BY s.full_name ASC`,
    params
  );
  return result.rows;
};

export const getStudentById = async (id: number, school_id: number): Promise<IStudent | null> => {
  const result = await pool.query(
    `SELECT id, school_id, admission_number, full_name, email, phone, gender,
       date_of_birth::text, blood_group, photo, nationality, religion, ethnicity,
       city, state, country, previous_school, admission_date::text, disability,
       disability_description, scholarship_type, scholarship_percent, scholarship_remarks,
       guardian_name, guardian_phone, guardian_email,
       guardian_relation, guardian_occupation, guardian_address, status,
       created_at, updated_at
     FROM students WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const getStudentByAdmissionNumber = async (admission_number: string, school_id: number): Promise<IStudent | null> => {
  const result = await pool.query(`SELECT * FROM students WHERE admission_number = $1 AND school_id = $2`, [admission_number, school_id]);
  return result.rows[0] || null;
};

export const getStudentByEmail = async (email: string, school_id: number): Promise<IStudent | null> => {
  const result = await pool.query(`SELECT * FROM students WHERE email = $1 AND school_id = $2`, [email, school_id]);
  return result.rows[0] || null;
};

// Used for login — student doesn't know their school_id upfront
// Returns school's calendar_system so it can be embedded in the JWT
export const findStudentByEmailGlobal = async (
  email: string
): Promise<(IStudent & {
  school_name: string;
  school_logo: string | null;
  school_timezone: string;
  school_account_status: string;
  school_calendar_system: string;
}) | null> => {
  const result = await pool.query(
    `SELECT st.*, s.school_name, s.logo AS school_logo, s.timezone AS school_timezone,
            s.is_account AS school_account_status, s.calendar_system AS school_calendar_system
     FROM students st
     INNER JOIN schools s ON s.id = st.school_id
     WHERE st.email = $1`,
    [email]
  );
  return result.rows[0] || null;
};

export const updateStudent = async (id: number, school_id: number, data: IUpdateStudent): Promise<IStudent | null> => {
  const result = await pool.query(
    `UPDATE students SET
      full_name              = COALESCE($1,  full_name),
      email                  = COALESCE($2,  email),
      phone                  = COALESCE($3,  phone),
      gender                 = COALESCE($4,  gender),
      date_of_birth          = COALESCE($5,  date_of_birth),
      blood_group            = COALESCE($6,  blood_group),
      photo                  = COALESCE($7,  photo),
      nationality            = COALESCE($8,  nationality),
      religion               = COALESCE($9,  religion),
      ethnicity              = COALESCE($10, ethnicity),
      city                   = COALESCE($11, city),
      state                  = COALESCE($12, state),
      country                = COALESCE($13, country),
      previous_school        = COALESCE($14, previous_school),
      disability             = COALESCE($15, disability),
      disability_description = COALESCE($16, disability_description),
      scholarship_type       = COALESCE($17, scholarship_type),
      scholarship_percent    = COALESCE($18, scholarship_percent),
      scholarship_remarks    = COALESCE($19, scholarship_remarks),
      guardian_name          = COALESCE($20, guardian_name),
      guardian_phone         = COALESCE($21, guardian_phone),
      guardian_email         = COALESCE($22, guardian_email),
      guardian_relation      = COALESCE($23, guardian_relation),
      guardian_occupation    = COALESCE($24, guardian_occupation),
      guardian_address       = COALESCE($25, guardian_address),
      status                 = COALESCE($26, status),
      updated_at             = NOW()
     WHERE id = $27 AND school_id = $28
     RETURNING id, school_id, admission_number, full_name, email, phone, gender,
       date_of_birth::text, blood_group, photo, nationality, religion, ethnicity,
       city, state, country, previous_school, admission_date::text, disability,
       disability_description, scholarship_type, scholarship_percent, scholarship_remarks,
       guardian_name, guardian_phone, guardian_email,
       guardian_relation, guardian_occupation, guardian_address, status,
       created_at, updated_at`,
    [
      data.full_name || null, data.email || null, data.phone || null,
      data.gender || null, data.date_of_birth || null, data.blood_group || null,
      data.photo || null, data.nationality || null, data.religion || null,
      data.ethnicity || null, data.city || null, data.state || null,
      data.country || null, data.previous_school || null, data.disability ?? null,
      data.disability_description || null, data.scholarship_type || null,
      data.scholarship_percent || null, data.scholarship_remarks || null,
      data.guardian_name || null, data.guardian_phone || null,
      data.guardian_email || null, data.guardian_relation || null,
      data.guardian_occupation || null, data.guardian_address || null,
      data.status || null, id, school_id,
    ]
  );
  return result.rows[0] || null;
};

export const getStudentByIdWithPassword = async (id: number, school_id: number): Promise<IStudent | null> => {
  const result = await pool.query(`SELECT * FROM students WHERE id = $1 AND school_id = $2`, [id, school_id]);
  return result.rows[0] || null;
};

export const updateStudentPassword = async (id: number, school_id: number, hashedPassword: string): Promise<void> => {
  await pool.query(`UPDATE students SET password = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3`, [hashedPassword, id, school_id]);
};

export const deleteStudent = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(`DELETE FROM students WHERE id = $1 AND school_id = $2`, [id, school_id]);
  return (result.rowCount ?? 0) > 0;
};

// ── ENROLLMENT QUERIES ──

export const createEnrollment = async (school_id: number, data: ICreateEnrollment): Promise<IStudentEnrollment> => {
  const result = await pool.query(
    `INSERT INTO student_enrollments
      (school_id, student_id, academic_year_id, class_id, section_id, roll_number,
       stream, registration_number, symbol_number, exam_roll_number, board_name,
       transport_required, transport_route, pickup_location, transport_fee,
       transport_fee_type, remarks, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      school_id, data.student_id, data.academic_year_id, data.class_id, data.section_id,
      data.roll_number || null, data.stream || 'not_applicable',
      data.registration_number || null, data.symbol_number || null,
      data.exam_roll_number || null, data.board_name || null,
      data.transport_required || false, data.transport_route || null,
      data.pickup_location || null, data.transport_fee || null,
      data.transport_fee_type || null, data.remarks || null, data.status || 'active',
    ]
  );
  return result.rows[0];
};

export const getEnrollmentsBySchool = async (
  school_id: number,
  academic_year_id: number,
  section_id?: number,
  class_id?: number,
  student_id?: number
): Promise<IStudentEnrollmentWithStudent[]> => {
  const params: any[] = [school_id, academic_year_id];
  let extraFilters = '';

  if (section_id) {
    params.push(section_id);
    extraFilters += ` AND se.section_id = $${params.length}`;
  }
  if (class_id) {
    params.push(class_id);
    extraFilters += ` AND se.class_id = $${params.length}`;
  }
  if (student_id) {
    params.push(student_id);
    extraFilters += ` AND se.student_id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT se.*, s.full_name, s.admission_number, s.photo, s.gender,
       s.guardian_name, s.guardian_phone, s.guardian_relation,
       s.scholarship_type, s.scholarship_percent, s.admission_date::text as admission_date,
       c.name AS class_name, sec.name AS section_name
     FROM student_enrollments se
     INNER JOIN students  s   ON s.id   = se.student_id
     INNER JOIN classes   c   ON c.id   = se.class_id
     INNER JOIN sections  sec ON sec.id = se.section_id
     WHERE se.school_id = $1 AND se.academic_year_id = $2 AND se.status = 'active'
       ${extraFilters}
     ORDER BY c.name ASC, sec.name ASC, se.roll_number ASC NULLS LAST, s.full_name ASC`,
    params
  );
  return result.rows;
};

export const getEnrollmentByStudent = async (student_id: number, school_id: number): Promise<IStudentEnrollment[]> => {
  const result = await pool.query(
    `SELECT se.*, c.name as class_name, sec.name as section_name, ay.year_name as academic_year_name
     FROM student_enrollments se
     INNER JOIN classes c ON c.id = se.class_id
     INNER JOIN sections sec ON sec.id = se.section_id
     INNER JOIN academic_years ay ON ay.id = se.academic_year_id
     WHERE se.student_id = $1 AND se.school_id = $2
     ORDER BY se.created_at DESC`,
    [student_id, school_id]
  );
  return result.rows;
};

export const getEnrollmentById = async (id: number, school_id: number): Promise<IStudentEnrollment | null> => {
  const result = await pool.query(`SELECT * FROM student_enrollments WHERE id = $1 AND school_id = $2`, [id, school_id]);
  return result.rows[0] || null;
};

export const updateEnrollment = async (id: number, school_id: number, data: IUpdateEnrollment): Promise<IStudentEnrollment | null> => {
  const result = await pool.query(
    `UPDATE student_enrollments SET
      class_id             = COALESCE($1,  class_id),
      section_id           = COALESCE($2,  section_id),
      roll_number          = COALESCE($3,  roll_number),
      stream               = COALESCE($4,  stream),
      registration_number  = COALESCE($5,  registration_number),
      symbol_number        = COALESCE($6,  symbol_number),
      exam_roll_number     = COALESCE($7,  exam_roll_number),
      board_name           = COALESCE($8,  board_name),
      is_promoted          = COALESCE($9,  is_promoted),
      promoted_to_class_id = COALESCE($10, promoted_to_class_id),
      transport_required   = COALESCE($11, transport_required),
      transport_route      = COALESCE($12, transport_route),
      pickup_location      = COALESCE($13, pickup_location),
      transport_fee        = COALESCE($14, transport_fee),
      transport_fee_type   = COALESCE($15, transport_fee_type),
      remarks              = COALESCE($16, remarks),
      status               = COALESCE($17, status),
      updated_at           = NOW()
     WHERE id = $18 AND school_id = $19
     RETURNING *`,
    [
      data.class_id || null, data.section_id || null, data.roll_number || null,
      data.stream || null, data.registration_number || null, data.symbol_number || null,
      data.exam_roll_number || null, data.board_name || null, data.is_promoted ?? null,
      data.promoted_to_class_id || null, data.transport_required ?? null,
      data.transport_route || null, data.pickup_location || null,
      data.transport_fee || null, data.transport_fee_type || null,
      data.remarks || null, data.status || null, id, school_id,
    ]
  );
  return result.rows[0] || null;
};
