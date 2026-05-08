import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getUser } from "../../../lib/auth";
import { canManageTasks } from "../../../lib/roles";
import { getTasks } from "../api";
import { getUserDisplayName } from "../display";
import type { TaskItem } from "../types";

type RangeFilter = "all" | "this" | "next";
type SortMode = "date-asc" | "date-desc" | "priority" | "title";

function formatDate(value?: string | null) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString();
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

function parseDateOnly(value?: string | null): Date | null {
    if (!value) return null;

    const raw = value.slice(0, 10);
    const [year, month, day] = raw.split("-").map(Number);

    if (!year || !month || !day) return null;

    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getWeekRange(range: "this" | "next") {
    const today = new Date();
    const start = new Date(today);
    const dayIndex = (start.getDay() + 6) % 7;

    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - dayIndex);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    if (range === "next") {
        start.setDate(start.getDate() + 7);
        end.setDate(end.getDate() + 7);
    }

    return { start, end };
}

function isTaskInWeek(task: TaskItem, range: "this" | "next"): boolean {
    const { start, end } = getWeekRange(range);

    const dueDate = parseDateOnly(task.dueDate);

    if (!dueDate) {
        return false;
    }

    dueDate.setHours(12, 0, 0, 0);

    return dueDate >= start && dueDate <= end;
}
function getPriorityRank(priority: string): number {
    switch (priority.toLowerCase()) {
        case "critical":
            return 4;
        case "high":
            return 3;
        case "medium":
            return 2;
        case "low":
            return 1;
        default:
            return 0;
    }
}

