import {
    NavLink,
    type NavLinkProps,
    type To,
} from "react-router-dom";

type AppNavLinkProps = {
    to: To;
    children: React.ReactNode;
    end?: boolean;
};

export default function AppNavLink({
    to,
    children,
    end,
}: AppNavLinkProps) {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                `app-nav-link${isActive ? " active" : ""}`
            }
        >
            {children}
        </NavLink>
    );
}

