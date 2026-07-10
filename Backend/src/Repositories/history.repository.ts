import pool from '../config/db';

export interface ActivityLog {
  id: number;
  school_id: number;
  actor_id: number | null;
  actor_role: string;
  actor_name: string | null;
  module: string;
  action: string;
  entity_id: number | null;
  entity_label: string | null;
  description: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface GetHistoryFilters {
  school_id: number;
  module?: string;
  action?: string;
  actor_role?: string;
  from_date?: string;   // ISO date string YYYY-MM-DD
  to_date?: string;
  page?: number;
  limit?: number;
}

/**
 * Insert one activity log entry.
 * Called by the middleware — not exposed via API.
 */
export async function insertActivityLog(params: {
  school_id: number;
  actor_id: number | null;
  actor_role: string;
  actor_name: string | null;
  module: string;
  action: string;
  entity_id: number | null;
  entity_label: string | null;
  description: string;
  ip_address: string | null;
  user_agent: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO activity_logs
       (school_id, actor_id, actor_role, actor_name, module, action,
        entity_id, entity_label, description, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      params.school_id,
      params.actor_id,
      params.actor_role,
      params.actor_name,
      params.module,
      params.action,
      params.entity_id,
      params.entity_label,
      params.description,
      params.ip_address,
      params.user_agent,
    ]
  );
}

/**
 * Fetch paginated activity logs for a school (max 3 months retention window).
 */
export async function getActivityLogs(filters: GetHistoryFilters): Promise<{
  logs: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const {
    school_id,
    module,
    action,
    actor_role,
    from_date,
    to_date,
    page = 1,
    limit = 50,
  } = filters;

  const offset = (page - 1) * limit;
  const params: any[] = [school_id];
  const conditions: string[] = [
    'school_id = $1',
    // Hard-enforce 3-month retention window on every query
    "created_at >= NOW() - INTERVAL '3 months'",
  ];

  if (module) {
    params.push(module);
    conditions.push(`module = $${params.length}`);
  }
  if (action) {
    params.push(action);
    conditions.push(`action = $${params.length}`);
  }
  if (actor_role) {
    params.push(actor_role);
    conditions.push(`actor_role = $${params.length}`);
  }
  if (from_date) {
    params.push(from_date);
    conditions.push(`created_at::date >= $${params.length}`);
  }
  if (to_date) {
    params.push(to_date);
    conditions.push(`created_at::date <= $${params.length}`);
  }

  const where = conditions.join(' AND ');

  // Count query
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM activity_logs WHERE ${where}`,
    params
  );
  const total: number = countResult.rows[0]?.total ?? 0;

  // Data query
  params.push(limit, offset);
  const dataResult = await pool.query(
    `SELECT id, school_id, actor_id, actor_role, actor_name,
            module, action, entity_id, entity_label, description,
            ip_address, user_agent, created_at::text AS created_at
     FROM activity_logs
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    logs: dataResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Purge logs older than 3 months for a specific school.
 * Called by super_admin endpoint only.
 */
export async function purgeOldLogsForSchool(school_id: number): Promise<number> {
  const result = await pool.query(
    `DELETE FROM activity_logs
     WHERE school_id = $1
       AND created_at < NOW() - INTERVAL '3 months'`,
    [school_id]
  );
  return result.rowCount ?? 0;
}

/**
 * Purge logs older than 3 months across ALL schools.
 * Intended for a scheduled job / super_admin sweep.
 */
export async function purgeAllOldLogs(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '3 months'`
  );
  return result.rowCount ?? 0;
}

/**
 * Get distinct modules that have logs for a school (for filter dropdown).
 */
export async function getDistinctModules(school_id: number): Promise<string[]> {
  const result = await pool.query(
    `SELECT DISTINCT module FROM activity_logs
     WHERE school_id = $1
       AND created_at >= NOW() - INTERVAL '3 months'
     ORDER BY module`,
    [school_id]
  );
  return result.rows.map((r) => r.module);
}
