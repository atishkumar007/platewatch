import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import {
  ScanLine,
  History,
  LayoutDashboard,
  CarFront,
  UserRound,
  LogOut,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "./Auth";
import { post } from "../services";
export function Logo() {
  return (
    <Link className="brand" to="/">
      <span className="logo-mark">
        <ScanLine size={22} />
      </span>
      PlateWatch<span className="green">.</span>
    </Link>
  );
}
export function Layout() {
  const { user, setUser, config } = useAuth(),
    navigate = useNavigate();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <div className="workspace-label">VEHICLE INTELLIGENCE</div>
        <nav>
          <NavLink to="/lookup">
            <ScanLine size={18} />
            Recognition & lookup
          </NavLink>
          <NavLink to="/history">
            <History size={18} />
            Recognition history
          </NavLink>
          {user.role === "admin" && (
            <>
              <div className="nav-label">ADMINISTRATION</div>
              <NavLink to="/admin" end>
                <LayoutDashboard size={18} />
                Overview
              </NavLink>
              <NavLink to="/admin/vehicles">
                <CarFront size={18} />
                Vehicle registry
              </NavLink>
            </>
          )}
          <NavLink to="/profile">
            <UserRound size={18} />
            My profile
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="secure-label">
            <ShieldCheck size={15} /> LOCAL DATABASE FIRST
          </div>
          <Link to="/profile" className="account">
            <div className="avatar">{user.name[0]?.toUpperCase()}</div>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
          </Link>
          <button
            className="text-button"
            onClick={async () => {
              try {
                await post("/auth/logout", {});
                setUser(null);
                navigate("/login");
              } catch (e) {
                alert(e.message);
              }
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="app-body">
        <div className="topbar">
          <span>
            <span className="status-dot" /> Application records ·{" "}
            {config?.officialLookupConfigured
              ? "Provider configured"
              : "Official lookup not configured"}
          </span>
          <Link to="/" className="text-link">
            Project home <ArrowUpRight size={14} />
          </Link>
        </div>
        <main className="content">
          <Outlet />
        </main>
        <footer>
          PlateWatch · Academic project · Authorization is separate from
          registration, challan and police status.
        </footer>
      </div>
    </div>
  );
}
export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Badge({ children, status }) {
  return (
    <span
      className={"badge " + (status || children || "").replaceAll(" ", "_")}
    >
      {children || status}
    </span>
  );
}
export function Notice({ children, type = "info" }) {
  return children ? (
    <div role="status" className={"notice " + type}>
      {children}
    </div>
  ) : null;
}
export function Empty({ children }) {
  return (
    <div className="empty-state">
      <ScanLine size={30} />
      <p>{children}</p>
    </div>
  );
}
