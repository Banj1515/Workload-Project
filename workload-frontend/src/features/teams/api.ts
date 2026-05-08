import { http } from "../../lib/http";
import type { TeamFormData, TeamItem, TeamMember } from "./types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null;
}

function pickString(...values: unknown[]): string | undefined {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value;
        if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }

    return undefined;
}

function pickNumber(...values: unknown[]): number | undefined {
    for (const value of values) {
        if (typeof value === "number" && Number.isFinite(value)) return value;

        if (typeof value === "string") {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
        }
    }

    return undefined;
}

function extractArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (!isRecord(value)) return [];

    const candidates = [
        value.items,
        value.Items,
        value.data,
        value.Data,
        value.results,
        value.Results,
        value.teams,
        value.Teams,
        value.members,
        value.Members,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
    }

    return [];
}

function normalizeTeam(raw: unknown, index: number): TeamItem {
    if (!isRecord(raw)) {
        return {
            id: String(index + 1),
            name: `Team ${index + 1}`,
            description: null,
            memberCount: 0,
        };
    }

    return {
        id: pickString(raw.id, raw.Id, raw.teamId, raw.TeamId, index + 1) ?? String(index + 1),
        name: pickString(raw.name, raw.Name, raw.teamName, raw.TeamName) ?? `Team ${index + 1}`,
        description: pickString(raw.description, raw.Description) ?? null,
        memberCount:
            pickNumber(raw.memberCount, raw.MemberCount, raw.membersCount, raw.MembersCount) ?? 0,
    };
}

function normalizeTeamMember(raw: unknown, index: number): TeamMember {
    if (!isRecord(raw)) {
        return {
            userId: String(index + 1),
            displayName: `Member ${index + 1}`,
            email: "",
        };
    }

    return {
        userId:
            pickString(raw.userId, raw.UserId, raw.id, raw.Id, raw.memberId, raw.MemberId, index + 1) ??
            String(index + 1),
        displayName:
            pickString(raw.displayName, raw.DisplayName, raw.name, raw.Name, raw.email, raw.Email) ??
            `Member ${index + 1}`,
        email: pickString(raw.email, raw.Email) ?? "",
    };
}

export async function getTeams(): Promise<TeamItem[]> {
    const response = await http.get("/api/teams");
    return extractArray(response.data).map(normalizeTeam);
}

export async function getTeamById(id: string): Promise<TeamItem> {
    const response = await http.get(`/api/teams/${id}`);
    return normalizeTeam(response.data, 0);
}

export async function createTeam(data: TeamFormData): Promise<TeamItem | null> {
    const response = await http.post("/api/teams", {
        name: data.name,
        description: data.description,
    });

    if (!response.data) return null;

    return normalizeTeam(response.data, 0);
}

export async function updateTeam(id: string, data: TeamFormData): Promise<void> {
    await http.put(`/api/teams/${id}`, data);
}

export async function deleteTeam(id: string): Promise<void> {
    await http.delete(`/api/teams/${id}`);
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const response = await http.get(`/api/teams/${teamId}/members`);
    return extractArray(response.data).map(normalizeTeamMember);
}

export async function addMemberToTeam(teamId: string, userId: string): Promise<void> {
    await http.post(`/api/teams/${teamId}/members`, { userId });
}

export async function removeMemberFromTeam(teamId: string, userId: string): Promise<void> {
    await http.delete(`/api/teams/${teamId}/members/${userId}`);
}