export type MemberWorkloadTask = {
    id: string;
    title: string;
    status: string;
    priority?: string | null;
    dueDate?: string | null;
    effortHours?: number | null;
    weight?: number | null;
};

export type MemberWorkloadDetail = {
    id: string;
    displayName: string;
    email: string | null;
    teamName: string | null;
    workloadStatus: "Available" | "Moderate" | "Overloaded";
    taskCount: number;
    totalEffort: number;
    totalWeight: number;
    tasks: MemberWorkloadTask[];
};