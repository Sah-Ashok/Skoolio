import { Pool } from "pg";
import dotenv from 'dotenv'

dotenv.config();

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    },

    // ── Connection pool settings ───────────────────────────────────────────
    max:                20,      // max connections in pool
    idleTimeoutMillis:  10000,   // close idle connections after 10 s (under Azure's ~4 min NAT timeout)
    connectionTimeoutMillis: 5000, // fail fast if no connection available in 5 s

    // ── TCP keepalive — prevents Azure load balancer from silently dropping idle connections
    keepAlive:         true,
    keepAliveInitialDelayMillis: 10000, // start sending keepalive probes after 10 s of idle
})

// Log and handle unexpected pool-level errors (e.g. backend crash, network drop)
// Without this handler, unhandled 'error' events crash the Node process
pool.on('error', (err, client) => {
    console.error('[DB] Unexpected pool client error — client will be removed:', err.message)
})

pool.connect()
    .then(client => {
        console.log('Database connected successfully')
        client.release()
    })
    .catch(err => console.error('Database connection error:', err))

export default pool;