function getRelevantSortDate(task: TaskItem): number {
    const due = parseDateOnly(task.dueDate);
    const start = parseDateOnly(task.startDate);

    return due?.getTime() ?? start?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function compareTasks(a: TaskItem, b: TaskItem, sortMode: SortMode): number {
    if (sortMode === "priority") {
        const priorityDiff = getPriorityRank(b.priority) - getPriorityRank(a.priority);

        if (priorityDiff !== 0) {
            return priorityDiff;
        }

        return getRelevantSortDate(a) - getRelevantSortDate(b);
    }

    if (sortMode === "title") {
        return a.title.localeCompare(b.title);
    }

    const dateA = getRelevantSortDate(a);
    const dateB = getRelevantSortDate(b);

    if (sortMode === "date-desc") {
        return dateB - dateA;
    }

    return dateA - dateB;
}

export default function TaskListPage() {
    const navigate = useNavigate();
    const user = getUser();
    const [searchParams, setSearchParams] = useSearchParams();

    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [search, setSearch] = useState<string>("");
    const [sortMode, setSortMode] = useState<SortMode>("date-asc");

    const statusFilter = searchParams.get("status");
    const assignedFilter = searchParams.get("assigned");
    const rangeQuery = searchParams.get("range");

    const rangeFilter: RangeFilter =
        rangeQuery === "this" || rangeQuery === "next" || rangeQuery === "all"
            ? rangeQuery
            : "all";

    const canCreateTask = canManageTasks(user);

    useEffect(() => {
        async function loadTasks() {
            setIsLoading(true);
            setError("");

            try {
                const data = await getTasks();
                setTasks(data);
            } catch (err: unknown) {
                let message = "Could not load tasks.";

                if (axios.isAxiosError(err)) {
                    if (err.response?.status === 401) {
                        message = "Unauthorized. Login with a real backend user to load tasks.";
                    } else if (err.response?.status === 403) {
                        message = "Forbidden. Your role cannot access tasks.";
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

        void loadTasks();
    }, []);

    const filteredTasks = useMemo(() => {
        const term = search.trim().toLowerCase();

        const result = tasks.filter((task) => {
            const assignedName = getUserDisplayName(task.assignedMember, task.assignedUserId);

            const matchesSearch =
                !term ||
                task.title.toLowerCase().includes(term) ||
                (task.description ?? "").toLowerCase().includes(term) ||
                task.status.toLowerCase().includes(term) ||
                task.priority.toLowerCase().includes(term) ||
                task.complexity.toLowerCase().includes(term) ||
                assignedName.toLowerCase().includes(term);

            const normalizedStatus = task.status.toLowerCase();

            const matchesStatus =
                !statusFilter ||
                (statusFilter === "done" && normalizedStatus === "done") ||
                (statusFilter === "active" &&
                    ["new", "in progress", "blocked"].includes(normalizedStatus));

            const isUnassigned = !task.assignedMember && !task.assignedUserId;

            const matchesAssigned =
                !assignedFilter || (assignedFilter === "unassigned" && isUnassigned);

            const matchesRange =
                rangeFilter === "all" ? true : isTaskInWeek(task, rangeFilter);

            return matchesSearch && matchesStatus && matchesAssigned && matchesRange;
        });

        return result.sort((a, b) => compareTasks(a, b, sortMode));
    }, [assignedFilter, rangeFilter, search, sortMode, statusFilter, tasks]);

    const groupedTasks = useMemo(() => {
        if (rangeFilter === "this") {
            return {
                primaryTitle: "This Week's Tasks",
                primary: filteredTasks,
                secondaryTitle: "",
                secondary: [],
            };
        }

        if (rangeFilter === "next") {
            return {
                primaryTitle: "Next Week's Tasks",
                primary: filteredTasks,
                secondaryTitle: "",
                secondary: [],
            };
        }

        const thisWeekTasks = filteredTasks.filter((task) => isTaskInWeek(task, "this"));
        const otherTasks = filteredTasks.filter((task) => !isTaskInWeek(task, "this"));

        return {
            primaryTitle: "This Week's Tasks",
            primary: thisWeekTasks,
            secondaryTitle: "Other Tasks",
            secondary: otherTasks,
        };
    }, [filteredTasks, rangeFilter]);

    const filterLabel =
        statusFilter === "active"
            ? "Active Tasks"
            : statusFilter === "done"
                ? "Done Tasks"
                : assignedFilter === "unassigned"
                    ? "Unassigned Tasks"
                    : "All Tasks";

    const rangeLabel =
        rangeFilter === "this"
            ? "This Week"
            : rangeFilter === "next"
                ? "Next Week"
                : "All Tasks";

    function updateRange(nextRange: RangeFilter) {
        const nextParams = new URLSearchParams(searchParams);

        nextParams.set("range", nextRange);
        nextParams.delete("startDate");
        nextParams.delete("endDate");

        setSearchParams(nextParams);
    }

    function renderRows(items: TaskItem[]) {
        if (items.length === 0) {
            return (
                <tr>
                    <td className="task-empty-cell" colSpan={9}>
                        No tasks found.
                    </td>
                </tr>
            );
        }

        return items.map((task) => (
            <tr
                key={task.id}
                className="clickable-row"
                onClick={() => navigate(`/tasks/${task.id}`)}
            >
                <td className="task-title-cell">{task.title}</td>
                <td>
                    <span className={getStatusClass(task.status)}>{task.status}</span>
                </td>
                <td>{task.priority}</td>
                <td>{task.complexity}</td>
                <td>{task.effortHours}</td>
                <td>{task.weight ?? "-"}</td>
                <td>{getUserDisplayName(task.assignedMember, task.assignedUserId)}</td>
                <td>{formatDate(task.startDate)}</td>
                <td>{formatDate(task.dueDate)}</td>
            </tr>
        ));
    }

    function renderSection(title: string, items: TaskItem[]) {
        return (
            <div className="task-table-section">
                <div className="task-section-heading-row">
                    <h3 className="task-section-heading">{title}</h3>
                    <span className="task-section-count">{items.length}</span>
                </div>

                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Complexity</th>
                                <th>Effort</th>
                                <th>Weight</th>
                                <th>Assigned</th>
                                <th>Start</th>
                                <th>Due</th>
                            </tr>
                        </thead>
                        <tbody>{renderRows(items)}</tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="task-page-stack">
            <div className="card task-header-card">
                <div className="card-body">
                    <div className="task-header-top">
                        <div>
                            <h2 className="task-page-title">Tasks</h2>
                            <p className="task-page-subtitle">
                                {filterLabel} • {rangeLabel}
                            </p>
                        </div>

                        {canCreateTask ? (
                            <Link to="/tasks/new" className="button">
                                + Create Task
                            </Link>
                        ) : null}
                    </div>

                    <div className="task-range-filter-group">
                        <button
                            type="button"
                            onClick={() => updateRange("all")}
                            className={`dashboard-filter-button ${rangeFilter === "all" ? "active" : ""}`}
                        >
                            All Tasks
                        </button>

                        <button
                            type="button"
                            onClick={() => updateRange("this")}
                            className={`dashboard-filter-button ${rangeFilter === "this" ? "active" : ""}`}
                        >
                            This Week
                        </button>

                        <button
                            type="button"
                            onClick={() => updateRange("next")}
                            className={`dashboard-filter-button ${rangeFilter === "next" ? "active" : ""}`}
                        >
                            Next Week
                        </button>
                    </div>

                    <div className="task-toolbar">
                        <div className="task-toolbar-left">
                            <input
                                className="input task-search"
                                type="text"
                                placeholder="Search by title, status, priority..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>

                        <div className="task-toolbar-right">
                            <select
                                className="select task-sort"
                                value={sortMode}
                                onChange={(event) => setSortMode(event.target.value as SortMode)}
                            >
                                <option value="date-asc">Sort: Due Date (Earliest)</option>
                                <option value="date-desc">Sort: Due Date (Latest)</option>
                                <option value="priority">Sort: Importance</option>
                                <option value="title">Sort: Title</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="task-loading-card card">
                    <div className="card-body">Loading tasks...</div>
                </div>
            ) : error ? (
                <div className="error-box">
                    <div className="card-body">{error}</div>
                </div>
            ) : (
                <div className="card task-table-card">
                    <div className="card-body">
                        {renderSection(groupedTasks.primaryTitle, groupedTasks.primary)}

                        {rangeFilter === "all" ? (
                            <>
                                <div className="task-section-divider" />
                                {renderSection(groupedTasks.secondaryTitle, groupedTasks.secondary)}
                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}