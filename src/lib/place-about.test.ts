import { describe, expect, it } from "vitest";

import { aboutFromNominatim, formatOpeningHours, googleMapsSearchUrl, nearestMatch, parseWikipediaTag, safePhone, safeWebUrl } from "@/lib/place-about";

const result = (lat: string, lon: string, extra = {}) => ({ lat, lon, display_name: "Somewhere", ...extra });

describe("public place details", () => {
  it("shows only plain web links, adding https when a site omits it", () => {
    expect(safeWebUrl("https://intramuros.gov.ph")).toBe("https://intramuros.gov.ph/");
    expect(safeWebUrl("www.example.ph; https://second.example")).toBe("https://www.example.ph/");
    expect(safeWebUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeWebUrl("not a site")).toBeUndefined();
    expect(safeWebUrl(undefined)).toBeUndefined();
  });

  it("accepts real phone numbers only", () => {
    expect(safePhone("+63 2 8527 2961")).toBe("+63 2 8527 2961");
    expect(safePhone("call us!")).toBeUndefined();
  });

  it("matches only a result near the saved pin", () => {
    const near = result("14.5906", "120.9752");
    const far = result("14.70", "121.10");
    expect(nearestMatch([far, near], 14.5904, 120.9750)).toBe(near);
    expect(nearestMatch([far], 14.5904, 120.9750)).toBeUndefined();
  });

  it("reads website, phone, hours, and the OpenStreetMap page from tags", () => {
    const about = aboutFromNominatim(result("14.59", "120.97", {
      osm_type: "way", osm_id: 123,
      extratags: { website: "intramuros.gov.ph", phone: "+63 2 8527 2961", opening_hours: "Tu-Su 08:00-17:00", wikipedia: "en:Intramuros" },
    }));
    expect(about).toEqual({
      website: "https://intramuros.gov.ph/",
      phone: "+63 2 8527 2961",
      openingHours: "Tu-Su 08:00-17:00",
      osmUrl: "https://www.openstreetmap.org/way/123",
      wikipediaTag: "en:Intramuros",
    });
  });

  it("parses Wikipedia tags without letting the language become an arbitrary host", () => {
    expect(parseWikipediaTag("en:Intramuros")).toEqual({ lang: "en", title: "Intramuros" });
    expect(parseWikipediaTag("Ayala Triangle Gardens")).toEqual({ lang: "en", title: "Ayala Triangle Gardens" });
    expect(parseWikipediaTag("evil.example/x:Title")).toEqual({ lang: "en", title: "evil.example/x:Title" });
    expect(parseWikipediaTag("")).toBeNull();
  });

  it("turns OpenStreetMap opening hours into plain English", () => {
    expect(formatOpeningHours("Mo-Su 09:00-18:00")).toBe("Mon–Sun 09:00–18:00");
    expect(formatOpeningHours("Mo-Fr 08:00-17:00; Sa 10:00-16:00")).toBe("Mon–Fri 08:00–17:00 · Sat 10:00–16:00");
    expect(formatOpeningHours("24/7")).toBe("Open 24 hours");
  });

  it("links to the place on Google Maps for reviews", () => {
    expect(googleMapsSearchUrl("Luna Café", "Makati")).toBe("https://www.google.com/maps/search/?api=1&query=Luna%20Caf%C3%A9%20Makati");
  });
});
