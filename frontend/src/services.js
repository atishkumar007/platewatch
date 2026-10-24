const base = import.meta.env.VITE_API_BASE || "";
export async function api(path, options = {}) {
  const response = await fetch(base + "/api" + path, {
    credentials: "include",
    signal: AbortSignal.timeout(100000),
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Server returned an invalid response." }));
  if (!response.ok)
    throw Object.assign(new Error(data.error || "Request failed."), {
      status: response.status,
      data,
    });
  return data;
}
export const post = (path, data) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
export const normalise = (value) => value.toUpperCase().replace(/[\s-]/g, "");
export const when = (value) =>
  value ? new Date(value).toLocaleString() : "Not available";
