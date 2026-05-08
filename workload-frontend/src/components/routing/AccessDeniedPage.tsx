import { Link, useLocation } from "react-router-dom";

export default function AccessDeniedPage() {
    const location = useLocation();
    const from =
        location.state &&
            typeof location.state === "object" &&
            "from" in location.state &&
            typeof location.state.from === "string"
            ? location.state.from
            : null;

    return (
        <div className="card not-found-card">
            <div className="card-body">
                <p className="not-found-code">403</p>
                <h2 className="not-found-title">Access Denied</h2>
                <p className="not-found-subtitle">
                    You do not have permission to open this page
                    {from ? `: ${from}` : "."}
                </p>

                <div className="not-found-actions">
                    <Link to="/tasks" className="button">
                        Go to Tasks
                    </Link>
                    <Link to="/my-tasks" className="button-secondary">
                        Go to My Tasks
                    </Link>
                </div>
            </div>
        </div>
    );
}