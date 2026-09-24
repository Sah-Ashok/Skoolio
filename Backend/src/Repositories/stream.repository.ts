import pool from '../config/db';
import { IStream, ICreateStream, IUpdateStream } from '../types/stream.types';

// Default streams seeded when a school has no streams configured
const DEFAULT_STREAMS = [
  'Commerce',
  'Science - PCM',
  'Science - PCB',
  'Arts',
  'General',
  'Vocational',
];

export const initStreamTable = async (): Promise<void> => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.streams (
        id SERIAL PRIMARY KEY,
        school_id INT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50),
        description TEXT,
        status VARCHAR(20) DEFAULT 'active' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        CONSTRAINT unique_school_stream_name UNIQUE (school_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_streams_school_id ON public.streams (school_id);
    `);
  } catch (err: any) {
    console.error('[Stream DB Init error]', err.message);
  }
};

// Initialize table on module load
initStreamTable();

export const getStreamsBySchool = async (school_id: number): Promise<IStream[]> => {
  const result = await pool.query(
    `SELECT * FROM public.streams WHERE school_id = $1 ORDER BY name ASC`,
    [school_id]
  );

  // Auto-seed if school has no streams yet
  if (result.rows.length === 0) {
    // Check if the school already used any custom stream in classes
    const existingClassStreams = await pool.query(
      `SELECT DISTINCT stream FROM public.classes
       WHERE school_id = $1 AND stream IS NOT NULL AND stream != 'Not Applicable' AND stream != ''`,
      [school_id]
    );

    const streamsToSeed = new Set<string>();
    existingClassStreams.rows.forEach((r) => streamsToSeed.add(r.stream.trim()));
    DEFAULT_STREAMS.forEach((st) => streamsToSeed.add(st));

    for (const streamName of streamsToSeed) {
      try {
        await pool.query(
          `INSERT INTO public.streams (school_id, name, status)
           VALUES ($1, $2, 'active')
           ON CONFLICT (school_id, name) DO NOTHING`,
          [school_id, streamName]
        );
      } catch {
        // Skip duplicate or race condition
      }
    }

    const seeded = await pool.query(
      `SELECT * FROM public.streams WHERE school_id = $1 ORDER BY name ASC`,
      [school_id]
    );
    return seeded.rows;
  }

  return result.rows;
};

export const getStreamById = async (id: number, school_id: number): Promise<IStream | null> => {
  const result = await pool.query(
    `SELECT * FROM public.streams WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const findStreamByName = async (school_id: number, name: string): Promise<IStream | null> => {
  const result = await pool.query(
    `SELECT * FROM public.streams WHERE school_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))`,
    [school_id, name]
  );
  return result.rows[0] || null;
};

export const createStream = async (school_id: number, data: ICreateStream): Promise<IStream> => {
  const result = await pool.query(
    `INSERT INTO public.streams (school_id, name, code, description, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      school_id,
      data.name.trim(),
      data.code?.trim() || null,
      data.description?.trim() || null,
      data.status || 'active',
    ]
  );
  return result.rows[0];
};

export const updateStream = async (
  id: number,
  school_id: number,
  data: IUpdateStream
): Promise<IStream | null> => {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name.trim());
  }
  if (data.code !== undefined) {
    fields.push(`code = $${idx++}`);
    values.push(data.code?.trim() || null);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(data.description?.trim() || null);
  }
  if (data.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(data.status);
  }

  if (fields.length === 0) return getStreamById(id, school_id);

  fields.push(`updated_at = NOW()`);
  values.push(id, school_id);

  const result = await pool.query(
    `UPDATE public.streams
     SET ${fields.join(', ')}
     WHERE id = $${idx++} AND school_id = $${idx++}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
};

export const deleteStream = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM public.streams WHERE id = $1 AND school_id = $2 RETURNING id`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};
