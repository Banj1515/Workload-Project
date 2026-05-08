import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getToken, getUser } from "../../lib/auth";

type ProtectedRouteProps = {
    children: ReactNode;
    allowedRoles?: string[];
};

export default function ProtectedRoute({
    children,
    allowedRoles,
}: ProtectedRouteProps) {
    const location = useLocation();
    const token = getToken();
    const user = getUser();

    if (!token) {
        return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }

    if (
        allowedRoles &&
        allowedRoles.length > 0 &&
        !allowedRoles.some((role) => user?.roles?.includes(role))
    ) {
        return <Navigate to="/tasks" replace />;
    }

    return <>{children}</>;
}