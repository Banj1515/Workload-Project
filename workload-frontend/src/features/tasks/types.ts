export type UserRef = {
    id: string;
    displayName?: string | null;
    email?: string | null;
};

export type TaskItem = {
    id: string | number;
    title: string;
    description?: string | null;
    assignedUserId?: string | null;
    assignedMember?: string | UserRef | null;
    acknowledgedBy?: string | UserRef | null;
    priority: "Low" | "Medium" | "High" | "Critical" | string;
    complexity: "Simple" | "Medium" | "Complex" | string;
    effortHours: number;
    startDate?: string | null;
    dueDate?: string | null;
    status: "New" | "In Progress" | "Blocked" | "Done" | string;
    teamId?: string | number | null;
    clickUpTaskId?: string | null;
    clickUpListId?: string | null;
    lastSyncedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    acknowledgedByUserId?: string | null;
    acknowledgedAt?: string | null;
    weight?: number | null;
};

export type WeightBreakdown = {
    effortHours?: number | null;
    complexity?: string | null;
    complexityMultiplier?: number | null;
    priority?: string | null;
    priorityMultiplier?: number | null;
    formula?: string | null;
    weight?: number | null;
};

export type StatusHistoryItem = {
    id?: string | number;
    oldStatus?: string | null;
    newStatus?: string | null;
    changedBy?: string | UserRef | null;
    changedAt?: string | null;
    notes?: string | null;
};

export type ChangeHistoryItem = {
    id?: string | number;
    changeType?: string | null;
    previousValue?: string | null;
    newValue?: string | null;
    requestedBy?: string | UserRef | null;
    reviewedBy?: string | UserRef | null;
    reviewedAt?: string | null;
    status?: string | null;
    notes?: string | null;
    changedAt?: string | null;
};

export type TaskDetail = TaskItem & {
    weightBreakdown?: WeightBreakdown | null;
    statusHistory?: StatusHistoryItem[];
    changeHistory?: ChangeHistoryItem[];
};

export type TaskFormData = {
    title: string;
    description: string;
    assignedUserId: string;
    priority: string;
    complexity: string;
    effortHours: number;
    startDate: string;
    dueDate: string;
    status: string;
    teamId: string;
};