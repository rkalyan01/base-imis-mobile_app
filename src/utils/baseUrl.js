// The API base URL is read at startup from a small JSON file hosted online
// ({"base_url": "https://.../", "version": 1}), so the server can be moved
// without shipping a new app.

// Hosts the app may talk to. The config file is fetched from a third-party site,
// so a URL pointing anywhere else is ignored rather than trusted: the app sends
// passwords and tokens to this host.
const ALLOWED_HOST_SUFFIX = "innovativesolution.com.np";

// Returns the URL without a trailing slash, or null if it is missing, not
// https, or not on an allowed host.
export const normalizeBaseUrl = (raw) => {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^https:\/\/([a-z0-9.-]+)(:\d+)?\/*$/i);
  if (!match) return null;
  const host = match[1].toLowerCase();
  if (host !== ALLOWED_HOST_SUFFIX && !host.endsWith(`.${ALLOWED_HOST_SUFFIX}`)) {
    return null;
  }
  return `https://${host}${match[2] ?? ""}`;
};

const fetchJson = async (fetchFn, url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

// Picks the base URL: the online config if it answers in time, otherwise the
// last good value saved on the phone, otherwise the build's built-in URL.
// `changed` is true when the online config names a different server than the
// one used last time, so the caller can drop the old server's login.
export const resolveBaseUrl = async ({
  configUrl,
  fallback,
  storage,
  storageKey = "remoteBaseUrl",
  fetchFn = fetch,
  timeoutMs = 5000,
}) => {
  let saved = null;
  try {
    saved = normalizeBaseUrl(await storage.getItem(storageKey));
  } catch (e) {
    // Storage unreadable: treat as nothing saved.
  }
  const builtIn = normalizeBaseUrl(fallback) ?? fallback ?? "";
  const previous = saved ?? builtIn;

  if (configUrl) {
    try {
      const json = await fetchJson(fetchFn, configUrl, timeoutMs);
      const url = normalizeBaseUrl(json?.base_url);
      if (url) {
        await Promise.resolve(storage.setItem(storageKey, url)).catch(() => {});
        return { url, source: "remote", changed: url !== previous };
      }
    } catch (e) {
      // Offline, slow or bad file: fall through to the saved value.
      console.log("Server config not loaded:", e?.message ?? e);
    }
  }

  if (saved) return { url: saved, source: "saved", changed: false };
  return { url: builtIn, source: "built-in", changed: false };
};
