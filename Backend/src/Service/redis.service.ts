import redis from '../config/redis.config';
import pool from '../config/db';

const ACTIVE_WINDOW_SECONDS = 15 * 60; // 15 minutes window for active users

export interface ActiveUserMeta {
  school_id: number;
  role: string;
  user_id: number;
  name?: string;
  ip?: string;
  last_seen: number;
}

export interface BannedIpEntry {
  ip: string;
  reason: string;
  banned_at: string;
  expires_at?: string;
}

/**
 * Record user activity in Redis
 */
export async function trackActiveUser(params: {
  school_id: number;
  user_id: number;
  role: string;
  name?: string;
  ip?: string;
}): Promise<void> {
  try {
    const now = Date.now();
    const member = `${params.school_id}:${params.role}:${params.user_id}`;

    const pipeline = redis.pipeline();
    // 1. Add to global active set
    pipeline.zadd('active:users:platform', now, member);
    // 2. Add to school-specific active set
    pipeline.zadd(`active:users:school:${params.school_id}`, now, `${params.role}:${params.user_id}`);
    // 3. Store user metadata with TTL
    const meta: ActiveUserMeta = {
      school_id: params.school_id,
      role: params.role,
      user_id: params.user_id,
      name: params.name || '',
      ip: params.ip || '',
      last_seen: now,
    };
    pipeline.set(`active:meta:${member}`, JSON.stringify(meta), 'EX', ACTIVE_WINDOW_SECONDS);

    // Prune entries older than 15 minutes
    const cutoff = now - ACTIVE_WINDOW_SECONDS * 1000;
    pipeline.zremrangebyscore('active:users:platform', 0, cutoff);
    pipeline.zremrangebyscore(`active:users:school:${params.school_id}`, 0, cutoff);

    await pipeline.exec();
  } catch (err) {
    // Non-blocking telemetry error
    console.warn('[Redis] trackActiveUser error:', (err as any).message);
  }
}

/**
 * Get active user counts for Super Admin
 */
export async function getActiveUsersStats() {
  try {
    const now = Date.now();
    const cutoff = now - ACTIVE_WINDOW_SECONDS * 1000;

    // Prune entries older than 15 minutes
    await redis.zremrangebyscore('active:users:platform', 0, cutoff);

    // Get all active members within window
    const members = await redis.zrangebyscore('active:users:platform', cutoff, '+inf');

    let adminsActive = 0;
    let teachersActive = 0;
    let studentsActive = 0;
    let superAdminsActive = 0;
    const schoolCounts: Record<number, number> = {};

    members.forEach((m) => {
      const parts = m.split(':');
      if (parts.length >= 3) {
        const schoolId = Number(parts[0]);
        const role = parts[1];
        if (role === 'admin') adminsActive++;
        else if (role === 'faculty' || role === 'teacher') teachersActive++;
        else if (role === 'student') studentsActive++;
        else if (role === 'super_admin') superAdminsActive++;

        if (schoolId > 0) {
          schoolCounts[schoolId] = (schoolCounts[schoolId] || 0) + 1;
        }
      }
    });

    // Fetch user metadata for all active members
    let activeMembers: any[] = [];
    if (members.length > 0) {
      const metaKeys = members.map((m) => `active:meta:${m}`);
      const rawMetas = await redis.mget(...metaKeys);

      activeMembers = rawMetas
        .map((raw, idx) => {
          if (raw) {
            try {
              return JSON.parse(raw);
            } catch {
              return null;
            }
          }
          const parts = members[idx].split(':');
          return {
            school_id: Number(parts[0]) || 0,
            role: parts[1] || 'user',
            user_id: Number(parts[2]) || 0,
            name: '',
            ip: '',
            last_seen: now,
          };
        })
        .filter(Boolean);
    }

    // Lookup real school names and codes from PostgreSQL
    const schoolIds = [
      ...new Set(
        [...Object.keys(schoolCounts).map(Number), ...activeMembers.map((m) => m.school_id)].filter(
          (id) => id > 0
        )
      ),
    ];

    const schoolMap: Record<number, { school_name: string; school_code: string }> = {};
    if (schoolIds.length > 0) {
      try {
        const sRes = await pool.query(
          `SELECT id, school_name, school_code FROM schools WHERE id = ANY($1::int[])`,
          [schoolIds]
        );
        sRes.rows.forEach((r) => {
          schoolMap[r.id] = { school_name: r.school_name, school_code: r.school_code };
        });
      } catch (err: any) {
        console.warn('[Redis] getActiveUsersStats school lookup error:', err.message);
      }
    }

    // Attach school information to active members
    const enrichedMembers = activeMembers
      .map((m) => ({
        ...m,
        school_name:
          m.school_id === 0
            ? 'Platform Control Center'
            : schoolMap[m.school_id]?.school_name || `School #${m.school_id}`,
        school_code: schoolMap[m.school_id]?.school_code || '',
      }))
      .sort((a, b) => b.last_seen - a.last_seen);

    const activeSchools = Object.keys(schoolCounts).map((sId) => {
      const id = Number(sId);
      return {
        school_id: id,
        school_name: schoolMap[id]?.school_name || `School #${id}`,
        school_code: schoolMap[id]?.school_code || '',
        active_count: schoolCounts[id],
      };
    });

    return {
      totalActive: members.length,
      adminsActive,
      teachersActive,
      studentsActive,
      superAdminsActive,
      activeSchools,
      activeMembers: enrichedMembers,
    };
  } catch (err) {
    console.warn('[Redis] getActiveUsersStats error:', (err as any).message);
    return {
      totalActive: 0,
      adminsActive: 0,
      teachersActive: 0,
      studentsActive: 0,
      superAdminsActive: 0,
      activeSchools: [],
      activeMembers: [],
    };
  }
}

