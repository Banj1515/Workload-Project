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
            return {
                color: "#b91c1c",
                background: "#fee2e2",
            };
        case "soon":
            return {
                color: "#c2410c",
                background: "#ffedd5",
            };
        default:
            return {
                color: "#cbd5e1",
                background: "transparent",
            };
    }
}

function getDueDateLabel(state: string) {
    switch (state) {
        case "overdue":
            return "Past Due";
        case "soon":
            return "Due Soon";
        default:
            return "";
    }
}

function parseDateOnly(value?: string | null): Date | null {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

function getTaskRange(task: TaskItem) {
    const start = parseDateOnly(task.startDate) ?? parseDateOnly(task.dueDate);
    const end = parseDateOnly(task.dueDate) ?? parseDateOnly(task.startDate);

    return {
        start,
        end,
    };
}

function isTaskInRange(task: TaskItem, startDate?: string | null, endDate?: string | null) {
    if (!startDate || !endDate) {
        return true;
    }

    const filterStart = parseDateOnly(startDate);
    const filterEnd = parseDateOnly(endDate);

    if (!filterStart || !filterEnd) {
        return true;
    }

    filterStart.setHours(0, 0, 0, 0);
    filterEnd.setHours(23, 59, 59, 999);

    const taskRange = getTaskRange(task);

    if (!taskRange.start && !taskRange.end) {
        return false;
    }

    const effectiveStart = taskRange.start ?? taskRange.end;
    const effectiveEnd = taskRange.end ?? taskRange.start;

    if (!effectiveStart || !effectiveEnd) {
        return false;
    }

    return effectiveEnd >= filterStart && effectiveStart <= filterEnd;
}

function getWeekRange(range: "this" | "next") {
    const now = new Date();
    const start = new Date(now);
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
    const end = parseDateOnly(task.dueDate);
    const start = parseDateOnly(task.startDate);

    return end?.getTime() ?? start?.getTime() ?? Number.MAX_SAFE_INTEGER;
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

function buildRangeQuery(range: RangeFilter) {
    if (range === "all") {
        return { startDate: null, endDate: null };
    }

    const week = getWeekRange(range);
    return {
        startDate: week.start.toISOString().slice(0, 10),
        endDate: week.end.toISOString().slice(0, 10),
    };
}

export default function MyTasksPage() {
    const navigate = useNavigate();
    const user = getUser();
    const [searchParams, setSearchParams] = useSearchParams();

    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [search, setSearch] = useState<string>("");

    const rangeQuery = searchParams.get("range");

    const rangeFilter: RangeFilter =
        rangeQuery === "this" || rangeQuery === "next" || rangeQuery === "all"
            ? rangeQuery
            : "all";

    const startDateQuery = searchParams.get("startDate");
    const endDateQuery = searchParams.get("endDate");

    const [sortMode, setSortMode] = useState<SortMode>("date-asc");
    const canCreateTask = canManageTasks(user);

    useEffect(() => {
        async function loadTasks() {
            setIsLoading(true);
            setError("");

            try {
                const data = await getTasks();
                const myTasks = data.filter((task) => task.assignedUserId === user?.id);
                setTasks(myTasks);
            } catch (err: unknown) {
                let message = "Could not load your tasks.";

                if (axios.isAxiosError(err)) {
                    if (err.response?.status === 401) {
                        message = "Unauthorized. Login with a real backend user to load your tasks.";
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

        loadTasks();
    }, [user?.id]);

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

            const matchesRange =
                rangeFilter === "all"
                    ? true
                    : isTaskInRange(task, startDateQuery, endDateQuery);

            return matchesSearch && matchesRange;
        });

        return result.sort((a, b) => compareTasks(a, b, sortMode));
    }, [endDateQuery, rangeFilter, search, sortMode, startDateQuery, tasks]);

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

        const thisWeek = buildRangeQuery("this");
        const thisWeekTasks = filteredTasks.filter((task) =>
            isTaskInRange(task, thisWeek.startDate, thisWeek.endDate)
        );

        const otherTasks = filteredTasks.filter(
            (task) => !isTaskInRange(task, thisWeek.startDate, thisWeek.endDate)
        );

        return {
            primaryTitle: "This Week's Tasks",
            primary: thisWeekTasks,
            secondaryTitle: "Other Tasks",
            secondary: otherTasks,
        };
    }, [filteredTasks, rangeFilter]);

    const rangeLabel =
        rangeFilter === "this"
            ? "This Week"
            : rangeFilter === "next"
                ? "Next Week"
                : "All Tasks";

    function updateRange(nextRange: RangeFilter) {
        const nextParams = new URLSearchParams(searchParams);

        nextParams.set("range", nextRange);

        const rangeDates = buildRangeQuery(nextRange);

        if (rangeDates.startDate && rangeDates.endDate) {
            nextParams.set("startDate", rangeDates.startDate);
            nextParams.set("endDate", rangeDates.endDate);
        } else {
            nextParams.delete("startDate");
            nextParams.delete("endDate");
        }

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

        return items.map((task) => {
            const statusClass = getStatusClass(task.status);
            const dueState = getDueDateState(task.dueDate, task.status);
            const dueStyle = getDueDateStyle(dueState);
            const dueLabel = getDueDateLabel(dueState);

            return (
                <tr
                    key={task.id}
                    className="clickable-row"
                    onClick={() => navigate(`/tasks/${task.id}`)}
                >
                    <td className="task-title-cell">{task.title}</td>
                    <td>
                        <span className={statusClass}>{task.status}</span>
                    </td>
                    <td>
                        <span className={getPriorityClass(task.priority)}>{task.priority}</span>
                    </td>
                    <td>
                        <span className={getComplexityClass(task.complexity)}>{task.complexity}</span>
                    </td>
                    <td>{task.effortHours}</td>
                    <td>{task.weight ?? "-"}</td>
                    <td>{getUserDisplayName(task.assignedMember, task.assignedUserId)}</td>
                    <td>{formatDate(task.startDate)}</td>
                    <td>
                        <div
                            className={`task-due-box ${dueLabel ? "alert" : ""}`}
                            style={{
                                color: dueStyle.color,
                                background: dueStyle.background,
                                fontWeight: dueLabel ? 700 : 400,
                            }}
                        >
                            <span>{formatDate(task.dueDate)}</span>
                            {dueLabel ? <span className="task-due-label">{dueLabel}</span> : null}
                        </div>
                    </td>
                </tr>
            );
        });
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
                            <h2 className="task-page-title">My Tasks</h2>
                            <p className="task-page-subtitle">
                                Tasks assigned to you • {rangeLabel}
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
                            All
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
                                placeholder="Search your tasks..."
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
                    <div className="card-body">Loading your tasks...</div>
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