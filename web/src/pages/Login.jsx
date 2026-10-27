import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Sprout, Store } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks";
import { Button, Notice } from "../components";

export default function Login() {
  const { user, config, configError, expired, login, retryConfig } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Navigate to="/" replace />;
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand light">
          <span className="brand-icon">
            <Store size={26} />
          </span>
          <span>
            little shop<span className="brand-dot">.</span>
            <small>SALES & A LITTLE FORESIGHT</small>
          </span>
        </div>
        <div className="login-story-copy">
          <span className="story-tag">
            <Sprout size={16} /> A clearer tomorrow starts here
          </span>
          <h1>
            Big possibilities.
            <br />
            <em>Little shop.</em>
          </h1>
          <p>
            Know your sales. Find the patterns.
            <br />
            Make a little more room for what comes next.
          </p>
          <div className="story-chart" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="story-chart-label">
            <span>A little history</span>
            <span>A little foresight ↗</span>
          </div>
        </div>
        <span className="story-footer">
          Thoughtful tools for the everyday shopkeeper.
        </span>
      </section>
      <section className="login-form-side">
        <form className="login-form" onSubmit={submit}>
          <div className="login-lock">
            <LockKeyhole size={22} />
          </div>
          <p className="eyebrow">YOUR SHOP, AT A GLANCE</p>
          <h2>Welcome back.</h2>
          <p>Sign in to your shop workspace.</p>
          {expired && (
            <Notice>Your session has ended. Please sign in again.</Notice>
          )}
          {configError && (
            <Notice>
              {configError}{" "}
              <button
                type="button"
                className="inline-button"
                onClick={retryConfig}
              >
                Retry connection
              </button>
            </Notice>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@yourshop.com"
            />
          </label>
          <div className="password-field">
            <label htmlFor="login-password">Password</label>
            <div className="password-input">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="icon-button password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-controls="login-password"
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <Button type="submit" busy={busy} disabled={!config}>
            Sign in to your shop
            <ArrowRight size={17} />
          </Button>
          {config?.mode === "demo" && (
            <div className="demo-login">
              <strong>A little look around?</strong>
              <p>This local demo uses persistent storage on your computer.</p>
              {config.default_demo_password ? (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setEmail(config.demo_email);
                    setPassword("shopdemo2026");
                  }}
                >
                  Fill demo credentials
                  <ArrowRight size={15} />
                </button>
              ) : (
                <p>Use the demo credentials from your backend configuration.</p>
              )}
            </div>
          )}
          <small className="login-footnote">
            One shop. One workspace. A clearer view.
          </small>
        </form>
      </section>
    </div>
  );
}
