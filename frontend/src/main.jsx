import React, { Component } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, Guard } from "./components/Auth";
import { Layout } from "./components/Layout";
import { Landing, AuthPage } from "./pages/Public";
import Lookup from "./pages/Lookup";
import { Result, History, Dashboard, Vehicles, Profile } from "./pages/Records";
import "./style.css";
class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="error-page">
        <h1>Something went wrong</h1>
        <p>Reload the page and try again.</p>
        <button onClick={() => window.location.assign("/")}>Go home</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage register />} />
            <Route
              element={
                <Guard>
                  <Layout />
                </Guard>
              }
            >
              <Route path="/lookup" element={<Lookup />} />
              <Route path="/result" element={<Result />} />
              <Route path="/history" element={<History />} />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/admin"
                element={
                  <Guard admin>
                    <Dashboard />
                  </Guard>
                }
              />
              <Route
                path="/admin/vehicles"
                element={
                  <Guard admin>
                    <Vehicles />
                  </Guard>
                }
              />
            </Route>
            <Route
              path="*"
              element={
                <div className="error-page">
                  <span className="eyebrow">404</span>
                  <h1>This road ends here.</h1>
                  <p>The page you requested could not be found.</p>
                  <Link className="button" to="/">
                    Return home
                  </Link>
                </div>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