/**
 * Check if a school is currently blocked
 */
export async function isSchoolBlocked(schoolId: number): Promise<boolean> {
  try {
    const isBlocked = await redis.sismember('blocked_schools', String(schoolId));
    return isBlocked === 1;
  } catch {
    return false;
  }
}

/**
 * Get count of active users for a specific school in last 15 minutes
 */
export async function getSchoolActiveUsersCount(school_id: number): Promise<number> {
  try {
    const now = Date.now();
    const cutoff = now - ACTIVE_WINDOW_SECONDS * 1000;
    await redis.zremrangebyscore(`active:users:school:${school_id}`, 0, cutoff);
    return await redis.zcount(`active:users:school:${school_id}`, cutoff, '+inf');
  } catch {
    return 0;
  }
}

/**
 * Synchronize blocked schools from PostgreSQL to Redis
 */
export async function syncBlockedSchools(): Promise<void> {
  try {
    const result = await pool.query(`SELECT id FROM schools WHERE is_account = 'blocked'`);
    await redis.del('blocked_schools');
    if (result.rows.length > 0) {
      const ids = result.rows.map((r) => String(r.id));
      await redis.sadd('blocked_schools', ...ids);
    }
  } catch (err) {
    console.warn('[Redis] syncBlockedSchools error:', (err as any).message);
  }
}

/**
 * Mark a school blocked or unblocked in Redis
 */
export async function setSchoolBlockedState(schoolId: number, blocked: boolean): Promise<void> {
  try {
    if (blocked) {
      await redis.sadd('blocked_schools', String(schoolId));
    } else {
      await redis.srem('blocked_schools', String(schoolId));
    }
  } catch (err) {
    console.warn('[Redis] setSchoolBlockedState error:', (err as any).message);
  }
}

/**
 * Check if an IP address is banned
 */
export async function isIpBanned(ip: string): Promise<boolean> {
  try {
    const banned = await redis.sismember('banned_ips', ip);
    return banned === 1;
  } catch {
    return false;
  }
}

/**
 * Ban an IP address
 */
