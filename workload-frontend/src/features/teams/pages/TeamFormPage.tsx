import { useEffect, useMemo, useState, type FormEvent } from "react";
import axios from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUsers } from "../../users/api";
import type { UserListItem } from "../../users/types";
import {
    addMemberToTeam,
    createTeam,
    getTeamById,
    getTeamMembers,
    removeMemberFromTeam,
    updateTeam,
} from "../api";
import type { TeamFormData, TeamMember } from "../types";

const emptyForm: TeamFormData = {
    name: "",
    description: "",
};

function getErrorMessage(err: unknown, fallback: string): string {
    if (!axios.isAxiosError(err)) return fallback;

    const data = err.response?.data;

    if (typeof data === "string") return data;

    if (
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
    ) {
        return data.message;
    }

    return fallback;
}

export default function TeamFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const isEditMode = Boolean(id);

    const [form, setForm] = useState<TeamFormData>(emptyForm);
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(Boolean(id));
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isAddingMember, setIsAddingMember] = useState<boolean>(false);
    const [removingUserId, setRemovingUserId] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [memberError, setMemberError] = useState<string>("");

    const availableUsers = useMemo(() => {
        const memberIds = new Set(members.map((member) => member.userId));

        return users.filter((user) => !memberIds.has(user.id));
    }, [members, users]);

    async function loadMembers(teamId: string): Promise<void> {
        const data = await getTeamMembers(teamId);
        setMembers(data);
    }

    useEffect(() => {
        async function loadPage(): Promise<void> {
            setIsLoading(true);
            setError("");
            setMemberError("");

            try {
                const usersData = await getUsers();
                setUsers(usersData);

                if (id) {
                    const [teamData] = await Promise.all([
                        getTeamById(id),
                        loadMembers(id),
                    ]);

                    setForm({
                        name: teamData.name ?? "",
                        description: teamData.description ?? "",
                    });
                }
            } catch (err: unknown) {
                setError(getErrorMessage(err, "Could not load team page."));
            } finally {
                setIsLoading(false);
            }
        }

        void loadPage();
    }, [id]);

    function updateField<K extends keyof TeamFormData>(
        key: K,
        value: TeamFormData[K]
    ): void {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError("");

        const created = await createTeam({
            name: form.name.trim(),
            description: form.description.trim(),
        });

        if (created?.id) {
            navigate(`/teams/${created.id}/edit`, { replace: true });
        } else {
            navigate("/teams", { replace: true });
        }

        setIsSaving(true);

        try {
            if (isEditMode && id) {
                await updateTeam(id, {
                    name: form.name.trim(),
                    description: form.description.trim(),
                });

                navigate("/teams", { replace: true });
            } else {
                const created = await createTeam({
                    name: form.name.trim(),
                    description: form.description.trim(),
                });

                if (created?.id) {
                    navigate(`/teams/${created.id}/edit`, { replace: true });
                } else {
                    navigate("/teams", { replace: true });
                }
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, isEditMode ? "Could not update team." : "Could not create team."));
        } finally {
            setIsSaving(false);
        }
    }

    async function handleAddMember(): Promise<void> {
        if (!id || !selectedUserId) {
            setMemberError("Select a user first.");
            return;
        }

        setIsAddingMember(true);
        setMemberError("");

        try {
            await addMemberToTeam(id, selectedUserId);
            setSelectedUserId("");
            await loadMembers(id);
        } catch (err: unknown) {
            setMemberError(getErrorMessage(err, "Could not add member to team."));
        } finally {
            setIsAddingMember(false);
        }
    }

    async function handleRemoveMember(userId: string): Promise<void> {
        if (!id) return;

        setRemovingUserId(userId);
        setMemberError("");

        try {
            await removeMemberFromTeam(id, userId);
            await loadMembers(id);
        } catch (err: unknown) {
            setMemberError(getErrorMessage(err, "Could not remove member from team."));
        } finally {
            setRemovingUserId("");
        }
    }

    if (isLoading) {
        return (
            <div className="card task-form-card">
                <div className="card-body">Loading team...</div>
            </div>
        );
    }

    return (
        <div className="task-page-stack">
            <div className="card task-form-card">
                <div className="card-body">
                    <Link to="/teams" className="task-form-back-link">
                        ← Back to Teams
                    </Link>

                    <h2 className="task-form-title">
                        {isEditMode ? "Edit Team" : "Create Team"}
                    </h2>
                    <p className="task-form-subtitle">
                        {isEditMode
                            ? "Update team information and manage its members."
                            : "Create a new team first, then add members."}
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div className="task-form-grid">
                            <div className="form-field">
                                <label className="task-form-label" htmlFor="teamName">
                                    Team Name
                                </label>
                                <input
                                    id="teamName"
                                    className="input"
                                    value={form.name}
                                    onChange={(event) => updateField("name", event.target.value)}
                                    placeholder="Frontend Team"
                                />
                            </div>

                            <div className="form-field">
                                <label className="task-form-label" htmlFor="teamDescription">
                                    Description
                                </label>
                                <input
                                    id="teamDescription"
                                    className="input"
                                    value={form.description}
                                    onChange={(event) =>
                                        updateField("description", event.target.value)
                                    }
                                    placeholder="Optional description"
                                />
                            </div>
                        </div>

                        {error ? (
                            <div className="error-box task-form-error">
                                <div className="card-body">{error}</div>
                            </div>
                        ) : null}

                        <div className="task-form-actions">
                            <button type="submit" className="button" disabled={isSaving}>
                                {isSaving ? "Saving..." : isEditMode ? "Save Team" : "Create Team"}
                            </button>

                            <Link to="/teams" className="button-secondary">
                                Cancel
                            </Link>
                        </div>
                    </form>
                </div>
            </div>

            {isEditMode && id ? (
                <div className="card task-form-card">
                    <div className="card-body">
                        <h3 className="card-title">Team Members</h3>

                        <div className="team-member-add-row">
                            <select
                                className="select"
                                value={selectedUserId}
                                onChange={(event) => setSelectedUserId(event.target.value)}
                            >
                                <option value="">Select user to add...</option>
                                {availableUsers.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.displayName} ({user.email})
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                className="button"
                                disabled={isAddingMember || !selectedUserId}
                                onClick={() => void handleAddMember()}
                            >
                                {isAddingMember ? "Adding..." : "Add Member"}
                            </button>
                        </div>

                        {memberError ? (
                            <div className="error-box task-form-error">
                                <div className="card-body">{memberError}</div>
                            </div>
                        ) : null}

                        {members.length === 0 ? (
                            <p className="dashboard-card-muted">No members in this team yet.</p>
                        ) : (
                            <div className="table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {members.map((member) => (
                                            <tr key={member.userId}>
                                                <td>{member.displayName}</td>
                                                <td>{member.email || "-"}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="button-danger"
                                                        disabled={removingUserId === member.userId}
                                                        onClick={() => void handleRemoveMember(member.userId)}
                                                    >
                                                        {removingUserId === member.userId
                                                            ? "Removing..."
                                                            : "Remove"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}