import jwt, { SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET     = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const generateToken = (payload: object): string => {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, JWT_SECRET, options);
};

/** Short-lived token for 2FA pending session or password reset.
 *  @param payload  object to encode — should include a `purpose` field
 *  @param expiresIn  e.g. '5m', '10m', '15m'
 */
export const generateShortToken = (payload: object, expiresIn: string): string => {
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const verifyToken = (token: string): any => {
  return jwt.verify(token, JWT_SECRET);
};
