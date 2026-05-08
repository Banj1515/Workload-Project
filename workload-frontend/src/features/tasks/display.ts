import type { UserRef } from "./types";

export function getUserDisplayName(
    value?: string | UserRef | null,
    fallback?: string | null
): string {
    if (typeof value === "string" && value.trim()) {
        return value;
    }

    if (value && typeof value === "object") {
        if (typeof value.displayName === "string" && value.displayName.trim()) {
            return value.displayName;
        }

        if (typeof value.email === "string" && value.email.trim()) {
            return value.email;
        }

        if (typeof value.id === "string" && value.id.trim()) {
            return value.id;
        }
    }

    if (typeof fallback === "string" && fallback.trim()) {
        return fallback;
    }

    return "Unassigned";
}