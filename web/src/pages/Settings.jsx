import { useState } from "react";
import {
  Calendar,
  Check,
  CircleHelp,
  DollarSign,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  User,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, Button, Notice, PageHeading } from "../components";
import { useAuth, useToast } from "../hooks";

export default function Settings() {
  const { user, config, logout, refreshUser } = useAuth();
  const notify = useToast();
  const [activeTab, setActiveTab] = useState("profile");

  // Profile Form State
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Password Form State
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      const payload = { name };
      if (email !== user.email) {
        payload.email = email;
      }
      const result = await api(`/users/${user.id}`, {
        method: "PATCH",
        body: payload,
      });
      if (result.reauthenticate) {
        notify("Email updated. Please sign in with your new email.");
        logout();
        return;
      }
      await refreshUser();
      setProfileSuccess("Profile information saved successfully.");
      notify("Profile updated successfully.");
    } catch (err) {
      setProfileError(err.message || "Failed to update profile.");
    } finally {
      setProfileBusy(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    setPasswordError("");
    try {
      await api(`/users/${user.id}/password`, {
        method: "POST",
        body: { password },
      });
      notify("Password updated! Please sign in with your new password.");
      logout();
    } catch (err) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const userInitial = user?.name?.[0]?.toUpperCase() || "A";

  return (
    <div className="settings-page">
      <PageHeading
        eyebrow="WORKSPACE PREFERENCES"
        title="Settings"
        description="Manage your account profile, credentials, and shop workspace configurations."
      />

      <div className="settings-tabs-bar">
        <button
          type="button"
          className={`settings-tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <User size={16} />
          <span>Account Profile</span>
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${activeTab === "security" ? "active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <Lock size={16} />
          <span>Security & Password</span>
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${activeTab === "workspace" ? "active" : ""}`}
          onClick={() => setActiveTab("workspace")}
        >
          <Store size={16} />
          <span>Shop & Preferences</span>
        </button>
      </div>

      {activeTab === "profile" && (
        <div className="settings-content-grid">
          <section className="card settings-card">
            <div className="card-header">
              <div>
                <h2>Profile Information</h2>
                <p>Update your personal account details.</p>
              </div>
              <Badge tone={user?.role === "administrator" ? "green" : "amber"}>
                {user?.role}
              </Badge>
            </div>

            <div className="settings-card-body">
              <div className="settings-profile-badge">
                <span className="user-avatar large">{userInitial}</span>
                <div>
                  <strong>{user?.name || "Shop administrator"}</strong>
                  <small>{user?.email}</small>
                </div>
              </div>

              <form onSubmit={handleProfileUpdate} className="form-stack">
                {profileError && <div className="form-error">{profileError}</div>}
                {profileSuccess && (
                  <div className="notice green">
                    <Check size={16} />
                    <span>{profileSuccess}</span>
                  </div>
                )}

                <div className="form-grid">
                  <label>
                    Full Name
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label>
                    Email Address
                    <input
                      type="email"
                      required
                      maxLength={255}
                      value={email}
                      disabled={user?.role !== "administrator"}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                </div>

                <div className="form-actions-bar">
                  <Button type="submit" busy={profileBusy}>
                    <Save size={16} />
                    Save changes
                  </Button>
                </div>
              </form>
            </div>
          </section>

          <aside className="card settings-side-card">
            <div className="card-header">
              <div>
                <h2>Account Summary</h2>
                <p>Role and privilege overview.</p>
              </div>
              <ShieldCheck size={20} className="muted-icon" />
            </div>
            <div className="settings-card-body">
              <div className="summary-item">
                <small>Account ID</small>
                <code>{user?.id}</code>
              </div>
              <div className="summary-item">
                <small>Assigned Role</small>
                <strong>{user?.role === "administrator" ? "Administrator (Full access)" : "Operator (Store management)"}</strong>
              </div>
              <div className="summary-item">
                <small>Authentication</small>
                <span>Argon2ID token-based session</span>
              </div>
              {user?.role === "administrator" && (
                <div className="settings-action-box">
                  <p>Need to manage other staff accounts or operators?</p>
                  <Link className="button secondary full-width" to="/users">
                    <UsersRound size={16} />
                    Manage Users & Permissions
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {activeTab === "security" && (
        <div className="settings-content-grid single-column">
          <section className="card settings-card">
            <div className="card-header">
              <div>
                <h2>Change Password</h2>
                <p>Ensure your account is using a secure, strong password.</p>
              </div>
            </div>

            <div className="settings-card-body max-w-lg">
              <form onSubmit={handlePasswordUpdate} className="form-stack">
                {passwordError && <div className="form-error">{passwordError}</div>}

                <div className="password-field">
                  <label htmlFor="settings-pwd">New Password</label>
                  <div className="password-input">
                    <input
                      id="settings-pwd"
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
                  <label htmlFor="settings-confirm-pwd">Confirm New Password</label>
                  <div className="password-input">
                    <input
                      id="settings-confirm-pwd"
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
                  Password must be at least 8 characters. Resetting your password will invalidate existing session tokens and require signing back in.
                </p>

                <div className="form-actions-bar">
                  <Button type="submit" busy={passwordBusy}>
                    <KeyRound size={16} />
                    Update Password
                  </Button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {activeTab === "workspace" && (
        <div className="settings-content-grid">
          <section className="card settings-card">
            <div className="card-header">
              <div>
                <h2>Shop Workspace</h2>
                <p>General store setup and regional preferences.</p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="settings-properties-list">
                <div className="property-item">
                  <div className="property-icon">
                    <Store size={18} />
                  </div>
                  <div className="property-details">
                    <small>Shop Name</small>
                    <strong>little shop.</strong>
                  </div>
                </div>

                <div className="property-item">
                  <div className="property-icon">
                    <DollarSign size={18} />
                  </div>
                  <div className="property-details">
                    <small>Currency</small>
                    <strong>USD ($)</strong>
                  </div>
                </div>

                <div className="property-item">
                  <div className="property-icon">
                    <Globe size={18} />
                  </div>
                  <div className="property-details">
                    <small>Timezone</small>
                    <strong>Asia/Phnom Penh (UTC+07:00)</strong>
                  </div>
                </div>

                <div className="property-item">
                  <div className="property-icon">
                    <SlidersHorizontal size={18} />
                  </div>
                  <div className="property-details">
                    <small>Forecast Horizon</small>
                    <strong>7 Days Ahead (Next Day through +7d)</strong>
                  </div>
                </div>

                <div className="property-item">
                  <div className="property-icon">
                    <Calendar size={18} />
                  </div>
                  <div className="property-details">
                    <small>Environment Mode</small>
                    <div className="mode-badge-wrap">
                      <Badge tone={config?.mode === "demo" ? "amber" : "green"}>
                        {config?.mode || "production"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="card settings-side-card">
            <div className="card-header">
              <div>
                <h2>Documentation & APIs</h2>
                <p>System endpoints and data schema.</p>
              </div>
              <CircleHelp size={20} className="muted-icon" />
            </div>
            <div className="settings-card-body">
              <p className="settings-helper-text">
                Your shop API is powered by FastAPI and MySQL with Argon2 hashing and JWT token authorization.
              </p>
              <div className="api-links-box">
                <a
                  className="button secondary full-width"
                  href="http://127.0.0.1:8000/docs"
                  target="_blank"
                  rel="noreferrer"
                >
                  <CircleHelp size={16} />
                  Interactive API Docs (Swagger) ↗
                </a>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
