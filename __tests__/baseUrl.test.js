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

  it("treats a value without a scheme as https", () => {
    expect(normalizeBaseUrl("imis.muninfosys.com/")).toBe("https://imis.muninfosys.com");
  });

  it("accepts every allowed domain and its subdomains", () => {
    expect(normalizeBaseUrl("https://muninfosys.com")).toBe("https://muninfosys.com");
    expect(normalizeBaseUrl("https://a.b.innovativesolution.com.np")).toBe(
      "https://a.b.innovativesolution.com.np"
    );
  });

  it("rejects http, other schemes, other hosts, look-alike hosts and paths", () => {
    expect(normalizeBaseUrl("http://imis.innovativesolution.com.np/")).toBeNull();
    expect(normalizeBaseUrl("ftp://imis.muninfosys.com/")).toBeNull();
    expect(normalizeBaseUrl("https://evil.example.com/")).toBeNull();
    expect(normalizeBaseUrl("evil.example.com/")).toBeNull();
    expect(normalizeBaseUrl("https://innovativesolution.com.np.evil.com/")).toBeNull();
    expect(normalizeBaseUrl("https://evilinnovativesolution.com.np/")).toBeNull();
    expect(normalizeBaseUrl("https://fakemuninfosys.com/")).toBeNull();
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
      storageKey: "k",
      fetchFn: okFetch({ base_url: "imis.muninfosys.com/", version: 1 }),
    });
    expect(result).toEqual({ url: "https://imis.muninfosys.com", source: "remote" });
    expect(storage.data.k).toBe("https://imis.muninfosys.com");
  });

  it("falls back to the saved value when offline", async () => {
    const result = await resolveBaseUrl({
      configUrl: "https://cfg",
      fallback: "https://built-in.innovativesolution.com.np",
      storage: memoryStorage({ k: "https://saved.innovativesolution.com.np" }),
      storageKey: "k",
      fetchFn: failFetch,
    });
    expect(result).toEqual({ url: "https://saved.innovativesolution.com.np", source: "saved" });
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

  it("uses the fallback when nothing else works", async () => {
    const result = await resolveBaseUrl({
      configUrl: "https://cfg",
      fallback: "https://built-in.innovativesolution.com.np",
      storage: memoryStorage(),
      fetchFn: async () => ({ ok: false, status: 404 }),
    });
    expect(result).toEqual({ url: "https://built-in.innovativesolution.com.np", source: "built-in" });
  });

  it("returns an empty URL when there is no safe fallback", async () => {
    const result = await resolveBaseUrl({
      configUrl: "https://cfg",
      fallback: "",
      storage: memoryStorage(),
      fetchFn: failFetch,
    });
    expect(result).toEqual({ url: "", source: "built-in" });
  });
});
