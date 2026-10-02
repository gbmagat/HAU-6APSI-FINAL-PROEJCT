import { describe, expect, it } from "vitest";

import { distanceKm, formatDistance, sortByDistance } from "@/lib/geo";

const manila = { latitude: 14.5995, longitude: 120.9842 };
const makati = { latitude: 14.5547, longitude: 121.0244 };
const sanFernando = { latitude: 15.0286, longitude: 120.6898 };
const tokyo = { latitude: 35.6762, longitude: 139.6503 };

describe("distanceKm (Haversine)", () => {
  it("measures known distances on the Earth's surface", () => {
    expect(distanceKm(manila, manila)).toBe(0);
    expect(distanceKm(manila, makati)).toBeCloseTo(6.6, 0);
    expect(distanceKm(manila, sanFernando)).toBeCloseTo(57, -1);
    expect(distanceKm(manila, tokyo)).toBeCloseTo(3000, -2);
  });

  it("is the same in both directions", () => {
    expect(distanceKm(makati, tokyo)).toBeCloseTo(distanceKm(tokyo, makati), 9);
  });
});

describe("formatDistance", () => {
  it("uses metres up close and kilometres further out", () => {
    expect(formatDistance(0.004)).toBe("10 m");
    expect(formatDistance(0.648)).toBe("650 m");
    expect(formatDistance(2.34)).toBe("2.3 km");
    expect(formatDistance(48.4)).toBe("48 km");
    expect(formatDistance(2998.6)).toBe("2,999 km");
  });
});

describe("sortByDistance", () => {
  const places = [{ name: "Tokyo", ...tokyo }, { name: "San Fernando", ...sanFernando }, { name: "Makati", ...makati }];

  it("puts the nearest place first and adds each distance", () => {
    const sorted = sortByDistance(places, manila);
    expect(sorted.map((place) => place.name)).toEqual(["Makati", "San Fernando", "Tokyo"]);
    expect(sorted[0].distanceKm).toBeCloseTo(6.6, 0);
  });

  it("changes the nearest when the pin moves", () => {
    expect(sortByDistance(places, { latitude: 15.03, longitude: 120.69 })[0].name).toBe("San Fernando");
  });

  it("keeps the original order without a pinned location", () => {
    expect(sortByDistance(places, null)).toBe(places);
  });
});
