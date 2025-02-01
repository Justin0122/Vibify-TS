import { Request, Response, NextFunction } from 'express';
import chalk from "chalk";

export default function catchErrors(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return async function (req: Request, res: Response, next: NextFunction) {
        try {
            return await fn(req, res, next);
        } catch (err) {
            console.error(chalk.red(err));
            if (err instanceof Error) {
                return res.status(500).json({ error: err.message });
            } else {
                return res.status(500).json({ error: 'An unknown error occurred' });
            }
        }
    }
}