import { Request, Response, NextFunction } from 'express';
import catchErrors from '../../src/middlewares/catchErrors';

describe('catchErrors middleware', () => {
    it('should call the passed function and handle success', async () => {
        const req = {} as Request;
        const res = {} as Response;
        const next = jest.fn() as NextFunction;
        const fn = jest.fn().mockResolvedValue('success');

        const wrappedFn = catchErrors(fn);
        await wrappedFn(req, res, next);

        expect(fn).toHaveBeenCalledWith(req, res, next);
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error if the passed function throws', async () => {
        const req = {} as Request;
        const res = {} as Response;
        const next = jest.fn() as NextFunction;
        const error = new Error('Test error');
        const fn = jest.fn().mockRejectedValue(error);

        const wrappedFn = catchErrors(fn);
        await wrappedFn(req, res, next);

        expect(fn).toHaveBeenCalledWith(req, res, next);
        expect(next).toHaveBeenCalledWith(error);
    });

    it('should log the error if the passed function throws', async () => {
        const req = {} as Request;
        const res = {} as Response;
        const next = jest.fn() as NextFunction;
        const error = new Error('Test error');
        const fn = jest.fn().mockRejectedValue(error);
        console.error = jest.fn();

        const wrappedFn = catchErrors(fn);
        await wrappedFn(req, res, next);

        expect(console.error).toHaveBeenCalledWith(error);
    });
});