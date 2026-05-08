export type AuthUser = {
    id: string;
    email: string;
    displayName: string;
    roles: string[];
};

export type LoginRequest = {
    email: string;
    password: string;
};

export type LoginResponse = {
    message?: string;
    token: string;
    user: AuthUser;
};