import { useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { getToken, getUser } from "../../../lib/auth";
import {
    getDashboardCharts,
    getDashboardSummary,
    getDashboardWorkloadDetails,
    getDashboardSummaryBreakdown,
    type DashboardRange,
} from "../api";
import type {
    DashboardCharts,
    DashboardSummary,
    DashboardSummaryBreakdown,
} from "../types";
import type { MemberWorkloadDetail, MemberWorkloadTask } from "../../members/types";

const emptySummary: DashboardSummary = {
    startDate: null,
    endDate: null,
    range: "this",
    totalTasks: 0,
    activeTasks: 0,
    doneTasks: 0,
    availableMembers: 0,
    moderateMembers: 0,
    overloadedMembers: 0,
    totalEffort: 0,
    totalWeight: 0,
};

const emptyCharts: DashboardCharts = {
    statusCounts: [],
    priorityCounts: [],
    workloadCounts: [],
    unassignedTasks: 0,
};

type DayWorkload = {
    label: string;
    date: string;
    count: number;
};

function parseDateOnly(value?: string | null): Date | null {
    if (!value) return null;

    const raw = value.slice(0, 10);
    const [year, month, day] = raw.split("-").map(Number);

    if (!year || !month || !day) return null;

    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getCurrentWeekValue(): string {
    const now = new Date();
    const firstThursday = new Date(now.getFullYear(), 0, 4);
    const firstMonday = new Date(firstThursday);

    firstMonday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7));

    const currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

    const diffDays = Math.round(
        (currentMonday.getTime() - firstMonday.getTime()) / 86400000
    );

    const week = Math.floor(diffDays / 7) + 1;

    return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getWeekDatesFromInput(weekValue: string): Date[] {
    const match = /^(\d{4})-W(\d{2})$/.exec(weekValue);

    if (!match) return [];

    const year = Number(match[1]);
    const week = Number(match[2]);

    const firstThursday = new Date(year, 0, 4);
    const firstMonday = new Date(firstThursday);

    firstMonday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7));

    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (week - 1) * 7);

    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        return date;
    });
}

function buildDailyWorkloadByWeek(
    members: MemberWorkloadDetail[],
    weekValue: string
): DayWorkload[] {
    const allTasks = members.flatMap((member) => member.tasks ?? []);
    const dates = getWeekDatesFromInput(weekValue);

    return dates.map((date) => {
        const key = formatDateKey(date);

        const count = allTasks.filter((task: MemberWorkloadTask) => {
            const dueDate = parseDateOnly(task.dueDate);
            return dueDate ? formatDateKey(dueDate) === key : false;
        }).length;

        return {
            date: key,
            label: date.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
            }),
            count,
        };
    });
}

function getRangeLabel(summary: DashboardSummary): string {
    if (summary.range === "all") return "All tasks";

    if (!summary.startDate || !summary.endDate) {
        return summary.range === "next" ? "Next week" : "This week";
    }

    return `${summary.startDate} - ${summary.endDate}`;
}

function getDayColor(count: number): string {
    if (count >= 6) return "#ef4444";
    if (count >= 3) return "#f59e0b";
    return "#22c55e";
}

function ChartTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{ value?: number | string; name?: string }>;
    label?: string;
}) {
    if (!active || !payload?.length) return null;

    return (
        <div className="custom-chart-tooltip">
            <p className="custom-chart-tooltip-title">{label}</p>
            <p className="custom-chart-tooltip-row">
                <span>count:</span> <strong>{payload[0]?.value ?? 0}</strong>
            </p>
        </div>
    );
}

function SummaryCard({
    title,
    value,
    onClick,
}: {
    title: string;
    value: number;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="summary-card dashboard-summary-card"
        >
            <p className="summary-label">{title}</p>
            <h3 className="summary-value">{value}</h3>
        </button>
    );
}

function SectionCard({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="card dashboard-chart-card dashboard-section-card dashboard-soft-card">
            <div className="card-body">
                <h3 className="card-title">{title}</h3>
                {children}
            </div>
        </div>
    );
}

