import redis from '../config/redis.config';

// ── Key helpers ──────────────────────────────────────────────────────────────
// Keys follow the pattern: otp:<type>:<email>
// e.g.  otp:two_fa:admin@school.com
//       otp:forgot_password:admin@school.com
//       otp:registration:admin@school.com

type OTPType = 'forgot_password' | 'two_fa' | 'registration';

const otpKey = (email: string, type: OTPType): string =>
  `otp:${type}:${email.toLowerCase()}`;

// TTL in seconds
const OTP_TTL: Record<OTPType, number> = {
  two_fa:           5  * 60, // 5 minutes
  forgot_password:  10 * 60, // 10 minutes
  registration:     10 * 60, // 10 minutes
};

// ── Store OTP ────────────────────────────────────────────────────────────────
export const storeOTP = async (
  email: string,
  code: string,
  type: OTPType
): Promise<void> => {
  const key   = otpKey(email, type);
  const ttl   = OTP_TTL[type];
  const value = JSON.stringify({ code, createdAt: Date.now() });
  await redis.set(key, value, 'EX', ttl);
};

// ── Verify OTP ───────────────────────────────────────────────────────────────
export const verifyOTP = async (
  email: string,
  code: string,
  type: OTPType
): Promise<boolean> => {
  const key = otpKey(email, type);
  const raw = await redis.get(key);
  if (!raw) return false;
  try {
    const stored = JSON.parse(raw) as { code: string; createdAt: number };
    return stored.code === code;
  } catch {
    return false;
  }
};

// ── Consume OTP (verify + delete atomically) ─────────────────────────────────
export const consumeOTP = async (
  email: string,
  code: string,
  type: OTPType
): Promise<boolean> => {
  const key = otpKey(email, type);
  const raw = await redis.get(key);
  if (!raw) return false;
  try {
    const stored = JSON.parse(raw) as { code: string; createdAt: number };
    if (stored.code !== code) return false;
    await redis.del(key);
    return true;
  } catch {
    return false;
  }
};

// ── Invalidate OTP ───────────────────────────────────────────────────────────
export const invalidateOTP = async (
  email: string,
  type: OTPType
): Promise<void> => {
  await redis.del(otpKey(email, type));
};

// ── TTL check (optional / debug) ─────────────────────────────────────────────
export const otpTTL = async (
  email: string,
  type: OTPType
): Promise<number> => {
  return redis.ttl(otpKey(email, type));
};
