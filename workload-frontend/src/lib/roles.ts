import type { AuthUser } from "../features/auth/types";

function getRoles(user: AuthUser | null): string[] {
    return user?.roles ?? [];
}

export function isAdmin(user: AuthUser | null): boolean {
    return getRoles(user).includes("Admin");
}

export function isTeamLeader(user: AuthUser | null): boolean {
    return getRoles(user).includes("Team Leader");
}

export function isMember(user: AuthUser | null): boolean {
    return getRoles(user).includes("Member");
}

export function canManageTasks(user: AuthUser | null): boolean {
    return isAdmin(user) || isTeamLeader(user);
}

export function canManageTeams(user: AuthUser | null): boolean {
    return isAdmin(user) || isTeamLeader(user);
}

export function canManageUsers(user: AuthUser | null): boolean {
    return isAdmin(user) || isTeamLeader(user);
}

export function canReviewChangeRequests(user: AuthUser | null): boolean {
    return isAdmin(user) || isTeamLeader(user);
}