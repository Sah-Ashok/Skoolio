import {Response} from 'express';

const sendResponse = (
    res: Response,
    statusCode: number , 
    success: boolean,
    message: string,
    data? : any 
)=> {
    res.status(statusCode).json({
        success,
        statusCode,
        message,
        data: data || null,
    });
}

export default sendResponse;