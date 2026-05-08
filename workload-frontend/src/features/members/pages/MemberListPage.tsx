import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
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

export default function MemberListPage() {
    const [searchParams] = useSearchParams();
    const workloadFilter = searchParams.get("workload");
    const range = searchParams.get("range");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const [members, setMembers] = useState<MemberWorkloadDetail[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        async function loadMembers() {
            setIsLoading(true);
            setError("");

            try {
                const data = await getDashboardWorkloadDetails({
                    range: range ?? undefined,
                    startDate,
                    endDate,
                });

                setMembers(data);
            } catch (err: unknown) {
                let message = "Could not load member workload details.";

                if (axios.isAxiosError(err)) {
                    if (err.response?.status === 401) {
                        message = "Unauthorized. Login with a real backend user to load members.";
                    } else if (err.response?.status === 403) {
                        message = "Forbidden. Your role cannot view member workload details.";
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
    }, [endDate, range, startDate]);

    const filteredMembers = useMemo(() => {
        return members.filter((member) => {
            if (!workloadFilter) {
                return true;
            }

            return member.workloadStatus.toLowerCase() === workloadFilter.toLowerCase();
        });
    }, [members, workloadFilter]);

    const title =
        workloadFilter === "available"
            ? "Available Members"
            : workloadFilter === "moderate"
                ? "Moderate Members"
                : workloadFilter === "overloaded"
                    ? "Overloaded Members"
                    : "All Members";

    return (
        <div className="members-page-stack">
            <div className="card members-page-card">
                <div className="card-body">
                    <div className="members-page-top">
                        <div>
                            <h2 className="members-page-title">Members</h2>
                            <p className="members-page-subtitle">{title}</p>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="card members-page-card">
                    <div className="card-body">Loading members...</div>
                </div>
            ) : error ? (
                <div className="error-box">
                    <div className="card-body">{error}</div>
                </div>
            ) : filteredMembers.length === 0 ? (
                <div className="card members-page-card">
                    <div className="card-body">No members found for this view.</div>
                </div>
            ) : (
                <div className="members-grid">
                    {filteredMembers.map((member) => (
                        <Link
                            key={member.id}
                            to={`/members/${member.id}`}
                            className="member-card-link"
                        >
                            <div className="card member-card">
                                <div className="card-body">
                                    <div className="member-card-top">
                                        <div>
                                            <h3 className="member-card-title">{member.displayName}</h3>
                                            <p className="member-card-subtitle">
                                                {member.email || "No email"}
                                            </p>
                                        </div>

                                        <span className={getWorkloadBadgeClass(member.workloadStatus)}>
                                            {member.workloadStatus}
                                        </span>
                                    </div>

                                    <div className="member-meta">
                                        <p>
                                            <strong>Tasks:</strong> {member.taskCount}
                                        </p>
                                        <p>
                                            <strong>Total Effort:</strong> {member.totalEffort}
                                        </p>
                                        <p>
                                            <strong>Total Weight:</strong> {member.totalWeight}
                                        </p>
                                        <p>
                                            <strong>Team:</strong> {member.teamName || "-"}
                                        </p>
                                    </div>

                                    <div className="member-task-preview">
                                        <strong>Assigned Tasks</strong>
                                        <ul className="member-task-preview-list">
                                            {member.tasks.slice(0, 3).map((task) => (
                                                <li key={task.id}>
                                                    {task.title} — {task.status}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="member-card-footer">View Details →</div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}