import {
    useEffect,
    useMemo,
    useState,
    type CSSProperties,
    type FormEvent,
    type InputHTMLAttributes,
    type ReactNode,
    type SelectHTMLAttributes,
    type TextareaHTMLAttributes,
} from "react";
import axios from "axios";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { getUser } from "../../../lib/auth";
import { canManageTasks } from "../../../lib/roles";
import { getUsers } from "../../users/api";
import { getTeams } from "../../teams/api";
import type { UserListItem } from "../../users/types";
import type { TeamItem } from "../../teams/types";
import { createTask, getTaskById, updateTask } from "../api";
import type { TaskFormData } from "../types";

const defaultForm: TaskFormData = {
    title: "",
    description: "",
    assignedUserId: "",
    priority: "Medium",
    complexity: "Medium",
    effortHours: 1,
    startDate: "",
    dueDate: "",
    status: "New",
    teamId: "",
};

function toDateInput(value?: string | null) {
    if (!value) return "";
    return value.slice(0, 10);
}

function getDueDateState(dueDate?: string, status?: string) {
    if (!dueDate) return "normal";
    if (status?.toLowerCase() === "done") return "done";

    const due = new Date(dueDate);

    if (Number.isNaN(due.getTime())) {
        return "normal";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);

    if (diffDays < 0) return "overdue";
    if (diffDays <= 3) return "soon";
    return "normal";
}

