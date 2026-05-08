import { http } from "../../lib/http";
import type { UserRef } from "../tasks/types";
import type {
    ChangeRequestItem,
    CreateChangeRequestPayload,
    ReviewChangeRequestPayload,
} from "./types";

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

function pickValueAsString(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
        return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }

    if (typeof value === "boolean") {
        return String(value);
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (isRecord(value)) {
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

    return null;
}

function normalizeUser(value: unknown): string | UserRef | null {
    if (typeof value === "string" && value.trim()) {
        return value;
    }

    if (!isRecord(value)) {
        return null;
    }

    const id = pickString(value.id, value.Id);
    const displayName = pickString(value.displayName, value.DisplayName, value.name, value.Name);
    const email = pickString(value.email, value.Email);

    if (!id && !displayName && !email) {
        return null;
    }

    return {
        id: id ?? "",
        displayName: displayName ?? null,
        email: email ?? null,
    };
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
        value.requests,
        value.Requests,
        value.pending,
        value.Pending,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
}

function normalizeItem(raw: unknown, index: number): ChangeRequestItem {
    if (!isRecord(raw)) {
        return {
            id: String(index + 1),
            taskId: "-",
            taskTitle: "Unknown Task",
            requestType: "Unknown",
            currentValue: null,
            requestedValue: null,
            requestedBy: null,
            reviewedBy: null,
            requestedAt: null,
            reason: null,
            status: "Pending",
        };
    }

    const taskRecord = isRecord(raw.task) ? raw.task : isRecord(raw.Task) ? raw.Task : null;
    const resolvedTaskId =
        pickString(raw.taskId, raw.TaskId, taskRecord?.id, taskRecord?.Id) ?? "-";

    return {
        id: pickString(raw.id, raw.Id, index + 1) ?? String(index + 1),
        taskId: resolvedTaskId,
        taskTitle:
            pickString(
                raw.taskTitle,
                raw.TaskTitle,
                taskRecord?.title,
                taskRecord?.Title,
                raw.title,
                raw.Title
            ) ?? `Task ${resolvedTaskId}`,
        requestType:
            pickString(raw.requestType, raw.RequestType, raw.changeType, raw.ChangeType) ?? "Unknown",
        currentValue:
            pickValueAsString(
                raw.currentValue ?? raw.CurrentValue ?? raw.previousValue ?? raw.PreviousValue
            ) ?? null,
        requestedValue:
            pickValueAsString(
                raw.requestedValue ?? raw.RequestedValue ?? raw.newValue ?? raw.NewValue
            ) ?? null,
        requestedBy: normalizeUser(raw.requestedBy ?? raw.RequestedBy),
        reviewedBy: normalizeUser(raw.reviewedBy ?? raw.ReviewedBy),
        requestedAt: pickString(raw.requestedAt, raw.RequestedAt, raw.createdAt, raw.CreatedAt) ?? null,
        reason: pickString(raw.reason, raw.Reason, raw.notes, raw.Notes) ?? null,
        status: pickString(raw.status, raw.Status) ?? "Pending",
    };
}

function toRequestTypeCode(requestType: CreateChangeRequestPayload["requestType"]) {
    switch (requestType) {
        case "Owner Change":
            return "OwnerChange";
        case "Due Date Change":
            return "DueDateChange";
        case "Effort Increase":
            return "EffortIncrease";
        default:
            return requestType;
    }
}

export async function createChangeRequest(
    data: CreateChangeRequestPayload
): Promise<void> {
    const changeType = toRequestTypeCode(data.requestType);

    await http.post("/api/changerequests", {
        taskId: String(data.taskId),
        changeType,
        requestedValue: data.requestedValue,
        reason: data.reason,
        notes: data.reason,
    });
}

export async function getPendingChangeRequests(): Promise<ChangeRequestItem[]> {
    const response = await http.get("/api/changerequests/pending");
    return extractArray(response.data).map(normalizeItem);
}

export async function reviewChangeRequest(
    id: string | number,
    data: ReviewChangeRequestPayload
): Promise<void> {
    await http.post(`/api/changerequests/${id}/review`, data);
}