import type { TaskDetail, TaskFormData, TaskItem } from "./types";

const DEV_TASKS_KEY = "workload_dev_tasks";

const defaultDevTasks: TaskItem[] = [
    {
        id: 1,
        title: "Build login page",
        description: "Create login UI and connect JWT flow.",
        priority: "High",
        complexity: "Medium",
        effortHours: 6,
        startDate: "2026-04-13",
        dueDate: "2026-04-15",
        status: "Done",
        assignedUserId: "m1",
        assignedMember: "Sarah Ali",
        teamId: 101,
        clickUpTaskId: "CU-TASK-001",
        lastSyncedAt: "2026-04-13T11:30:00",
        weight: 13.5,
    },
    {
        id: 2,
        title: "Create dashboard cards",
        description: "Show summary cards and workload overview.",
        priority: "High",
        complexity: "Medium",
        effortHours: 8,
        startDate: "2026-04-13",
        dueDate: "2026-04-18",
        status: "In Progress",
        assignedUserId: "m2",
        assignedMember: "Omar Nassar",
        teamId: 101,
        clickUpTaskId: "CU-TASK-002",
        lastSyncedAt: "2026-04-13T12:00:00",
        weight: 18,
    },
    {
        id: 3,
        title: "Task detail page",
        description: "Display history, weight breakdown, and acknowledgement.",
        priority: "Critical",
        complexity: "Complex",
        effortHours: 12,
        startDate: "2026-04-14",
        dueDate: "2026-04-20",
        status: "New",
        assignedUserId: "m3",
        assignedMember: "Maya Haddad",
        teamId: 102,
        clickUpTaskId: "CU-TASK-003",
        lastSyncedAt: "2026-04-13T12:30:00",
        weight: 48,
    },
    {
        id: 4,
        title: "Members workload page",
        description: "List members with workload status and task totals.",
        priority: "Medium",
        complexity: "Medium",
        effortHours: 7,
        startDate: "2026-04-15",
        dueDate: "2026-04-19",
        status: "Blocked",
        assignedUserId: "m2",
        assignedMember: "Omar Nassar",
        teamId: 102,
        clickUpTaskId: "CU-TASK-004",
        lastSyncedAt: "2026-04-13T13:00:00",
        weight: 12.6,
    },
    {
        id: 5,
        title: "Change request page",
        description: "Approve or reject pending requests.",
        priority: "High",
        complexity: "Complex",
        effortHours: 10,
        startDate: "2026-04-16",
        dueDate: "2026-04-22",
        status: "In Progress",
        assignedUserId: "m4",
        assignedMember: "Lina Kareem",
        teamId: 103,
        clickUpTaskId: "CU-TASK-005",
        lastSyncedAt: "2026-04-13T13:30:00",
        weight: 30,
    },
    {
        id: 6,
        title: "Sync unassigned tasks",
        description: "Handle tasks without assigned member.",
        priority: "Low",
        complexity: "Simple",
        effortHours: 3,
        startDate: "2026-04-16",
        dueDate: "2026-04-17",
        status: "New",
        assignedUserId: null,
        assignedMember: null,
        teamId: 103,
        clickUpTaskId: "CU-TASK-006",
        lastSyncedAt: "2026-04-13T14:00:00",
        weight: 3,
    },
];

function getStoredDevTasks(): TaskItem[] | null {
    const raw = localStorage.getItem(DEV_TASKS_KEY);

    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as TaskItem[];
    } catch {
        return null;
    }
}

export function getDevTasks(): TaskItem[] {
    const stored = getStoredDevTasks();

    if (stored && stored.length > 0) {
        return stored;
    }

    localStorage.setItem(DEV_TASKS_KEY, JSON.stringify(defaultDevTasks));
    return defaultDevTasks;
}

export function saveDevTasks(tasks: TaskItem[]) {
    localStorage.setItem(DEV_TASKS_KEY, JSON.stringify(tasks));
}

export function resetDevTasks() {
    localStorage.setItem(DEV_TASKS_KEY, JSON.stringify(defaultDevTasks));
}

function getComplexityMultiplier(complexity: string) {
    switch (complexity.toLowerCase()) {
        case "simple":
            return 1;
        case "medium":
            return 1.5;
        case "complex":
            return 2;
        default:
            return 1;
    }
}

function getPriorityMultiplier(priority: string) {
    switch (priority.toLowerCase()) {
        case "low":
            return 1;
        case "medium":
            return 1.2;
        case "high":
            return 1.5;
        case "critical":
            return 2;
        default:
            return 1;
    }
}

function calculateWeight(task: Pick<TaskItem, "effortHours" | "complexity" | "priority">) {
    return (
        Number(task.effortHours) *
        getComplexityMultiplier(task.complexity) *
        getPriorityMultiplier(task.priority)
    );
}

