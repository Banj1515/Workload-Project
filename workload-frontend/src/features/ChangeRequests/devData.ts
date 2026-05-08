import type {
    ChangeRequestItem,
    ReviewChangeRequestPayload,
} from "./types";

const DEV_CHANGE_REQUESTS_KEY = "workload_dev_change_requests";

const defaultDevChangeRequests: ChangeRequestItem[] = [
    {
        id: 1,
        taskId: 2,
        taskTitle: "Create dashboard cards",
        requestType: "Due Date Change",
        currentValue: "2026-04-18",
        requestedValue: "2026-04-20",
        requestedBy: "Omar Nassar",
        requestedAt: "2026-04-14T09:30:00",
        reason: "Need extra time for chart polish.",
        status: "Pending",
    },
    {
        id: 2,
        taskId: 3,
        taskTitle: "Task detail page",
        requestType: "Effort Increase",
        currentValue: "12",
        requestedValue: "16",
        requestedBy: "Maya Haddad",
        requestedAt: "2026-04-14T10:15:00",
        reason: "Weight breakdown and history UI are larger than expected.",
        status: "Pending",
    },
    {
        id: 3,
        taskId: 5,
        taskTitle: "Change request page",
        requestType: "Owner Change",
        currentValue: "Lina Kareem",
        requestedValue: "Sarah Ali",
        requestedBy: "Team Leader",
        requestedAt: "2026-04-14T11:00:00",
        reason: "Rebalancing workload across members.",
        status: "Pending",
    },
];

function getStoredDevChangeRequests(): ChangeRequestItem[] | null {
    const raw = localStorage.getItem(DEV_CHANGE_REQUESTS_KEY);

    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as ChangeRequestItem[];
    } catch {
        return null;
    }
}

export function getDevPendingChangeRequests(): ChangeRequestItem[] {
    const stored = getStoredDevChangeRequests();

    if (stored && stored.length > 0) {
        return stored.filter((item) => (item.status ?? "Pending") === "Pending");
    }

    localStorage.setItem(
        DEV_CHANGE_REQUESTS_KEY,
        JSON.stringify(defaultDevChangeRequests)
    );

    return defaultDevChangeRequests;
}

export function reviewDevChangeRequest(
    id: string | number,
    data: ReviewChangeRequestPayload
): boolean {
    const stored = getStoredDevChangeRequests() ?? defaultDevChangeRequests;
    const index = stored.findIndex((item) => String(item.id) === String(id));

    if (index === -1) {
        return false;
    }

    const next = [...stored];
    next[index] = {
        ...next[index],
        status: data.approved ? "Approved" : "Rejected",
        reason: data.notes?.trim() || next[index].reason,
    };

    localStorage.setItem(DEV_CHANGE_REQUESTS_KEY, JSON.stringify(next));
    return true;
}