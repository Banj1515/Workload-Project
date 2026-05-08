import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { getUser } from "../../../lib/auth";
import { canReviewChangeRequests } from "../../../lib/roles";
import { getUserDisplayName } from "../../tasks/display";
import { getPendingChangeRequests, reviewChangeRequest } from "../api";
import type { ChangeRequestItem } from "../types";

function formatDateTime(value?: string | null) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

export default function ChangeRequestsPage() {
    const user = getUser();

    const [items, setItems] = useState<ChangeRequestItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [processingId, setProcessingId] = useState<string>("");

    const canReview = canReviewChangeRequests(user);

    async function loadItems() {
        setIsLoading(true);
        setError("");

        try {
            const data = await getPendingChangeRequests();
            setItems(Array.isArray(data) ? data : []);
        } catch (err: unknown) {
            let message = "Could not load change requests.";

            if (axios.isAxiosError(err)) {
                if (err.response?.status === 401) {
                    message = "Unauthorized. Login with a real backend user to load change requests.";
                } else if (err.response?.status === 403) {
                    message = "Forbidden. Your role cannot view pending change requests.";
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

    useEffect(() => {
        loadItems();
    }, []);

    async function handleReview(id: string | number, approved: boolean) {
        if (!canReview) {
            setError("Only Team Leader or Admin can review change requests.");
            return;
        }

        setProcessingId(String(id));
        setError("");

        try {
            await reviewChangeRequest(id, {
                approved,
                notes: approved ? "Approved from frontend." : "Rejected from frontend.",
            });

            setItems((current) => current.filter((item) => String(item.id) !== String(id)));
        } catch (err: unknown) {
            let message = "Could not review change request.";

            if (axios.isAxiosError(err)) {
                if (err.response?.status === 401) {
                    message = "Unauthorized. Login with a real backend user to review requests.";
                } else if (err.response?.status === 403) {
                    message = "Forbidden. Your role cannot review change requests.";
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
            setProcessingId("");
        }
    }

    return (
        <div className="change-request-stack">
            <div className="card change-request-header-card">
                <div className="card-body">
                    <h2 className="change-request-title">Change Requests</h2>
                    <p className="change-request-subtitle">
                        Pending requests for owner, due date, and effort changes.
                    </p>
                    <p className="change-request-role-line">
                        <strong>Role:</strong> {user?.roles?.join(", ") || "None"}
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="card change-request-loading">
                    <div className="card-body">Loading change requests...</div>
                </div>
            ) : error ? (
                <div className="error-box">
                    <div className="card-body">{error}</div>
                </div>
            ) : items.length === 0 ? (
                <div className="card change-request-loading">
                    <div className="card-body">No pending change requests.</div>
                </div>
            ) : (
                <div className="change-request-list">
                    {items.map((item) => (
                        <div key={item.id} className="card change-request-card">
                            <div className="card-body">
                                <div className="change-request-top">
                                    <div>
                                        <h3 className="change-request-card-title">{item.taskTitle}</h3>
                                        <p className="change-request-card-subtitle">
                                            Request Type: {item.requestType}
                                        </p>
                                    </div>

                                    <span className="change-request-badge">
                                        {item.status || "Pending"}
                                    </span>
                                </div>

                                <div className="change-request-meta">
                                    <p><strong>Task ID:</strong> {item.taskId}</p>
                                    <p><strong>Current Value:</strong> {item.currentValue ?? "-"}</p>
                                    <p><strong>Requested Value:</strong> {item.requestedValue ?? "-"}</p>
                                    <p><strong>Requested By:</strong> {getUserDisplayName(item.requestedBy)}</p>
                                    <p><strong>Requested At:</strong> {formatDateTime(item.requestedAt)}</p>
                                    <p><strong>Reason:</strong> {item.reason ?? "-"}</p>
                                </div>

                                <div className="change-request-links">
                                    <Link to={`/tasks/${item.taskId}`} className="button-secondary">
                                        View Task
                                    </Link>
                                </div>

                                {canReview ? (
                                    <div className="change-request-actions">
                                        <button
                                            type="button"
                                            onClick={() => handleReview(item.id, true)}
                                            disabled={processingId === String(item.id)}
                                            className="button-success"
                                        >
                                            {processingId === String(item.id) ? "Working..." : "Approve"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleReview(item.id, false)}
                                            disabled={processingId === String(item.id)}
                                            className="button-danger"
                                        >
                                            {processingId === String(item.id) ? "Working..." : "Reject"}
                                        </button>
                                    </div>
                                ) : (
                                    <p className="change-request-review-note">
                                        Review actions are visible only for Team Leader or Admin.
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
