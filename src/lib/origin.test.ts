import { describe, expect, it } from "vitest";

import { isSameOriginRequest } from "@/lib/origin";

const request = (headers: Record<string, string>, internalHost = "localhost:3000") =>
  ({ headers: new Headers(headers), nextUrl: { host: internalHost } });

describe("isSameOriginRequest", () => {
  it("accepts a browser write to the host it is on, even when the server knows itself as localhost", () => {
    expect(isSameOriginRequest(request({ origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" }))).toBe(true);
  });

  it("accepts writes through the HTTPS proxy", () => {
    expect(isSameOriginRequest(request({
      origin: "https://places.example.com",
      host: "127.0.0.1:3000",
      "x-forwarded-host": "places.example.com",
      "x-forwarded-proto": "https",
    }))).toBe(true);
  });

  it("rejects another site, a missing origin, and a malformed origin", () => {
    expect(isSameOriginRequest(request({ origin: "https://evil.example", host: "places.example.com" }))).toBe(false);
    expect(isSameOriginRequest(request({ host: "places.example.com" }))).toBe(false);
    expect(isSameOriginRequest(request({ origin: "not a url", host: "places.example.com" }))).toBe(false);
  });

  it("uses the first host when a proxy chain lists several", () => {
    expect(isSameOriginRequest(request({ origin: "https://places.example.com", "x-forwarded-host": "places.example.com, internal:3000" }))).toBe(true);
  });
});