function getPriorityStyle(priority: string): CSSProperties {
    switch (priority.toLowerCase()) {
        case "low":
            return { background: "#ecfdf5", borderColor: "#86efac", color: "#166534", fontWeight: 700 };
        case "medium":
            return { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8", fontWeight: 700 };
        case "high":
            return { background: "#ffedd5", borderColor: "#fdba74", color: "#c2410c", fontWeight: 700 };
        case "critical":
            return { background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c", fontWeight: 700 };
        default:
            return {};
    }
}

function getComplexityStyle(complexity: string): CSSProperties {
    switch (complexity.toLowerCase()) {
        case "simple":
            return { background: "#ecfdf5", borderColor: "#86efac", color: "#166534", fontWeight: 700 };
        case "medium":
            return { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8", fontWeight: 700 };
        case "complex":
            return { background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c", fontWeight: 700 };
        default:
            return {};
    }
}

function getStatusStyle(status: string): CSSProperties {
    switch (status.toLowerCase()) {
        case "new":
            return { background: "#fef3c7", borderColor: "#fcd34d", color: "#92400e", fontWeight: 700 };
        case "in progress":
            return { background: "#dbeafe", borderColor: "#93c5fd", color: "#1d4ed8", fontWeight: 700 };
        case "blocked":
            return { background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c", fontWeight: 700 };
        case "done":
            return { background: "#dcfce7", borderColor: "#86efac", color: "#166534", fontWeight: 700 };
        default:
            return {};
    }
}

function getDueDateInputStyle(dueDate?: string, status?: string): CSSProperties {
    const state = getDueDateState(dueDate, status);

    switch (state) {
        case "overdue":
            return { color: "#b91c1c", fontWeight: 700 };
        case "soon":
            return { color: "#c2410c", fontWeight: 700 };
        default:
            return {};
    }
}

function FieldLabel(props: { htmlFor: string; children: ReactNode }) {
    return (
        <label className="task-form-label" htmlFor={props.htmlFor}>
            {props.children}
        </label>
    );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
    const { style, ...rest } = props;
    return <input {...rest} className="input" style={style} />;
}

function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const { style, ...rest } = props;
    return <textarea {...rest} className="textarea" style={style} />;
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
    const { style, children, ...rest } = props;
    return (
        <select {...rest} className="select" style={style}>
            {children}
        </select>
    );
}

export default function TaskFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const user = getUser();

    const isEditMode = Boolean(id);
    const canEditPage = canManageTasks(user);

    const [form, setForm] = useState<TaskFormData>(defaultForm);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [teams, setTeams] = useState<TeamItem[]>([]);

    const pageTitle = useMemo(() => {
        return isEditMode ? "Edit Task" : "Create Task";
    }, [isEditMode]);

    useEffect(() => {
        async function loadPage() {
            setIsLoading(true);
            setError("");

            try {
                const [usersData, teamsData] = await Promise.all([getUsers(), getTeams()]);

                setUsers(Array.isArray(usersData) ? usersData : []);
                setTeams(Array.isArray(teamsData) ? teamsData : []);

                if (isEditMode && id) {
                    const task = await getTaskById(id);

                    setForm({
                        title: task.title ?? "",
                        description: task.description ?? "",
                        assignedUserId: task.assignedUserId ?? "",
                        priority: task.priority ?? "Medium",
                        complexity: task.complexity ?? "Medium",
                        effortHours: Number(task.effortHours ?? 1),
                        startDate: toDateInput(task.startDate),
                        dueDate: toDateInput(task.dueDate),
                        status: task.status ?? "New",
                        teamId: task.teamId ? String(task.teamId) : "",
                    });
                }
            } catch (err: unknown) {
                let message = "Could not load task form data.";

                if (axios.isAxiosError(err)) {
                    if (err.response?.status === 401) {
                        message = "Unauthorized. Login with a real backend user to access the task form.";
                    } else if (err.response?.status === 403) {
                        message = "Forbidden. Your role cannot access the task form.";
                    } else if (err.response?.status === 404) {
                        message = "Task not found.";
                    } else {
                        const data = err.response?.data;

                        if (typeof data === "string") {
                            message = data;
                        } else if (
                            data &&
                            typeof data === "object" &&
                            "message" in data &&
                            typeof data.message === "string"
                        ) {
                            message = data.message;
                        }
                    }
                }

                setError(message);
            } finally {
                setIsLoading(false);
            }
        }

        loadPage();
    }, [id, isEditMode]);

    function updateField<K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        if (!form.title.trim()) {
            setError("Title is required.");
            return;
        }

        if (!form.startDate || !form.dueDate) {
            setError("Start date and due date are required.");
            return;
        }

        if (form.dueDate < form.startDate) {
            setError("Due date cannot be before start date.");
            return;
        }

        setIsSaving(true);

        try {
            if (isEditMode && id) {
                await updateTask(id, form);
            } else {
                await createTask(form);
            }

            navigate("/tasks");
        } catch (err: unknown) {
            let message = isEditMode ? "Could not update task." : "Could not create task.";

            if (axios.isAxiosError(err)) {
                if (err.response?.status === 401) {
                    message = "Unauthorized. Login with a real backend user to save tasks.";
                } else if (err.response?.status === 403) {
                    message = "Forbidden. Your role cannot save tasks.";
                } else if (err.response?.status === 400) {
                    const data = err.response?.data;

                    if (typeof data === "string") {
                        message = data;
                    } else if (
                        data &&
                        typeof data === "object" &&
                        "message" in data &&
                        typeof data.message === "string"
                    ) {
                        message = data.message;
                    } else {
                        message = "The backend rejected the task data.";
                    }
                } else {
                    const data = err.response?.data;

                    if (typeof data === "string") {
                        message = data;
                    } else if (
                        data &&
                        typeof data === "object" &&
                        "message" in data &&
                        typeof data.message === "string"
                    ) {
                        message = data.message;
                    }
                }
            }

            setError(message);
        } finally {
            setIsSaving(false);
        }
    }

    if (!canEditPage) {
        return <Navigate to="/tasks" replace />;
    }

    if (isLoading) {
        return (
            <div className="card task-form-loading">
                <div className="card-body">Loading task form...</div>
            </div>
        );
    }

    return (
        <div className="card task-form-card">
            <div className="card-body">
                <Link to={isEditMode && id ? `/tasks/${id}` : "/tasks"} className="task-form-back-link">
                    ← Back
                </Link>

                <h2 className="task-form-title">{pageTitle}</h2>
                <p className="task-form-subtitle">
                    {isEditMode ? "Update task information." : "Create a new task."}
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="task-form-grid">
                        <div className="form-field">
                            <FieldLabel htmlFor="title">Title</FieldLabel>
                            <TextInput
                                id="title"
                                value={form.title}
                                onChange={(event) => updateField("title", event.target.value)}
                                placeholder="Enter task title"
                            />
                        </div>

                        <div className="form-field">
                            <FieldLabel htmlFor="assignedUserId">Assigned User</FieldLabel>
                            <Select
                                id="assignedUserId"
                                value={form.assignedUserId}
                                onChange={(event) => updateField("assignedUserId", event.target.value)}
                            >
                                <option value="">Unassigned</option>
                                {users.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.displayName}
                                    </option>
                                ))}
                            </Select>
                        </div>


                        <div className="form-field">
                            <FieldLabel htmlFor="priority">Priority</FieldLabel>
                            <Select
                                id="priority"
                                value={form.priority}
                                onChange={(event) => updateField("priority", event.target.value)}
                                style={getPriorityStyle(form.priority)}
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Critical">Critical</option>
                            </Select>
                        </div>

                        <div className="form-field">
                            <FieldLabel htmlFor="complexity">Complexity</FieldLabel>
                            <Select
                                id="complexity"
                                value={form.complexity}
                                onChange={(event) => updateField("complexity", event.target.value)}
                                style={getComplexityStyle(form.complexity)}
                            >
                                <option value="Simple">Simple</option>
                                <option value="Medium">Medium</option>
                                <option value="Complex">Complex</option>
                            </Select>
                        </div>

                        <div className="form-field">
                            <FieldLabel htmlFor="effortHours">Effort Hours</FieldLabel>
                            <TextInput
                                id="effortHours"
                                type="number"
                                min="1"
                                step="1"
                                value={form.effortHours}
                                onChange={(event) => updateField("effortHours", Number(event.target.value))}
                            />
                        </div>

                        <div className="form-field">
                            <FieldLabel htmlFor="status">Status</FieldLabel>
                            <Select
                                id="status"
                                value={form.status}
                                onChange={(event) => updateField("status", event.target.value)}
                                style={getStatusStyle(form.status)}
                            >
                                <option value="New">New</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Blocked">Blocked</option>
                                <option value="Done">Done</option>
                            </Select>
                        </div>

                        <div className="form-field">
                            <FieldLabel htmlFor="startDate">Start Date</FieldLabel>
                            <TextInput
                                id="startDate"
                                type="date"
                                value={form.startDate}
                                onChange={(event) => updateField("startDate", event.target.value)}
                            />
                        </div>

                        <div className="form-field">
                            <FieldLabel htmlFor="dueDate">Due Date</FieldLabel>
                            <TextInput
                                id="dueDate"
                                type="date"
                                value={form.dueDate}
                                onChange={(event) => updateField("dueDate", event.target.value)}
                                style={getDueDateInputStyle(form.dueDate, form.status)}
                            />
                        </div>

                        <div className="form-field">
                            <FieldLabel htmlFor="teamId">Team</FieldLabel>
                            <Select
                                id="teamId"
                                value={form.teamId}
                                onChange={(event) => updateField("teamId", event.target.value)}
                            >
                                <option value="">No team</option>
                                {teams.map((team) => (
                                    <option key={team.id} value={String(team.id)}>
                                        {team.name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className="form-field task-form-description">
                        <FieldLabel htmlFor="description">Description</FieldLabel>
                        <TextArea
                            id="description"
                            value={form.description}
                            onChange={(event) => updateField("description", event.target.value)}
                            placeholder="Describe the task"
                        />
                    </div>

                    {error ? (
                        <div className="error-box task-form-error">
                            <div className="card-body">{error}</div>
                        </div>
                    ) : null}

                    <div className="task-form-actions">
                        <button type="submit" disabled={isSaving} className="button">
                            {isSaving ? (isEditMode ? "Saving..." : "Creating...") : isEditMode ? "Save Changes" : "Create Task"}
                        </button>

                        <Link to={isEditMode && id ? `/tasks/${id}` : "/tasks"} className="button-secondary">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}