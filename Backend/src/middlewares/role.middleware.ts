import { Request, Response , NextFunction } from "express";
import { AllRoles } from '../types/auth.types';
import AppError from "../utils/AppError";

const restrictTo = (...roles: AllRoles[])=>{
    return (req: Request , res: Response , next: NextFunction): void => {
        if(!req.user){
            throw new AppError('You are not logged in. ', 401);
        }

        if(!roles.includes(req.user.role)){
            throw new AppError('Yor do not have permission to perform this action. ' , 403)
        }

        next();
    }
}

export default restrictTo;




