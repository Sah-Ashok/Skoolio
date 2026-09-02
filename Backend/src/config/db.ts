import { Pool, types } from "pg";
import dotenv from 'dotenv'

dotenv.config();

// Ensure PostgreSQL DATE (OID 1082) is always parsed as pure 'YYYY-MM-DD' string without timezone shifting
types.setTypeParser(1082, (val: string) => val);

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    },

// ── Connection pool settings for Azure PostgreSQL ──────────────────────────
    max:                     20,      // max connections in pool
    idleTimeoutMillis:       30000,   // close idle connections after 30 s
    connectionTimeoutMillis: 30000,   // allow up to 30 s for remote SSL handshake & cold starts

    // ── TCP keepalive — prevents Azure load balancer from silently dropping idle connections
    keepAlive:                   true,
    keepAliveInitialDelayMillis: 10000, // send keepalive probe after 10 s of idle
})

// Log and handle unexpected pool-level errors (e.g. network drops)
pool.on('error', (err) => {
    console.error('[DB Pool] Unexpected client error (connection dropped, will recover):', err.message)
})

// Retry connection with exponential backoff on startup
const testConnection = async (retries = 5, delay = 2000): Promise<void> => {
    for (let i = 1; i <= retries; i++) {
        try {
            const client = await pool.connect();
            console.log('✓ Database connected successfully to Azure PostgreSQL');
            client.release();
            return;
        } catch (err: any) {
            console.warn(`[DB] Connection attempt ${i}/${retries} failed: ${err.message}`);
            if (i < retries) {
                console.log(`[DB] Retrying connection in ${delay / 1000}s...`);
                await new Promise((res) => setTimeout(res, delay));
                delay = Math.min(delay * 1.5, 10000);
            } else {
                console.error('[DB] All connection attempts failed. Please verify Azure Firewall rules and network connectivity.');
            }
        }
    }
};

testConnection();

export default pool;
