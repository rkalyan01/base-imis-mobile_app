// The API base URL is read at startup from a small JSON file hosted online
// ({"base_url": "https://.../", "version": 1}), so the server can be moved
// without shipping a new app.

// Domains the app may talk to (a domain or any of its subdomains). The config
// file is fetched from a third-party site, so a URL pointing anywhere else is
// ignored rather than trusted: the app sends passwords and tokens to this host.
const ALLOWED_DOMAINS = ["innovativesolution.com.np", "muninfosys.com"];

// Returns "https://host[:port]" with no trailing slash, or null if the value is
// missing, uses another scheme (http is refused) or is not on an allowed domain.
// A value without a scheme ("imis.example.com/") is treated as https.
export const normalizeBaseUrl = (raw) => {
  if (typeof raw !== "string") return null;
  let value = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;
  const match = value.match(/^https:\/\/([a-z0-9.-]+)(:\d+)?\/*$/i);
  if (!match) return null;
  const host = match[1].toLowerCase();
  const allowed = ALLOWED_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
  return allowed ? `https://${host}${match[2] ?? ""}` : null;
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
// last good value saved on the phone for this config, otherwise `fallback`
// (may be empty when there is no safe default).
export const resolveBaseUrl = async ({
  configUrl,
  fallback,
  storage,
  storageKey = "remoteBaseUrl",
  fetchFn = fetch,
  timeoutMs = 8000,
}) => {
  if (configUrl) {
    try {
      const json = await fetchJson(fetchFn, configUrl, timeoutMs);
      const url = normalizeBaseUrl(json?.base_url);
      if (url) {
        await Promise.resolve(storage.setItem(storageKey, url)).catch(() => {});
        return { url, source: "remote" };
      }
      console.log("Server config has no allowed base_url:", json?.base_url);
    } catch (e) {
      // Offline, slow or bad file: fall through to the saved value.
      console.log("Server config not loaded:", e?.message ?? e);
    }
  }

  try {
    const saved = normalizeBaseUrl(await storage.getItem(storageKey));
    if (saved) return { url: saved, source: "saved" };
  } catch (e) {
    // Storage unreadable: use the fallback.
  }

  return { url: normalizeBaseUrl(fallback) ?? "", source: "built-in" };
};
