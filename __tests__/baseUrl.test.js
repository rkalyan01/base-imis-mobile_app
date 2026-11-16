import { normalizeBaseUrl, resolveBaseUrl } from "../src/utils/baseUrl";

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: async (k) => data[k] ?? null,
    setItem: async (k, v) => {
      data[k] = v;
    },
  };
};

const okFetch = (body) => async () => ({ ok: true, json: async () => body });
const failFetch = async () => {
  throw new Error("offline");
};

describe("normalizeBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeBaseUrl("https://imis.innovativesolution.com.np/")).toBe(
      "https://imis.innovativesolution.com.np"
    );
    expect(normalizeBaseUrl(" https://imis-base-staging.innovativesolution.com.np ")).toBe(
      "https://imis-base-staging.innovativesolution.com.np"
    );
  });

  it("rejects http, other hosts, look-alike hosts and paths", () => {
    expect(normalizeBaseUrl("http://imis.innovativesolution.com.np/")).toBeNull();
    expect(normalizeBaseUrl("https://evil.example.com/")).toBeNull();
    expect(normalizeBaseUrl("https://innovativesolution.com.np.evil.com/")).toBeNull();
    expect(normalizeBaseUrl("https://evilinnovativesolution.com.np/")).toBeNull();
    expect(normalizeBaseUrl("https://imis.innovativesolution.com.np/api")).toBeNull();
    expect(normalizeBaseUrl("https://user@imis.innovativesolution.com.np/")).toBeNull();
    expect(normalizeBaseUrl(undefined)).toBeNull();
  });
});

describe("resolveBaseUrl", () => {
  it("uses the online config and saves it", async () => {
    const storage = memoryStorage();
    const result = await resolveBaseUrl({
      configUrl: "https://cfg",
      fallback: "https://old.innovativesolution.com.np",
      storage,
      fetchFn: okFetch({ base_url: "https://imis.innovativesolution.com.np/", version: 1 }),
    });
    expect(result).toEqual({
      url: "https://imis.innovativesolution.com.np",
      source: "remote",
      changed: true,
    });
    expect(storage.data.remoteBaseUrl).toBe("https://imis.innovativesolution.com.np");
  });

  it("reports no change when the server is the same as last time", async () => {
    const result = await resolveBaseUrl({
      configUrl: "https://cfg",
      fallback: "https://old.innovativesolution.com.np",
      storage: memoryStorage({ remoteBaseUrl: "https://imis.innovativesolution.com.np" }),
      fetchFn: okFetch({ base_url: "https://imis.innovativesolution.com.np/" }),
    });
    expect(result.changed).toBe(false);
  });

  it("reports no change on first run when the config matches the built-in URL", async () => {
    const result = await resolveBaseUrl({
      configUrl: "https://cfg",
      fallback: "https://imis.innovativesolution.com.np/",
      storage: memoryStorage(),
      fetchFn: okFetch({ base_url: "https://imis.innovativesolution.com.np/" }),
    });
    expect(result.changed).toBe(false);
  });

  it("falls back to the saved value when offline", async () => {
    const result = await resolveBaseUrl({
      configUrl: "https://cfg",
      fallback: "https://built-in.innovativesolution.com.np",
      storage: memoryStorage({ remoteBaseUrl: "https://saved.innovativesolution.com.np" }),
      fetchFn: failFetch,
    });
    expect(result).toEqual({ url: "https://saved.innovativesolution.com.np", source: "saved", changed: false });
  });

  it("ignores a config pointing at a host that is not allowed", async () => {
    const storage = memoryStorage();
    const result = await resolveBaseUrl({
      configUrl: "https://cfg",
      fallback: "https://built-in.innovativesolution.com.np",
      storage,
      fetchFn: okFetch({ base_url: "https://evil.example.com/" }),
    });
    expect(result.source).toBe("built-in");
    expect(storage.data.remoteBaseUrl).toBeUndefined();
  });

  it("uses the built-in URL when nothing else works", async () => {
    const result = await resolveBaseUrl({
      configUrl: "https://cfg",
      fallback: "https://built-in.innovativesolution.com.np",
      storage: memoryStorage(),
      fetchFn: async () => ({ ok: false, status: 404 }),
    });
    expect(result).toEqual({ url: "https://built-in.innovativesolution.com.np", source: "built-in", changed: false });
  });
});
