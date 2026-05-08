import { Route, Routes, useLocation } from "react-router-dom";
import LoginPage from "./features/auth/pages/LoginPage";
import DashboardPage from "./features/dashboard/pages/DashboardPage";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import TaskListPage from "./features/tasks/pages/TaskListPage";
import TaskDetailPage from "./features/tasks/pages/TaskDetailPage";
import TaskFormPage from "./features/tasks/pages/TaskFormPage";
import MemberListPage from "./features/members/pages/MemberListPage";
import MemberDetailPage from "./features/members/pages/MemberDetailPage";
import ChangeRequestsPage from "./features/ChangeRequests/pages/ChangeRequestsPage";
import NotFoundPage from "./components/routing/NotFoundPage";
import AccessDeniedPage from "./components/routing/AccessDeniedPage";
import AppNavLink from "./components/navigation/AppNavLink";
import MyTasksPage from "./features/tasks/pages/MyTasksPage";
import { clearAuth, getToken } from "./lib/auth";
import { logout } from "./features/auth/api";
import TeamListPage from "./features/teams/pages/TeamListPage";
import TeamFormPage from "./features/teams/pages/TeamFormPage";

export default function App() {
    useLocation();

    const token = getToken();

    async function handleLogout() {
        try {
            await logout();
        } catch {//qqq
        }

        clearAuth();
        window.location.replace("/");
    }

    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="app-header-inner">
                    <div className="app-header-left">
                        {token ? (
                            <button
                                type="button"
                                className="button-danger app-logout-button"
                                onClick={handleLogout}
                            >
                                Logout
                            </button>
                        ) : null}

                        <h1 className="app-brand">Team Workload Command Center</h1>
                    </div>
                    <AppNavLink to="/teams">Teams</AppNavLink>
                    <nav className="app-nav">
                        {!token ? (
                            <AppNavLink to="/" end>
                                Login
                            </AppNavLink>
                        ) : (
                            <>
                                <AppNavLink to="/dashboard">Dashboard</AppNavLink>
                                <AppNavLink to="/tasks">Tasks</AppNavLink>
                                <AppNavLink to="/my-tasks">My Tasks</AppNavLink>
                                <AppNavLink to="/members">Members</AppNavLink>
                                <AppNavLink to="/change-requests">Change Requests</AppNavLink>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            <main className="page-container">
                <Routes>
                    <Route path="/" element={<LoginPage />} />

                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={["Admin", "Team Leader"]}>
                                <DashboardPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/tasks"
                        element={
                            <ProtectedRoute>
                                <TaskListPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/my-tasks"
                        element={
                            <ProtectedRoute>
                                <MyTasksPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/tasks/new"
                        element={
                            <ProtectedRoute allowedRoles={["Admin", "Team Leader"]}>
                                <TaskFormPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/tasks/:id"
                        element={
                            <ProtectedRoute>
                                <TaskDetailPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/tasks/:id/edit"
                        element={
                            <ProtectedRoute allowedRoles={["Admin", "Team Leader"]}>
                                <TaskFormPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/members"
                        element={
                            <ProtectedRoute allowedRoles={["Admin", "Team Leader"]}>
                                <MemberListPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/members/:id"
                        element={
                            <ProtectedRoute allowedRoles={["Admin", "Team Leader"]}>
                                <MemberDetailPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/change-requests"
                        element={
                            <ProtectedRoute allowedRoles={["Admin", "Team Leader"]}>
                                <ChangeRequestsPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/access-denied"
                        element={
                            <ProtectedRoute>
                                <AccessDeniedPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route path="*" element={<NotFoundPage />} />
                    <Route
                        path="/teams"
                        element={
                            <ProtectedRoute allowedRoles={["Admin", "Team Leader"]}>
                                <TeamListPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/teams/new"
                        element={
                            <ProtectedRoute allowedRoles={["Admin", "Team Leader"]}>
                                <TeamFormPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/teams/:id/edit"
                        element={
                            <ProtectedRoute allowedRoles={["Admin", "Team Leader"]}>
                                <TeamFormPage />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </main>
        </div>
    );
}