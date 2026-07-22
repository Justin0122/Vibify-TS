export interface UserRow {
    id: number;
    user_id: string;
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: Date;
    api_token: string;
    scopes: string | null;
    created_at: string;
    updated_at: string;
}
