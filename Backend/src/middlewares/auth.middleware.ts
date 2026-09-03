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


import { isSchoolBlocked } from '../Service/redis.service';

const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = req.cookies?.token;

        if (!token) {
            throw new AppError('You are not logged in. Please login to continue', 401);
        }

        const decoded = verifyToken(token) as IJwtPayload;

        // Instant Lockout: check if school is blocked in Redis
        if (decoded.role !== 'super_admin') {
            const schoolId = 'school_id' in decoded ? (decoded as any).school_id : decoded.id;
            if (schoolId) {
                const blocked = await isSchoolBlocked(Number(schoolId));
                if (blocked) {
                    res.clearCookie('token');
                    throw new AppError('Your school account has been suspended by the platform administrator.', 403);
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

