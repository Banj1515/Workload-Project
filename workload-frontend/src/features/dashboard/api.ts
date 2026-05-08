import { http } from "../../lib/http";
import type {
    CountItem,
    DashboardCharts,
    DashboardSummary,
    DashboardSummaryBreakdown,
} from "./types";
import type { MemberWorkloadDetail } from "../members/types";

export type DashboardRange = "this" | "next" | "all";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }

    return 0;
}

function normalizeCounts(value: unknown): CountItem[] {
    if (Array.isArray(value)) {
        return value
            .map((item): CountItem | null => {
                if (!isRecord(item)) return null;

                const label = String(
                    item.label ??
                    item.Label ??
                    item.name ??
                    item.Name ??
                    item.status ??
                    item.Status ??
                    item.priority ??
                    item.Priority ??
                    item.workloadStatus ??
                    item.WorkloadStatus ??
                    item.key ??
                    item.Key ??
                    ""
                ).trim();

                const count = toNumber(
                    item.count ??
                    item.Count ??
                    item.total ??
                    item.Total ??
                    item.value ??
                    item.Value ??
                    item.taskCount ??
                    item.TaskCount
                );

                return label ? { label, count } : null;
            })
            .filter((item): item is CountItem => item !== null);
    }

    if (isRecord(value)) {
        return Object.entries(value).map(([label, count]) => ({
            label,
            count: toNumber(count),
        }));
    }

    return [];
}

export async function getDashboardSummary(
    range: DashboardRange
): Promise<DashboardSummary> {
    const response = await http.get<DashboardSummary>("/api/dashboard/summary", {
        params: { range },
    });

    return response.data;
}

export async function getDashboardCharts(
    range: DashboardRange
): Promise<DashboardCharts> {
    const response = await http.get("/api/dashboard/charts", {
        params: { range },
    });

    const raw = response.data;

    if (!isRecord(raw)) {
        return {
            statusCounts: [],
            priorityCounts: [],
            workloadCounts: [],
            unassignedTasks: 0,
        };
    }

    return {
        statusCounts: normalizeCounts(raw.statusCounts ?? raw.StatusCounts),
        priorityCounts: normalizeCounts(raw.priorityCounts ?? raw.PriorityCounts),
        workloadCounts: normalizeCounts(raw.workloadCounts ?? raw.WorkloadCounts),
        unassignedTasks: toNumber(raw.unassignedTasks ?? raw.UnassignedTasks),
    };
}

export async function getDashboardWorkloadDetails(
    range: DashboardRange
): Promise<MemberWorkloadDetail[]> {
    const response = await http.get<MemberWorkloadDetail[]>(
        "/api/dashboard/workload-details",
        {
            params: { range },
        }
    );

    return response.data;
}
export async function getDashboardSummaryBreakdown(
    range: DashboardRange
): Promise<DashboardSummaryBreakdown> {
    const response = await http.get<DashboardSummaryBreakdown>(
        "/api/dashboard/summary-breakdown",
        {
            params: { range },
        }
    );

    return response.data;
}
