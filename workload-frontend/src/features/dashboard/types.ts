export type DashboardSummary = {
    startDate: string | null;
    endDate: string | null;
    range: "this" | "next" | "all";
    totalTasks: number;
    activeTasks: number;
    doneTasks: number;
    availableMembers: number;
    moderateMembers: number;
    overloadedMembers: number;
    totalEffort: number;
    totalWeight: number;
};

export type CountItem = {
    label: string;
    count: number;
};

export type DashboardCharts = {
    statusCounts: CountItem[];
    priorityCounts: CountItem[];
    workloadCounts: CountItem[];
    unassignedTasks: number;
};
export type DashboardSummaryBreakdownItem = {
    taskId?: string;
    title: string;
    effortHours: number;
    priority: string;
    priorityMultiplier: number;
    complexity: string;
    complexityMultiplier: number;
    formula: string;
    weight: number;
};

export type DashboardSummaryBreakdown = {
    range: "this" | "next" | "all";
    totalEffort: number;
    totalWeight: number;
    tasks: DashboardSummaryBreakdownItem[];
};
