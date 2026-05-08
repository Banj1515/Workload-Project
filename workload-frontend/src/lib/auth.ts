import type { AuthUser } from "../features/auth/types";

const TOKEN_KEY = "workload_token";
const USER_KEY = "workload_user";

type RawAuthUser = Partial<AuthUser> & {
    Roles?: string[];
    roles?: string[];
};

export function normalizeAuthUser(user: RawAuthUser): AuthUser {
    return {
        id: String(user.id ?? ""),
        email: String(user.email ?? ""),
        displayName: String(user.displayName ?? user.email ?? ""),
        roles: Array.isArray(user.roles)
            ? user.roles
            : Array.isArray(user.Roles)
                ? user.Roles
                : [],
    };
}

export function saveAuth(token: string, user: RawAuthUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(normalizeAuthUser(user)));
}

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);

    if (!raw) return null;

    try {
        return normalizeAuthUser(JSON.parse(raw) as RawAuthUser);
    } catch {
        return null;
    }
}

export function clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}