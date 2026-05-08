import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import axios from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUser } from "../../../lib/auth";
import { canManageTasks, isMember } from "../../../lib/roles";
import { getUsers } from "../../users/api";
import type { UserListItem } from "../../users/types";
import { getTeams } from "../../teams/api";
import type { TeamItem } from "../../teams/types";
import { createChangeRequest } from "../../ChangeRequests/api";
import { acknowledgeTask, deleteTask, getTaskById, updateTaskStatus } from "../api";
import { getUserDisplayName } from "../display";
import type { TaskDetail, UserRef } from "../types";

type MemberStatus = "New" | "In Progress" | "Blocked" | "Done";
type ChangeRequestType = "Owner Change" | "Due Date Change" | "Effort Increase";

function formatDateTime(value?: string | null) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

function formatDateInput(value?: string | null) {
    if (!value) return "";
    return value.slice(0, 10);
}

function getDueDateState(dueDate?: string | null, status?: string) {
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

function getDueDateStyle(state: string) {
    switch (state) {
        case "overdue":
            return { color: "#b91c1c", background: "#fee2e2" };
        case "soon":
            return { color: "#c2410c", background: "#ffedd5" };
        default:
            return { color: "#111827", background: "transparent" };
    }
}

function getStatusClass(status: string) {
    switch (status.toLowerCase()) {
        case "done":
            return "status-badge status-done";
        case "in progress":
            return "status-badge status-progress";
        case "blocked":
            return "status-badge status-blocked";
        case "new":
            return "status-badge status-new";
        default:
            return "status-badge status-default";
    }
}

function getPriorityClass(priority: string) {
    switch (priority.toLowerCase()) {
        case "low":
            return "priority-badge priority-low";
        case "medium":
            return "priority-badge priority-medium";
        case "high":
            return "priority-badge priority-high";
        case "critical":
            return "priority-badge priority-critical";
        default:
            return "priority-badge priority-default";
    }
}

function getComplexityClass(complexity: string) {
    switch (complexity.toLowerCase()) {
        case "simple":
            return "complexity-badge complexity-simple";
        case "medium":
            return "complexity-badge complexity-medium";
        case "complex":
            return "complexity-badge complexity-complex";
        default:
            return "complexity-badge complexity-default";
    }
}

function normalizeChangeRequestValue(
    type: ChangeRequestType,
    value: string
): string {
    const trimmed = value.trim();

    if (type !== "Due Date Change") {
        return trimmed;
    }

    if (!trimmed) {
        return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
    }

    const parts = trimmed.split("/");

    if (parts.length === 3) {
        const [month, day, year] = parts;

        if (month && day && year) {
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
    }

    return trimmed;
}

function DetailCard(props: {
    title: string;
    value: ReactNode;
}) {
    return (
        <div className="card task-detail-card">
            <div className="card-body">
                <p className="summary-label">{props.title}</p>
                <div className="task-detail-value">{props.value ?? "-"}</div>
            </div>
        </div>
    );
}

function Section(props: { title: string; children: ReactNode }) {
    return (
        <div className="card task-detail-section">
            <div className="card-body">
                <h3 className="card-title">{props.title}</h3>
                {props.children}
            </div>
        </div>
    );
}

function getCurrentValueForRequest(
    task: TaskDetail,
    type: ChangeRequestType,
    assignedDisplayName: string
): string {
    switch (type) {
        case "Owner Change":
            return assignedDisplayName;
        case "Due Date Change":
            return formatDateInput(task.dueDate) || "";
        case "Effort Increase":
            return String(task.effortHours ?? "");
        default:
            return "";
    }
}

function getRequestedValueInputType(type: ChangeRequestType): "text" | "date" | "number" {
    switch (type) {
        case "Due Date Change":
            return "date";
        case "Effort Increase":
            return "number";
        default:
            return "text";
    }
}

function getRequestedValueLabel(type: ChangeRequestType): string {
    switch (type) {
        case "Owner Change":
            return "Requested New Owner";
        case "Due Date Change":
            return "Requested New Due Date";
        case "Effort Increase":
            return "Requested New Effort Hours";
        default:
            return "Requested Value";
    }
}

function getUserNameById(userId: string | null | undefined, users: UserListItem[]) {
    if (!userId) {
        return null;
    }

    const match = users.find((item) => item.id === userId);
    return match?.displayName ?? null;
}

function getTeamNameById(teamId: string | number | null | undefined, teams: TeamItem[]) {
    if (teamId === null || teamId === undefined || teamId === "") {
        return null;
    }

    const value = String(teamId);
    const match = teams.find((item) => String(item.id) === value);
    return match?.name ?? null;
}

export default function TaskDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const user = getUser();

    const [task, setTask] = useState<TaskDetail | null>(null);
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [teams, setTeams] = useState<TeamItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [isAcknowledging, setIsAcknowledging] = useState<boolean>(false);

    const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
    const [memberStatus, setMemberStatus] = useState<MemberStatus>("New");
    const [memberStatusError, setMemberStatusError] = useState<string>("");
    const [memberStatusSuccess, setMemberStatusSuccess] = useState<string>("");

    const [requestType, setRequestType] = useState<ChangeRequestType>("Due Date Change");
    const [requestedValue, setRequestedValue] = useState<string>("");
    const [requestReason, setRequestReason] = useState<string>("");
    const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);
    const [requestError, setRequestError] = useState<string>("");
    const [requestSuccess, setRequestSuccess] = useState<string>("");

    const canEditTask = canManageTasks(user);

    const isAssignedMember = useMemo(() => {
        if (!task || !user) {
            return false;
        }

        return task.assignedUserId === user.id;
    }, [task, user]);

    const canAcknowledgeTask = useMemo(() => {
        if (!task || !user) {
            return false;
        }

        if (!isAssignedMember) {
            return false;
        }

        if (task.acknowledgedAt || task.acknowledgedByUserId) {
            return false;
        }

        return true;
    }, [isAssignedMember, task, user]);

    const canUpdateOwnTaskStatus = useMemo(() => {
        if (!task || !user) {
            return false;
        }

        return isMember(user) && isAssignedMember;
    }, [isAssignedMember, task, user]);

    const canRequestChange = useMemo(() => {
        if (!task || !user) {
            return false;
        }

        return isMember(user) && isAssignedMember;
    }, [isAssignedMember, task, user]);

    const assignedDisplayName = useMemo(() => {
        if (!task) {
            return "Unassigned";
        }

        return getUserDisplayName(
            task.assignedMember,
            getUserNameById(task.assignedUserId, users) ?? task.assignedUserId ?? null
        );
    }, [task, users]);

    const acknowledgedByDisplayName = useMemo(() => {
        if (!task) {
            return "Not acknowledged";
        }

        return getUserDisplayName(
            task.acknowledgedBy,
            getUserNameById(task.acknowledgedByUserId, users) ?? task.acknowledgedByUserId ?? null
        );
    }, [task, users]);

    const teamDisplayName = useMemo(() => {
        if (!task) {
            return "-";
        }

        return getTeamNameById(task.teamId, teams) ?? "-";
    }, [task, teams]);

    function getHistoryUserDisplay(value?: string | UserRef | null) {
        return getUserDisplayName(
            value,
            typeof value === "string" ? getUserNameById(value, users) ?? value : null
        );
    }

    useEffect(() => {
        async function loadTask() {
            if (!id) {
                setError("Task ID is missing.");
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError("");

            try {
                const data = await getTaskById(id);
                setTask(data);
                setMemberStatus((data.status as MemberStatus) ?? "New");

                if (canEditTask) {
                    const [usersData, teamsData] = await Promise.allSettled([getUsers(), getTeams()]);

                    if (usersData.status === "fulfilled") {
                        setUsers(Array.isArray(usersData.value) ? usersData.value : []);
                    }

                    if (teamsData.status === "fulfilled") {
                        setTeams(Array.isArray(teamsData.value) ? teamsData.value : []);
                    }
                }
            } catch (err: unknown) {
                let message = "Could not load task details.";

                if (axios.isAxiosError(err)) {
                    if (err.response?.status === 401) {
                        message = "Unauthorized. Login with a real backend user to load task details.";
                    } else if (err.response?.status === 403) {
                        message = "Forbidden. Your role cannot access this task.";
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

        loadTask();
    }, [id, canEditTask]);

    async function refreshTask() {
        if (!id) {
            return;
        }

        const refreshed = await getTaskById(id);
        setTask(refreshed);
        setMemberStatus((refreshed.status as MemberStatus) ?? "New");
    }

    async function handleDelete() {
        if (!id || !canEditTask) {
            return;
        }

        const confirmed = window.confirm("Are you sure you want to delete this task?");

        if (!confirmed) {
            return;
        }

        setIsDeleting(true);
        setError("");

        try {
            await deleteTask(id);
            navigate("/tasks");
        } catch (err: unknown) {
            let message = "Could not delete task.";

            if (axios.isAxiosError(err)) {
                if (err.response?.status === 401) {
                    message = "Unauthorized. Login with a real backend user to delete tasks.";
                } else if (err.response?.status === 403) {
                    message = "Forbidden. Your role cannot delete tasks.";
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
            setIsDeleting(false);
        }
    }

    async function handleAcknowledge() {
        if (!id || !canAcknowledgeTask) {
            return;
        }

        setIsAcknowledging(true);
        setError("");

        try {
            await acknowledgeTask(id);
            await refreshTask();
        } catch (err: unknown) {
            let message = "Could not acknowledge task.";

            if (axios.isAxiosError(err)) {
                if (err.response?.status === 401) {
                    message = "Unauthorized. Login with a real backend user to acknowledge tasks.";
                } else if (err.response?.status === 403) {
                    message = "Forbidden. You cannot acknowledge this task.";
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
            setIsAcknowledging(false);
        }
    }

    async function handleMemberStatusUpdate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!id || !canUpdateOwnTaskStatus) {
            return;
        }

        setMemberStatusError("");
        setMemberStatusSuccess("");
        setIsUpdatingStatus(true);

        try {
            await updateTaskStatus(id, memberStatus);
            await refreshTask();
            setMemberStatusSuccess("Task status updated successfully.");
        } catch (err: unknown) {
            let message = "Could not update task status.";

            if (axios.isAxiosError(err)) {
                if (err.response?.status === 401) {
                    message = "Unauthorized. Login with a real backend user to update status.";
                } else if (err.response?.status === 403) {
                    message = "Forbidden. You cannot update the status of this task.";
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
                        message = "The backend rejected the status update request.";
                    }
                }
            }

            setMemberStatusError(message);
        } finally {
            setIsUpdatingStatus(false);
        }
    }

    async function handleCreateChangeRequest(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!task) {
            return;
        }

        setRequestError("");
        setRequestSuccess("");

        if (!requestedValue.trim()) {
            setRequestError("Requested value is required.");
            return;
        }

        if (!requestReason.trim()) {
            setRequestError("Reason is required.");
            return;
        }

        setIsSubmittingRequest(true);

        try {
            await createChangeRequest({
                taskId: task.id,
                requestType,
                requestedValue: normalizeChangeRequestValue(requestType, requestedValue),
                reason: requestReason.trim(),
            });

            setRequestedValue("");
            setRequestReason("");
            setRequestType("Due Date Change");
            setRequestSuccess("Change request submitted successfully.");
        } catch (err: unknown) {
            let message = "Could not create change request.";

            if (axios.isAxiosError(err)) {
                if (err.response?.status === 401) {
                    message = "Unauthorized. Login with a real backend user to submit change requests.";
                } else if (err.response?.status === 403) {
                    message = "Forbidden. You cannot request changes for this task.";
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
                    } else if (
                        data &&
                        typeof data === "object" &&
                        "errors" in data &&
                        data.errors &&
                        typeof data.errors === "object"
                    ) {
                        const firstErrorGroup = Object.values(data.errors)[0];

                        if (Array.isArray(firstErrorGroup) && typeof firstErrorGroup[0] === "string") {
                            message = firstErrorGroup[0];
                        } else {
                            message = "The backend rejected the change request.";
                        }
                    } else {
                        message = "The backend rejected the change request.";
                    }
                }
            }

            setRequestError(message);
        } finally {
            setIsSubmittingRequest(false);
        }
    }

    if (isLoading) {
        return (
            <div className="card task-detail-loading">
                <div className="card-body">Loading task details...</div>
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="error-box">
                <div className="card-body">
                    <p style={{ marginTop: 0 }}>{error || "Task not found."}</p>
                    <Link to="/tasks">Back to Tasks</Link>
                </div>
            </div>
        );
    }

    const dueState = getDueDateState(task.dueDate, task.status);
    const dueStyle = getDueDateStyle(dueState);
    const dueLabel =
        dueState === "overdue" ? "Past Due" : dueState === "soon" ? "Due Soon" : "";

    return (
        <div className="task-detail-stack">
            <div className="card task-detail-hero">
                <div className="card-body">
                    <div className="task-detail-hero-top">
                        <Link to="/tasks">← Back to Tasks</Link>

                        <div className="task-detail-action-group">
                            {canAcknowledgeTask ? (
                                <button
                                    type="button"
                                    className="button-success"
                                    onClick={handleAcknowledge}
                                    disabled={isAcknowledging}
                                >
                                    {isAcknowledging ? "Acknowledging..." : "Acknowledge Task"}
                                </button>
                            ) : null}

                            {canEditTask ? (
                                <Link to={`/tasks/${task.id}/edit`} className="button">
                                    Edit Task
                                </Link>
                            ) : null}

                            {canEditTask ? (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="button-danger"
                                >
                                    {isDeleting ? "Deleting..." : "Delete Task"}
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <h2 className="task-detail-title">{task.title}</h2>
                    <p className="task-detail-description">
                        {task.description || "No description provided."}
                    </p>
                </div>
            </div>

            <div className="task-detail-grid">
                <DetailCard
                    title="Status"
                    value={<span className={getStatusClass(task.status)}>{task.status}</span>}
                />
                <DetailCard
                    title="Priority"
                    value={<span className={getPriorityClass(task.priority)}>{task.priority}</span>}
                />
                <DetailCard
                    title="Complexity"
                    value={<span className={getComplexityClass(task.complexity)}>{task.complexity}</span>}
                />
                <DetailCard title="Effort Hours" value={task.effortHours} />
                <DetailCard title="Assigned Member" value={assignedDisplayName} />
                <DetailCard
                    title="Weight"
                    value={task.weight ?? task.weightBreakdown?.weight ?? "-"}
                />
            </div>

            <div className="task-detail-panels">
                <Section title="Task Information">
                    <p>
                        <strong>Start Date:</strong> {formatDateTime(task.startDate)}
                    </p>
                    <p>
                        <strong>Due Date:</strong>{" "}
                        <span
                            className={`task-detail-due-inline ${dueLabel ? "alert" : ""}`}
                            style={{
                                color: dueStyle.color,
                                background: dueStyle.background,
                                fontWeight: dueLabel ? 700 : 400,
                            }}
                        >
                            {formatDateTime(task.dueDate)}
                            {dueLabel ? <span>{dueLabel}</span> : null}
                        </span>
                    </p>
                    <p>
                        <strong>Created At:</strong> {formatDateTime(task.createdAt)}
                    </p>
                    <p>
                        <strong>Updated At:</strong> {formatDateTime(task.updatedAt)}
                    </p>
                    <p>
                        <strong>Team:</strong> {teamDisplayName}
                    </p>
                    <p>
                        <strong>ClickUp Task ID:</strong> {task.clickUpTaskId ?? "-"}
                    </p>
                    <p>
                        <strong>ClickUp List ID:</strong> {task.clickUpListId ?? "-"}
                    </p>
                    <p>
                        <strong>Last Synced:</strong> {formatDateTime(task.lastSyncedAt)}
                    </p>
                </Section>

                <Section title="Acknowledgement">
                    <p>
                        <strong>Acknowledged By:</strong> {acknowledgedByDisplayName}
                    </p>
                    <p>
                        <strong>Acknowledged At:</strong> {formatDateTime(task.acknowledgedAt)}
                    </p>
                </Section>
            </div>

            {canUpdateOwnTaskStatus ? (
                <Section title="Update Task Status">
                    <form onSubmit={handleMemberStatusUpdate}>
                        <div className="task-form-grid">
                            <div className="form-field">
                                <label className="task-form-label" htmlFor="memberStatus">
                                    Status
                                </label>
                                <select
                                    id="memberStatus"
                                    className="select"
                                    value={memberStatus}
                                    onChange={(event) => setMemberStatus(event.target.value as MemberStatus)}
                                >
                                    <option value="New">New</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Blocked">Blocked</option>
                                    <option value="Done">Done</option>
                                </select>
                            </div>
                        </div>

                        {memberStatusError ? (
                            <div className="error-box task-form-error">
                                <div className="card-body">{memberStatusError}</div>
                            </div>
                        ) : null}

                        {memberStatusSuccess ? (
                            <div
                                style={{
                                    marginBottom: "16px",
                                    padding: "12px 16px",
                                    borderRadius: "12px",
                                    background: "#dcfce7",
                                    color: "#166534",
                                    fontWeight: 600,
                                }}
                            >
                                {memberStatusSuccess}
                            </div>
                        ) : null}

                        <div className="task-form-actions">
                            <button type="submit" className="button" disabled={isUpdatingStatus}>
                                {isUpdatingStatus ? "Updating..." : "Update Status"}
                            </button>
                        </div>
                    </form>
                </Section>
            ) : null}

            {canRequestChange ? (
                <Section title="Request Change">
                    <form onSubmit={handleCreateChangeRequest}>
                        <div className="task-form-grid">
                            <div className="form-field">
                                <label className="task-form-label" htmlFor="requestType">
                                    Change Type
                                </label>
                                <select
                                    id="requestType"
                                    className="select"
                                    value={requestType}
                                    onChange={(event) =>
                                        setRequestType(event.target.value as ChangeRequestType)
                                    }
                                >
                                    <option value="Due Date Change">Due Date Change</option>
                                    <option value="Effort Increase">Effort Increase</option>
                                    <option value="Owner Change">Owner Change</option>
                                </select>
                            </div>

                            <div className="form-field">
                                <label className="task-form-label" htmlFor="currentValue">
                                    Current Value
                                </label>
                                <input
                                    id="currentValue"
                                    className="input"
                                    value={getCurrentValueForRequest(task, requestType, assignedDisplayName)}
                                    readOnly
                                />
                            </div>

                            <div className="form-field">
                                <label className="task-form-label" htmlFor="requestedValue">
                                    {getRequestedValueLabel(requestType)}
                                </label>
                                <input
                                    id="requestedValue"
                                    className="input"
                                    type={getRequestedValueInputType(requestType)}
                                    value={requestedValue}
                                    onChange={(event) => setRequestedValue(event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-field task-form-description">
                            <label className="task-form-label" htmlFor="requestReason">
                                Reason
                            </label>
                            <textarea
                                id="requestReason"
                                className="textarea"
                                value={requestReason}
                                onChange={(event) => setRequestReason(event.target.value)}
                                placeholder="Explain why you are requesting this change"
                            />
                        </div>

                        {requestError ? (
                            <div className="error-box task-form-error">
                                <div className="card-body">{requestError}</div>
                            </div>
                        ) : null}

                        {requestSuccess ? (
                            <div
                                style={{
                                    marginBottom: "16px",
                                    padding: "12px 16px",
                                    borderRadius: "12px",
                                    background: "#dcfce7",
                                    color: "#166534",
                                    fontWeight: 600,
                                }}
                            >
                                {requestSuccess}
                            </div>
                        ) : null}

                        <div className="task-form-actions">
                            <button type="submit" className="button" disabled={isSubmittingRequest}>
                                {isSubmittingRequest ? "Submitting..." : "Submit Change Request"}
                            </button>
                        </div>
                    </form>
                </Section>
            ) : null}

            <Section title="Weight Breakdown">
                <p>
                    <strong>Effort Hours:</strong> {task.weightBreakdown?.effortHours ?? "-"}
                </p>
                <p>
                    <strong>Complexity:</strong> {task.weightBreakdown?.complexity ?? "-"}
                </p>
                <p>
                    <strong>Complexity Multiplier:</strong>{" "}
                    {task.weightBreakdown?.complexityMultiplier ?? "-"}
                </p>
                <p>
                    <strong>Priority:</strong> {task.weightBreakdown?.priority ?? "-"}
                </p>
                <p>
                    <strong>Priority Multiplier:</strong>{" "}
                    {task.weightBreakdown?.priorityMultiplier ?? "-"}
                </p>
                <p>
                    <strong>Formula:</strong> {task.weightBreakdown?.formula ?? "-"}
                </p>
                <p>
                    <strong>Weight:</strong> {task.weightBreakdown?.weight ?? "-"}
                </p>
            </Section>

            <Section title="Status History">
                {task.statusHistory && task.statusHistory.length > 0 ? (
                    <div className="task-detail-table-wrap">
                        <table className="task-detail-table">
                            <thead>
                                <tr>
                                    <th>Old Status</th>
                                    <th>New Status</th>
                                    <th>Changed By</th>
                                    <th>Changed At</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {task.statusHistory.map((item, index) => (
                                    <tr key={item.id ?? index}>
                                        <td>{item.oldStatus ?? "-"}</td>
                                        <td>{item.newStatus ?? "-"}</td>
                                        <td>{getHistoryUserDisplay(item.changedBy)}</td>
                                        <td>{formatDateTime(item.changedAt)}</td>
                                        <td>{item.notes ?? "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p>No status history available.</p>
                )}
            </Section>

            <Section title="Change History">
                {task.changeHistory && task.changeHistory.length > 0 ? (
                    <div className="task-detail-table-wrap">
                        <table className="task-detail-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Previous</th>
                                    <th>New</th>
                                    <th>Requested By</th>
                                    <th>Status</th>
                                    <th>Reviewed By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {task.changeHistory.map((item, index) => (
                                    <tr key={item.id ?? index}>
                                        <td>{item.changeType ?? "-"}</td>
                                        <td>{item.previousValue ?? "-"}</td>
                                        <td>{item.newValue ?? "-"}</td>
                                        <td>{getHistoryUserDisplay(item.requestedBy)}</td>
                                        <td>{item.status ?? "-"}</td>
                                        <td>{getHistoryUserDisplay(item.reviewedBy)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p>No change history available.</p>
                )}
            </Section>
        </div>
    );
}