import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ChevronsUpDown,
  CircleHelp,
  ClipboardList,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
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
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useToast } from "./hooks";
import { Badge, Button, Loading, Modal } from "./components";
import { day, today } from "./utils";
import { api } from "./api";

const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/products", "Products", Package],
  ["/sales", "Sales records", ClipboardList],
  ["/imports", "Import data", Upload],
  ["/training", "Model training", FlaskConical],
  ["/predictions", "Forecasts", BarChart3],
  ["/users", "Users", UsersRound],
];

function SettingsModal({ user, config, onClose, onLogout }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notify = useToast();
  const navigate = useNavigate();

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/users/${user.id}/password`, {
        method: "POST",
        body: { password },
      });
      notify("Password updated! Please sign in again with your new password.");
      onClose();
      onLogout();
    } catch (err) {
      setError(err.message || "Failed to update password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Settings"
      description="Manage your account profile, security, and workspace preferences."
      onClose={onClose}
    >
      <div className="settings-modal-body">
        <section className="settings-section">
          <h3>Account Profile</h3>
          <div className="settings-profile-card">
            <span className="user-avatar large">
              {user.name?.[0]?.toUpperCase() || "A"}
            </span>
            <div className="settings-profile-info">
              <strong>{user.name || "Shop administrator"}</strong>
              <small>{user.email}</small>
              <div className="settings-badge-row">
                <Badge tone={user.role === "administrator" ? "green" : "amber"}>
                  {user.role}
                </Badge>
                {config?.mode === "demo" && <Badge tone="amber">Demo</Badge>}
              </div>
            </div>
          </div>
        </section>

        {user.role === "administrator" && (
          <section className="settings-section">
            <div className="settings-section-header">
              <div>
                <h3>Team & Users</h3>
                <p>Manage accounts, assign roles, and control shop access.</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigate("/users");
                }}
              >
                <UsersRound size={15} />
                Open Users
              </Button>
            </div>
          </section>
        )}

        <section className="settings-section">
          <h3>Change Password</h3>
          <form onSubmit={handlePasswordReset} className="settings-form">
            {error && <div className="form-error">{error}</div>}
            <div className="password-field">
              <label htmlFor="settings-new-password">New password</label>
              <div className="password-input">
                <input
                  id="settings-new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={256}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="password-field">
              <label htmlFor="settings-confirm-password">Confirm new password</label>
              <div className="password-input">
                <input
                  id="settings-confirm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={256}
                  autoComplete="new-password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <p className="form-hint">
              Resetting your password will require you to sign in again.
            </p>
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                <KeyRound size={15} />
                Update password
              </Button>
            </div>
          </form>
        </section>

        <section className="settings-section">
          <h3>Workspace Information</h3>
          <div className="settings-info-grid">
            <div>
              <small>Shop Name</small>
              <strong>little shop.</strong>
            </div>
            <div>
              <small>System Mode</small>
              <strong>{config?.mode || "production"}</strong>
            </div>
            <div>
              <small>Timezone</small>
              <strong>Asia/Phnom Penh (UTC+7)</strong>
            </div>
            <div>
              <small>Currency</small>
              <strong>USD ($)</strong>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}

export default function Layout() {
  const { user, ready, logout, config } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    navigation.find(([path]) => path === location.pathname)?.[1] || "Workspace";
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
                <button
                  type="button"
                  className="account-popover-item"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                >
                  <Settings size={16} />
                  <span>Setting</span>
                </button>
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
      {settingsOpen && (
        <SettingsModal
          user={user}
          config={config}
          onClose={() => setSettingsOpen(false)}
          onLogout={logout}
        />
      )}
    </div>
  );
}
