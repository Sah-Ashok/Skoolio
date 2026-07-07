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


const protect = (req: Request , res: Response , next: NextFunction): void => {
    try{
        const token = req.cookies?.token;

        if(!token){
            throw new AppError('You are not logged in. Please login to continue' , 401);
        }

        const decoded = verifyToken(token) as IJwtPayload;
        
        req.user = decoded;

        next();
    }catch(err){
        next(err);
    }


}

export default protect

