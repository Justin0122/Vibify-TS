import { NextFunction, Request, RequestHandler, Response } from 'express';

export class AppError extends Error {
    status: number;
    code?: string;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export const asyncHandler =
    (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
    (req, res, next) => {
        handler(req, res, next).catch(next);
    };

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof AppError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
    }
    console.error('[error]', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
}

export function notFoundHandler(_req: Request, res: Response): void {
    res.status(404).json({ error: '404: Not found' });
}
