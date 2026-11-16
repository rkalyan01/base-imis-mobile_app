import { describe, expect, it } from "@jest/globals";
import { formatWmsUrl, joinWmsUrl, mergeWmsLinks, wmsProxyUrl } from "../src/utils/wmsUrl";

describe("joinWmsUrl", () => {
  const link = "wms?SERVICE=WMS&LAYERS=imis_base%3Abuildings_layer";

  it("adds the missing slash (staging: baseUrl without trailing slash -> HTTP 403)", () => {
    expect(
      joinWmsUrl("https://geoserver-staging.innovativesolution.com.np/geoserver/imis_base", link)
    ).toBe("https://geoserver-staging.innovativesolution.com.np/geoserver/imis_base/wms?SERVICE=WMS&LAYERS=imis_base%3Abuildings_layer");
  });

  it("does not double the slash when the base already ends with one", () => {
    expect(joinWmsUrl("https://gs.example/geoserver/ws/", "/" + link)).toBe(
      "https://gs.example/geoserver/ws/" + link
    );
  });

  it("keeps an already absolute link", () => {
    expect(joinWmsUrl("https://ignored", "https://gs.example/wms?x=1")).toBe("https://gs.example/wms?x=1");
  });

  it("returns an empty string when a part is missing", () => {
    expect(joinWmsUrl("https://gs.example", undefined)).toBe("");
    expect(joinWmsUrl(undefined, link)).toBe("");
  });
});

describe("wmsProxyUrl", () => {
  const api = "https://imis.example/api";
  const query = "SERVICE=WMS&LAYERS=imis_base%3Abuildings_layer&BBOX={minX},{minY},{maxX},{maxY}";

  it("sends a direct GeoServer link through the API proxy, keeping the tile placeholders", () => {
    expect(wmsProxyUrl(api, `https://gs.example/geoserver/ws/wms?${query}`)).toBe(
      `${api}/gis/wms?${query}`
    );
  });

  it("does not double the path when the backend already returns the proxy", () => {
    expect(wmsProxyUrl(`${api}/`, `${api}/gis/wms/wms?${query}`)).toBe(`${api}/gis/wms?${query}`);
  });

  it("returns an empty string for a missing link or one without a query", () => {
    expect(wmsProxyUrl(api, "")).toBe("");
    expect(wmsProxyUrl(api, undefined)).toBe("");
    expect(wmsProxyUrl(api, "https://gs.example/wms")).toBe("");
  });
});

describe("mergeWmsLinks", () => {
  const link = (layer, style) =>
    `https://gs.example/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=imis_base:${layer}&STYLES=imis_base:${style}&FORMAT=image/png&BBOX={minX},{minY},{maxX},{maxY}`;

  it("puts every layer in one request, first layer at the bottom", () => {
    const merged = mergeWmsLinks([
      link("buildings_layer", "buildings_layer_none"),
      link("roadlines_layer", "roadlines_layer_width"),
    ]);
    expect(merged).toBe(
      "https://gs.example/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=imis_base:buildings_layer,imis_base:roadlines_layer&STYLES=imis_base:buildings_layer_none,imis_base:roadlines_layer_width&FORMAT=image/png&BBOX={minX},{minY},{maxX},{maxY}",
    );
  });

  it("skips hidden layers", () => {
    expect(mergeWmsLinks([false, link("wards_layer", "wards_layer_none"), null])).toBe(
      link("wards_layer", "wards_layer_none"),
    );
  });

  it("keeps the layer and style counts equal when a link has no STYLES", () => {
    const merged = mergeWmsLinks([
      "https://gs.example/wms?LAYERS=imis_base:wards_layer",
      link("roadlines_layer", "roadlines_layer_width"),
    ]);
    expect(merged).toContain("LAYERS=imis_base:wards_layer,imis_base:roadlines_layer");
    expect(merged).toContain("STYLES=,imis_base:roadlines_layer_width");
  });

  it("returns an empty string when nothing is visible", () => {
    expect(mergeWmsLinks([false, null, ""])).toBe("");
    expect(mergeWmsLinks(undefined)).toBe("");
  });
});

describe("formatWmsUrl", () => {
  // Shape of a GeoServer layer-preview link, as stored in wms_links
  const preview =
    "wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=imis_base%3Abuildings_layer&STYLES=imis_base%3Abuildings_layer_none&CRS=EPSG:32645&WIDTH=768&HEIGHT=330&BBOX=336148,3058457,343218,3064532";

  it("replaces fixed tile values with per-tile placeholders in Web Mercator", () => {
    expect(formatWmsUrl(preview)).toBe(
      "wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=imis_base%3Abuildings_layer&STYLES=imis_base%3Abuildings_layer_none&CRS=EPSG:900913&WIDTH={width}&HEIGHT={height}&BBOX={minX},{minY},{maxX},{maxY}",
    );
  });

  it("adds the placeholders when the link has none", () => {
    expect(formatWmsUrl("wms?SERVICE=WMS&LAYERS=imis_base%3Awards_layer")).toBe(
      "wms?SERVICE=WMS&LAYERS=imis_base%3Awards_layer&BBOX={minX},{minY},{maxX},{maxY}&WIDTH={width}&HEIGHT={height}",
    );
  });

  it("leaves an already formatted link unchanged", () => {
    const once = formatWmsUrl(preview);
    expect(formatWmsUrl(once)).toBe(once);
  });

  it("formats a merged link without losing a layer", () => {
    const merged = formatWmsUrl(
      mergeWmsLinks([preview, preview.replace(/buildings_layer/g, "wards_layer")]),
    );
    expect(merged).toContain("LAYERS=imis_base%3Abuildings_layer,imis_base%3Awards_layer");
    expect(merged).toContain("BBOX={minX},{minY},{maxX},{maxY}");
  });

  it("returns an empty link unchanged", () => {
    expect(formatWmsUrl("")).toBe("");
  });
});
