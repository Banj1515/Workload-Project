import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { login } from "../api";
import { getToken, saveAuth } from "../../../lib/auth";

export default function LoginPage() {
    const navigate = useNavigate();
    const existingToken = getToken();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (existingToken) {
        return <Navigate to="/dashboard" replace />;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            const response = await login({ email, password });
            saveAuth(response.token, response.user);
            navigate("/dashboard", { replace: true });
        } catch (err: unknown) {
            let message = "Login failed. Check your email, password, backend URL, or CORS settings.";

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
            setIsSubmitting(false);
        }
    }

    return (
        <div className="login-page-shell">
            <div className="card login-card">
                <div className="card-body">
                    <p className="login-eyebrow">Secure Access</p>
                    <h2 className="login-title">Login</h2>
                    <p className="login-subtitle">Sign in to continue.</p>

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="form-field">
                            <label className="login-label" htmlFor="email">
                                Email
                            </label>
                            <input
                                id="email"
                                className="input"
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                autoComplete="email"
                            />
                        </div>

                        <div className="form-field">
                            <label className="login-label" htmlFor="password">
                                Password
                            </label>
                            <input
                                id="password"
                                className="input"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="current-password"
                            />
                        </div>

                        {error ? (
                            <div className="error-box">
                                <div className="card-body">{error}</div>
                            </div>
                        ) : null}

                        <div className="login-actions">
                            <button
                                type="submit"
                                className="button login-primary-button"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Signing in..." : "Login"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}