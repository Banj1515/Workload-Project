import { Link } from "react-router-dom";

export default function NotFoundPage() {
    return (
        <div className="card not-found-card">
            <div className="card-body">
                <p className="not-found-code">404</p>
                <h2 className="not-found-title">Page not found</h2>
                <p className="not-found-subtitle">
                    The page you tried to open does not exist.
                </p>

                <div className="not-found-actions">
                    <Link to="/dashboard" className="button">
                        Go to Dashboard
                    </Link>
                    <Link to="/" className="button-secondary">
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
