import type { UserRef } from "../tasks/types";

export type ChangeRequestItem = {
    id: number | string;
    taskId: number | string;
    taskTitle: string;
    requestType: string;
    currentValue?: string | null;
    requestedValue?: string | null;
    requestedBy?: string | UserRef | null;
    reviewedBy?: string | UserRef | null;
    requestedAt?: string | null;
    reason?: string | null;
    status?: string;
};

export type ReviewChangeRequestPayload = {
    approved: boolean;
    notes?: string;
};

export type CreateChangeRequestPayload = {
    taskId: string | number;
    requestType: "Owner Change" | "Due Date Change" | "Effort Increase";
    currentValue?: string | null;
    requestedValue: string;
    reason: string;
};