export function getDevTaskDetail(id: string | number): TaskDetail | undefined {
    const task = getDevTasks().find((item) => String(item.id) === String(id));

    if (!task) {
        return undefined;
    }

    const complexityMultiplier = getComplexityMultiplier(task.complexity);
    const priorityMultiplier = getPriorityMultiplier(task.priority);
    const weight = task.weight ?? calculateWeight(task);

    return {
        ...task,
        weight,
        clickUpListId: "CU-LIST-12",
        createdAt: "2026-04-12T09:00:00",
        updatedAt: new Date().toISOString(),
        acknowledgedByUserId: task.assignedUserId ?? null,
        acknowledgedAt: task.status === "Done" ? "2026-04-14T10:15:00" : null,
        weightBreakdown: {
            effortHours: task.effortHours,
            complexity: task.complexity,
            complexityMultiplier,
            priority: task.priority,
            priorityMultiplier,
            formula: `${task.effortHours} × ${complexityMultiplier} × ${priorityMultiplier}`,
            weight,
        },
        statusHistory: [
            {
                id: 1,
                oldStatus: null,
                newStatus: "New",
                changedAt: "2026-04-12T09:00:00",
                changedBy: "Team Leader",
                notes: "Task created.",
            },
            {
                id: 2,
                oldStatus: "New",
                newStatus: task.status === "Done" ? "In Progress" : task.status,
                changedAt: "2026-04-13T11:00:00",
                changedBy: task.assignedMember ?? "System",
                notes: "Work started.",
            },
            ...(task.status === "Done"
                ? [
                    {
                        id: 3,
                        oldStatus: "In Progress",
                        newStatus: "Done",
                        changedAt: "2026-04-14T10:00:00",
                        changedBy: task.assignedMember ?? "Member",
                        notes: "Task completed.",
                    },
                ]
                : []),
        ],
        changeHistory: [
            {
                id: 1,
                changeType: "Due Date Change",
                previousValue: task.startDate ?? null,
                newValue: task.dueDate ?? null,
                requestedBy: task.assignedMember ?? "Member",
                reviewedBy: "Team Leader",
                reviewedAt: "2026-04-13T15:00:00",
                status: "Approved",
                notes: "Timeline adjusted.",
                changedAt: "2026-04-13T14:50:00",
            },
        ],
    };
}

export function createDevTask(data: TaskFormData): TaskItem {
    const tasks = getDevTasks();
    const maxId = tasks.reduce((max, task) => Math.max(max, Number(task.id) || 0), 0);
    const newId = maxId + 1;

    const newTask: TaskItem = {
        id: newId,
        title: data.title.trim(),
        description: data.description.trim(),
        priority: data.priority,
        complexity: data.complexity,
        effortHours: Number(data.effortHours),
        startDate: data.startDate,
        dueDate: data.dueDate,
        status: data.status,
        assignedUserId: data.assignedUserId || null,
        assignedMember: data.assignedUserId || null,
        teamId: data.teamId || null,
        clickUpTaskId: null,
        lastSyncedAt: null,
        weight: calculateWeight({
            effortHours: Number(data.effortHours),
            complexity: data.complexity,
            priority: data.priority,
        }),
    };

    saveDevTasks([newTask, ...tasks]);
    return newTask;
}

export function updateDevTask(id: string | number, data: TaskFormData): TaskItem | null {
    const tasks = getDevTasks();
    const index = tasks.findIndex((task) => String(task.id) === String(id));

    if (index === -1) {
        return null;
    }

    const updatedTask: TaskItem = {
        ...tasks[index],
        title: data.title.trim(),
        description: data.description.trim(),
        priority: data.priority,
        complexity: data.complexity,
        effortHours: Number(data.effortHours),
        startDate: data.startDate,
        dueDate: data.dueDate,
        status: data.status,
        assignedUserId: data.assignedUserId || null,
        assignedMember: data.assignedUserId || null,
        teamId: data.teamId || null,
        weight: calculateWeight({
            effortHours: Number(data.effortHours),
            complexity: data.complexity,
            priority: data.priority,
        }),
        lastSyncedAt: new Date().toISOString(),
    };

    const nextTasks = [...tasks];
    nextTasks[index] = updatedTask;
    saveDevTasks(nextTasks);

    return updatedTask;
}
    export function deleteDevTask(id: string | number): boolean {
        const tasks = getDevTasks();
        const nextTasks = tasks.filter((task) => String(task.id) !== String(id));

        if (nextTasks.length === tasks.length) {
            return false;
        }

        saveDevTasks(nextTasks);
        return true;
    }



