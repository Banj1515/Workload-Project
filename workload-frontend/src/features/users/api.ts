import { http } from "../../lib/http";
import type { UserListItem } from "./types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null;
}

function pickString(...values: unknown[]): string | undefined {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value;
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            return String(value);
        }
    }

    return undefined;
}

function extractArray(value: unknown): unknown[] {
    if (Array.isArray(value)) {
        return value;
    }

    if (!isRecord(value)) {
        return [];
    }

    const candidates = [
        value.items,
        value.Items,
        value.data,
        value.Data,
        value.results,
        value.Results,
        value.users,
        value.Users,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
}

function normalizeUser(raw: unknown, index: number): UserListItem {
    if (!isRecord(raw)) {
        return {
            id: String(index + 1),
            email: "",
            displayName: `User ${index + 1}`,
            roles: [],
        };
    }

    return {
        id: pickString(raw.id, raw.Id, raw.userId, raw.UserId, index + 1) ?? String(index + 1),
        email: pickString(raw.email, raw.Email) ?? "",
        displayName:
            pickString(raw.displayName, raw.DisplayName, raw.name, raw.Name, raw.email, raw.Email) ??
            `User ${index + 1}`,
        roles: Array.isArray(raw.roles)
            ? raw.roles.filter((item): item is string => typeof item === "string")
            : Array.isArray(raw.Roles)
                ? raw.Roles.filter((item): item is string => typeof item === "string")
                : [],
    };
}

export async function getUsers(): Promise<UserListItem[]> {
    const response = await http.get("/api/users");
    return extractArray(response.data).map(normalizeUser);
}