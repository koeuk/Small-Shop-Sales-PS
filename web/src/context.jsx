import { useEffect, useState } from "react";
import { AuthContext, ToastContext } from "./contexts";
import { api, clearSession, getSession, saveSession, updateSessionUser } from "./api";
import { CheckCircle2, X, AlertCircle } from "lucide-react";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSession()?.user || null);
  const [ready, setReady] = useState(!getSession());
  const [expired, setExpired] = useState(false);
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api("/config", { publicRequest: true })
      .then((value) => {
        if (active) {
          setConfig(value);
          setConfigError("");
        }
      })
      .catch((error) => {
        if (active) setConfigError(error.message);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    let active = true;
    if (getSession())
      api("/auth/me")
        .then((profile) => {
          if (active) { setUser(profile); updateSessionUser(profile); }
        })
        .catch(() => {
          if (active) {
            clearSession();
            setUser(null);
          }
        })
        .finally(() => {
          if (active) setReady(true);
        });
    const expire = () => {
      setUser(null);
      setReady(true);
      setExpired(true);
    };
    window.addEventListener("session-expired", expire);
    return () => {
      active = false;
      window.removeEventListener("session-expired", expire);
    };
  }, []);
  const login = async (email, password) => {
    const session = await api("/auth/login", {
      method: "POST",
      body: { email, password },
      publicRequest: true,
    });
    saveSession(session);
    setUser(session.user);
    setExpired(false);
    setReady(true);
  };
  const logout = () => {
    clearSession();
    setUser(null);
  };
  const refreshUser = async () => {
    const profile = await api("/auth/me");
    setUser(profile);
    updateSessionUser(profile);
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        config,
        configError,
        expired,
        login,
        logout,
        refreshUser,
        retryConfig: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = (id) =>
    setToasts((items) => items.filter((item) => item.id !== id));
  const notify = (message, type = "success") => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items.slice(-3), { id, message, type }]);
    setTimeout(() => dismiss(id), 6000);
  };
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((item) => (
          <div className={`toast ${item.type}`} key={item.id}>
            {item.type === "error" ? (
              <AlertCircle size={19} />
            ) : (
              <CheckCircle2 size={19} />
            )}
            <span>{item.message}</span>
            <button
              className="icon-button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
