import { http } from "../../lib/http";
import type { MemberWorkloadDetail, MemberWorkloadTask } from "./types";

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

function pickNumber(...values: unknown[]): number | undefined {
    for (const value of values) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === "string" && value.trim()) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }

    return undefined;
}

function toArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function normalizeWorkloadStatus(rawStatus: unknown, totalWeight: number) {
    const value = pickString(rawStatus)?.toLowerCase();

    if (value === "available") return "Available";
    if (value === "moderate") return "Moderate";
    if (value === "overloaded") return "Overloaded";

    if (totalWeight <= 15) return "Available";
    if (totalWeight <= 25) return "Moderate";
    return "Overloaded";
}

function normalizeTask(raw: unknown, index: number): MemberWorkloadTask {
    if (!isRecord(raw)) {
        return {
            id: String(index + 1),
            title: "Untitled Task",
            status: "New",
        };
    }

    return {
        id:
            pickString(raw.id, raw.Id, raw.taskId, raw.TaskId, index + 1) ??
            String(index + 1),
        title:
            pickString(
                raw.title,
                raw.Title,
                raw.taskTitle,
                raw.TaskTitle,
                raw.name,
                raw.Name
            ) ?? "Untitled Task",
        status:
            pickString(raw.status, raw.Status, raw.taskStatus, raw.TaskStatus) ?? "New",
        priority: pickString(raw.priority, raw.Priority) ?? null,
        dueDate: pickString(raw.dueDate, raw.DueDate) ?? null,
        effortHours:
            pickNumber(
                raw.effortHours,
                raw.EffortHours,
                raw.totalEffort,
                raw.TotalEffort
            ) ?? null,
        weight:
            pickNumber(
                raw.weight,
                raw.Weight,
                raw.totalWeight,
                raw.TotalWeight
            ) ?? null,
    };
}

function normalizeMember(raw: unknown, index: number): MemberWorkloadDetail {
    if (!isRecord(raw)) {
        return {
            id: String(index + 1),
            displayName: "Unknown Member",
            email: null,
            teamName: null,
            workloadStatus: "Available",
            taskCount: 0,
            totalEffort: 0,
            totalWeight: 0,
            tasks: [],
        };
    }

    const nestedUser = isRecord(raw.user)
        ? raw.user
        : isRecord(raw.User)
            ? raw.User
            : undefined;

    const rawTasks =
        raw.tasks ??
        raw.Tasks ??
        raw.assignedTasks ??
        raw.AssignedTasks ??
        raw.taskDetails ??
        raw.TaskDetails;

    const tasks = toArray(rawTasks).map(normalizeTask);

    const totalEffort =
        pickNumber(
            raw.totalEffort,
            raw.TotalEffort,
            raw.totalEffortHours,
            raw.TotalEffortHours,
            raw.effortHours,
            raw.EffortHours
        ) ?? 0;

    const totalWeight =
        pickNumber(
            raw.totalWeight,
            raw.TotalWeight,
            raw.workloadWeight,
            raw.WorkloadWeight,
            raw.weight,
            raw.Weight
        ) ?? 0;

    const taskCount =
        pickNumber(raw.taskCount, raw.TaskCount, raw.totalTasks, raw.TotalTasks, tasks.length) ??
        tasks.length;

    return {
        id:
            pickString(
                raw.id,
                raw.Id,
                raw.userId,
                raw.UserId,
                raw.memberId,
                raw.MemberId,
                nestedUser?.id,
                nestedUser?.Id
            ) ?? String(index + 1),
        displayName:
            pickString(
                raw.displayName,
                raw.DisplayName,
                raw.memberName,
                raw.MemberName,
                raw.name,
                raw.Name,
                nestedUser?.displayName,
                nestedUser?.DisplayName,
                nestedUser?.name,
                nestedUser?.Name
            ) ?? "Unknown Member",
        email:
            pickString(
                raw.email,
                raw.Email,
                nestedUser?.email,
                nestedUser?.Email
            ) ?? null,
        teamName:
            pickString(
                raw.teamName,
                raw.TeamName,
                raw.team,
                raw.Team,
                raw.groupName,
                raw.GroupName
            ) ?? null,
        workloadStatus: normalizeWorkloadStatus(
            raw.workloadStatus ??
            raw.WorkloadStatus ??
            raw.status ??
            raw.Status ??
            raw.workloadLevel ??
            raw.WorkloadLevel,
            totalWeight
        ),
        taskCount,
        totalEffort,
        totalWeight,
        tasks,
    };
}

function extractMembersArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) {
        return raw;
    }

    if (!isRecord(raw)) {
        return [];
    }

    const candidates = [
        raw.items,
        raw.Items,
        raw.data,
        raw.Data,
        raw.members,
        raw.Members,
        raw.workloadDetails,
        raw.WorkloadDetails,
        raw.memberWorkloads,
        raw.MemberWorkloads,
        raw.results,
        raw.Results,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
}

export async function getDashboardWorkloadDetails(params?: {
    range?: string;
    startDate?: string | null;
    endDate?: string | null;
}): Promise<MemberWorkloadDetail[]> {
    const response = await http.get("/api/dashboard/workload-details", {
        params,
    });

    const rawItems = extractMembersArray(response.data);
    return rawItems.map(normalizeMember);
}