function SimpleBarChart({ data }: { data: { label: string; count: number }[] }) {
    const safeData = data
        .map((item) => ({
            label: String(item.label ?? ""),
            count: Number(item.count) || 0,
        }))
        .filter((item) => item.label);

    if (safeData.length === 0) {
        return <p className="dashboard-card-muted">No chart data available.</p>;
    }

    return (
        <div className="dashboard-chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={safeData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                        cursor={{ fill: "rgba(96, 165, 250, 0.12)" }}
                        content={<ChartTooltip />}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="#60a5fa" barSize={38}>
                        <LabelList dataKey="count" position="top" />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function DailyWorkloadChart({ data }: { data: DayWorkload[] }) {
    if (data.length === 0) {
        return <p className="dashboard-card-muted">No daily workload data available.</p>;
    }

    return (
        <div className="dashboard-chart-wrap daily-workload-chart-wrap">
            <ResponsiveContainer width="100%" height={360}>
                <BarChart data={data} margin={{ top: 24, right: 16, left: -8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                        cursor={{ fill: "rgba(96, 165, 250, 0.12)" }}
                        content={<ChartTooltip />}
                    />
                    <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={58}>
                        {data.map((item) => (
                            <Cell key={item.date} fill={getDayColor(item.count)} />
                        ))}
                        <LabelList dataKey="count" position="top" />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const user = getUser();
    const token = getToken();

    const [range, setRange] = useState<DashboardRange>("this");
    const [selectedWeek, setSelectedWeek] = useState<string>(() => getCurrentWeekValue());
    const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
    const [charts, setCharts] = useState<DashboardCharts>(emptyCharts);
    const [workloadDetailsAll, setWorkloadDetailsAll] = useState<MemberWorkloadDetail[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    const [breakdown, setBreakdown] = useState<DashboardSummaryBreakdown | null>(null);
    const [breakdownType, setBreakdownType] = useState<"effort" | "weight" | null>(null);
    const [isBreakdownLoading, setIsBreakdownLoading] = useState<boolean>(false);
    const [breakdownError, setBreakdownError] = useState<string>("");

    const dailyWorkload = useMemo(
        () => buildDailyWorkloadByWeek(workloadDetailsAll, selectedWeek),
        [workloadDetailsAll, selectedWeek]
    );

    const rangeLabel = useMemo(() => getRangeLabel(summary), [summary]);

    function buildTaskLink(base: string) {
        const params = new URLSearchParams(base);
        params.set("range", range);
        return `/tasks?${params.toString()}`;
    }

    function buildMembersLink(workload: "available" | "moderate" | "overloaded") {
        const params = new URLSearchParams();
        params.set("workload", workload);
        params.set("range", range);
        return `/members?${params.toString()}`;
    }

    async function openBreakdown(type: "effort" | "weight"): Promise<void> {
        setBreakdownType(type);
        setBreakdown(null);
        setBreakdownError("");
        setIsBreakdownLoading(true);

        try {
            const data = await getDashboardSummaryBreakdown(range);
            setBreakdown(data);
        } catch (err: unknown) {
            let message = "Could not load breakdown.";

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

            setBreakdownError(message);
        } finally {
            setIsBreakdownLoading(false);
        }
    }

    function closeBreakdown(): void {
        setBreakdown(null);
        setBreakdownType(null);
        setBreakdownError("");
    }

    useEffect(() => {
        async function loadDashboard(): Promise<void> {
            setIsLoading(true);
            setError("");
            setSummary({ ...emptySummary, range });
            setCharts(emptyCharts);
            setWorkloadDetailsAll([]);

            try {
                const [summaryData, chartsData, workloadDataAll] = await Promise.all([
                    getDashboardSummary(range),
                    getDashboardCharts(range),
                    getDashboardWorkloadDetails("all"),
                ]);

                setSummary(summaryData);
                setCharts(chartsData);
                setWorkloadDetailsAll(Array.isArray(workloadDataAll) ? workloadDataAll : []);
            } catch (err: unknown) {
                let message = "Could not load dashboard data.";

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

        void loadDashboard();
    }, [range, token]);

    return (
        <div className="page-stack">
            <div className="card dashboard-header-card dashboard-hero-glass">
                <div className="card-body">
                    <h2 className="dashboard-title">Dashboard</h2>
                    <p className="dashboard-subtitle">{rangeLabel}</p>

                    <div className="dashboard-filter-group">
                        <button
                            type="button"
                            onClick={() => setRange("all")}
                            className={`dashboard-filter-button ${range === "all" ? "active" : ""}`}
                        >
                            All Tasks
                        </button>

                        <button
                            type="button"
                            onClick={() => setRange("this")}
                            className={`dashboard-filter-button ${range === "this" ? "active" : ""}`}
                        >
                            This Week
                        </button>

                        <button
                            type="button"
                            onClick={() => setRange("next")}
                            className={`dashboard-filter-button ${range === "next" ? "active" : ""}`}
                        >
                            Next Week
                        </button>
                    </div>

                    <div className="dashboard-meta compact">
                        <p>
                            <strong>User:</strong> {user?.displayName || "Not found"}
                        </p>
                        <p>
                            <strong>Email:</strong> {user?.email || "Not found"}
                        </p>
                        <p>
                            <strong>Roles:</strong> {user?.roles?.join(", ") || "None"}
                        </p>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="dashboard-loading-card">
                    <div className="card-body">Loading dashboard...</div>
                </div>
            ) : error ? (
                <div className="error-box">
                    <div className="card-body">{error}</div>
                </div>
            ) : (
                <>
                    <div className="summary-grid">
                        <SummaryCard
                            title="Total Tasks"
                            value={summary.totalTasks}
                            onClick={() => navigate(buildTaskLink(""))}
                        />
                        <SummaryCard
                            title="Active Tasks"
                            value={summary.activeTasks}
                            onClick={() => navigate(buildTaskLink("status=active"))}
                        />
                        <SummaryCard
                            title="Done Tasks"
                            value={summary.doneTasks}
                            onClick={() => navigate(buildTaskLink("status=done"))}
                        />
                        <SummaryCard
                            title="Available Members"
                            value={summary.availableMembers}
                            onClick={() => navigate(buildMembersLink("available"))}
                        />
                        <SummaryCard
                            title="Moderate Members"
                            value={summary.moderateMembers}
                            onClick={() => navigate(buildMembersLink("moderate"))}
                        />
                        <SummaryCard
                            title="Overloaded Members"
                            value={summary.overloadedMembers}
                            onClick={() => navigate(buildMembersLink("overloaded"))}
                        />
                        <SummaryCard
                            title="Total Effort"
                            value={summary.totalEffort ?? 0}
                            onClick={() => void openBreakdown("effort")}
                        />
                        <SummaryCard
                            title="Total Weight"
                            value={summary.totalWeight ?? 0}
                            onClick={() => void openBreakdown("weight")}
                        />
                    </div>

                    <div className="section-grid compact">
                        <SectionCard title="Task Status">
                            <SimpleBarChart data={charts.statusCounts} />
                        </SectionCard>

                        <SectionCard title="Task Priority">
                            <SimpleBarChart data={charts.priorityCounts} />
                        </SectionCard>

                        <SectionCard title="Workload Status">
                            <SimpleBarChart data={charts.workloadCounts} />
                        </SectionCard>

                        <SectionCard title="Unassigned Tasks">
                            <p className="dashboard-number-highlight">{charts.unassignedTasks}</p>
                            <p className="dashboard-card-muted">Tasks without an assigned member.</p>
                        </SectionCard>
                    </div>

                    <div className="card dashboard-chart-card dashboard-section-card dashboard-soft-card">
                        <div className="card-body">
                            <div className="dashboard-member-list-top">
                                <div>
                                    <h3 className="card-title">Daily Workload Distribution</h3>
                                    <p className="dashboard-card-muted">
                                        Pick a week. Green = light, orange = moderate, red = packed.
                                    </p>
                                </div>

                                <div className="daily-range-picker">
                                    <label>
                                        Week
                                        <input
                                            type="week"
                                            className="input"
                                            value={selectedWeek}
                                            onChange={(event) => setSelectedWeek(event.target.value)}
                                        />
                                    </label>
                                </div>
                            </div>

                            <DailyWorkloadChart data={dailyWorkload} />
                        </div>
                    </div>
                </>
            )}

            {breakdownType ? (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                    <div className="modal-card breakdown-modal-card">
                        <div className="modal-header">
                            <div>
                                <h3 className="card-title">
                                    {breakdownType === "effort"
                                        ? "Total Effort Breakdown"
                                        : "Total Weight Breakdown"}
                                </h3>
                                <p className="dashboard-card-muted">
                                    {breakdownType === "effort"
                                        ? "Total Effort = Sum of EffortHours."
                                        : "Total Weight = Sum of EffortHours × PriorityMultiplier × ComplexityMultiplier."}
                                </p>
                            </div>

                            <button type="button" className="button-secondary" onClick={closeBreakdown}>
                                Close
                            </button>
                        </div>

                        {isBreakdownLoading ? (
                            <p className="dashboard-card-muted">Loading breakdown...</p>
                        ) : breakdownError ? (
                            <div className="error-box">
                                <div className="card-body">{breakdownError}</div>
                            </div>
                        ) : breakdown ? (
                            <div className="table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Task</th>
                                            <th>Effort</th>
                                            <th>Priority</th>
                                            <th>Priority Mult.</th>
                                            <th>Complexity</th>
                                            <th>Complexity Mult.</th>
                                            <th>Formula</th>
                                            <th>Weight</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {breakdown.tasks.length === 0 ? (
                                            <tr>
                                                <td colSpan={8}>No tasks found for this range.</td>
                                            </tr>
                                        ) : (
                                            breakdown.tasks.map((task) => (
                                                <tr key={task.taskId ?? task.title}>
                                                    <td>{task.title}</td>
                                                    <td>{task.effortHours}</td>
                                                    <td>{task.priority}</td>
                                                    <td>{task.priorityMultiplier}</td>
                                                    <td>{task.complexity}</td>
                                                    <td>{task.complexityMultiplier}</td>
                                                    <td>{task.formula}</td>
                                                    <td>{task.weight}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}