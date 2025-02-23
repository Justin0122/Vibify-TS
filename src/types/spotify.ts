import {Request} from "express";

export interface SpotifyAuthorizationResponse {
    api_token: string;
    userId: string;
}

export interface PaginationOptions {
    limit?: number;
    offset?: number;
    after?: number;
    before?: number;
}

export interface log {
    (message: string, type: string, images?: boolean): void;
}

export interface RequestWithLog extends Request {
    log?: log;
    paginationOptions?: PaginationOptions;
    monthOptions?: MonthOptions;
}

export interface MonthOptions {
    month: number;
    year: number;
}