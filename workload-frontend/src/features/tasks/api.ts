import { http } from "../../lib/http";
import type { TaskDetail, TaskFormData, TaskItem } from "./types";

export async function getTasks(): Promise<TaskItem[]> {
    const response = await http.get<TaskItem[]>("/api/tasks");
    return response.data;
}

export async function getMyTasks(): Promise<TaskItem[]> {
    const response = await http.get<TaskItem[]>("/api/tasks/my");
    return response.data;
}

export async function getTaskById(id: string | number): Promise<TaskDetail> {
    const response = await http.get<TaskDetail>(`/api/tasks/${id}`);
    return response.data;
}

export async function createTask(data: TaskFormData): Promise<TaskDetail | TaskItem> {
    const payload = {
        ...data,
        effortHours: Number(data.effortHours),
        assignedUserId: data.assignedUserId || null,
        teamId: data.teamId || null,
    };

    const response = await http.post<TaskDetail | TaskItem>("/api/tasks", payload);
    return response.data;
}

export async function updateTask(
    id: string | number,
    data: TaskFormData
): Promise<TaskDetail | TaskItem> {
    const payload = {
        ...data,
        effortHours: Number(data.effortHours),
        assignedUserId: data.assignedUserId || null,
        teamId: data.teamId || null,
    };

    const response = await http.put<TaskDetail | TaskItem>(`/api/tasks/${id}`, payload);
    return response.data;
}

export async function updateTaskStatus(
    id: string | number,
    status: "New" | "In Progress" | "Blocked" | "Done"
): Promise<void> {
    await http.put(`/api/tasks/${id}/status`, { status });
}

export async function deleteTask(id: string | number): Promise<void> {
    await http.delete(`/api/tasks/${id}`);
}

export async function acknowledgeTask(id: string | number): Promise<void> {
    await http.post(`/api/tasks/${id}/acknowledge`);
}