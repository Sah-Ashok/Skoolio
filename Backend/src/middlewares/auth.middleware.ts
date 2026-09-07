import {Request , Response , NextFunction} from 'express';
import { verifyToken } from '../config/jwt.config';
import { IJwtPayload } from '../types/auth.types';
import AppError from '../utils/AppError';
declare global {
    namespace Express {
        interface Request{
            user?: IJwtPayload;
        }
    }
}


import { isSchoolBlocked, getCachedSchoolSubscription } from '../Service/redis.service';

const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = req.cookies?.token;

        if (!token) {
            throw new AppError('You are not logged in. Please login to continue', 401);
        }

        const decoded = verifyToken(token) as IJwtPayload;

        // Instant Lockout & Subscription Validation (Non Super-Admin)
        if (decoded.role !== 'super_admin') {
            const schoolId = 'school_id' in decoded ? (decoded as any).school_id : decoded.id;
            if (schoolId) {
                const blocked = await isSchoolBlocked(Number(schoolId));
                if (blocked) {
                    res.clearCookie('token');
                    throw new AppError('Your school account has been suspended by the platform administrator.', 403);
                }

                // Subscription Check via Redis (Sub-millisecond)
                // Exempt paths: viewing plans, offers, subscription status for renewal, and logging out
                const url = req.originalUrl || req.url || '';
                const isSubscriptionExempt =
                    url.includes('/subscriptions') ||
                    url.includes('/auth/logout') ||
                    url.includes('/auth/me');

                if (!isSubscriptionExempt) {
                    const subStatus = await getCachedSchoolSubscription(Number(schoolId));
                    if (subStatus.status === 'expired' && !subStatus.is_in_grace_period) {
                        throw new AppError(
                            'Your school subscription has expired. Please renew your plan to continue using the portal.',
                            402
                        );
                    }
                }
            }
        }

        req.user = decoded;

        next();
    } catch (err) {
        next(err);
    }
};

export default protect;

