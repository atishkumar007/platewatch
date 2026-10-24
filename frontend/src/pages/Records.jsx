import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CarFront,
  Database,
  Search,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  Activity,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { PageHeading, Notice, Badge, Empty } from "../components/Layout";
import { api, when } from "../services";
import { useAuth } from "../components/Auth";

export function Result() {
  const { state: d } = useLocation();
  if (!d)
    return (
      <>
        <PageHeading
          eyebrow="VEHICLE LOOKUP"
          title="Start with a registration"
          description="Run a lookup to see a vehicle record here."
        />
        <Link className="button" to="/lookup">
          Open recognition station
        </Link>
      </>
    );
  const v = d.vehicle;
  return (
    <>
      <PageHeading
        eyebrow="LOOKUP RESULT"
        title={d.registrationNumber}
        description="Source-labelled vehicle information from your confirmed registration."
        action={
          <Link className="button secondary" to="/lookup">
            <ArrowLeft size={16} />
            New lookup
          </Link>
        }
      />
      <Notice type={v ? "success" : "warning"}>{d.message}</Notice>
      {v ? (
        <section className="panel vehicle-result">
          <div className="vehicle-result-heading">
            <div className="vehicle-symbol">
              <CarFront size={38} />
            </div>
            <div>
              <div className="eyebrow">
                {v.isDemo
                  ? "FICTIONAL DEMONSTRATION RECORD"
                  : "VEHICLE DETAILS"}
              </div>
              <h2>
                {[v.make, v.model].filter(Boolean).join(" ") ||
                  "Vehicle record"}
              </h2>
            </div>
            <Badge status={v.authorizationStatus} />
          </div>
          <div className="detail-grid">
            {[
              ["Registration number", v.registrationNumber],
              ["Manufacturer / make", v.make],
              ["Model", v.model],
              ["Vehicle class", v.vehicleClass],
              ["Fuel type", v.fuelType],
              ["Registration status (source claim)", v.registrationStatus],
              ["Registration status source", v.registrationSource],
              ["Application authorization", v.authorizationStatus],
              ["Data source", d.source],
              ["Updated / retrieved", when(v.updatedAt)],
              ["Local owner / reference label", v.ownerLabel],
            ].map(([k, val]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{val || "Not available"}</strong>
              </div>
            ))}
          </div>
          <Notice>
            {v.isDemo
              ? "This record is fictional and exists only for your college demonstration."
              : "Local entries are application records. Any registration status shown must be assessed against its named source."}
          </Notice>
        </section>
      ) : (
        <section className="panel">
          <Empty>No matching local vehicle record was found.</Empty>
          <p>
            The vehicle may exist outside this application's database. No
            authorization or official registration conclusion can be drawn from
            an unmatched lookup.
          </p>
        </section>
      )}
      {!d.localFound && (
        <section className="panel">
          <div className="panel-title">
            <h2>Official lookup</h2>
            <Badge>{d.external.status}</Badge>
          </div>
          <p>
            {d.external.message ||
              "Result returned by the configured provider."}
          </p>
          {d.external.manualLookupUrl && (
            <a
              className="button secondary"
              href={d.external.manualLookupUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open official manual lookup
              <ArrowUpRight size={16} />
            </a>
          )}
        </section>
      )}
      <p className="hint">
        Authorization, registration validity, pending challans and police flags
        are different checks. This application does not certify a vehicle as
        crime-free or challan-free.
      </p>
    </>
  );
}

function LogTable({ logs }) {
  const [open, setOpen] = useState(null);
  return !logs.length ? (
    <Empty>No recognition activity matches these filters.</Empty>
  ) : (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Registration</th>
            <th>Input</th>
            <th>Result source</th>
            <th>Recognition</th>
            <th>Time</th>
            <th>Inspect</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <LogRow
              key={l._id}
              log={l}
              open={open === l._id}
              onToggle={() => setOpen(open === l._id ? null : l._id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
function LogRow({ log: l, open, onToggle }) {
  return (
    <>
      <tr>
        <td className="mono">
          {l.registrationNumber ||
            l.recognizedRegistrationNumber ||
            "No reading"}
        </td>
        <td>{l.inputMethod.replaceAll("_", " ")}</td>
        <td>{l.resultSource}</td>
        <td>
          <Badge status={l.recognitionStatus} />
        </td>
        <td>{when(l.createdAt)}</td>
        <td>
          <button
            className="table-button"
            onClick={onToggle}
            aria-expanded={open}
          >
            {open ? "Close" : "Details"}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6}>
            <div className="log-detail">
              <p>
                <strong>Original OCR:</strong>{" "}
                {l.recognizedRegistrationNumber || "Not available"} ·{" "}
                <strong>Correction:</strong>{" "}
                {l.correctedRegistrationNumber || "None"} ·{" "}
                <strong>OCR score:</strong>{" "}
                {l.confidence == null
                  ? "Not available"
                  : Math.round(l.confidence * 100) + "%"}
              </p>
              <p>
                Local lookup: {l.localLookupResult} · External lookup:{" "}
                {l.externalLookupStatus} · Failure code:{" "}
                {l.failureCode || "None"}
              </p>
              <p>
                Scheduled expiry: {when(l.expiresAt)}. Images are not stored.
              </p>
              {l.candidates?.length > 1 && (
                <p>
                  Detected candidates:{" "}
                  {l.candidates
                    .map((c) => c.registrationNumber || "Unreadable")
                    .join(", ")}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
export function History() {
  const [logs, setLogs] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [filter, setFilter] = useState({ q: "", from: "", to: "" });
  const { user, config } = useAuth();
  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      setLoading(true);
      api("/history?" + new URLSearchParams(filter))
        .then((d) => {
          if (active) {
            setLogs(d.logs);
            setError("");
          }
        })
        .catch((e) => active && setError(e.message))
        .finally(() => active && setLoading(false));
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [filter]);
  return (
    <>
      <PageHeading
        eyebrow="ACTIVITY RECORDS"
        title="Recognition history"
        description={
          user.role === "admin"
            ? "Review recognition and lookup activity across the application."
            : "Review your own recognition attempts and confirmed vehicle lookups."
        }
      />
      <Notice type="error">{error}</Notice>
      <section className="panel">
        <div className="panel-title">
          <h2>Recent activity</h2>
          <span className="hint">
            Up to 200 records · {config?.logRetentionDays || 30}-day retention
          </span>
        </div>
        <div className="filter-bar">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search registration"
              placeholder="Search registration…"
              value={filter.q}
              onChange={(e) => setFilter({ ...filter, q: e.target.value })}
            />
          </label>
          <label>
            From (UTC)
            <input
              type="date"
              value={filter.from}
              onChange={(e) => setFilter({ ...filter, from: e.target.value })}
            />
          </label>
          <label>
            To (UTC)
            <input
              type="date"
              value={filter.to}
              onChange={(e) => setFilter({ ...filter, to: e.target.value })}
            />
          </label>
          <button
            className="secondary"
            onClick={() => setFilter({ q: "", from: "", to: "" })}
          >
            Reset
          </button>
        </div>
        {loading ? (
          <div className="loading">Loading records…</div>
        ) : (
          <LogTable logs={logs} />
        )}
      </section>
    </>
  );
}
export function Dashboard() {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/admin/stats")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Your application at a glance"
        description="Live counts from MongoDB. Recognition history reflects the configured retention window."
        action={
          <Link className="button" to="/admin/vehicles">
            <Plus size={16} />
            Manage vehicles
          </Link>
        }
      />
      <Notice type="error">{error}</Notice>
      <div className="stat-grid">
        {[
          [CarFront, "Registered vehicles", data?.totalVehicles],
          [Activity, "Recognition attempts", data?.totalAttempts],
          [
            CheckCircle2,
            "Successful local lookups",
            data?.successfulLocalLookups,
          ],
          [HelpCircle, "Unmatched locally", data?.unmatched],
        ].map(([Icon, title, value]) => (
          <article className="stat-card" key={title}>
            <div>
              <span>{title}</span>
              <Icon size={18} />
            </div>
            <strong>{value ?? "—"}</strong>
            <small>Application records</small>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Latest activity</h2>
          <Link className="text-link" to="/history">
            View all
            <ArrowUpRight size={15} />
          </Link>
        </div>
        {data ? (
          <LogTable logs={data.recent} />
        ) : (
          <div className="loading">Loading statistics…</div>
        )}
      </section>
      <div className="info-grid">
        <section className="panel">
          <Database className="green" size={25} />
          <h3>One source of local truth</h3>
          <p>
            The registry controls application authorization. Dataset photos are
            never automatically added as authorised vehicles.
          </p>
        </section>
        <section className="panel">
          <ShieldCheck className="green" size={25} />
          <h3>Evidence before a decision</h3>
          <p>
            Users confirm OCR readings. Official status and application
            authorization are displayed as separate fields.
          </p>
        </section>
      </div>
    </>
  );
}
const blank = {
  registrationNumber: "",
  make: "",
  model: "",
  vehicleClass: "",
  fuelType: "",
  registrationStatus: "unknown",
  registrationSource: "Unverified local entry",
  authorizationStatus: "unauthorised",
  ownerLabel: "",
};
export function Vehicles() {
  const [vehicles, setVehicles] = useState([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [editing, setEditing] = useState(null),
    [form, setForm] = useState(blank),
    [busy, setBusy] = useState(false);
  async function load() {
    const d = await api(
      "/admin/vehicles?" + new URLSearchParams({ q, status }),
    );
    setVehicles(d.vehicles);
  }
  useEffect(() => {
    const t = setTimeout(() => load().catch((e) => setError(e.message)), 200);
    return () => clearTimeout(t);
  }, [q, status]);
  function edit(v) {
    setEditing(v?._id || "new");
    setForm(
      v
        ? Object.fromEntries(
            Object.keys(blank).map((k) => [k, v[k] ?? blank[k]]),
          )
        : { ...blank },
    );
    setError("");
    setMessage("");
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/vehicles" + (editing === "new" ? "" : "/" + editing), {
        method: editing === "new" ? "POST" : "PUT",
        body: JSON.stringify(form),
      });
      setEditing(null);
      setMessage("Vehicle record saved.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(v) {
    if (
      !confirm(
        "Delete " +
          v.registrationNumber +
          " from the local registry? Recognition history is retained until its expiry.",
      )
    )
      return;
    try {
      await api("/admin/vehicles/" + v._id, { method: "DELETE" });
      setMessage("Vehicle removed.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="VEHICLE REGISTRY"
        title="Manage application access"
        description="Add local vehicle details and grant or revoke application authorization."
        action={
          <button onClick={() => edit(null)}>
            <Plus size={17} />
            Add vehicle
          </button>
        }
      />
      <Notice type="error">{error}</Notice>
      <Notice type="success">{message}</Notice>
      {editing && (
        <section className="panel edit-panel">
          <div className="panel-title">
            <h2>
              {editing === "new" ? "Add a vehicle" : "Edit vehicle record"}
            </h2>
            <button className="text-button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
          <form onSubmit={save}>
            <div className="form-grid">
              {[
                ["registrationNumber", "Registration number"],
                ["make", "Manufacturer / make"],
                ["model", "Model"],
                ["vehicleClass", "Vehicle class"],
                ["fuelType", "Fuel type"],
                ["ownerLabel", "Owner / reference label"],
                ["registrationSource", "Registration-status source"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                    required={key === "registrationNumber"}
                    maxLength={
                      key === "registrationNumber"
                        ? 30
                        : key === "registrationSource"
                          ? 200
                          : 80
                    }
                  />
                </label>
              ))}
              <label>
                Registration status (local claim)
                <select
                  value={form.registrationStatus}
                  onChange={(e) =>
                    setForm({ ...form, registrationStatus: e.target.value })
                  }
                >
                  {["unknown", "active", "expired", "suspended"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Application authorization
                <select
                  value={form.authorizationStatus}
                  onChange={(e) =>
                    setForm({ ...form, authorizationStatus: e.target.value })
                  }
                >
                  {["authorised", "unauthorised", "blacklisted"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="hint">
              Local registration-status entries are not independently verified.
              Record the actual source, or keep status unknown.
            </p>
            <button disabled={busy}>{busy ? "Saving…" : "Save vehicle"}</button>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="filter-bar">
          <label className="search-field">
            <Search size={16} />
            <input
              placeholder="Search registration…"
              aria-label="Search registry"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            aria-label="Authorization filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All authorization statuses</option>
            {["authorised", "unauthorised", "blacklisted"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {vehicles.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Vehicle</th>
                  <th>Authorization</th>
                  <th>Source</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v._id}>
                    <td className="mono">{v.registrationNumber}</td>
                    <td>
                      {[v.make, v.model].filter(Boolean).join(" ") ||
                        "Not available"}
                    </td>
                    <td>
                      <Badge status={v.authorizationStatus} />
                    </td>
                    <td>{v.dataSource}</td>
                    <td>{when(v.updatedAt)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-button"
                          title={"Edit " + v.registrationNumber}
                          onClick={() => edit(v)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button danger"
                          title={"Delete " + v.registrationNumber}
                          onClick={() => remove(v)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            No local vehicles match. Add a record or run the fictional seed
            script.
          </Empty>
        )}
      </section>
    </>
  );
}
export function Profile() {
  const { user, config } = useAuth();
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT"
        title="Your profile"
        description="Account details and data-handling settings."
      />
      <section className="panel profile-panel">
        <div className="detail-grid">
          {[
            ["Name", user.name],
            ["Email", user.email],
            ["Role", user.role],
            ["Image storage", "None — in-memory processing"],
            ["History retention", (config?.logRetentionDays || 30) + " days"],
            [
              "Official lookup",
              config?.officialLookupConfigured
                ? "Provider configured"
                : "Unavailable — no approved provider configured",
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <p className="hint">
          Use Sign out in the navigation to end this browser session.
        </p>
      </section>
    </>
  );
}
