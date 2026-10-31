import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ChevronsUpDown,
  CircleHelp,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Sprout,
  Store,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./hooks";
import { Badge, Loading } from "./components";
import { day, today } from "./utils";

const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/products", "Products", Package],
  ["/sales", "Sales records", ClipboardList],
  ["/imports", "Import data", Upload],
  ["/training", "Model training", FlaskConical],
  ["/predictions", "Forecasts", BarChart3],
  ["/users", "Users", UsersRound],
];

export default function Layout() {
  const { user, ready, logout, config } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handlePointerDown = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  const title =
    navigation.find(([path]) => path === location.pathname)?.[1] ||
    (location.pathname === "/settings" ? "Settings" : "Workspace");
  const userInitial = user.name?.[0]?.toUpperCase() || "A";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <NavLink className="brand" to="/" onClick={() => setOpen(false)}>
          <span className="brand-icon">
            <Store size={24} strokeWidth={1.6} />
          </span>
          <span>
            little shop<span className="brand-dot">.</span>
            <small>SALES & A LITTLE FORESIGHT</small>
          </span>
        </NavLink>
        <button
          className="icon-button sidebar-close"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation
            .filter(
              ([path]) => path !== "/users" || user.role === "administrator",
            )
            .map(([path, label, Icon], index) => (
              <NavLink
                to={path}
                onClick={() => setOpen(false)}
                end={path === "/"}
                key={path}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""} ${index === 4 ? "nav-separated" : ""}`
                }
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{label}</span>
                {path === "/predictions" && (
                  <span className="nav-pill">7d</span>
                )}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sprout size={24} strokeWidth={1.4} />
            <strong>Small steps. Better decisions.</strong>
            <p>A little history helps you see what could come next.</p>
          </div>
          <a
            className="help-link"
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noreferrer"
          >
            <CircleHelp size={16} />
            API documentation
          </a>
          <div className="account-container" ref={accountMenuRef}>
            {accountMenuOpen && (
              <div
                className="account-popover"
                role="menu"
                aria-label="Account options"
              >
                <div className="account-popover-header">
                  <span className="user-avatar">{userInitial}</span>
                  <div className="account-popover-user">
                    <strong>{user.name || "Shop administrator"}</strong>
                    <small>{user.email}</small>
                  </div>
                </div>
                <div className="account-popover-divider" />
                <NavLink
                  to="/settings"
                  className="account-popover-item"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setOpen(false);
                  }}
                >
                  <Settings size={16} />
                  <span>Setting</span>
                </NavLink>
                <div className="account-popover-divider" />
                <button
                  type="button"
                  className="account-popover-item danger"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={16} />
                  <span>Log out</span>
                </button>
              </div>
            )}
            <button
              type="button"
              className={`account ${accountMenuOpen ? "active" : ""}`}
              onClick={() => setAccountMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              aria-label="Account menu"
            >
              <span className="user-avatar">{userInitial}</span>
              <span>
                <strong>{user.name || "Shop administrator"}</strong>
                <small>{user.email || user.role}</small>
              </span>
              <ChevronsUpDown size={15} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span> <strong>{title}</strong>
            </span>
          </div>
          <div className="topbar-right">
            {config?.mode === "demo" && <Badge tone="amber">Local demo</Badge>}
            <span className="today-label">
              {day(today(), { weekday: "short", year: "numeric" })}
            </span>
            <span className="user-avatar small">{userInitial}</span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </main>
        <footer className="app-footer">
          <span>Made for your next small step.</span>
          <span>USD · Asia/Phnom Penh</span>
        </footer>
      </div>
    </div>
  );
}
