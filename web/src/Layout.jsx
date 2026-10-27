import { useEffect, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Sprout,
  Store,
  Upload,
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
];

export default function Layout() {
  const { user, ready, logout, config } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  const title =
    navigation.find(([path]) => path === location.pathname)?.[1] || "Workspace";
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
        <div className="shop-switch">
          <span className="shop-avatar">LS</span>
          <div>
            <strong>My little shop</strong>
            <small>Single shop workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map(([path, label, Icon], index) => (
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
              {path === "/predictions" && <span className="nav-pill">7d</span>}
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
          <button className="account" onClick={logout}>
            <span className="user-avatar">A</span>
            <span>
              <strong>Shop administrator</strong>
              <small>Sign out of workspace</small>
            </span>
            <LogOut size={17} />
          </button>
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
            <span className="user-avatar small">A</span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Made for your next small step.</span>
          <span>USD · Asia/Phnom Penh</span>
        </footer>
      </div>
    </div>
  );
}
