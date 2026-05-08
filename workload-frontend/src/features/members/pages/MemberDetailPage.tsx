import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useParams } from "react-router-dom";
import { getDashboardWorkloadDetails } from "../api";
import type { MemberWorkloadDetail } from "../types";

function getWorkloadBadgeClass(status: string) {
    switch (status.toLowerCase()) {
        case "available":
            return "status-badge status-done";
        case "moderate":
            return "status-badge status-new";
        case "overloaded":
            return "status-badge status-blocked";
        default:
            return "status-badge status-default";
    }
}

function getStatusBadgeClass(status: string) {
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

function formatDate(value?: string | null) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString();
}

export default function MemberDetailPage() {
    const { id } = useParams();

    const [members, setMembers] = useState<MemberWorkloadDetail[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        async function loadMembers() {
            setIsLoading(true);
            setError("");

            try {
                const data = await getDashboardWorkloadDetails();
                setMembers(data);
            } catch (err: unknown) {
                let message = "Could not load member details.";

                if (axios.isAxiosError(err)) {
                    if (err.response?.status === 401) {
                        message =
                            "Unauthorized. Login with a real backend user to load member details.";
                    } else if (err.response?.status === 403) {
                        message =
                            "Forbidden. Your role cannot view member details.";
                    } else if (err.response?.status === 404) {
                        message = "Member not found.";
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

        loadMembers();
    }, []);

    const member = useMemo(() => {
        if (!id) {
            return null;
        }

        return members.find((item) => String(item.id) === String(id)) ?? null;
    }, [id, members]);

    if (isLoading) {
        return (
            <div className="card members-page-card">
                <div className="card-body">Loading member details...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-box">
                <div className="card-body">{error}</div>
            </div>
        );
    }

    if (!member) {
        return (
            <div className="error-box">
                <div className="card-body">
                    <p style={{ marginTop: 0 }}>Member not found.</p>
                    <Link to="/members">Back to Members</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="member-detail-stack">
            <div className="card member-detail-hero">
                <div className="card-body">
                    <div className="member-detail-top">
                        <Link to="/members" className="member-back-link">
                            ← Back to Members
                        </Link>
                    </div>

                    <div className="member-card-top">
                        <div>
                            <h2 className="member-detail-title">{member.displayName}</h2>
                            <p className="member-detail-subtitle">
                                {member.email || "No email"} {member.teamName ? `• ${member.teamName}` : ""}
                            </p>
                        </div>

                        <span className={getWorkloadBadgeClass(member.workloadStatus)}>
                            {member.workloadStatus}
                        </span>
                    </div>
                </div>
            </div>

            <div className="member-summary-grid">
                <div className="card member-summary-card">
                    <div className="card-body">
                        <p className="summary-label">Task Count</p>
                        <h3 className="summary-value">{member.taskCount}</h3>
                    </div>
                </div>

                <div className="card member-summary-card">
                    <div className="card-body">
                        <p className="summary-label">Total Effort</p>
                        <h3 className="summary-value">{member.totalEffort}</h3>
                    </div>
                </div>

                <div className="card member-summary-card">
                    <div className="card-body">
                        <p className="summary-label">Total Weight</p>
                        <h3 className="summary-value">{member.totalWeight}</h3>
                    </div>
                </div>
            </div>

            <div className="card member-tasks-card">
                <div className="card-body">
                    <h3 className="card-title">Assigned Tasks</h3>

                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Task Title</th>
                                    <th>Status</th>
                                    <th>Priority</th>
                                    <th>Effort</th>
                                    <th>Weight</th>
                                    <th>Due</th>
                                    <th>Open</th>
                                </tr>
                            </thead>
                            <tbody>
                                {member.tasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={7}>No tasks assigned.</td>
                                    </tr>
                                ) : (
                                    member.tasks.map((task) => (
                                        <tr key={task.id}>
                                            <td>{task.title}</td>
                                            <td>
                                                <span className={getStatusBadgeClass(task.status)}>
                                                    {task.status}
                                                </span>
                                            </td>
                                            <td>{task.priority ?? "-"}</td>
                                            <td>{task.effortHours ?? "-"}</td>
                                            <td>{task.weight ?? "-"}</td>
                                            <td>{formatDate(task.dueDate)}</td>
                                            <td>
                                                <Link to={`/tasks/${task.id}`} className="button-secondary">
                                                    View Task
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}