const BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const KEY = "small-shop-session";

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveSession(value) {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      ...value,
      expires_at: Date.now() + (value.expires_in || 3600) * 1000,
    }),
  );
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}

export function updateSessionUser(user) {
  const session = getSession();
  if (session) sessionStorage.setItem(KEY, JSON.stringify({ ...session, user }));
}

export async function api(
  path,
  { method = "GET", body, signal, raw = false, publicRequest = false } = {},
) {
  const session = getSession();
  const headers = {};
  const isForm = body instanceof FormData;
  if (body && !isForm) headers["Content-Type"] = "application/json";
  if (!publicRequest && session?.access_token)
    headers.Authorization = `Bearer ${session.access_token}`;
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Could not reach the API. Check that the Python backend is running.",
    );
  }
  if (response.status === 401 && !publicRequest) {
    clearSession();
    window.dispatchEvent(new Event("session-expired"));
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = Array.isArray(data.detail)
      ? data.detail
          .map((item) => `${item.loc?.slice(1).join(" ")}: ${item.msg}`)
          .join("; ")
      : data.detail;
    throw new Error(detail || `Request failed (${response.status})`);
  }
  if (raw) return response.blob();
  if (response.status === 204) return null;
  return response.json();
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
