import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "../services";
const Context = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [config, setConfig] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      api("/auth/me")
        .then((d) => setUser(d.user))
        .catch((e) => {
          if (e.status !== 401)
            setError(
              "Cannot connect to the API. Start Express and MongoDB, then refresh.",
            );
        }),
      api("/config")
        .then(setConfig)
        .catch(() =>
          setError(
            "Cannot connect to the API. Start Express and MongoDB, then refresh.",
          ),
        ),
    ]).finally(() => setLoading(false));
  }, []);
  return (
    <Context.Provider value={{ user, setUser, loading, config, error }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
export function Guard({ children, admin = false }) {
  const { user, loading, error } = useAuth(),
    location = useLocation();
  if (loading) return <div className="loading">Connecting to PlateWatch…</div>;
  if (error)
    return (
      <div className="error-page">
        <h1>Connection unavailable</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== "admin")
    return (
      <div className="error-page">
        <h1>Administrator access required</h1>
        <p>Your account can recognise plates and inspect your own history.</p>
        <a href="/lookup">Open lookup</a>
      </div>
    );
  return children;
}
