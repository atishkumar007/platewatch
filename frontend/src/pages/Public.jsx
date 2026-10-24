import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ScanLine,
  ArrowRight,
  Camera,
  Database,
  ShieldCheck,
  Check,
  CarFront,
} from "lucide-react";
import { Logo, Notice } from "../components/Layout";
import { useAuth } from "../components/Auth";
import { post } from "../services";
export function Landing() {
  const { user } = useAuth();
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <div>
          <a href="#workflow">How it works</a>
          <Link className="button secondary" to={user ? "/lookup" : "/login"}>
            {user ? "Open workspace" : "Sign in"}
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" /> AI-POWERED VEHICLE AUTHORIZATION
            </div>
            <h1>
              A clearer view of
              <br />
              every <span>arrival.</span>
            </h1>
            <p>
              Read a number plate. Confirm the registration. Find the vehicle in
              your own records—all from a camera you already have.
            </p>
            <div className="hero-actions">
              <Link className="button" to={user ? "/lookup" : "/login"}>
                Open recognition station
                <ArrowRight size={18} />
              </Link>
              <a className="text-link" href="#workflow">
                Explore the workflow ↗
              </a>
            </div>
            <div className="hero-notes">
              <span>
                <Check size={15} /> No dedicated hardware
              </span>
              <span>
                <Check size={15} /> Local lookup without API keys
              </span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="Illustration of a number plate detection, not a live recognition result"
          >
            <div className="visual-head">
              <span>
                <span className="status-dot" /> CAPTURE → CONFIRM → LOOKUP
              </span>
              <span>ILLUSTRATION</span>
            </div>
            <div className="road-art">
              <div className="road-stripe" />
              <CarFront className="car-art" strokeWidth={0.7} />
              <div className="detection-bracket">
                <div className="sample-plate">PB 10 AB 1234</div>
                <span>EXAMPLE PLATE · NOT LIVE DATA</span>
              </div>
            </div>
            <div className="visual-foot">
              <ScanLine size={20} />
              <div>
                <strong>Every reading gets a review.</strong>
                <p>Confirm or correct OCR before searching.</p>
              </div>
              <ShieldCheck size={22} />
            </div>
          </div>
        </section>
        <section className="workflow" id="workflow">
          <div className="section-title">
            <div className="eyebrow">ONE CONNECTED WORKFLOW</div>
            <h2>From a frame to a useful record.</h2>
          </div>
          <div className="feature-grid">
            {[
              [
                Camera,
                "01",
                "Capture your way",
                "Upload a photo, take a phone picture or use your laptop webcam.",
              ],
              [
                ScanLine,
                "02",
                "Recognise and review",
                "YOLO locates the plate. OCR reads the characters. You confirm the result.",
              ],
              [
                Database,
                "03",
                "Check your records",
                "Search MongoDB first and see a clearly labelled authorization result.",
              ],
            ].map(([Icon, n, t, d]) => (
              <article key={n}>
                <span className="step">{n}</span>
                <Icon size={26} />
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="honesty">
          <ShieldCheck size={28} />
          <div>
            <h3>Useful records. Clear boundaries.</h3>
            <p>
              Local authorisation does not prove registration validity or a
              vehicle's challan or criminal status. Official lookup runs only
              with an approved, configured provider.
            </p>
          </div>
        </section>
      </main>
      <footer>
        PlateWatch · React / Express / MongoDB / Python · Built for academic
        demonstration.
      </footer>
    </div>
  );
}
export function AuthPage({ register = false }) {
  const { setUser, config, error: connectionError } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const d = await post(register ? "/auth/register" : "/auth/login", data);
      setUser(d.user);
      navigate(location.state?.from || "/lookup");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-intro">
        <Logo />
        <div>
          <div className="eyebrow">YOUR VEHICLE WORKSPACE</div>
          <h1>
            See the plate.
            <br />
            Know the record.
          </h1>
          <p>
            A connected workspace for image recognition, local vehicle lookup
            and access management.
          </p>
        </div>
        <small>AI assists the reading. You confirm the identity.</small>
      </div>
      <div className="auth-main">
        <form className="auth-card" onSubmit={submit}>
          <span className="eyebrow">
            {register ? "GET STARTED" : "WELCOME BACK"}
          </span>
          <h2>{register ? "Create your account" : "Sign in to PlateWatch"}</h2>
          <p>
            {register
              ? "User accounts can perform lookups and view their own history."
              : "Enter your project account details to continue."}
          </p>
          <Notice type="error">{error || connectionError}</Notice>
          {register && config?.publicRegistration === false ? (
            <Notice>
              Public registration is disabled. Ask your project administrator
              for access.
            </Notice>
          ) : (
            <>
              {register && (
                <label>
                  Full name
                  <input
                    name="name"
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    required
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                />
                {register && <small>Use at least 12 characters.</small>}
              </label>
              <button className="wide" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create account"
                    : "Sign in"}
                <ArrowRight size={16} />
              </button>
            </>
          )}
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to the project?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <Link className="text-link" to="/">
            ← Project home
          </Link>
        </form>
      </div>
    </div>
  );
}
