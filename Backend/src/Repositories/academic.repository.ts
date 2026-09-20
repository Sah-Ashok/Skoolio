import pool from '../config/db';
import { IAcademicYear, ICreateAcademicYear, IUpdateAcademicYear } from '../types/academic.types';
import { getCache, setCache, deleteCachePattern } from '../utils/redisCache';

export const createAcademicYear = async(school_id: number, data: ICreateAcademicYear): Promise<IAcademicYear> => {
    const result = await pool.query(
        `INSERT INTO academic_years
        (school_id, year_name, start_date, end_date, status, description)
        VALUES($1, $2, $3, $4, $5, $6)
        RETURNING id, school_id, year_name,
        start_date::text,
        end_date::text,
        status, description, created_at, updated_at`,
        [
            school_id,
            data.year_name,
            data.start_date,
            data.end_date,
            data.status,
            data.description || null,
        ]
    );
    await deleteCachePattern(`cache:school:${school_id}:academic_year:*`);
    return result.rows[0];
}


export const getAcademicYearsBySchool = async (
    school_id: number
): Promise<IAcademicYear[]> => {
    const result = await pool.query(
        `SELECT id, school_id, year_name,
        start_date::text,
        end_date::text,
        status, description, created_at, updated_at
        FROM academic_years WHERE school_id = $1
        ORDER BY start_date DESC`,
        [school_id]
    );
    return result.rows;
};


export const getAcademicYearById = async (
    id: number,
    school_id: number
): Promise<IAcademicYear | null> => {
    const result = await pool.query(
        `SELECT id, school_id, year_name,
        start_date::text,
        end_date::text,
        status, description, created_at, updated_at
        FROM academic_years WHERE id = $1 AND school_id = $2`,
        [id, school_id]
    );
    return result.rows[0] || null;
}


export const getActiveAcademicYear = async(
    school_id: number
): Promise<IAcademicYear | null> => {
    const cacheKey = `cache:school:${school_id}:academic_year:active`;
    const cached = await getCache<IAcademicYear>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(
        `SELECT id, school_id, year_name,
        start_date::text,
        end_date::text,
        status, description, created_at, updated_at
        FROM academic_years WHERE school_id = $1 AND LOWER(status) = 'active'
        ORDER BY id DESC LIMIT 1`,
        [school_id]
    );
    let activeYear = result.rows[0] || null;
    if (!activeYear) {
        const fallback = await pool.query(
            `SELECT id, school_id, year_name,
            start_date::text,
            end_date::text,
            status, description, created_at, updated_at
            FROM academic_years WHERE school_id = $1
            ORDER BY start_date DESC, id DESC LIMIT 1`,
            [school_id]
        );
        activeYear = fallback.rows[0] || null;
    }
    if (activeYear) {
        await setCache(cacheKey, activeYear, 86400); // 24 hours TTL
    }
    return activeYear;
}


export const updateAcademicYear = async(
    id: number,
    school_id: number,
    data: IUpdateAcademicYear
): Promise<IAcademicYear | null> => {
    const result = await pool.query(
        `UPDATE academic_years
        SET
        year_name = COALESCE($1, year_name),
        start_date = COALESCE($2, start_date),
        end_date = COALESCE($3, end_date),
        status = COALESCE($4, status),
        description = COALESCE($5, description),
        updated_at = NOW()
        WHERE id = $6 AND school_id = $7
        RETURNING id, school_id, year_name,
        start_date::text,
        end_date::text,
        status, description, created_at, updated_at`,
        [
            data.year_name || null,
            data.start_date || null,
            data.end_date || null,
            data.status || null,
            data.description || null,
            id,
            school_id,
        ]
    );
    await deleteCachePattern(`cache:school:${school_id}:academic_year:*`);
    return result.rows[0] || null;
};


export const deleteAcademicYear = async (
    id: number,
    school_id: number
): Promise<boolean> => {
    const result = await pool.query(
        `DELETE FROM academic_years WHERE id = $1 AND school_id = $2`,
        [id, school_id]
    );
    await deleteCachePattern(`cache:school:${school_id}:academic_year:*`);
    return (result.rowCount ?? 0) > 0;
}