export async function banIp(ip: string, reason: string = 'Abusive requests / security trigger', durationSeconds: number = 86400): Promise<void> {
  try {
    await redis.sadd('banned_ips', ip);
    const entry: BannedIpEntry = {
      ip,
      reason,
      banned_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + durationSeconds * 1000).toISOString(),
    };
    await redis.set(`banned_ip_meta:${ip}`, JSON.stringify(entry), 'EX', durationSeconds);
  } catch (err) {
    console.warn('[Redis] banIp error:', (err as any).message);
  }
}

/**
 * Unban an IP address
 */
export async function unbanIp(ip: string): Promise<void> {
  try {
    await redis.srem('banned_ips', ip);
    await redis.del(`banned_ip_meta:${ip}`);
  } catch (err) {
    console.warn('[Redis] unbanIp error:', (err as any).message);
  }
}

/**
 * Retrieve all currently banned IPs with metadata
 */
export async function getBannedIps(): Promise<BannedIpEntry[]> {
  try {
    const ips = await redis.smembers('banned_ips');
    if (!ips.length) return [];

    const entries: BannedIpEntry[] = [];
    for (const ip of ips) {
      const metaStr = await redis.get(`banned_ip_meta:${ip}`);
      if (metaStr) {
        try {
          entries.push(JSON.parse(metaStr));
        } catch {
          entries.push({ ip, reason: 'Banned by Super Admin', banned_at: new Date().toISOString() });
        }
      } else {
        entries.push({ ip, reason: 'Banned by Super Admin', banned_at: new Date().toISOString() });
      }
    }
    return entries;
  } catch (err) {
    console.warn('[Redis] getBannedIps error:', (err as any).message);
    return [];
  }
}

/**
 * Insert security event into the platform_security_events table
 */
export async function logSecurityEvent(params: {
  event_type: 'BRUTE_FORCE_BLOCKED' | 'CROSS_TENANT_ATTEMPT' | 'RATE_LIMIT_EXCEEDED' | 'ACCOUNT_LOCKED' | 'UNAUTHORIZED_ACCESS';
  school_id?: number | null;
  actor_id?: number | null;
  actor_role?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  endpoint?: string | null;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO platform_security_events
        (event_type, school_id, actor_id, actor_role, ip_address, user_agent, endpoint, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.event_type,
        params.school_id || null,
        params.actor_id || null,
        params.actor_role || null,
        params.ip_address || null,
        params.user_agent || null,
        params.endpoint || null,
        JSON.stringify(params.details || {}),
      ]
    );
  } catch (err) {
    console.warn('[SecurityEvent] Error writing security event:', (err as any).message);
  }
}

/**
 * Maintenance mode state
 */
export async function getMaintenanceMode(): Promise<{ enabled: boolean; message: string }> {
  try {
    const raw = await redis.get('platform:maintenance_mode');
    if (!raw) return { enabled: false, message: '' };
    return JSON.parse(raw);
  } catch {
    return { enabled: false, message: '' };
  }
}

export async function setMaintenanceMode(enabled: boolean, message: string = 'System is undergoing scheduled maintenance.'): Promise<void> {
  try {
    await redis.set('platform:maintenance_mode', JSON.stringify({ enabled, message }));
  } catch (err) {
    console.warn('[Redis] setMaintenanceMode error:', (err as any).message);
  }
}

/**
 * Global announcement banner
 */
export async function getGlobalAnnouncement(): Promise<{ active: boolean; message: string }> {
  try {
    const raw = await redis.get('platform:announcement');
    if (!raw) return { active: false, message: '' };
    return JSON.parse(raw);
  } catch {
    return { active: false, message: '' };
  }
}

export async function setGlobalAnnouncement(message: string, active: boolean): Promise<void> {
  try {
    await redis.set('platform:announcement', JSON.stringify({ active, message }));
  } catch (err) {
    console.warn('[Redis] setGlobalAnnouncement error:', (err as any).message);
  }
}
