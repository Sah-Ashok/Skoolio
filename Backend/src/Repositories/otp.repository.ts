import redis from '../config/redis.config';

// ── Key helpers ──────────────────────────────────────────────────────────────
// Keys follow the pattern: otp:<type>:<email>
// e.g.  otp:two_fa:admin@school.com
//       otp:forgot_password:admin@school.com

type OTPType = 'forgot_password' | 'two_fa';

const otpKey = (email: string, type: OTPType): string =>
  `otp:${type}:${email.toLowerCase()}`;

// TTL in seconds
const OTP_TTL: Record<OTPType, number> = {
  two_fa:           5  * 60, // 5 minutes
  forgot_password:  10 * 60, // 10 minutes
};

// ── Store OTP ────────────────────────────────────────────────────────────────
/**
 * Save an OTP to Redis with automatic expiry.
 * Overwrites any existing OTP for the same email+type (one active OTP at a time).
 */
export const storeOTP = async (
  email: string,
  code: string,
  type: OTPType
): Promise<void> => {
  const key = otpKey(email, type);
  const ttl = OTP_TTL[type];

  // Store as JSON so we can add metadata in the future without key changes
  const value = JSON.stringify({ code, createdAt: Date.now() });

  // SET with EX (expire in seconds) — atomic, replaces previous if exists
  await redis.set(key, value, 'EX', ttl);
};

// ── Verify OTP ───────────────────────────────────────────────────────────────
/**
 * Check if the given code matches what's stored in Redis.
 * Returns true if valid (does NOT delete — call consumeOTP after success).
 */
export const verifyOTP = async (
  email: string,
  code: string,
  type: OTPType
): Promise<boolean> => {
  const key = otpKey(email, type);
  const raw = await redis.get(key);

  if (!raw) return false; // expired or never set

  try {
    const stored = JSON.parse(raw) as { code: string; createdAt: number };
    return stored.code === code;
  } catch {
    return false;
  }
};

// ── Consume OTP (verify + delete atomically) ─────────────────────────────────
/**
 * Verify the OTP and immediately delete it so it can't be reused.
 * Returns true if the code was valid.
 */
export const consumeOTP = async (
  email: string,
  code: string,
  type: OTPType
): Promise<boolean> => {
  const key   = otpKey(email, type);
  const raw   = await redis.get(key);

  if (!raw) return false;

  try {
    const stored = JSON.parse(raw) as { code: string; createdAt: number };
    if (stored.code !== code) return false;

    // Delete immediately — one-time use
    await redis.del(key);
    return true;
  } catch {
    return false;
  }
};

// ── Invalidate OTP ───────────────────────────────────────────────────────────
/**
 * Explicitly delete any existing OTP for this email+type.
 * Call before issuing a new OTP if you want to cancel the old one.
 */
export const invalidateOTP = async (
  email: string,
  type: OTPType
): Promise<void> => {
  await redis.del(otpKey(email, type));
};

// ── TTL check (optional / debug) ─────────────────────────────────────────────
/**
 * Returns seconds remaining before the OTP expires, or -2 if not found.
 */
export const otpTTL = async (
  email: string,
  type: OTPType
): Promise<number> => {
  return redis.ttl(otpKey(email, type));
};
