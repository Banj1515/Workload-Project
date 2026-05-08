import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { deleteTeam, getTeams } from "../api";
import type { TeamItem } from "../types";

export default function TeamListPage() {
    const [teams, setTeams] = useState<TeamItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [deletingId, setDeletingId] = useState<string>("");

    async function loadTeams(): Promise<void> {
        setIsLoading(true);
        setError("");

        try {
            const data = await getTeams();
            setTeams(data);
        } catch (err: unknown) {
            let message = "Could not load teams.";

            if (axios.isAxiosError(err)) {
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

            setError(message);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadTeams();
    }, []);

    async function handleDelete(id: string): Promise<void> {
        const confirmed = window.confirm("Delete this team?");

        if (!confirmed) return;

        setDeletingId(id);
        setError("");

        try {
            await deleteTeam(id);
            await loadTeams();
        } catch (err: unknown) {
            let message = "Could not delete team.";

            if (axios.isAxiosError(err)) {
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

            setError(message);
        } finally {
            setDeletingId("");
        }
    }

    return (
        <div className="members-page-stack">
            <div className="card members-page-card">
                <div className="card-body">
                    <div className="members-page-top">
                        <div>
                            <h2 className="members-page-title">Teams</h2>
                            <p className="members-page-subtitle">
                                Create teams and manage team members.
                            </p>
                        </div>

                        <Link to="/teams/new" className="button">
                            + Create Team
                        </Link>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="card members-page-card">
                    <div className="card-body">Loading teams...</div>
                </div>
            ) : error ? (
                <div className="error-box">
                    <div className="card-body">{error}</div>
                </div>
            ) : (
                <div className="card task-table-card">
                    <div className="card-body table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Description</th>
                                    <th>Members</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {teams.length === 0 ? (
                                    <tr>
                                        <td colSpan={4}>No teams found.</td>
                                    </tr>
                                ) : (
                                    teams.map((team) => (
                                        <tr key={team.id}>
                                            <td>{team.name}</td>
                                            <td>{team.description || "-"}</td>
                                            <td>{team.memberCount ?? 0}</td>
                                            <td>
                                                <div className="table-action-group">
                                                    <Link to={`/teams/${team.id}/edit`} className="button-secondary">
                                                        Edit / Members
                                                    </Link>

                                                    <button
                                                        type="button"
                                                        className="button-danger"
                                                        disabled={deletingId === team.id}
                                                        onClick={() => void handleDelete(team.id)}
                                                    >
                                                        {deletingId === team.id ? "Deleting..." : "Delete"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}