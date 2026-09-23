import pool from '../config/db';

export interface IPasskeyRecord {
  id: number;
  user_id: number;
  role: string;
  email: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_name: string;
  transports: string[];
  created_at: string;
  last_used_at: string | null;
}

// Auto-initialize table if not exists
export const initPasskeyTable = async (): Promise<void> => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_passkeys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        role VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        credential_id TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        counter BIGINT NOT NULL DEFAULT 0,
        device_name VARCHAR(255) NOT NULL,
        transports TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_role ON user_passkeys(user_id, role);
      CREATE INDEX IF NOT EXISTS idx_user_passkeys_cred_id ON user_passkeys(credential_id);
      CREATE INDEX IF NOT EXISTS idx_user_passkeys_email ON user_passkeys(LOWER(email));
    `);
  } catch (err: any) {
    console.warn('[Passkey DB Init]', err.message);
  }
};

// Immediately invoke table creation
initPasskeyTable();

export const createPasskey = async (data: {
  user_id: number;
  role: string;
  email: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_name: string;
  transports?: string[];
}): Promise<IPasskeyRecord> => {
  const result = await pool.query(
    `INSERT INTO user_passkeys (user_id, role, email, credential_id, public_key, counter, device_name, transports)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.user_id,
      data.role,
      data.email.toLowerCase().trim(),
      data.credential_id,
      data.public_key,
      data.counter,
      data.device_name,
      data.transports || [],
    ]
  );
  return result.rows[0];
};

export const getPasskeysByUser = async (user_id: number, role: string): Promise<IPasskeyRecord[]> => {
  const result = await pool.query(
    `SELECT id, user_id, role, email, credential_id, counter, device_name, transports, created_at, last_used_at
     FROM user_passkeys
     WHERE user_id = $1 AND role = $2
     ORDER BY created_at DESC`,
    [user_id, role]
  );
  return result.rows;
};

export const getPasskeyByCredentialId = async (credential_id: string): Promise<IPasskeyRecord | null> => {
  const result = await pool.query(
    `SELECT * FROM user_passkeys WHERE credential_id = $1`,
    [credential_id]
  );
  return result.rows[0] || null;
};

export const getPasskeysByEmail = async (email: string): Promise<IPasskeyRecord[]> => {
  const result = await pool.query(
    `SELECT * FROM user_passkeys WHERE LOWER(email) = LOWER($1) ORDER BY created_at DESC`,
    [email.trim()]
  );
  return result.rows;
};

export const updatePasskeyCounter = async (id: number, counter: number): Promise<void> => {
  await pool.query(
    `UPDATE user_passkeys SET counter = $1, last_used_at = NOW() WHERE id = $2`,
    [counter, id]
  );
};

export const deletePasskeyById = async (id: number, user_id: number, role: string): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM user_passkeys WHERE id = $1 AND user_id = $2 AND role = $3`,
    [id, user_id, role]
  );
  return (result.rowCount ?? 0) > 0;
};
